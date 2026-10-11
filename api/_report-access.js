const { sbFetch } = require('./_supabase');

const STAGE_PRICE = Object.freeze({story:4900, detail:12900});
const STAGES = ['story', 'detail'];
function stageKey(conceptId, stage) { return 'report-' + stage + '-' + conceptId; }
async function rowsAt(path) {
  const r = await sbFetch(path);
  if (!r.ok) throw new Error('PURCHASE_LOOKUP_FAILED');
  return r.json();
}
async function reportAccess(deviceId, conceptId) {
  if (!deviceId) return { story: false, detail: false, legacy: false };
  const device = encodeURIComponent(deviceId), concept = encodeURIComponent(conceptId);
  const [legacyRows, paidRows] = await Promise.all([
    rowsAt('/report_unlocks?device_id=eq.' + device + '&concept_id=eq.' + concept + '&select=concept_id'),
    rowsAt('/paid_unlocks?device_id=eq.' + device + '&select=unlock_key')
  ]);
  const legacy = legacyRows.length > 0;
  const keys = new Set(paidRows.map(r => r.unlock_key));
  return {
    story: legacy || keys.has(stageKey(conceptId, 'story')),
    detail: legacy || keys.has(stageKey(conceptId, 'detail')),
    legacy
  };
}
module.exports = { STAGE_PRICE, STAGES, stageKey, rowsAt, reportAccess };
