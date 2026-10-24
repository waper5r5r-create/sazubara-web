// 로그인 계정 ↔ 기기 연결. 같은 계정에 묶인 기기끼리 구매 내역을 함께 쓴다.
// 기기 ID(shareCode)는 초대 링크로 공개되므로, 연결할 때는 그 기기에만 있는 비밀 키를 함께 확인한다.
// 연결 표(account_devices)가 아직 없거나 조회가 실패하면 조용히 "이 기기만" 기준으로 동작한다.
const crypto = require('crypto');
const { sbFetch, SUPABASE_URL, SERVICE_KEY } = require('./_supabase');

const MAX_LINKED = 20;

function hashSecret(secret) {
  return crypto.createHash('sha256').update('byeolcheop-device:' + secret).digest('hex');
}

// PostgREST 필터: 하나면 eq, 여럿이면 in
function deviceFilter(ids) {
  if (ids.length === 1) return 'eq.' + encodeURIComponent(ids[0]);
  return 'in.(' + ids.map(id => encodeURIComponent('"' + String(id).replace(/"/g, '') + '"')).join(',') + ')';
}

async function linkedDeviceIds(deviceId) {
  if (!deviceId) return [];
  try {
    const r = await sbFetch('/account_devices?device_id=eq.' + encodeURIComponent(deviceId) + '&select=user_id');
    if (!r.ok) return [deviceId];
    const users = [...new Set((await r.json()).map(x => x.user_id))];
    if (!users.length) return [deviceId];
    const r2 = await sbFetch('/account_devices?user_id=in.(' + users.map(encodeURIComponent).join(',') + ')&select=device_id');
    if (!r2.ok) return [deviceId];
    const ids = new Set([deviceId]);
    (await r2.json()).forEach(x => ids.add(x.device_id));
    return [...ids].slice(0, MAX_LINKED);
  } catch (e) {
    return [deviceId];
  }
}

// Supabase 로그인 토큰을 서버에서 확인해 사용자 id를 얻는다.
async function verifyUser(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.length < 20) return null;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + accessToken }
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user && user.id ? user : null;
}

module.exports = { hashSecret, deviceFilter, linkedDeviceIds, verifyUser, MAX_LINKED };
