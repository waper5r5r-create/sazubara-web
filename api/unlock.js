// 크레딧 폐지 이후 생긴, "리포트(이야기) 건별결제"를 제외한 모든 유료 콘텐츠의 공용 결제 엔드포인트.
// 토스페이먼츠 결제 승인 API를 "서버에서만" 호출합니다(/api/reports/unlock과 동일한 패턴).
//
// 다루는 unlock_key 종류:
// - feature-saju-deep     : 고민상담 전체 카테고리 (4,900원, 기기당 1회, 평생)
// - feature-today-premium : 월간/신년 프리미엄 + 오늘의 케미 상세 (990원, 기기당 1회, 평생)
// - compat-<pairKey>      : 궁합 상세 리포트 (990원, 기기+조합 쌍마다 1회)
//
// 지급 금액은 클라이언트가 보낸 값이 아니라, 토스가 실제로 승인한 결제금액(KRW)을 서버가 직접
// PAID_UNLOCK_PRICE_BY_KEY(또는 compat- 접두사는 고정가)에 대조해서 검증합니다.
// 같은 orderId로 다시 호출돼도 DB의 unique 제약 때문에 중복 지급되지 않습니다.

const { ensureDevice, sbFetch, getQuery, readJsonBody } = require('./_supabase');

const PAID_UNLOCK_PRICE_BY_KEY = {
  'feature-saju-deep': 4900,
  'feature-today-premium': 990
};
const COMPAT_DETAIL_PRICE = 990;

function priceForUnlockKey(key) {
  if (typeof key !== 'string' || !key) return null;
  if (PAID_UNLOCK_PRICE_BY_KEY[key] != null) return PAID_UNLOCK_PRICE_BY_KEY[key];
  if (['연애','직장','재물','건강','인간관계'].some(cat => key === 'feature-saju-deep:' + cat)) return 990;
  if (key.indexOf('compat-') === 0) return COMPAT_DETAIL_PRICE;
  return null;
}

async function handleGet(req, res) {
  const q = getQuery(req);
  const deviceId = q.device_id || '';
  if (!deviceId) {
    res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
    return;
  }
  try {
    const r = await sbFetch(
      '/paid_unlocks?device_id=eq.' + encodeURIComponent(deviceId) + '&select=unlock_key'
    );
    if (!r.ok) {
      res.status(500).json({ ok: false, error: 'QUERY_FAILED' });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows.map(function (row) { return row.unlock_key; }) });
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
  const { paymentKey, orderId, amount, deviceId, unlockKey } = body || {};
  if (!paymentKey || !orderId || !amount || !deviceId || !unlockKey) {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }

  const price = priceForUnlockKey(unlockKey);
  if (!price) {
    res.status(400).json({ ok: false, error: 'UNKNOWN_UNLOCK_KEY', message: '알 수 없는 잠금 항목입니다.' });
    return;
  }

  if (!Number.isSafeInteger(amount) || amount !== price) {
    res.status(400).json({ ok: false, error: 'AMOUNT_MISMATCH', message: '가격이 변경되었어요. 상품 화면에서 다시 시작해주세요.' });
    return;
  }

  try {
    const existing = await sbFetch('/paid_unlocks?order_id=eq.' + encodeURIComponent(orderId) + '&select=device_id,unlock_key,amount');
    if (!existing.ok) throw new Error('ORDER_LOOKUP_FAILED');
    const rows = await existing.json();
    const matches = row => row.device_id === deviceId && row.unlock_key === unlockKey && row.amount === price;
    if (rows.length) {
      res.status(matches(rows[0]) ? 200 : 409).json(matches(rows[0]) ? {ok:true,unlockKey,orderId} : {ok:false,error:'ORDER_CONFLICT'});
      return;
    }
    const basicAuth = Buffer.from(secretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + basicAuth,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    const data = await tossRes.json();

    if (!tossRes.ok) {
      res.status(tossRes.status).json({ ok: false, error: data.code || 'CONFIRM_FAILED', message: data.message || '결제 승인에 실패했습니다.' });
      return;
    }

    if (data.totalAmount !== price || data.orderId !== orderId || data.status !== 'DONE' || data.currency !== 'KRW') {
      // 토스 승인은 됐지만 이 unlock_key의 실제 가격과 승인 금액이 다름 — 지급하지 않음(조작/오류 방지).
      res.status(400).json({ ok: false, error: 'AMOUNT_MISMATCH', message: '결제 금액이 올바르지 않습니다. 고객센터로 문의해주세요.' });
      return;
    }

    await ensureDevice(deviceId);
    const insertRes = await sbFetch('/paid_unlocks', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        device_id: deviceId,
        unlock_key: unlockKey,
        order_id: data.orderId,
        amount: data.totalAmount
      })
    });
    if (!insertRes.ok) {
      if (insertRes.status !== 409) throw new Error('UNLOCK_INSERT_FAILED');
      const conflict = await sbFetch('/paid_unlocks?order_id=eq.' + encodeURIComponent(orderId) + '&select=device_id,unlock_key,amount');
      if (!conflict.ok) throw new Error('ORDER_LOOKUP_FAILED');
      const saved = await conflict.json();
      if (!saved.some(matches)) {
        res.status(409).json({ok:false,error:'ORDER_CONFLICT'});
        return;
      }
    }

    res.status(200).json({ ok: true, unlockKey: unlockKey, orderId: data.orderId, approvedAt: data.approvedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
};
