// 리포트(이야기) 건별 결제 관련 2개 엔드포인트(보유 목록 조회 / 결제 승인)를 한 파일로 합쳤습니다.
// Vercel Hobby 플랜의 서버리스 함수 12개 제한 때문에 api/reports/unlocks.js, api/reports/unlock-confirm.js
// 2개였던 걸 메서드(GET/POST)로 분기해서 이 파일 하나로 합쳤습니다 — 각 동작 자체는 그대로입니다.
//
// GET  /api/reports/unlock?device_id=...   이 기기가 실제로 결제해서 보유 중인 리포트 concept_id 목록.
//   누구나 조회 가능한 공개 엔드포인트(device_id 자체가 추측 불가능한 무작위 문자열이라 안전).
//   credit_ledger처럼 "아직 안 받은 줄만" 증분으로 주지 않고 매번 전체 목록을 돌려준다 — 리포트는
//   가짓수가 적고(기기당 결제 건수가 많아야 수십 건) 한 번 사면 영구 보유라 가볍다.
//
// POST /api/reports/unlock  body:{paymentKey, orderId, amount, deviceId, conceptId}
//   리포트(유료 상세 풀이) 건별(원화) 결제 승인 — 크레딧 장부와는 완전히 별개 경로다.
//   토스페이먼츠 결제 승인 API를 "서버에서만" 호출하고(/api/toss/confirm과 동일한 패턴),
//   결제가 끝나면 report_unlocks에 (device_id, concept_id) 한 줄을 남긴다.
//   금액 검증: 클라이언트가 보낸 amount가 아니라, 토스가 실제로 승인한 결제금액(KRW)을
//   서버가 report_concepts.price_krw와 직접 대조해서 확인한다.
//   중복 지급 방지: order_id 유니크 제약 + device_id+concept_id 유니크 제약.

const { ensureDevice, sbFetch, getQuery, readJsonBody } = require('../_supabase');

async function handleGet(req, res) {
  const q = getQuery(req);
  const deviceId = q.device_id || '';
  if (!deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
    return;
  }
  try {
    const r = await sbFetch(
      '/report_unlocks?device_id=eq.' + encodeURIComponent(deviceId) + '&select=concept_id'
    );
    if (!r.ok) {
      res.status(500).json({ ok: false, error: 'QUERY_FAILED' });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows.map(function (row) { return row.concept_id; }) });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
}

async function handlePost(req, res) {
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
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
};
