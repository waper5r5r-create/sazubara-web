// 캐릭터 궁합 갤러리에 쓰이는 "전체 캐릭터 목록" — 로그인 없이 누구나 볼 수 있는 공개 엔드포인트.
// 실제 쓰기(추가/수정/삭제)는 save.js / delete.js 쪽에서 관리자 비밀번호로만 허용한다.

const { sbFetch } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const r = await sbFetch('/characters?select=*&order=sort_order.asc,created_at.asc', { method: 'GET' });
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'QUERY_FAILED', message: text });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, rows: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
