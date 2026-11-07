// 방문 측정. 어디서 들어왔는지(source·campaign)와 주요 단계만 visit_events에 한 줄씩 남깁니다.
// POST /api/track  body:{device_id, name, source, campaign, landing}
// 이름·생년월일 같은 개인정보는 받지 않습니다. 실패해도 사용자 화면에는 영향이 없게 항상 204로 답합니다.
const { sbFetch, readJsonBody } = require('./_supabase');

const NAMES = ['visit', 'saju_done', 'pay_start', 'pay_done'];
const clip = (v, n) => String(v || '').replace(/[^\w.\-/?=&%가-힣]/g, '').slice(0, n);

function eventRow(body) {
  body = body || {};
  if (NAMES.indexOf(body.name) === -1) return null;
  if (!/^[a-z0-9]{6,24}$/.test(String(body.device_id || ''))) return null;
  return {
    device_id: body.device_id,
    name: body.name,
    source: clip(body.source, 60) || 'direct',
    campaign: clip(body.campaign, 60),
    landing: clip(body.landing, 80)
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  try {
    const row = eventRow(await readJsonBody(req));
    if (row) await sbFetch('/visit_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  } catch (e) {}
  res.status(204).end();
};
module.exports.eventRow = eventRow;
