// 캐릭터 궁합용 캐릭터를 추가하거나 수정합니다. 관리자 비밀번호(x-admin-secret 헤더)가 맞아야만 동작하고,
// 이 비밀번호는 Vercel 환경변수 ADMIN_SECRET으로만 설정합니다(코드에 하드코딩하지 않음).
// 이미지는 브라우저에서 리사이즈한 뒤 base64로 보내고, 여기서 Supabase Storage에 업로드해 공개 URL을 만듭니다.

const { sbFetch, uploadStorageImage, checkAdminSecret, readJsonBody } = require('../_supabase');

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

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
  const name = (body.name || '').trim();
  const opts = body.opts || {};
  if (!name || !opts.year || !opts.month || !opts.day) {
    res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    return;
  }

  // id가 오면 기존 캐릭터 수정(업서트), 없으면 새 캐릭터 — 한글 이름을 그대로 URL/파일 경로에 쓰지 않도록
  // 새 id는 타임스탬프 기반으로 만든다(충돌 걱정 없음, 사람이 읽을 필요 없는 내부 키).
  const id = body.id && String(body.id).trim() ? String(body.id).trim() : 'char-' + Date.now().toString(36);

  try {
    let imgUrl = body.existingImgUrl || null;
    if (body.imageBase64) {
      const mime = MIME_EXT[body.imageMime] ? body.imageMime : 'image/png';
      const ext = MIME_EXT[mime] || 'png';
      const buffer = Buffer.from(body.imageBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ ok: false, error: 'IMAGE_TOO_LARGE' });
        return;
      }
      imgUrl = await uploadStorageImage('character-images', id + '.' + ext, buffer, mime);
    }

    const row = {
      id: id,
      name: name,
      tagline: (body.tagline || '').trim(),
      cost: Number.isFinite(Number(body.cost)) ? Math.max(1, Math.round(Number(body.cost))) : 25,
      gender: body.gender === 'female' ? 'female' : 'male',
      img_url: imgUrl,
      birth_year: Number(opts.year),
      birth_month: Number(opts.month),
      birth_day: Number(opts.day),
      birth_hour: Number.isFinite(Number(opts.hour)) ? Number(opts.hour) : 12,
      birth_minute: Number.isFinite(Number(opts.minute)) ? Number(opts.minute) : 0,
      is_lunar: !!opts.isLunar,
      is_leap_month: !!opts.isLeapMonth,
      unknown_time: !!opts.unknownTime,
      updated_at: new Date().toISOString()
    };

    const r = await sbFetch('/characters', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const text = await r.text().catch(function () {
        return '';
      });
      res.status(500).json({ ok: false, error: 'SAVE_FAILED', message: text });
      return;
    }
    const rows = await r.json();
    res.status(200).json({ ok: true, row: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: String((e && e.message) || e) });
  }
};
