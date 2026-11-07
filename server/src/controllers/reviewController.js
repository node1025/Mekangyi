const Review = require('../models/review');
const Order = require('../models/order');

// [POST] 리뷰 작성
exports.createReview = async (req, res) => {
  try {
    const { orderId, productId, rating, content } = req.body;
    const userId = req.user.id;

    // 업로드된 리뷰 이미지 경로 배열 생성
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    // 배송 완료 + 본인 주문인지 검증
    const order = await Order.findOne({ _id: orderId, userId, status: 'delivered' });
    if (!order) {
      return res.status(400).json({ message: "배송 완료된 주문만 리뷰를 작성할 수 있습니다." });
    }
    if (!order.items.some(item => item.productId.toString() === productId)) {
      return res.status(400).json({ message: '주문에 포함된 상품만 리뷰를 작성할 수 있습니다.' });
    }

    // 리뷰 생성
    const newReview = await Review.create({
      userId,
      productId,
      orderId,
      rating,
      content,
      images: imageUrls
    });

    // 주문 내 해당 상품을 리뷰 작성 완료 상태로 변경
    await Order.updateOne(
      { 
        _id: orderId, 
        "items.productId": productId 
      },
      { 
        $set: { "items.$.isReviewed": true } 
      }
    );

    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "이미 이 상품에 대한 리뷰를 작성하셨습니다." });
    }
    res.status(500).json({ message: error.message });
  }
};

// [GET] 상품별 리뷰 목록 조회
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId })
      .populate('userId', 'name') // 작성자 이름 가져오기
      .sort({ createdAt: -1 });   // 최신순 정렬

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// [GET] 전체 리뷰 목록 조회 (관리자용)
exports.getAllReviewsForAdmin = async (req, res) => {
  try {
    // 모든 리뷰를 찾고, 작성자 이름과 상품명 정보를 채워서 최신순 정렬
    const reviews = await Review.find()
      .populate('userId', 'name email')       // 작성자 이름과 이메일
      .populate('productId', 'name price')    // 상품명과 가격
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      count: reviews.length, 
      reviews 
    });
  } catch (error) {
    res.status(500).json({ message: "리뷰 목록을 불러오는데 실패했습니다.", error: error.message });
  }
};

// [DELETE] 리뷰 삭제 (관리자용)
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // 삭제할 리뷰 찾기 (주문 상태 복구를 위해 먼저 조회)
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "해당 리뷰를 찾을 수 없습니다." });
    }

    // 리뷰 삭제
    await Review.findByIdAndDelete(reviewId);

    // 관리자가 삭제했을 때 사용자가 다시 쓸 수 있게 하려면 아래 로직을 포함하세요.
    await Order.updateOne(
      { 
        _id: review.orderId, 
        "items.productId": review.productId 
      },
      { 
        $set: { "items.$.isReviewed": false } 
      }
    );

    res.json({ success: true, message: "리뷰가 성공적으로 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({ message: "리뷰 삭제 중 오류가 발생했습니다.", error: error.message });
  }
};
