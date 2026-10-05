// 캐릭터 삭제. save.js와 마찬가지로 관리자 비밀번호(x-admin-secret)가 맞아야만 동작합니다.
// 이미지 파일 자체(Storage)는 지우지 않고 DB 행만 지웁니다 — 저장 공간이 크게 중요하지 않고,
// 실수로 지웠을 때 이미지 URL이 남아있으면 복구가 더 쉽기 때문입니다.

const { sbFetch, checkAdminSecret, readJsonBody } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!checkAdminSecret(req)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return;
  }

  const body = await readJsonBody(req);
  const id = (body.id || '').trim();
  if (!id) {
    res.status(400).json({ ok: false, error: 'MISSING_ID' });
    return;
  }

  try {
    const r = await sbFetch('/characters?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    });
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'DELETE_FAILED', message: text });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
