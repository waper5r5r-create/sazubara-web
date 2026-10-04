// 이 기기(나)의 "현재 사주 입력값"을 devices 테이블에 올려둡니다.
// 내가 초대한 친구의 마이룸에 "나를 초대한 친구" 카드를 보여주려면, 그 친구가 내 사주를 알아야 하는데
// invite_redemptions에는 초대받은 쪽(invitee)의 사주만 저장되어 있어서 이 기록이 따로 필요합니다.
// 사주를 새로 입력/수정할 때마다 호출해서 항상 최신 상태로 덮어씁니다.

const { ensureDevice, sbFetch, readJsonBody } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = await readJsonBody(req);
  const { deviceId, sajuOpts } = body || {};
  if (!deviceId || !sajuOpts || typeof sajuOpts !== 'object') {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }

  try {
    await ensureDevice(deviceId);
    const r = await sbFetch('/devices?device_id=eq.' + encodeURIComponent(deviceId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ saju_opts: sajuOpts, saju_updated_at: new Date().toISOString() })
    });
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'UPDATE_FAILED', message: text });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
