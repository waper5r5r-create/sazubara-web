// 로그인한 사용자가 지금 기기를 자기 계정에 연결한다.
// 이후 같은 계정의 다른 기기에서 산 콘텐츠도 이 기기에서 열리고, 새 기기에서는 저장된 사주를 이어받는다.
//
// 로그인 없이 구매 내역을 옮기는 길도 여기서 맡는다(결제 코드는 건드리지 않는다).
//  - action 'restore-issue': 이 기기의 "구매 내역 링크"를 만든다. 기기 비밀 키가 맞아야 한다.
//  - action 'restore'      : 링크(token) 또는 결제 주문번호(orderId)로, 원래 기기의 구매 내역을 지금 기기에 연결한다.
const { ensureDevice, sbFetch, readJsonBody } = require('../_supabase');
const { hashSecret, linkedDeviceIds, deviceFilter, verifyUser, signRestore, verifyRestore, guestUserId, isRealUser, MAX_LINKED } = require('../_account');

const DEVICE_ID = /^[A-Za-z0-9_.~-]{4,64}$/;
const ORDER_ID = /^[A-Za-z0-9_-]{20,64}$/;

// 이 기기의 비밀 키 확인: 처음이면 등록하고, 이미 있으면 일치해야 한다. 'ok' | 'mismatch' | 'unavailable'
async function checkDevice(deviceId, deviceSecret) {
  await ensureDevice(deviceId);
  const hash = hashSecret(deviceSecret);
  const found = await sbFetch('/device_secrets?device_id=eq.' + encodeURIComponent(deviceId) + '&select=secret_hash');
  if (!found.ok) return 'unavailable';
  let rows = await found.json();
  if (!rows.length) {
    await sbFetch('/device_secrets', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ device_id: deviceId, secret_hash: hash }) });
    const again = await sbFetch('/device_secrets?device_id=eq.' + encodeURIComponent(deviceId) + '&select=secret_hash');
    rows = again.ok ? await again.json() : [];
  }
  return rows.length && rows[0].secret_hash === hash ? 'ok' : 'mismatch';
}

async function usersOf(deviceId) {
  const r = await sbFetch('/account_devices?device_id=eq.' + encodeURIComponent(deviceId) + '&select=user_id');
  if (!r.ok) throw new Error('ACCOUNT_LOOKUP_FAILED');
  return [...new Set((await r.json()).map(x => x.user_id))];
}

async function addLink(userId, deviceId) {
  const r = await sbFetch('/account_devices', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: userId, device_id: deviceId }) });
  if (!r.ok && r.status !== 409) throw new Error('ACCOUNT_LINK_FAILED');
}

// 주문번호로 산 기기 찾기: 실제로 돈을 낸 주문만(초대·쿠폰처럼 0원인 줄은 주문번호를 짐작할 수 있어서 뺀다).
async function deviceOfOrder(orderId) {
  for (const table of ['paid_unlocks', 'report_unlocks']) {
    const r = await sbFetch('/' + table + '?order_id=eq.' + encodeURIComponent(orderId) + '&select=device_id,amount');
    if (!r.ok) throw new Error('ORDER_LOOKUP_FAILED');
    const row = (await r.json()).find(x => x.amount > 0);
    if (row) return row.device_id;
  }
  return null;
}

async function restore(body, res) {
  const { deviceId, token, orderId } = body;
  let source = null;
  if (token) source = verifyRestore(token);
  else if (typeof orderId === 'string' && ORDER_ID.test(orderId.trim())) source = await deviceOfOrder(orderId.trim());
  else return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  if (!source) return res.status(404).json({ ok: false, error: token ? 'RESTORE_LINK_INVALID' : 'ORDER_NOT_FOUND' });
  if (source === deviceId) return res.status(200).json({ ok: true, same: true, devices: (await linkedDeviceIds(deviceId)).length });

  let sourceUsers = await usersOf(source);
  const currentUsers = await usersOf(deviceId);
  // 두 기기가 서로 다른 로그인 계정에 이미 묶여 있으면(예: 가족이 같은 휴대폰을 함께 씀) 자동으로 합치지 않는다.
  if (sourceUsers.length && currentUsers.some(u => !sourceUsers.includes(u))) {
    const realHere = (await Promise.all(currentUsers.filter(u => !sourceUsers.includes(u)).map(isRealUser))).some(Boolean);
    const realThere = (await Promise.all(sourceUsers.map(isRealUser))).some(Boolean);
    if (realHere && realThere) return res.status(409).json({ ok: false, error: 'OTHER_ACCOUNT', message: '이 브라우저는 다른 카카오 계정에 연결돼 있어요. 구매한 계정으로 로그인해 주세요.' });
  }
  if (!sourceUsers.length) {
    // 로그인한 적 없는 기기: 그 기기 전용 게스트 계정을 만든다. 같은 기기면 늘 같은 id라 두 번 불려도 하나만 생긴다.
    sourceUsers = [guestUserId(source)];
    await addLink(sourceUsers[0], source);
  }
  for (const u of sourceUsers.slice(0, 5)) await addLink(u, deviceId);
  res.status(200).json({ ok: true, devices: (await linkedDeviceIds(deviceId)).length });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  const body = (await readJsonBody(req)) || {};
  const { deviceId, deviceSecret, accessToken, action } = body;
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId) || typeof deviceSecret !== 'string' || deviceSecret.length < 24 || deviceSecret.length > 128) {
    return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
  }
  try {
    if (action === 'restore-issue' || action === 'restore') {
      const check = await checkDevice(deviceId, deviceSecret);
      if (check === 'unavailable') return res.status(503).json({ ok: false, error: 'ACCOUNT_LINK_UNAVAILABLE' });
      if (check !== 'ok') return res.status(403).json({ ok: false, error: 'DEVICE_MISMATCH' });
      if (action === 'restore-issue') return res.status(200).json({ ok: true, token: signRestore(deviceId) });
      return await restore(body, res);
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ ok: false, error: 'NOT_LOGGED_IN' });
    const check = await checkDevice(deviceId, deviceSecret);
    if (check === 'unavailable') return res.status(503).json({ ok: false, error: 'ACCOUNT_LINK_UNAVAILABLE' });
    if (check !== 'ok') return res.status(403).json({ ok: false, error: 'DEVICE_MISMATCH' });

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
