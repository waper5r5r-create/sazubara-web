const { sbFetch } = require('./_supabase');
const { linkedDeviceIds, deviceFilter } = require('./_account');

// 2026-10-24부터 이야기와 심층 리포트를 7,900원 한 번의 결제로 묶는다.
// 예전에 이야기(story)나 심층 리포트(detail) 중 하나라도 산 기기는 전체를 연다.
const STAGE_PRICE = Object.freeze({story:7900});
const STAGES = ['story'];
function stageKey(conceptId, stage) { return 'report-' + stage + '-' + conceptId; }
async function rowsAt(path) {
  const r = await sbFetch(path);
  if (!r.ok) throw new Error('PURCHASE_LOOKUP_FAILED');
  return r.json();
}
async function reportAccess(deviceId, conceptId) {
  if (!deviceId) return { story: false, detail: false, legacy: false };
  // 로그인 계정으로 묶인 다른 기기에서 산 것도 함께 본다.
  const device = deviceFilter(await linkedDeviceIds(deviceId)), concept = encodeURIComponent(conceptId);
  const [legacyRows, paidRows] = await Promise.all([
    rowsAt('/report_unlocks?device_id=' + device + '&concept_id=eq.' + concept + '&select=concept_id'),
    rowsAt('/paid_unlocks?device_id=' + device + '&select=unlock_key')
  ]);
  const legacy = legacyRows.length > 0;
  const keys = new Set(paidRows.map(r => r.unlock_key));
  const owned = legacy || keys.has(stageKey(conceptId, 'story')) || keys.has(stageKey(conceptId, 'detail'));
  return { story: owned, detail: owned, legacy };
}
module.exports = { STAGE_PRICE, STAGES, stageKey, rowsAt, reportAccess };
