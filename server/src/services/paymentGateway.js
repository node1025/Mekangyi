const axios = require('axios');
const { fail } = require('./orderInventory');

function localPaymentEnabled() {
  if (process.env.LOCAL_PAYMENT_MODE === 'false') return false;
  if (process.env.LOCAL_PAYMENT_MODE === 'true') return true;
  return process.env.NODE_ENV === 'development' && !process.env.PORTONE_API_SECRET?.trim();
}

exports.localPaymentEnabled = localPaymentEnabled;

exports.getPayment = async (paymentId, allowMissing = false) => {
  if (localPaymentEnabled()) {
    if (allowMissing) {
      return { id: paymentId, status: 'READY', currency: 'KRW', amount: { total: 0 } };
    }
    return { id: paymentId, status: 'PAID', currency: 'KRW', amount: { total: 0 } };
  }
  const secret = process.env.PORTONE_API_SECRET?.trim();
  if (!secret) throw fail('결제 조회 설정을 확인해주세요.', 503);
  try {
    const response = await axios.get(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${secret}` }, timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (allowMissing && error.response?.status === 404) return null;
    throw fail('결제 내역을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.', 503);
  }
};

exports.verifyPaid = (payment, order) => {
  if (localPaymentEnabled()) {
    if (!payment || payment.id !== order.orderId || payment.status !== 'PAID' || payment.currency !== 'KRW') {
      throw fail('결제 상태 또는 결제 금액이 주문과 일치하지 않습니다.', 409);
    }
    return;
  }
  if (!payment || payment.id !== order.orderId || payment.status !== 'PAID' || payment.currency !== 'KRW' ||
      payment.amount?.total !== order.totalPrice) throw fail('결제 상태 또는 결제 금액이 주문과 일치하지 않습니다.', 409);
};

exports.verifyCancellation = (payment, order) => {
  if (localPaymentEnabled()) return;
  if (payment && payment.id !== order.orderId) throw fail('결제 주문번호가 일치하지 않습니다.', 409);
  if (order.status === 'pending' && (!payment || ['READY', 'FAILED'].includes(payment.status))) return;
  if (!payment || payment.id !== order.orderId || payment.status !== 'CANCELLED') {
    throw fail('PortOne에서 전액 결제 취소를 완료한 뒤 주문을 취소해주세요. 재고는 아직 변경되지 않았습니다.', 409);
  }
};
