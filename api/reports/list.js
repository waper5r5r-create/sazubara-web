const pocha = require('../_pocha-content');
const { sbFetch, getQuery, checkAdminSecret } = require('../_supabase');
const { STAGE_PRICE, rowsAt, reportAccess } = require('../_report-access');

function shortSentences(text) {
  return String(text).match(/[^.!?]+[.!?]?/g)?.slice(0, 2).join('').trim() || '';
}
function storyCaption(tpl) {
  // Keep branch syntax intact while shortening each personalised narrative.
  return String(tpl || '').replace(/\{\{branch:(\w+)\|((?:(?!\}\})[\s\S])*?)\}\}/g, (m, name, body) =>
    '{{branch:' + name + '|' + body.split('||').map(pair => {
      const at = pair.indexOf('::');
      return at < 0 ? pair : pair.slice(0, at + 2) + shortSentences(pair.slice(at + 2));
    }).join('||') + '}}');
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  const q = getQuery(req), conceptId = q.conceptId || '';
  try {
    if (conceptId === pocha.concept.id) {
      const access = await reportAccess(q.device_id || '', conceptId);
      return res.status(200).json({ok:true, rows:access.story ? pocha.panels : pocha.panels.slice(0,6), detailRows:access.detail ? pocha.panels : [], access, preview:!access.story, storyCount:pocha.panels.length});
    }
    if (conceptId) {
      const concepts = await rowsAt('/report_concepts?id=eq.' + encodeURIComponent(conceptId) + '&select=id,active');
      const admin = checkAdminSecret(req);
      if (!concepts[0] || (!concepts[0].active && !admin)) return res.status(404).json({ ok: false, error: 'UNKNOWN_CONCEPT' });
      const panels = await rowsAt('/report_panels?concept_id=eq.' + encodeURIComponent(conceptId) + '&select=id,sort_order,img_url,caption_template,tone,img_variants&order=sort_order.asc');
      if (admin) return res.status(200).json({ ok: true, rows: panels, access: { story: true, detail: true, legacy: true } });
      const access = await reportAccess(q.device_id || '', conceptId);
      // Preserve every original scene and its complete narrative in the paid webtoon.
      let lastArt = null;
      const firstArt = panels.find(p => p.img_url || (p.img_variants && Object.keys(p.img_variants).length));
      const story = panels.map(p => {
        if (p.img_url || (p.img_variants && Object.keys(p.img_variants).length)) lastArt = p;
        const art = lastArt || firstArt || {};
        return {...p, img_url:p.img_url || art.img_url, img_variants:p.img_variants || art.img_variants};
      });
      const preview = story.slice(0, 1);
      res.status(200).json({ ok: true, rows: access.story ? story : preview, detailRows: access.detail ? panels : [], access, preview: !access.story, storyCount: story.length });
      return;
    }
    const r = await sbFetch('/report_concepts?active=eq.true&select=id,title,tagline,cover_img_url,price_krw,category&order=sort_order.asc');
    if (!r.ok) throw new Error('QUERY_FAILED');
    const rows = (await r.json()).map(c => ({ ...c, price_krw: STAGE_PRICE.story, detail_price_krw: STAGE_PRICE.detail }));
    res.status(200).json({ ok: true, rows: rows.concat([pocha.concept]) });
  } catch (e) { res.status(500).json({ ok: false, error: 'SERVER_ERROR' }); }
};
