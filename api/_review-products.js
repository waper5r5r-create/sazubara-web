// 후기를 남길 수 있는 상품 목록과 "실제로 돈을 내고 샀는지" 확인.
// 무료로 연 것(초대 선물, 프로모션 코드 = amount 0)은 구매로 치지 않는다.
const { sbFetch } = require('./_supabase');
const { linkedDeviceIds, deviceFilter } = require('./_account');
const { CONTENTS } = require('./_contents');

const PRODUCTS = Object.freeze(Object.assign(
  Object.fromEntries(CONTENTS.map(c => [c.concept.id, { title: c.concept.title, story: true }])),
  {
    compat: { title: '궁합 깊이 보기', match: k => k.indexOf('compat-') === 0 },
    'today-premium': { title: '오늘의 운세 프리미엄', match: k => k === 'feature-today-premium' },
    'saju-deep': { title: '고민상담', match: k => k === 'feature-saju-deep' || k.indexOf('feature-saju-deep:') === 0 }
  }
));

function productOf(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PRODUCTS, id) ? PRODUCTS[id] : null;
}

async function rowsAt(path) {
  const r = await sbFetch(path);
  if (!r.ok) throw new Error('LOOKUP_FAILED');
  return r.json();
}

// 이 기기(로그인으로 묶인 기기 포함)가 그 상품을 돈 내고 샀는가
async function ownsProduct(deviceId, productId) {
  const product = productOf(productId);
  if (!product || !deviceId) return false;
  const device = deviceFilter(await linkedDeviceIds(deviceId));
  const paid = await rowsAt('/paid_unlocks?device_id=' + device + '&amount=gt.0&select=unlock_key');
  const keys = paid.map(r => r.unlock_key);
  if (product.story) {
    if (keys.includes('report-story-' + productId) || keys.includes('report-detail-' + productId)) return true;
    // 크레딧 시절(2026-10 이전)에 산 이야기
    const legacy = await rowsAt('/report_unlocks?device_id=' + device + '&concept_id=eq.' + encodeURIComponent(productId) + '&select=concept_id');
    return legacy.length > 0;
  }
  return keys.some(product.match);
}

module.exports = { PRODUCTS, productOf, ownsProduct, rowsAt };
