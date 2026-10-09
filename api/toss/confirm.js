// 토스페이먼츠 결제 승인 API를 "서버에서만" 호출합니다.
// 시크릿 키는 절대 클라이언트로 내려가지 않고, 이 서버리스 함수(Vercel 환경변수) 안에만 존재합니다.
// 참고: https://docs.tosspayments.com/reference#결제-승인
//
// 크레딧 적립은 Supabase(서버 DB)의 credit_ledger에 한 줄 남기는 방식으로 처리합니다.
// - 지급할 크레딧 개수는 클라이언트가 보낸 값이 아니라, 토스가 실제로 승인한 결제금액(KRW)을
//   서버가 직접 금액표(CREDIT_PACKS_BY_KRW)에 대조해서 정합니다 — 그래서 브라우저 개발자도구로
//   결제금액/크레딧개수를 조작해도 실제로 지급되는 크레딧은 바뀌지 않습니다.
// - 같은 주문번호(orderId)로 다시 호출돼도 DB의 unique 제약 때문에 크레딧이 두 번 적립되지 않습니다.

const { ensureDevice, insertLedger, readJsonBody } = require('../_supabase');

const CREDIT_PACKS_BY_KRW = { 3900: 30, 9900: 80, 19900: 200 };

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
  const { paymentKey, orderId, amount, deviceId } = body || {};
  if (!paymentKey || !orderId || !amount || !deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }

  try {
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

    const creditAmt = CREDIT_PACKS_BY_KRW[data.totalAmount];
    if (!creditAmt) {
      // 토스 승인은 됐지만, 사주바라가 파는 크레딧팩 금액과 일치하지 않음 — 지급하지 않음(조작/오류 방지).
      res.status(400).json({ ok: false, error: 'UNKNOWN_AMOUNT', message: '알 수 없는 결제 금액입니다. 고객센터로 문의해주세요.' });
      return;
    }

    await ensureDevice(deviceId);
    await insertLedger({ deviceId: deviceId, amount: creditAmt, reason: '크레딧 충전', orderId: data.orderId });

    res.status(200).json({
      ok: true,
      orderId: data.orderId,
      amount: creditAmt,
      approvedAt: data.approvedAt
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
