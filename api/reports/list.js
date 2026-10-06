// 일러스트 상세 리포트(웹툰형 컷) 컨셉 목록 — 누구나 볼 수 있는 공개 엔드포인트.
// 실제 컷 내용(panels)은 /api/reports/panels 에서 따로 받아온다.

const { sbFetch } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const r = await sbFetch(
      '/report_concepts?active=eq.true&select=id,title,tagline,cover_img_url,cost&order=sort_order.asc',
      { method: 'GET' }
    );
    if (!r.ok) {
      res.status(500).json({ ok: false, error: 'QUERY_FAILED' });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
