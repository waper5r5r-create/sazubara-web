// "내가 초대해서 실제로 사주를 등록한 친구" 목록을 돌려줍니다 — 마이룸에 쓰입니다.
// 궁합 점수 자체는 계산하지 않고(이 기기는 초대한 사람의 사주를 모르므로) 친구의 입력값(invitee_saju)만
// 내려주면, 요청한 브라우저(초대한 사람)가 자기 사주와 비교해서 직접 계산합니다.

const { sbFetch, getQuery } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const q = getQuery(req);
  const deviceId = q.device_id || '';
  if (!deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
    return;
  }

  try {
    const r = await sbFetch(
      '/invite_redemptions?inviter_device_id=eq.' +
        encodeURIComponent(deviceId) +
        '&select=invitee_device_id,invitee_name,invitee_saju,created_at&order=created_at.desc&limit=60',
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
