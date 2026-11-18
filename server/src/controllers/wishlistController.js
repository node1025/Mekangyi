const Wishlist = require('../models/wishlist');
const Product = require('../models/product/product');
const ProductVariant = require('../models/product/productvariant');
const { isObjectIdOrHexString } = require('../models/mariaSchema');
const { enrichProductForResponse } = require('../utils/productPricing');
const { sortVariants } = require('../utils/variantOrder');

async function findSellableProduct(productId) {
  return Product.findOne({ _id: productId, isDeleted: false, status: '판매중' });
}

function itemHasProduct(items, productId) {
  return items.some((row) => row.productId.toString() === productId);
}

// [GET] 내 찜 목록
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id }).populate('items.productId');
    if (!wishlist) return res.status(200).json({ items: [] });

    const payload = wishlist.toObject();
    const visible = payload.items.filter((row) => row.productId && typeof row.productId === 'object' && !row.productId.isDeleted);
    const productIds = visible.map((row) => row.productId._id);
    const variants = productIds.length
      ? await ProductVariant.find({ productId: { $in: productIds }, isDeleted: false }).lean()
      : [];
    payload.items = visible.map((row) => {
      const product = enrichProductForResponse(row.productId);
      const ordered = sortVariants(
        product.productCode,
        variants.filter((variant) => String(variant.productId) === String(product._id))
      );
      product.thumbnail = ordered[0]?.images?.thumbnail || '';
      row.productId = product;
      return row;
    });

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ message: '찜 목록 조회에 실패했습니다.' });
  }
};

// [GET] 상품 찜 여부
exports.getWishStatus = async (req, res) => {
  const { productId } = req.params;
  if (!isObjectIdOrHexString(productId)) {
    return res.status(400).json({ message: '올바른 상품 ID가 아닙니다.' });
  }
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id });
    const wished = wishlist ? itemHasProduct(wishlist.items, productId) : false;
    res.status(200).json({ wished });
  } catch (error) {
    res.status(500).json({ message: '찜 상태 조회에 실패했습니다.' });
  }
};

// [POST] 찜 토글
exports.toggleWishlist = async (req, res) => {
  const { productId } = req.body;
  if (!isObjectIdOrHexString(productId)) {
    return res.status(400).json({ message: '찜할 상품을 확인해주세요.' });
  }
  const userId = req.user.id;

  try {
    const product = await findSellableProduct(productId);
    if (!product) {
      return res.status(404).json({ message: '찜할 수 없는 상품입니다.' });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, items: [{ productId }] });
      return res.status(201).json({ wished: true, productId });
    }

    const existingIndex = wishlist.items.findIndex(
      (row) => row.productId.toString() === productId
    );

    if (existingIndex > -1) {
      wishlist.items.splice(existingIndex, 1);
      await wishlist.save();
      return res.status(200).json({ wished: false, productId });
    }

    wishlist.items.push({ productId });
    await wishlist.save();
    return res.status(200).json({ wished: true, productId });
  } catch (error) {
    res.status(500).json({ message: '찜 처리에 실패했습니다.' });
  }
};

// [DELETE] 찜 해제
exports.removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  if (!isObjectIdOrHexString(productId)) {
    return res.status(400).json({ message: '올바른 상품 ID가 아닙니다.' });
  }
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id });
    if (!wishlist) return res.status(404).json({ message: '찜 목록이 없습니다.' });

    const before = wishlist.items.length;
    wishlist.items = wishlist.items.filter((row) => row.productId.toString() !== productId);
    if (wishlist.items.length === before) {
      return res.status(404).json({ message: '찜 목록에서 상품을 찾을 수 없습니다.' });
    }
    await wishlist.save();
    res.status(200).json({ message: '찜을 해제했습니다.', productId });
  } catch (error) {
    res.status(500).json({ message: '찜 해제에 실패했습니다.' });
  }
};
