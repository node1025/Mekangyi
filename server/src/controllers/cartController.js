const Cart = require('../models/cart');   // Cart 모델 불러오기
const Product = require('../models/product/product');
const ProductVariant = require('../models/product/productvariant');
const Inventory = require('../models/product/inventory');
const { isObjectIdOrHexString, ObjectId } = require('../models/mariaSchema');
const { isQuantity } = require('../utils/input');
const { salePriceFromProduct, enrichProductForResponse } = require('../utils/productPricing');

// [POST] 장바구니 담기
exports.addToCart = async (req, res) => {
  // 프론트엔드에서 전달받은 데이터
  const { productId, variantId, size, quantity } = req.body;
  if (!isObjectIdOrHexString(productId) || !isObjectIdOrHexString(variantId) ||
      typeof size !== 'string' || !size.trim() || !isQuantity(quantity)) {
    return res.status(400).json({ message: '상품 옵션과 수량을 확인해주세요.' });
  }
  // 인증 미들웨어에 저장해둔 로그인한 사용자 ID
  const userId = req.user.id;

  try {
    const product = await Product.findOne({ _id: productId, isDeleted: false, status: '판매중' });
    const variant = await ProductVariant.findOne({ _id: variantId, productId });
    const inventory = await Inventory.findOne({ variantId, size });
    if (!product || !variant || !inventory) {
      return res.status(400).json({ message: '구매 가능한 상품 옵션이 아닙니다.' });
    }
    const price = salePriceFromProduct(product);
    // 현재 사용자 장바구니가 이미 존재하는지 조회
    let cart = await Cart.findOne({ userId });

    // 장바구니가 이미 있는 경우
    if (cart) {
      // items 배열 안에 같은 variantId + 같은 size 상품이 있는지 확인
      const itemIndex = cart.items.findIndex(p => 
        p.variantId.toString() === variantId && p.size === size
      );

      // 이미 동일 옵션 상품이 있다면
      if (itemIndex > -1) {
        if (cart.items[itemIndex].quantity + quantity > inventory.stockQuantity) {
          return res.status(400).json({ message: '재고 수량을 초과했습니다.' });
        }
        // 수량만 추가
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].price = price;
      } else {
        if (quantity > inventory.stockQuantity) return res.status(400).json({ message: '재고 수량을 초과했습니다.' });
        // 없으면 새로 추가
        cart.items.push({ productId, variantId, size, quantity, price });
      }
      cart = await cart.save();
    } else {
      if (quantity > inventory.stockQuantity) return res.status(400).json({ message: '재고 수량을 초과했습니다.' });
      // 장바구니가 아예 없는 경우(새로 생성)
      cart = await Cart.create({
        userId,
        items: [{ productId, variantId, size, quantity, price }]
      });
    }
    res.status(201).json(cart);
  } catch (error) {
    res.status(500).json({ message: "장바구니 담기 실패", error });
  }
};

// [GET] 내 장바구니 목록 조회
exports.getCart = async (req, res) => {
  try {
    // 로그인한 사용자의 장바구니 조회
    const cart = await Cart.findOne({ userId: req.user.id })
      // productId를 실제 상품 데이터로 변환
      .populate('items.productId')
      // variantId를 실제 옵션 데이터로 변환
      .populate('items.variantId');
    if (!cart) return res.status(200).json({ items: [] });
    let priceAdjusted = false;
    for (const row of cart.items) {
      const p = row.productId;
      if (p && typeof p === 'object' && !(p instanceof ObjectId)) {
        const unit = salePriceFromProduct(p);
        if (row.price !== unit) {
          row.price = unit;
          priceAdjusted = true;
        }
      }
    }
    if (priceAdjusted) await cart.save();
    const payload = cart.toObject();
    for (const row of payload.items) {
      if (row.productId && typeof row.productId === 'object') {
        row.productId = enrichProductForResponse(row.productId);
      }
    }
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ message: "조회 실패" });
  }
};

// [PATCH] 수량 변경
exports.updateQuantity = async (req, res) => {
  // items 배열 안에 있는 특정 상품의 _id
  const { itemId, quantity } = req.body;
  if (!isObjectIdOrHexString(itemId) || !isQuantity(quantity)) {
    return res.status(400).json({ message: '올바른 항목과 양의 정수 수량을 입력해주세요.' });
  }
  try {
    const existingCart = await Cart.findOne({ userId: req.user.id, 'items._id': itemId });
    const item = existingCart?.items.find(entry => entry._id.toString() === itemId);
    if (!item) return res.status(404).json({ message: '장바구니 항목을 찾을 수 없습니다.' });
    const inventory = await Inventory.findOne({ variantId: item.variantId, size: item.size });
    if (!inventory || quantity > inventory.stockQuantity) {
      return res.status(400).json({ message: '재고 수량을 초과했습니다.' });
    }
    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id, "items._id": itemId },
      { $set: { "items.$.quantity": quantity } },
      { new: true, runValidators: true }
    );
    if (!cart) return res.status(404).json({ message: '장바구니 항목을 찾을 수 없습니다.' });
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "수량 변경 실패" });
  }
};

// [DELETE] 항목 삭제
exports.removeItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $pull: { items: { _id: itemId } } },
      { new: true }
    );
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "삭제 실패" });
  }
};

// [DELETE] 장바구니 전체 비우기
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { items: [] } }, // items 배열을 빈 배열로 설정
      { new: true }
    );
    res.status(200).json({ message: "장바구니가 비워졌습니다." });
  } catch (error) {
    res.status(500).json({ message: "비우기 실패" });
  }
};
