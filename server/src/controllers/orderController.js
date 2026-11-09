const maria = require('../config/maria');
const { randomUUID } = require('node:crypto');
const Order = require('../models/order');
const Cart = require('../models/cart');
const inventory = require('../services/orderInventory');
const gateway = require('../services/paymentGateway');

const reportError = (res, error, extra = {}) => {
  if (!error.status) console.error('주문 처리 실패:', error.code || error.name);
  return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : '주문 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.', ...extra });
};
const paymentIdValid = id => typeof id === 'string' && /^ord_[a-f0-9-]{36}$/.test(id);
const owns = (order, userId) => order.userId.toString() === userId.toString();

exports.checkoutMode = (_req, res) => {
  res.json({ localPayment: gateway.localPaymentEnabled() });
};

exports.prepareOrder = async (req, res) => {
  try {
    const address = inventory.shippingAddress(req.body?.shippingAddress);
    const input = inventory.normalizeItems(req.body?.items);
    let order;
    await maria.transaction(async session => {
      const quote = await inventory.quoteItems(input, session);
      [order] = await Order.create([{
        userId: req.user.id, orderId: `ord_${randomUUID()}`, ...quote,
        shippingAddress: address, status: 'pending', inventoryApplied: false
      }], { session });
    });
    return res.status(201).json({ success: true, paymentId: order.orderId, totalPrice: order.totalPrice, shippingFee: order.shippingFee });
  } catch (error) { return reportError(res, error); }
};

exports.createOrder = async (req, res) => {
  const paymentId = req.body?.paymentId;
  if (!paymentIdValid(paymentId)) return res.status(400).json({ success: false, message: '서버에서 준비한 주문번호가 필요합니다.' });
  let paidVerified = false;
  try {
    const pending = await Order.findOne({ orderId: paymentId });
    if (!pending || !owns(pending, req.user.id)) throw inventory.fail('주문을 찾을 수 없습니다.', 404);
    if (pending.status === 'cancelled') throw inventory.fail('취소된 주문은 다시 확정할 수 없습니다.', 409);
    if (pending.status !== 'pending') return res.status(200).json({ success: true, order: pending, alreadyProcessed: true });
    const payment = await gateway.getPayment(paymentId);
    gateway.verifyPaid(payment, pending);
    paidVerified = true;
    let order;
    let alreadyProcessed = false;
    await maria.transaction(async session => {
      order = await Order.findOne({ orderId: paymentId }).session(session);
      if (!order || !owns(order, req.user.id)) throw inventory.fail('주문을 찾을 수 없습니다.', 404);
      if (order.status === 'cancelled') throw inventory.fail('취소된 주문은 다시 확정할 수 없습니다.', 409);
      if (order.status !== 'pending') { alreadyProcessed = true; return; }
      gateway.verifyPaid(payment, order);
      if (order.inventoryApplied) throw inventory.fail('주문 재고 상태를 확인해주세요.', 409);
      await inventory.applyStock(order.items, session);
      order.status = 'paid';
      order.inventoryApplied = true;
      order.paymentKey = paymentId;
      await order.save({ session });
      // Keep cart rows edited while the payment window was open.
      await Cart.updateOne({ userId: req.user.id }, { $pull: { items: { $or: order.items.map(item => ({
        productId: item.productId, variantId: item.variantId, size: item.size, quantity: item.quantity
      })) } } }, { session });
    });
    return res.status(alreadyProcessed ? 200 : 201).json({ success: true, order, alreadyProcessed });
  } catch (error) {
    return reportError(res, error, paidVerified ? { paymentVerified: true, paymentId, requiresReconciliation: true } : {});
  }
};

const transitions = { pending: [], paid: ['shipping'], shipping: ['delivered'], delivered: [], cancelled: [] };

async function cancelOrder(orderId) {
  if (!inventory.validId(orderId)) throw inventory.fail('올바른 주문 ID가 필요합니다.');
  const current = await Order.findById(orderId);
  if (!current) throw inventory.fail('주문을 찾을 수 없습니다.', 404);
  if (current.status === 'cancelled') return current;
  const payment = await gateway.getPayment(current.paymentKey || current.orderId, current.status === 'pending');
  gateway.verifyCancellation(payment, current);
  let order;
  await maria.transaction(async session => {
    order = await Order.findById(orderId).session(session);
    if (!order) throw inventory.fail('주문을 찾을 수 없습니다.', 404);
    if (order.status === 'cancelled') return;
    gateway.verifyCancellation(payment, order);
    if (order.inventoryApplied) await inventory.applyStock(order.items, session, true);
    order.status = 'cancelled';
    order.inventoryApplied = false;
    await order.save({ session });
  });
  return order;
}

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = req.body?.status;
    if (!inventory.validId(orderId) || !Object.hasOwn(transitions, status)) throw inventory.fail('주문 ID와 상태를 확인해주세요.');
    let order;
    if (status === 'cancelled') order = await cancelOrder(orderId);
    else await maria.transaction(async session => {
      order = await Order.findById(orderId).session(session);
      if (!order) throw inventory.fail('주문을 찾을 수 없습니다.', 404);
      if (order.status === status) return;
      if (!transitions[order.status]?.includes(status)) throw inventory.fail('허용되지 않는 주문 상태 변경입니다.', 409);
      order.status = status;
      await order.save({ session });
    });
    return res.json({ success: true, message: '주문 상태가 변경되었습니다.', order });
  } catch (error) { return reportError(res, error); }
};

// Keep the route while preserving cancelled orders against payment replay.
exports.cancelOrder = async (req, res) => {
  try {
    const order = await cancelOrder(req.params.orderId);
    return res.json({ success: true, message: '주문이 취소되었습니다. 주문 이력은 보존됩니다.', order });
  } catch (error) { return reportError(res, error); }
};

exports.getAllOrders = async (_req, res) => {
  try {
    const orders = await Order.find()
      .populate({ path: 'userId', select: 'name email' })
      .populate({ path: 'items.productId', select: 'name' })
      .populate({ path: 'items.variantId', select: 'color' })
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) { return reportError(res, error); }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate({ path: 'items.productId', select: 'name' })
      .populate({ path: 'items.variantId', select: 'color images' })
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) { return reportError(res, error); }
};
