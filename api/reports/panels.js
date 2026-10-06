// 특정 컨셉의 컷(panel) 목록 — 이미지 + 문구 템플릿. 누구나 받아올 수 있는 공개 엔드포인트.
// (이 앱의 다른 "크레딧으로 열어보기" 콘텐츠들과 동일하게, 잠금 해제는 클라이언트 UI에서만
//  처리한다 — 크레딧 적립 자체가 로컬에서 처리되는 구조라 서버가 "해금 여부"를 증명해줄 방법이
//  없기 때문. 문구 템플릿의 {name}/{dayGanWx} 등 자리표시자는 클라이언트가 본인 사주로 채운다.)

const { sbFetch, getQuery } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const q = getQuery(req);
  const conceptId = q.conceptId || '';
  if (!conceptId) {
    res.status(400).json({ ok: false, error: 'MISSING_CONCEPT_ID' });
    return;
  }

  try {
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
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
