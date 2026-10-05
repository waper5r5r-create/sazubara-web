// 프로모션 코드(테스트 배포용) 사용. 지인/테스터가 각자 기기에서 코드를 입력하면
// 그 기기(deviceId)에 바로 크레딧이 적립됩니다.
// - 같은 코드를 같은 기기가 두 번 쓰면(promo_redemptions의 code+device_id unique 제약) 막힙니다.
// - max_redemptions가 설정돼있으면 그 횟수를 넘기면 더 이상 쓸 수 없습니다(소진).
// - 코드 자체는 Supabase SQL 편집기에서 직접 만듭니다(관리자 화면 없음) — 예:
//   insert into promo_codes (code, amount, max_redemptions, note)
//   values ('코드이름', 50, 20, '메모');

const { ensureDevice, insertLedger, sbFetch, readJsonBody } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = await readJsonBody(req);
  const rawCode = body && body.code;
  const deviceId = body && body.deviceId;
  if (!rawCode || !deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }
  const code = String(rawCode).trim().toUpperCase().slice(0, 40);

  try {
    await ensureDevice(deviceId);

    const codeRes = await sbFetch(
      '/promo_codes?code=eq.' + encodeURIComponent(code) + '&active=eq.true&select=code,amount,max_redemptions,times_redeemed',
      { method: 'GET' }
    );
    if (!codeRes.ok) {
      res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
      return;
    }
    const rows = await codeRes.json();
    const promo = rows && rows[0];
    if (!promo) {
      res.status(404).json({ ok: false, error: 'INVALID_CODE' });
      return;
    }
    if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) {
      res.status(410).json({ ok: false, error: 'CODE_EXHAUSTED' });
      return;
    }

    const redeemRes = await sbFetch('/promo_redemptions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code: code, device_id: deviceId })
    });
    if (redeemRes.status === 409) {
      res.status(409).json({ ok: false, error: 'ALREADY_REDEEMED' });
      return;
    }
    if (!redeemRes.ok) {
      const text = await redeemRes.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'REDEEM_INSERT_FAILED', message: text });
      return;
    }

    // 사용 횟수 +1 (동시에 여러 명이 몰리는 상황은 이 프로젝트 규모에서 고려하지 않음)
    await sbFetch('/promo_codes?code=eq.' + encodeURIComponent(code), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ times_redeemed: promo.times_redeemed + 1 })
    });

    await insertLedger({ deviceId: deviceId, amount: promo.amount, reason: '프로모션 코드: ' + code });

    res.status(200).json({ ok: true, credited: true, amount: promo.amount });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
