const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');

// api/admin/_gate.js — 비밀번호를 계속 넣어 보는 것을 막는다
function harness({ mine = 0, all = 0, correct = false, dbOk = true, user = null, admins = [], headers = {} } = {}) {
  const calls = [], module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/admin/_gate.js'), 'utf8'), {
    module, encodeURIComponent, Date, Promise,
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (name === '../_supabase') return {
        SERVICE_KEY: 'k', checkAdminSecret: () => correct,
        sbFetch: async (p, opt = {}) => {
          calls.push({ path: p, method: opt.method || 'GET' });
          if (p.startsWith('/admin_users')) return { ok: true, json: async () => admins.filter(a => p.includes(a)).map(a => ({ user_id: a })) };
          const n = p.includes('ip_hash=eq.') ? mine : all;
          return { ok: dbOk, json: async () => Array.from({ length: n }, (_, i) => ({ id: i })) };
        }
      };
      if (name === '../_account') return { verifyUser: async t => (t === 'good-token' ? user : null) };
      throw Error(name);
    }
  });
  const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const req = { headers: Object.assign({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, headers) };
  return { calls, res, req, run: () => module.exports.adminGate(req, res) };
}

test('a wrong password is recorded and says how many tries are left', async () => {
  const h = harness({ mine: 1 });
  assert.equal(await h.run(), false);
  assert.equal(h.res.code, 401);
  assert.equal(h.res.body.left, 3);
  assert.ok(h.calls.some(c => c.method === 'POST' && c.path === '/admin_auth_failures'));
});

test('five wrong tries lock that connection, even with the right password', async () => {
  const h = harness({ mine: 5, all: 5, correct: true });
  assert.equal(await h.run(), false);
  assert.equal(h.res.code, 429);
});

test('thirty wrong tries across the site lock everyone', async () => {
  const h = harness({ mine: 0, all: 30, correct: true });
  assert.equal(await h.run(), false);
  assert.equal(h.res.code, 429);
});

test('the right password passes and clears that connection\'s failures', async () => {
  const h = harness({ mine: 2, all: 2, correct: true });
  assert.equal(await h.run(), true);
  assert.ok(h.calls.some(c => c.method === 'DELETE'));
});

test('if the failure log cannot be read, nobody gets in', async () => {
  const h = harness({ correct: true, dbOk: false });
  assert.equal(await h.run(), false);
  assert.equal(h.res.code, 503);
});

test('the raw IP address is never stored', async () => {
  const h = harness();
  await h.run();
  assert.ok(!h.calls.some(c => c.path.includes('203.0.113.9')));
});

test('every admin request passes the gate before anything else', () => {
  const src = fs.readFileSync(path.join(__dirname, '../api/admin/reports.js'), 'utf8');
  const gate = src.indexOf('await adminGate(req, res)'), reviews = src.indexOf('return reviewsAdmin(req, res)'), actions = src.indexOf('const body = await readJsonBody');
  assert.ok(gate > 0 && gate < reviews && gate < actions);
});

const OWNER = '11111111-2222-4333-8444-555555555555', bearer = { authorization: 'Bearer good-token' };

test('the owner Kakao login gets in, even while passwords are locked', async () => {
  const h = harness({ user: { id: OWNER }, admins: [OWNER], headers: bearer, mine: 5, all: 30 });
  assert.equal(await h.run(), true);
  assert.equal(h.req.adminOk, true);
});

test('another Kakao account is refused and only shown the start of its account number', async () => {
  const h = harness({ user: { id: '99999999-0000-4000-8000-000000000000' }, admins: [OWNER], headers: bearer });
  assert.equal(await h.run(), false);
  assert.equal(h.res.code, 403);
  assert.equal(h.res.body.account, '99999999');
  assert.equal(h.req.adminOk, undefined);
});

test('a fake Kakao token does not get in', async () => {
  const h = harness({ admins: [OWNER], headers: { authorization: 'Bearer forged' } });
  assert.equal(await h.run(), false);
  assert.equal(h.req.adminOk, undefined);
});
