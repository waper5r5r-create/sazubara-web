// 구매 확인 후기.
// GET  ?conceptId=…[&deviceId=…]  공개된 후기, 개수·평균 별점, (deviceId가 오면) 이 기기가 쓸 수 있는지
// POST { conceptId, deviceId, rating, text, publishConsent }  실제로 산 기기만, 상품마다 1번
// conceptId는 이야기 id 또는 compat / today-premium / saju-deep (api/_review-products.js).
// 후기 글은 관리자도 고칠 수 없다. 관리자는 숨기기·답글·삭제만 한다(api/admin/reviews.js).
const { createHash } = require('node:crypto');
const { sbFetch, getQuery } = require('../_supabase');
const { productOf, ownsProduct, rowsAt } = require('../_review-products');

const reviewerHashOf = (conceptId, deviceId) => createHash('sha256').update(conceptId + '\0' + deviceId).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false });
  const body = req.method === 'POST' ? (req.body || {}) : getQuery(req);
  const conceptId = typeof body.conceptId === 'string' ? body.conceptId : '';
  if (!/^[\p{L}\p{N}_-]{1,100}$/u.test(conceptId)) return res.status(400).json({ ok: false, message: '상품을 확인해주세요.' });
  if (!productOf(conceptId)) return res.status(404).json({ ok: false });
  const deviceId = typeof body.deviceId === 'string' && body.deviceId.length >= 8 && body.deviceId.length <= 150 ? body.deviceId : '';
  const concept = encodeURIComponent(conceptId);
  try {
    if (req.method === 'GET') {
      const [rows, ratings] = await Promise.all([
        rowsAt('/report_reviews?concept_id=eq.' + concept + '&status=eq.visible&select=rating,text,reply,created_at,reviewer_hash&order=created_at.desc&limit=20'),
        rowsAt('/report_reviews?concept_id=eq.' + concept + '&status=eq.visible&select=rating')
      ]);
      const count = ratings.length;
      const average = count ? Math.round(ratings.reduce((s, r) => s + r.rating, 0) / count * 10) / 10 : null;
      let canWrite = false;
      if (deviceId) {
        const mine = await rowsAt('/report_reviews?concept_id=eq.' + concept + '&reviewer_hash=eq.' + reviewerHashOf(conceptId, deviceId) + '&select=id');
        canWrite = !mine.length && await ownsProduct(deviceId, conceptId);
      }
      return res.status(200).json({
        ok: true, count, average, canWrite,
        rows: rows.map(r => ({
          rating: r.rating, text: r.text, reply: r.reply || null, createdAt: r.created_at,
          displayName: '구매자 ' + (r.reviewer_hash || '').slice(0, 4).toUpperCase(), verified: true
        }))
      });
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 10 || text.length > 500 || !deviceId || body.publishConsent !== true) {
      return res.status(400).json({ ok: false, message: '별점, 10~500자 후기, 공개 동의를 확인해주세요.' });
    }
    if (!await ownsProduct(deviceId, conceptId)) return res.status(403).json({ ok: false, message: '이 상품을 구매한 뒤 후기를 남길 수 있어요.' });
    const response = await sbFetch('/report_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ concept_id: conceptId, reviewer_hash: reviewerHashOf(conceptId, deviceId), rating, text }) });
    if (response.status === 409) return res.status(409).json({ ok: false, message: '이 상품에는 이미 후기를 남겼어요.' });
    if (!response.ok) throw new Error('WRITE_FAILED');
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(503).json({ ok: false, message: '후기를 불러오거나 저장하지 못했어요. 잠시 후 다시 시도해주세요.' });
  }
};
