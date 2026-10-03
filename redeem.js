// 친구가 초대 링크로 들어와서 "자기 사주를 직접 입력"했을 때 호출됩니다.
// - 이 기기(invitee)가 과거에 이미 어떤 초대로든 보너스를 적립해준 적이 있으면(=invitee_device_id unique 제약),
//   다시 호출돼도 또 적립되지 않습니다 — 같은 사람이 여러 번 보너스를 긁어가는 걸 막습니다.
// - 자기 자신의 초대코드로는 적립되지 않습니다(자기 초대 방지).
// - 실제로 친구가 사주를 등록한 경우에만 초대한 사람(inviter)에게 +3 크레딧이 적립됩니다.

const { ensureDevice, insertLedger, sbFetch, readJsonBody } = require('../_supabase');

const INVITE_BONUS = 3;

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = await readJsonBody(req);
  const { code, inviteeDeviceId, inviteeName, sajuOpts } = body || {};
  if (!code || !inviteeDeviceId || !sajuOpts || typeof sajuOpts !== 'object') {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }
  if (code === inviteeDeviceId) {
    res.status(400).json({ ok: false, error: 'SELF_INVITE' });
    return;
  }

  try {
    await ensureDevice(code);
    await ensureDevice(inviteeDeviceId);

    const insRes = await sbFetch('/invite_redemptions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        invite_code: code,
        inviter_device_id: code,
        invitee_device_id: inviteeDeviceId,
        invitee_name: String(inviteeName || '').slice(0, 40),
        invitee_saju: sajuOpts
      })
    });

    if (insRes.status === 409) {
      // 이 기기는 이미 예전에 (이 초대든 다른 초대든) 등록 보너스를 적립해줬음 — 정상, 중복 지급만 막음.
      res.status(200).json({ ok: true, credited: false, already: true });
      return;
    }
    if (!insRes.ok) {
      const text = await insRes.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'INSERT_FAILED', message: text });
      return;
    }

    await insertLedger({ deviceId: code, amount: INVITE_BONUS, reason: '친구 초대 등록 보너스' });

    res.status(200).json({ ok: true, credited: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
