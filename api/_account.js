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

// 구매 내역 링크: 기기 id를 서버 키로 서명한다. 링크를 가진 사람은 그 기기의 구매 내역을 볼 수 있으니 1년만 유효하다.
const RESTORE_DAYS = 366;
function restoreKey() { return 'byeolcheop-restore:' + (SERVICE_KEY || ''); }
function signRestore(deviceId) {
  const payload = Buffer.from(JSON.stringify({ d: deviceId, e: Date.now() + RESTORE_DAYS * 86400000 })).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', restoreKey()).update(payload).digest('base64url').slice(0, 32);
}
function verifyRestore(token) {
  if (typeof token !== 'string' || token.length > 512 || !SERVICE_KEY) return null;
  try {
    const [payload, signature] = token.split('.');
    const actual = Buffer.from(crypto.createHmac('sha256', restoreKey()).update(payload).digest('base64url').slice(0, 32));
    const provided = Buffer.from(String(signature));
    if (actual.length !== provided.length || !crypto.timingSafeEqual(actual, provided)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data && typeof data.d === 'string' && data.e >= Date.now() ? data.d : null;
  } catch (e) { return null; }
}

// 로그인한 적 없는 기기를 위한 게스트 계정 id. 같은 기기면 늘 같은 값이다(UUID 모양, 버전 자리는 8).
function guestUserId(deviceId) {
  const h = crypto.createHmac('sha256', 'byeolcheop-guest:' + (SERVICE_KEY || '')).update(String(deviceId)).digest('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-8' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
}

// 실제 로그인 계정인지(게스트 id가 아닌지) Supabase 인증 목록에서 확인한다. 확인이 안 되면 실제 계정으로 본다(합치지 않는 쪽).
async function isRealUser(userId) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-8/.test(String(userId))) return false;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(userId), { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } });
    if (r.status === 404) return false;
    return true;
  } catch (e) { return true; }
}

module.exports = { hashSecret, deviceFilter, linkedDeviceIds, verifyUser, signRestore, verifyRestore, guestUserId, isRealUser, MAX_LINKED };
