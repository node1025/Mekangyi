const { isObjectIdOrHexString } = require('../models/mariaSchema');
const Board = require('../models/board');
const Comment = require('../models/comment');
const { literalSearch } = require('../utils/input');

const categories = ['free', 'qna', 'notice', 'event'];
const adminCategory = category => ['notice', 'event'].includes(category);
const authorIdOf = post => {
  if (!post) return '';
  const plain = typeof post.toObject === 'function' ? post.toObject() : post;
  const a = plain.author;
  if (a == null) return '';
  if (typeof a === 'object') return String(a._id ?? a.id ?? '');
  return String(a);
};
const isOwner = (post, user) => {
  const uid = user?.id != null ? String(user.id) : '';
  const aid = authorIdOf(post);
  return Boolean(uid && aid && uid === aid);
};
const canManage = (post, user, verified) => (user?.role === 'admin' && verified) || (isOwner(post, user) && !adminCategory(post.category));
const canRead = (post, user, verified) => !post.isPrivate || isOwner(post, user) || (user?.role === 'admin' && verified);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const replyError = (res, error) => res.status(error.status || (error.name === 'ValidationError' ? 400 : 500))
  .json({ message: error.status ? error.message : error.name === 'ValidationError' ? '게시글 입력값을 확인해주세요.' : '게시글 처리에 실패했습니다.' });

function fields(body = {}, previous) {
  const prev = previous && typeof previous.toObject === 'function' ? previous.toObject() : previous;
  const result = {};
  for (const [key, max] of [['title', 100], ['content', 10000]]) {
    const value = body[key] === undefined ? prev?.[key] : body[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw fail(`${key === 'title' ? '제목은 100자' : '내용은 10,000자'} 이내로 입력해주세요.`);
    result[key] = value.trim();
  }
  result.category = body.category ?? prev?.category ?? 'free';
  if (!categories.includes(result.category)) throw fail('게시판 카테고리가 올바르지 않습니다.');
  const privacy = body.isPrivate ?? prev?.isPrivate ?? false;
  if (![true, false, 'true', 'false'].includes(privacy)) throw fail('비밀글 설정이 올바르지 않습니다.');
  result.isPrivate = privacy === true || privacy === 'true';
  return result;
}

async function loadPost(id) {
  if (!isObjectIdOrHexString(id)) throw fail('게시글 번호가 올바르지 않습니다.');
  const post = await Board.findById(id);
  if (!post) throw fail('게시글을 찾을 수 없습니다.', 404);
  return post;
}

exports.createPost = async (req, res) => {
  try {
    const data = fields(req.body);
    if (adminCategory(data.category) && req.user.role !== 'admin') throw fail('공지사항과 이벤트는 관리자만 작성할 수 있습니다.', 403);
    const post = await Board.create({ ...data, author: req.user.id, imageUrl: req.file?.path || null });
    res.status(201).json({ message: '게시글이 등록되었습니다.', post });
  } catch (error) { replyError(res, error); }
};

exports.getPosts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger((page - 1) * limit)) throw fail('페이지와 조회 개수를 확인해주세요.');
    const query = {};
    if (category) {
      if (!categories.includes(category)) throw fail('게시판 카테고리가 올바르지 않습니다.');
      query.category = category;
    }
    if (search !== undefined) {
      const keyword = literalSearch(search);
      if (keyword === null) throw fail('검색어는 100자 이내의 문자열이어야 합니다.');
      query.title = { $regex: keyword, $options: 'i' };
    }
    // Lists must never return private bodies or attachments.
    const posts = await Board.find(query).select('title category author views isPrivate createdAt updatedAt')
      .populate('author', 'name userId').sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit);
    const total = await Board.countDocuments(query);
    res.json({ posts, total, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (error) { replyError(res, error); }
};

exports.getPostDetail = async (req, res) => {
  try {
    const post = await loadPost(req.params.id);
    if (!canRead(post, req.user, req.adminVerified)) throw fail('비밀글은 작성자와 관리자만 볼 수 있습니다.', 403);
    await Board.updateOne({ _id: post._id }, { $inc: { views: 1 } });
    post.views += 1;
    await post.populate('author', 'name userId');
    if (post.isPrivate) res.set('Cache-Control', 'no-store');
    res.json({ post });
  } catch (error) { replyError(res, error); }
};

// Run before uploading so another member cannot upload files against this post.
exports.authorizeManage = async (req, res, next) => {
  try {
    const post = await loadPost(req.params.id);
    if (!canManage(post, req.user, req.adminVerified)) throw fail('이 게시글을 변경할 권한이 없습니다.', 403);
    req.boardPost = post;
    next();
  } catch (error) { replyError(res, error); }
};

exports.updatePost = async (req, res) => {
  try {
    const post = req.boardPost || await loadPost(req.params.id);
    if (!canManage(post, req.user, req.adminVerified)) throw fail('수정 권한이 없습니다.', 403);
    const data = fields(req.body, post);
    if (adminCategory(data.category) && req.user.role !== 'admin') throw fail('공지사항과 이벤트는 관리자만 작성할 수 있습니다.', 403);
    for (const [key, val] of Object.entries(data)) post.set(key, val);
    if (req.file) post.imageUrl = req.file.path;
    await post.save();
    res.json({ message: '수정 완료', post });
  } catch (error) { replyError(res, error); }
};

exports.deletePost = async (req, res) => {
  try {
    const post = req.boardPost || await loadPost(req.params.id);
    if (!canManage(post, req.user, req.adminVerified)) throw fail('삭제 권한이 없습니다.', 403);
    await Board.findByIdAndDelete(post._id);
    res.json({ message: '삭제 완료' });
  } catch (error) { replyError(res, error); }
};

exports.addComment = async (req, res) => {
  try {
    const post = await loadPost(req.params.id);
    if (!canRead(post, req.user, req.adminVerified)) throw fail('비밀글은 작성자와 관리자만 볼 수 있습니다.', 403);
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.trim().length > 2000) throw fail('댓글은 2,000자 이내로 입력해주세요.');
    const comment = await Comment.create({ boardId: post._id, author: req.user.id, content: content.trim() });
    res.status(201).json({ message: '댓글 등록 성공', comment });
  } catch (error) { replyError(res, error); }
};

