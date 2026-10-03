// 이 기기(device_id)에 서버가 쌓아둔 크레딧 장부 중, 아직 브라우저가 반영하지 않은(after_id보다 큰) 줄들을
// 돌려줍니다. 결제 충전과 "친구 초대 등록 보너스"가 모두 이 한 경로로 클라이언트에 반영됩니다.
// (초대 보너스는 초대한 사람과 등록한 친구가 서로 다른 기기/브라우저이기 때문에, 브라우저끼리 직접
// 알려줄 방법이 없어서 — 서버에 쌓인 걸 각자 불러오는 방식이 유일한 방법입니다.)

const { sbFetch, getQuery } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const q = getQuery(req);
  const deviceId = q.device_id || '';
  const afterId = parseInt(q.after_id || '0', 10) || 0;
  if (!deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
    return;
  }

  try {
    const r = await sbFetch(
      '/credit_ledger?device_id=eq.' +
        encodeURIComponent(deviceId) +
        '&id=gt.' +
        afterId +
        '&select=id,amount,reason,created_at&order=id.asc&limit=100',
      { method: 'GET' }
    );
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'QUERY_FAILED', message: text });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
