// 리포트(유료 상세 풀이) 건별(원화) 결제 승인 — 크레딧 장부와는 완전히 별개 경로다.
// 토스페이먼츠 결제 승인 API를 "서버에서만" 호출하고(/api/toss/confirm과 동일한 패턴),
// 결제가 끝나면 report_unlocks에 (device_id, concept_id) 한 줄을 남긴다.
//
// 금액 검증: 클라이언트가 보낸 amount가 아니라, 토스가 실제로 승인한 결제금액(KRW)을
// 서버가 report_concepts.price_krw와 직접 대조해서 확인한다 — 개발자도구로 금액을 조작해도
// 실제 가격과 다르면 거부되고 지급되지 않는다.
// 중복 지급 방지: order_id 유니크 제약(같은 결제가 두 번 승인 호출돼도 1회만 기록) +
// device_id+concept_id 유니크 제약(같은 리포트를 두 번 결제해도 보유 상태는 1건만 유지).

const { ensureDevice, sbFetch, readJsonBody } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ ok: false, error: 'NO_SECRET_KEY', message: 'TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const body = await readJsonBody(req);
  const { paymentKey, orderId, amount, deviceId, conceptId } = body || {};
  if (!paymentKey || !orderId || !amount || !deviceId || !conceptId) {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }

  try {
    const conceptRes = await sbFetch(
      '/report_concepts?id=eq.' + encodeURIComponent(conceptId) + '&select=id,price_krw,active'
    );
    if (!conceptRes.ok) {
      res.status(500).json({ ok: false, error: 'CONCEPT_LOOKUP_FAILED' });
      return;
    }
    const concepts = await conceptRes.json();
    const concept = concepts[0];
    if (!concept || !concept.active) {
      res.status(400).json({ ok: false, error: 'UNKNOWN_CONCEPT', message: '존재하지 않거나 비활성화된 리포트입니다.' });
      return;
    }

    const basicAuth = Buffer.from(secretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + basicAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    const data = await tossRes.json();

    if (!tossRes.ok) {
      res.status(tossRes.status).json({ ok: false, error: data.code || 'CONFIRM_FAILED', message: data.message || '결제 승인에 실패했습니다.' });
      return;
    }

    if (data.totalAmount !== concept.price_krw) {
      // 토스 승인은 됐지만, 이 리포트의 실제 가격과 승인 금액이 다름 — 지급하지 않음(조작/오류 방지).
      res.status(400).json({ ok: false, error: 'AMOUNT_MISMATCH', message: '결제 금액이 올바르지 않습니다. 고객센터로 문의해주세요.' });
      return;
    }

    await ensureDevice(deviceId);
    const insertRes = await sbFetch('/report_unlocks', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        device_id: deviceId,
        concept_id: conceptId,
        order_id: data.orderId,
        amount: data.totalAmount
      })
    });
    if (insertRes.status !== 409 && !insertRes.ok) {
      const text = await insertRes.text().catch(function () { return ''; });
      res.status(500).json({ ok: false, error: 'UNLOCK_INSERT_FAILED', message: text });
      return;
    }
    // 409(이미 같은 order_id 또는 같은 device+concept가 있음)도 "이미 지급됨"으로 정상 처리한다.

    res.status(200).json({ ok: true, conceptId: conceptId, orderId: data.orderId, approvedAt: data.approvedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
