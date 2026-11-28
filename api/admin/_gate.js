// 관리자 비밀번호를 계속 넣어 보며 맞히는 것을 막는다.
// - 같은 접속(IP)에서 15분 안에 5번 틀리면 그 접속은 15분 동안 막는다(맞는 비밀번호여도).
// - 접속을 바꿔 가며 시도하는 경우를 막으려고, 사이트 전체에서 15분 안에 30번 틀리면 모두 15분 막는다.
// - 맞게 들어오면 그 접속의 실패 기록을 지운다.
// IP는 그대로 저장하지 않고 한 방향 해시만 저장한다(DB: admin_auth_failures).
const { createHash } = require('node:crypto');
const { sbFetch, checkAdminSecret, SERVICE_KEY } = require('../_supabase');
const { verifyUser } = require('../_account');

const WINDOW_MS = 15 * 60 * 1000, PER_IP = 5, GLOBAL = 30;

function clientIp(req) {
  const h = req.headers || {};
  const fwd = typeof h['x-forwarded-for'] === 'string' ? h['x-forwarded-for'].split(',')[0].trim() : '';
  return fwd || h['x-real-ip'] || 'unknown';
}
const ipHashOf = req => createHash('sha256').update('admin-gate\0' + (SERVICE_KEY || '') + '\0' + clientIp(req)).digest('hex');

async function count(path) {
  const r = await sbFetch(path);
  if (!r.ok) throw new Error('GATE_LOOKUP_FAILED');
  return (await r.json()).length;
}

// 카카오 로그인: Authorization: Bearer <Supabase 로그인 토큰>. 토큰의 계정이 admin_users에 있어야 한다.
// 토큰은 맞혀 볼 수 없는 값이라 비밀번호 잠금과 상관없이 들어올 수 있다(공격 중에도 사장님은 들어갈 수 있게).
async function kakaoAdmin(req) {
  const auth = (req.headers || {}).authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { tried: false };
  const user = await verifyUser(token).catch(() => null);
  if (!user) return { tried: true, ok: false };
  const r = await sbFetch('/admin_users?user_id=eq.' + encodeURIComponent(user.id) + '&select=user_id');
  const ok = r.ok && (await r.json()).length > 0;
  return { tried: true, ok, userId: user.id };
}

// 통과하면 true(req.adminOk = true). 막거나 틀리면 응답을 보내고 false.
async function adminGate(req, res, now = Date.now()) {
  const kakao = await kakaoAdmin(req).catch(() => ({ tried: true, ok: false }));
  if (kakao.ok) { req.adminOk = true; return true; }
  if (kakao.tried && !(req.headers || {})['x-admin-secret']) {
    // 로그인은 됐지만 관리자로 등록되지 않은 계정. 등록할 때 쓰도록 계정 번호 앞부분만 알려 준다.
    res.status(403).json({ ok: false, error: 'NOT_ADMIN', account: kakao.userId ? String(kakao.userId).slice(0, 8) : null });
    return false;
  }
  const ipHash = ipHashOf(req), since = encodeURIComponent(new Date(now - WINDOW_MS).toISOString());
  let mine, all;
  try {
    [mine, all] = await Promise.all([
      count('/admin_auth_failures?ip_hash=eq.' + ipHash + '&created_at=gt.' + since + '&select=id&limit=' + PER_IP),
      count('/admin_auth_failures?created_at=gt.' + since + '&select=id&limit=' + GLOBAL)
    ]);
  } catch (e) {
    res.status(503).json({ ok: false, error: 'TRY_LATER' });
    return false;
  }
  if (mine >= PER_IP || all >= GLOBAL) {
    res.status(429).json({ ok: false, error: 'LOCKED', message: '비밀번호를 여러 번 틀려서 15분 동안 막혀 있어요.' });
    return false;
  }
  if (checkAdminSecret(req)) {
    if (mine) await sbFetch('/admin_auth_failures?ip_hash=eq.' + ipHash, { method: 'DELETE' }).catch(() => {});
    req.adminOk = true;
    return true;
  }
  await sbFetch('/admin_auth_failures', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip_hash: ipHash }) }).catch(() => {});
  res.status(401).json({ ok: false, error: 'UNAUTHORIZED', left: Math.max(0, PER_IP - mine - 1) });
  return false;
}

module.exports = { adminGate, WINDOW_MS, PER_IP, GLOBAL };
