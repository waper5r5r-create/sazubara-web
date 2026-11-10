// 토스페이(직연동) 결제. 문서: https://docs-pay.toss.im
// - 결제 생성은 서버에서만 한다. 금액은 서버가 정한 값이다.
// - autoExecute=false: 구매자가 인증만 마친 상태(PAY_APPROVED)로 돌아오면, 서버가 상태를 확인한 뒤 직접 승인한다.
//   그래서 콘텐츠를 열 수 없는 건(이미 보유 등)은 승인하지 않아 돈이 빠져나가지 않는다.
// - API 키는 TOSSPAY_API_KEY 환경변수에만 둔다(sk_test_ 테스트 / sk_live_ 실거래).
const BASE = 'https://pay.toss.im/api/v2/';
const SITE = 'https://www.byeolcheop.com';

function tosspayKey() { return process.env.TOSSPAY_API_KEY || ''; }
function tosspayMode() { const k = tosspayKey(); return !k ? '' : k.indexOf('sk_test_') === 0 ? 'test' : 'live'; }

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ apiKey: tosspayKey() }, body))
  });
  try { return await r.json(); } catch (e) { return { code: -1, errorCode: 'BAD_RESPONSE' }; }
}

// 돌아올 주소는 우리 사이트로만 만든다(미리보기·로컬은 그 주소 그대로).
function siteOrigin(req) {
  const host = String((req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '');
  if (/^(www\.)?byeolcheop\.com$/.test(host) || /\.vercel\.app$/.test(host)) return 'https://' + host;
  if (/^localhost(:\d+)?$/.test(host)) return 'http://' + host;
  return SITE;
}

async function createTossPay({ orderNo, amount, productDesc, retUrl, retCancelUrl }) {
  if (!tosspayKey()) return { ok: false, error: 'TOSSPAY_UNAVAILABLE', message: '토스페이 결제를 준비 중이에요.' };
  if (retUrl.length > 255 || retCancelUrl.length > 255) return { ok: false, error: 'RET_URL_TOO_LONG', message: '결제창을 열지 못했어요. 카드 결제를 이용해 주세요.' };
  const d = await post('payments', {
    orderNo, amount, amountTaxFree: 0, productDesc: String(productDesc).slice(0, 200),
    autoExecute: false, retUrl, retCancelUrl
  });
  if (d.code !== 0 || !d.checkoutPage) return { ok: false, error: d.errorCode || 'TOSSPAY_CREATE_FAILED', message: d.msg || '토스페이 결제창을 열지 못했어요.' };
  return { ok: true, checkoutPage: d.checkoutPage };
}

// 인증이 끝난 결제를 승인하고, 토스페이먼츠 승인 응답과 같은 모양({orderId,totalAmount,status:'DONE',currency})으로 돌려준다.
// 이미 승인된 건(다시 시도)은 승인을 다시 하지 않고 상태만 확인한다.
async function finishTossPay(orderNo, price) {
  if (!tosspayKey()) return { ok: false, error: 'TOSSPAY_UNAVAILABLE', message: '토스페이 결제를 준비 중이에요.' };
  const done = (amount, approvedAt, mode) => ({ ok: true, data: { orderId: orderNo, totalAmount: amount, status: 'DONE', currency: 'KRW', approvedAt: approvedAt || null, mode: mode || '' } });
  let s = await post('status', { orderNo });
  if (!s.payStatus) return { ok: false, error: s.errorCode || 'TOSSPAY_STATUS_FAILED', message: s.msg || '결제 상태를 확인하지 못했어요.' };
  if (s.amount !== price) return { ok: false, error: 'PAYMENT_MISMATCH', message: '결제 금액이 올바르지 않아요. 고객센터로 문의해 주세요.' };
  if (s.payStatus === 'PAY_COMPLETE' || s.payStatus === 'SETTLEMENT_COMPLETE') return done(s.amount, null, s.mode);
  if (s.payStatus !== 'PAY_APPROVED') return { ok: false, error: 'TOSSPAY_NOT_PAID', message: '결제가 완료되지 않았어요.' };
  const e = await post('execute', { payToken: s.payToken, orderNo });
  if (e.code === 0) {
    if (e.amount !== price) return { ok: false, error: 'PAYMENT_MISMATCH', message: '결제 금액이 올바르지 않아요. 고객센터로 문의해 주세요.' };
    return done(e.amount, e.approvalTime, e.mode);
  }
  // 동시에 두 번 승인을 시도한 경우: 상태를 다시 보고 완료면 그대로 인정한다.
  s = await post('status', { orderNo });
  if (s.amount === price && (s.payStatus === 'PAY_COMPLETE' || s.payStatus === 'SETTLEMENT_COMPLETE')) return done(s.amount, null, s.mode);
  return { ok: false, error: e.errorCode || 'TOSSPAY_EXECUTE_FAILED', message: e.msg || '결제를 승인하지 못했어요.' };
}

module.exports = { tosspayMode, createTossPay, finishTossPay, siteOrigin };
