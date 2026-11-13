<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { fieldErrorsFromApi, validationSummary } from '../../utils/apiValidation';

interface Shipping {
  receiver: string;
  phone: string;
  zipCode: string;
  basicAddress: string;
  detailAddress: string;
}

const saved = ref<Shipping | null>(null);
const editing = ref(false);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const message = ref('');
const fieldErrors = ref<Record<string, string>>({});
const draft = reactive<Shipping>({ receiver: '', phone: '', zipCode: '', basicAddress: '', detailAddress: '' });

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await axios.get('/api/auth/profile');
    const user = data.user;
    const address = user.shippingAddress?.receiver
      ? user.shippingAddress
      : {
          receiver: user.name || '',
          phone: user.phone || '',
          zipCode: user.address?.zipCode || '',
          basicAddress: user.address?.basicAddress || '',
          detailAddress: user.address?.detailAddress || '',
        };
    saved.value = address;
  } catch (e: any) {
    error.value = e.response?.data?.message || '배송지를 불러오지 못했습니다.';
  } finally {
    loading.value = false;
  }
}

function beginEdit() {
  Object.assign(draft, saved.value);
  editing.value = true;
  message.value = '';
  error.value = '';
  fieldErrors.value = {};
}

function cancel() {
  editing.value = false;
  error.value = '';
  fieldErrors.value = {};
}

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  fieldErrors.value = {};
  try {
    const { data } = await axios.patch('/api/auth/shipping-address', { ...draft });
    saved.value = data.shippingAddress;
    editing.value = false;
    message.value = '배송지를 저장했습니다. 다음 주문부터 새 배송지가 기본 입력됩니다.';
  } catch (e: any) {
    const res = e.response?.data;
    fieldErrors.value = fieldErrorsFromApi(res?.errors);
    error.value = validationSummary(res, '배송지를 저장하지 못했습니다.');
  } finally {
    busy.value = false;
  }
}

const formatPhone = (phone: string) => phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
onMounted(load);
</script>
<template><div class="shipping-wrapper"><p v-if="loading" role="status">배송지를 불러오는 중입니다.</p><p v-if="error" class="shipping-error" role="alert">{{error}}</p><p v-if="message" class="shipping-message" role="status">{{message}}</p><button v-if="!loading&&!saved" @click="load">다시 불러오기</button><div v-if="saved" class="address-grid"><article class="address-card"><header class="card-header"><strong class="addr-name">기본 배송지</strong><button v-if="!editing" class="shipping-edit" @click="beginEdit">배송지 수정</button></header><template v-if="!editing"><div class="card-body"><div class="info-row"><span class="label">받는 분</span><span class="value">{{saved.receiver}}</span></div><div class="info-row"><span class="label">연락처</span><span class="value">{{formatPhone(saved.phone)}}</span></div><div class="info-row"><span class="label">주소</span><span class="value"><span class="zip">({{saved.zipCode}})</span><br>{{saved.basicAddress}}<span class="detail">{{saved.detailAddress}}</span></span></div></div><p class="shipping-note">배송지의 받는 분과 연락처는 회원정보와 별도로 저장됩니다.<br>이미 접수된 주문의 배송지는 변경되지 않습니다.</p></template><form v-else class="shipping-form" @submit.prevent="save"><label for="shipping-receiver">받는 분<input id="shipping-receiver" v-model="draft.receiver" required maxlength="50" autocomplete="shipping name"></label><label for="shipping-phone">연락처<input id="shipping-phone" v-model="draft.phone" required maxlength="13" inputmode="tel" autocomplete="shipping tel" placeholder="010-1234-5678"></label><label for="shipping-postcode">우편번호<input id="shipping-postcode" v-model="draft.zipCode" required pattern="[0-9]{5}" maxlength="5" inputmode="numeric" autocomplete="shipping postal-code"></label><label for="shipping-address" class="shipping-wide">기본 주소<input id="shipping-address" v-model="draft.basicAddress" required maxlength="200" autocomplete="shipping address-line1"></label><label for="shipping-detail" class="shipping-wide">상세 주소<input id="shipping-detail" v-model="draft.detailAddress" required maxlength="200" autocomplete="shipping address-line2"><span v-if="fieldErrors.detailAddress" class="shipping-field-error" role="alert">{{ fieldErrors.detailAddress }}</span></label><p class="shipping-note shipping-wide">회원 이름·연락처는 그대로 유지하며, 이 배송지를 다음 주문의 기본값으로 사용합니다.</p><div class="shipping-actions shipping-wide"><button type="button" :disabled="busy" @click="cancel">취소</button><button type="submit" :disabled="busy">{{busy?'저장 중…':'배송지 저장'}}</button></div></form></article></div></div></template>
<style scoped>
/* 배송지 페이지 전체 컨테이너 */
.shipping-wrapper {
  padding: 30px 0;
  max-width: 1200px;
  margin: 0 auto;
}

/* 배송지 카드 */
.address-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.address-card {
  position: relative;
  border: 1px solid #f0f0f0;
  border-radius: 16px;
  padding: 24px;
  background: #ffffff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.address-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

/* 기본 배송지 카드 강조 */
.default-border {
  border-color: #074CA1;
  background-color: #fcfdff;
}

/* 카드 헤더 영역 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

/* 배송지 이름 */
.addr-name {
  font-size: 18px;
  font-weight: 800;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

/* 기본 배송지 뱃지 스타일 */
.default-badge {
  font-size:16px;
  font-weight: 600;
  padding: 4px 10px;
  background: #074CA1;
  color: #fff;
  border-radius: 20px;
}

/* 카드 바디 영역 */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  font-size:18px;
  line-height: 1.5;
}

.info-row .label {
  width: 70px;
  color:#626d7e;
  font-weight: 500;
  flex-shrink: 0;
}

.info-row .value {
  flex: 1;
  color: #2d2d2d;
  font-weight: 600;
}

/* 주소 세부 스타일 */
.zip {
  display: inline-block;
  font-size:17px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.detail {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-weight: 400;
}

/* 데이터가 없을 경우 */
.no-data {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 0;
  color:#52627a;
  font-size:19px;
  border: 2px dashed #f1f5f9;
  border-radius: 16px;
}
.address-grid{grid-template-columns:minmax(0,1fr)}.address-card{max-width:760px}.address-card:hover{transform:none}.card-header{gap:16px;flex-wrap:wrap}.shipping-edit{background:#122551;color:white;border:0;border-radius:7px;padding:10px 18px;font-size:15px}.shipping-form{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px}.shipping-form label{display:flex;flex-direction:column;gap:8px;font-size:15px;color:#122551}.shipping-form input{min-width:0;width:100%;padding:13px;border:1px solid #ccd9ed;border-radius:7px;font-size:16px}.shipping-wide{grid-column:1/-1}.shipping-actions{display:flex;gap:12px;justify-content:flex-end}.shipping-actions button{padding:12px 23px;border:1px solid #ccd9ed;border-radius:7px;background:white;color:#122551;font-size:16px}.shipping-actions button[type=submit]{background:#122551;color:white}.shipping-note{font-size:14px;color:#52627a;line-height:1.8}.shipping-message{padding:12px;background:#f1f6fd;color:#122551;line-height:1.7}.shipping-field-error {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  color: #c62828;
  line-height: 1.4;
}
.shipping-error{color:#ad3939}.shipping-wrapper>button{padding:12px 20px}@media(max-width:600px){.shipping-form{grid-template-columns:1fr}.address-card{padding:22px}.shipping-form label{grid-column:1/-1}.info-row{font-size:16px}}
</style>