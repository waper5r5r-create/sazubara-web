// 후기 관리 (관리자 전용, x-admin-secret = Vercel 환경변수 ADMIN_SECRET).
// Vercel 무료 요금제의 함수 개수(12개) 제한 때문에 따로 함수를 만들지 않고 /api/admin/reports?scope=reviews 로 들어온다.
// body.action:
//   'list'    { conceptId?, status? }   전체 후기(숨긴 것 포함)와 상품 목록
//   'hide'    { id, reason }            숨기기 — 사유 필수
//   'unhide'  { id }                    다시 공개
//   'reply'   { id, reply }             사장님 답글. 빈 글이면 답글 지우기
//   'delete'  { id, reason }            삭제 — 사유 필수
// 후기 글을 고치거나 새로 만드는 기능은 일부러 없다. 고객 글을 바꾸거나 만들어 넣으면 가짜 후기가 된다.
// 별점이 낮다는 이유만으로 숨기는 것도 안 된다(공정위 기준). 그래서 사유를 아래 목록에서만 고르고, 기록을 남긴다.
const { sbFetch, checkAdminSecret, readJsonBody } = require('../_supabase');
const { PRODUCTS } = require('../_review-products');

const REASONS = Object.freeze(['욕설·비방', '개인정보 포함', '광고·스팸', '상품과 무관', '작성자 요청']);
const ID_RE = /^[0-9a-f-]{36}$/;

async function json(r) { if (!r.ok) throw new Error('DB_' + r.status); return r.json(); }

async function findReview(id) {
  const rows = await json(await sbFetch('/report_reviews?id=eq.' + id + '&select=id,concept_id,rating'));
  return rows[0] || null;
}

async function log(review, action, reason) {
  await sbFetch('/review_moderation_log', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ review_id: review.id, concept_id: review.concept_id, rating: review.rating, action, reason: reason || null })
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (!checkAdminSecret(req)) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  const body = (await readJsonBody(req)) || {};
  const action = body.action;
  try {
    if (action === 'list') {
      let path = '/report_reviews?select=id,concept_id,rating,text,status,hidden_reason,reply,created_at&order=created_at.desc&limit=500';
      if (typeof body.conceptId === 'string' && PRODUCTS[body.conceptId]) path += '&concept_id=eq.' + encodeURIComponent(body.conceptId);
      if (body.status === 'visible' || body.status === 'hidden') path += '&status=eq.' + body.status;
      const rows = await json(await sbFetch(path));
      const products = Object.entries(PRODUCTS).map(([id, p]) => ({ id, title: p.title }));
      return res.status(200).json({ ok: true, rows, products, reasons: REASONS });
    }

    const id = typeof body.id === 'string' && ID_RE.test(body.id) ? body.id : '';
    if (!id) return res.status(400).json({ ok: false, error: 'MISSING_ID' });
    const review = await findReview(id);
    if (!review) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    const at = '/report_reviews?id=eq.' + id;
    const patch = data => sbFetch(at, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error('DB_' + r.status); });

    if (action === 'hide' || action === 'delete') {
      if (!REASONS.includes(body.reason)) return res.status(400).json({ ok: false, error: 'REASON_REQUIRED', reasons: REASONS });
      if (action === 'hide') await patch({ status: 'hidden', hidden_reason: body.reason, hidden_at: new Date().toISOString() });
      else { const r = await sbFetch(at, { method: 'DELETE' }); if (!r.ok) throw new Error('DB_' + r.status); }
      await log(review, action, body.reason);
      return res.status(200).json({ ok: true });
    }
    if (action === 'unhide') {
      await patch({ status: 'visible', hidden_reason: null, hidden_at: null });
      await log(review, 'unhide');
      return res.status(200).json({ ok: true });
    }
    if (action === 'reply') {
      const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
      if (reply.length > 500) return res.status(400).json({ ok: false, error: 'REPLY_TOO_LONG' });
      await patch(reply ? { reply, replied_at: new Date().toISOString() } : { reply: null, replied_at: null });
      await log(review, 'reply');
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
};
