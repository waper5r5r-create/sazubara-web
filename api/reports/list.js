// 일러스트 상세 리포트(웹툰형 컷) — 컨셉 목록 + 컷(panel) 목록을 한 파일로 합쳤습니다.
// Vercel Hobby 플랜의 서버리스 함수 12개 제한 때문에 api/reports/panels.js를 따로 두지 않고
// 같은 /api/reports/list 경로에 conceptId 유무로 분기했습니다 — 둘 다 공개 엔드포인트입니다.
//
// GET /api/reports/list                 → 컨셉 목록(기존 list.js와 동일)
// GET /api/reports/list?conceptId=...   → 그 컨셉의 컷 목록(기존 panels.js와 동일)
//   (이 앱의 다른 "크레딧으로 열어보기" 콘텐츠들과 동일하게, 잠금 해제는 클라이언트 UI에서만
//    처리한다 — 크레딧 적립 자체가 로컬에서 처리되는 구조라 서버가 "해금 여부"를 증명해줄 방법이
//    없기 때문. 문구 템플릿의 {name}/{dayGanWx} 등 자리표시자는 클라이언트가 본인 사주로 채운다.)

const { sbFetch, getQuery } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const q = getQuery(req);
  const conceptId = q.conceptId || '';

  try {
    if (conceptId) {
      const r = await sbFetch(
        '/report_panels?concept_id=eq.' +
          encodeURIComponent(conceptId) +
          '&select=id,sort_order,img_url,caption_template&order=sort_order.asc',
        { method: 'GET' }
      );
      if (!r.ok) {
        res.status(500).json({ ok: false, error: 'QUERY_FAILED' });
        return;
      }
      const rows = await r.json();
      res.status(200).json({ ok: true, rows: rows });
      return;
    }

    const r = await sbFetch(
      '/report_concepts?active=eq.true&select=id,title,tagline,cover_img_url,price_krw&order=sort_order.asc',
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
