// 일러스트 상세 리포트 관리자 전용 엔드포인트 (비밀번호: Vercel 환경변수 ADMIN_SECRET, 캐릭터
// 관리자 기능 때 쓰던 것과 동일한 x-admin-secret 헤더 체크를 그대로 재사용).
// body.action 으로 분기:
//   'save-concept'  { id?, title, tagline, cost, imageBase64?, imageMime?, existingCoverUrl? }
//   'delete-concept'{ id }                         — 컨셉과 그 안의 컷(panels)까지 함께 삭제(DB가 cascade 처리)
//   'save-panel'    { id?, conceptId, sortOrder, captionTemplate, imageBase64?, imageMime?, existingImgUrl? }
//   'delete-panel'  { id }

const { sbFetch, uploadStorageImage, checkAdminSecret, readJsonBody } = require('../_supabase');

function slugify(title) {
  var base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'concept') + '-' + Date.now().toString(36).slice(-5);
}

async function uploadIfProvided(bucket, idForPath, body) {
  if (!body.imageBase64) return body.existingCoverUrl || body.existingImgUrl || null;
  var mime = body.imageMime || 'image/jpeg';
  var ext = mime.indexOf('png') !== -1 ? 'png' : 'jpg';
  var buffer = Buffer.from(body.imageBase64, 'base64');
  return uploadStorageImage(bucket, idForPath + '-' + Date.now() + '.' + ext, buffer, mime);
}

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
  const action = body && body.action;

  try {
    if (action === 'save-concept') {
      const id = body.id || slugify(body.title);
      const coverUrl = await uploadIfProvided('report-images', id + '-cover', body);
      const r = await sbFetch('/report_concepts', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          id: id,
          title: body.title,
          tagline: body.tagline || '',
          cost: Number(body.cost) || 20,
          cover_img_url: coverUrl,
          active: body.active !== false,
          sort_order: Number(body.sortOrder) || 0,
          updated_at: new Date().toISOString()
        })
      });
      if (!r.ok) {
        const text = await r.text().catch(function () { return ''; });
        res.status(500).json({ ok: false, error: 'SAVE_FAILED', message: text });
        return;
      }
      const rows = await r.json();
      res.status(200).json({ ok: true, row: rows[0] });
      return;
    }

    if (action === 'delete-concept') {
      if (!body.id) { res.status(400).json({ ok: false, error: 'MISSING_ID' }); return; }
      const r = await sbFetch('/report_concepts?id=eq.' + encodeURIComponent(body.id), { method: 'DELETE' });
      if (!r.ok) { res.status(500).json({ ok: false, error: 'DELETE_FAILED' }); return; }
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'save-panel') {
      if (!body.conceptId) { res.status(400).json({ ok: false, error: 'MISSING_CONCEPT_ID' }); return; }
      const panelKey = 'panel-' + (body.id || Date.now());
      const imgUrl = await uploadIfProvided('report-images', body.conceptId + '-' + panelKey, body);
      const payload = {
        concept_id: body.conceptId,
        sort_order: Number(body.sortOrder) || 0,
        img_url: imgUrl,
        caption_template: body.captionTemplate || ''
      };
      let r;
      if (body.id) {
        r = await sbFetch('/report_panels?id=eq.' + encodeURIComponent(body.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        });
      } else {
        r = await sbFetch('/report_panels', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        });
      }
      if (!r.ok) {
        const text = await r.text().catch(function () { return ''; });
        res.status(500).json({ ok: false, error: 'SAVE_FAILED', message: text });
        return;
      }
      const rows = await r.json();
      res.status(200).json({ ok: true, row: rows[0] });
      return;
    }

    if (action === 'delete-panel') {
      if (!body.id) { res.status(400).json({ ok: false, error: 'MISSING_ID' }); return; }
      const r = await sbFetch('/report_panels?id=eq.' + encodeURIComponent(body.id), { method: 'DELETE' });
      if (!r.ok) { res.status(500).json({ ok: false, error: 'DELETE_FAILED' }); return; }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
