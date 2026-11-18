// 결제 확인 화면(success.html)에서 승인이 실패하거나, 결제한 곳과 돌아온 브라우저가 다를 때 남기는 기록.
// 운영자가 "결제는 했는데 안 열렸다" 같은 일을 손님 문의 전에 알 수 있게 한다.
// 기록만 하고 아무것도 열어 주지 않는다. 기록이 실패해도 손님 화면에는 영향이 없다.
const { sbFetch, readJsonBody } = require('./_supabase');

const clip = (v, n) => (typeof v === 'string' && v ? v.slice(0, n) : null);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  const b = (await readJsonBody(req)) || {};
  const row = {
    code: clip(b.code, 60),
    message: clip(b.message, 300),
    order_id: clip(b.orderId, 80),
    device_id: clip(b.deviceId, 64),
    item: clip(b.item, 160),
    stage: clip(b.stage, 20),
    extra: clip(b.extra, 160),
    had_local_device: !!b.hadLocalDevice,
    user_agent: clip(req.headers && req.headers['user-agent'], 300)
  };
  if (!row.code || !/^[A-Z0-9_]+$/.test(row.code)) return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  console.error('PAY_LOG', JSON.stringify(row));
  try {
    await sbFetch('/payment_failures', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  } catch (e) { /* 기록 실패는 무시한다 */ }
  res.status(200).json({ ok: true });
};
