const pocha = require('../_pocha-content');
// Two independent purchases; historic report_unlocks still grants both stages.
const { ensureDevice, sbFetch, getQuery, readJsonBody } = require('../_supabase');
const { STAGE_PRICE, STAGES, stageKey, rowsAt, reportAccess } = require('../_report-access');
const { signQuote, verifyQuote, newOrderId } = require('../_payment-quote');

async function handleGet(req, res) {
  const { device_id: deviceId } = getQuery(req);
  if (!deviceId) return res.status(400).json({ ok: false, error: 'MISSING_DEVICE_ID' });
  const [legacy, stages] = await Promise.all([
    rowsAt('/report_unlocks?device_id=eq.' + encodeURIComponent(deviceId) + '&select=concept_id'),
    rowsAt('/paid_unlocks?device_id=eq.' + encodeURIComponent(deviceId) + '&select=unlock_key')
  ]);
  res.status(200).json({ ok: true, rows: legacy.map(r => r.concept_id), stageKeys: stages.map(r => r.unlock_key).filter(k => /^report-(story|detail)-/.test(k)) });
}

async function prepareCheckout(body,res){
  const {deviceId,conceptId,stage}=body;
  if(typeof deviceId!=='string'||!deviceId||typeof conceptId!=='string'||!conceptId||!STAGES.includes(stage)) return res.status(400).json({ok:false,error:'MISSING_FIELDS'});
  if(!process.env.TOSS_SECRET_KEY) return res.status(503).json({ok:false,error:'PAYMENT_UNAVAILABLE',message:'결제 연결을 준비 중이에요.'});
  const concepts=conceptId===pocha.concept.id ? [pocha.concept] : await rowsAt('/report_concepts?id=eq.'+encodeURIComponent(conceptId)+'&select=id,title,active');
  if(!concepts[0]||!concepts[0].active) return res.status(400).json({ok:false,error:'UNKNOWN_CONCEPT'});
  const access=await reportAccess(deviceId,conceptId);
  if(stage==='detail'&&!access.story) return res.status(409).json({ok:false,error:'STORY_REQUIRED',message:'이야기를 먼저 열어주세요.'});
  if(access[stage]) return res.status(409).json({ok:false,error:'ALREADY_OWNED',message:'이미 보유한 콘텐츠예요.'});
  const fields={orderId:newOrderId(),deviceId,conceptId,stage,amount:STAGE_PRICE[stage]};
  res.status(200).json({ok:true,orderId:fields.orderId,amount:STAGE_PRICE[stage],quote:signQuote(fields)});
}

async function handlePost(req, res) {
  const body = await readJsonBody(req);
  if(body.action==='prepare') return prepareCheckout(body,res);
  const { paymentKey, orderId, amount, deviceId, conceptId, stage, quote } = body;
  if (!paymentKey || !orderId || !deviceId || !conceptId || !Number.isSafeInteger(amount)) {
    return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  }
  // The old full-report checkout can finish during the rollout. New UI always sends stage.
  const legacy = stage == null && amount === 4900;
  if (!legacy && !STAGES.includes(stage)) return res.status(400).json({ ok: false, error: 'INVALID_STAGE' });
  const price = legacy ? 4900 : STAGE_PRICE[stage];
  if(!legacy&&!verifyQuote(quote,{orderId,deviceId,conceptId,stage,amount:price})) return res.status(400).json({ok:false,error:'INVALID_CHECKOUT',message:'상품 화면에서 결제를 다시 시작해주세요.'});
  if (amount !== price) return res.status(400).json({ ok: false, error: 'AMOUNT_MISMATCH', message: '결제 금액이 올바르지 않아요. 상품 화면에서 다시 시작해주세요.' });
  const concepts = conceptId===pocha.concept.id ? [pocha.concept] : await rowsAt('/report_concepts?id=eq.' + encodeURIComponent(conceptId) + '&select=id,active');
  if (legacy && conceptId===pocha.concept.id) return res.status(400).json({ok:false,error:'INVALID_STAGE'});
  if (!concepts[0] || !concepts[0].active) return res.status(400).json({ ok: false, error: 'UNKNOWN_CONCEPT' });
  const key = stageKey(conceptId, stage);
  const table = legacy ? 'report_unlocks' : 'paid_unlocks';
  const previous = await rowsAt('/' + table + '?order_id=eq.' + encodeURIComponent(orderId) + '&select=*');
  if (previous.length) {
    const row = previous[0];
    if (row.device_id !== deviceId || row.amount !== amount || (legacy ? row.concept_id !== conceptId : row.unlock_key !== key)) {
      return res.status(409).json({ ok: false, error: 'ORDER_CONFLICT' });
    }
    return res.status(200).json({ ok: true, conceptId, stage: legacy ? 'legacy' : stage, orderId });
  }
  const access = await reportAccess(deviceId, conceptId);
  if (stage === 'detail' && !access.story) return res.status(409).json({ ok: false, error: 'STORY_REQUIRED', message: '이야기를 먼저 열어주세요.' });
  if (legacy ? access.legacy : access[stage]) return res.status(409).json({ ok: false, error: 'ALREADY_OWNED', message: '이미 보유한 콘텐츠예요. 상품 화면으로 돌아가주세요.' });
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return res.status(503).json({ ok: false, error: 'PAYMENT_UNAVAILABLE', message: '결제 연결을 준비 중이에요.' });
  const authorization = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
    body: JSON.stringify({ paymentKey, orderId, amount })
  });
  let data = await tossRes.json();
  // Recover approval that succeeded before a network/DB failure, without approving again.
  if (!tossRes.ok && ['ALREADY_PROCESSED_PAYMENT', 'DUPLICATED_REQUEST'].includes(data.code)) {
    const lookup = await fetch('https://api.tosspayments.com/v1/payments/' + encodeURIComponent(paymentKey), { headers: { Authorization: authorization } });
    if (!lookup.ok) return res.status(502).json({ ok: false, error: 'PAYMENT_LOOKUP_FAILED' });
    data = await lookup.json();
  } else if (!tossRes.ok) return res.status(tossRes.status).json({ ok: false, error: data.code || 'CONFIRM_FAILED', message: data.message || '결제를 승인하지 못했어요.' });
  if (data.totalAmount !== price || data.orderId !== orderId || data.status !== 'DONE' || data.currency !== 'KRW') {
    return res.status(400).json({ ok: false, error: 'PAYMENT_MISMATCH' });
  }
  await ensureDevice(deviceId);
  const payload = { device_id: deviceId, order_id: orderId, amount: data.totalAmount };
  if (legacy) payload.concept_id = conceptId; else payload.unlock_key = key;
  const insert = await sbFetch('/' + table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  if (!insert.ok) {
    if (insert.status === 409) {
      const after = await rowsAt('/' + table + '?order_id=eq.' + encodeURIComponent(orderId) + '&select=*');
      if (!after.some(r => r.device_id === deviceId && r.amount === amount && (legacy ? r.concept_id === conceptId : r.unlock_key === key))) {
        return res.status(409).json({ ok: false, error: 'UNLOCK_CONFLICT', message: '구매 내역을 확인하지 못했어요. 같은 결제 확인 주소에서 다시 시도해주세요.' });
      }
    } else return res.status(500).json({ ok: false, error: 'UNLOCK_INSERT_FAILED' });
  }
  res.status(200).json({ ok: true, conceptId, stage: legacy ? 'legacy' : stage, orderId, approvedAt: data.approvedAt });
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (e) { res.status(500).json({ ok: false, error: 'SERVER_ERROR' }); }
};
