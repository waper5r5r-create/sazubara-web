// 로그인한 사용자가 지금 기기를 자기 계정에 연결한다.
// 이후 같은 계정의 다른 기기에서 산 콘텐츠도 이 기기에서 열리고, 새 기기에서는 저장된 사주를 이어받는다.
const { ensureDevice, sbFetch, readJsonBody } = require('../_supabase');
const { hashSecret, linkedDeviceIds, deviceFilter, verifyUser } = require('../_account');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  const { deviceId, deviceSecret, accessToken } = (await readJsonBody(req)) || {};
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_.~-]{4,64}$/.test(deviceId) || typeof deviceSecret !== 'string' || deviceSecret.length < 24 || deviceSecret.length > 128) {
    return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  }
  try {
    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ ok: false, error: 'NOT_LOGGED_IN' });
    await ensureDevice(deviceId);

    // 이 기기의 비밀 키 확인: 처음이면 등록하고, 이미 있으면 일치해야 한다.
    const hash = hashSecret(deviceSecret);
    const found = await sbFetch('/device_secrets?device_id=eq.' + encodeURIComponent(deviceId) + '&select=secret_hash');
    if (!found.ok) return res.status(503).json({ ok: false, error: 'ACCOUNT_LINK_UNAVAILABLE' });
    let rows = await found.json();
    if (!rows.length) {
      await sbFetch('/device_secrets', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ device_id: deviceId, secret_hash: hash }) });
      const again = await sbFetch('/device_secrets?device_id=eq.' + encodeURIComponent(deviceId) + '&select=secret_hash');
      rows = again.ok ? await again.json() : [];
    }
    if (!rows.length || rows[0].secret_hash !== hash) return res.status(403).json({ ok: false, error: 'DEVICE_MISMATCH' });

    const link = await sbFetch('/account_devices', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: user.id, device_id: deviceId }) });
    if (!link.ok && link.status !== 409) return res.status(503).json({ ok: false, error: 'ACCOUNT_LINK_UNAVAILABLE' });

    // 같은 계정의 기기 중 가장 최근에 저장된 사주를 돌려준다(새 기기에서 이어받기용).
    const ids = await linkedDeviceIds(deviceId);
    let saju = null;
    const s = await sbFetch('/devices?device_id=' + deviceFilter(ids) + '&saju_opts=not.is.null&select=saju_opts,saju_updated_at&order=saju_updated_at.desc.nullslast&limit=1');
    if (s.ok) { const list = await s.json(); if (list[0]) saju = list[0].saju_opts; }
    res.status(200).json({ ok: true, devices: ids.length, saju });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
};
