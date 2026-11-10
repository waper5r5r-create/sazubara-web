const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TOSS_SECRET_KEY = 'test-secret-key';
process.env.TOSSPAY_API_KEY = 'sk_test_fake';
const reportUnlock = require('../api/reports/unlock');
const unlock = require('../api/unlock');
const config = require('../api/config');

let tables, orders, executes, created;
function reset() {
  executes = 0; created = []; orders = {};
  tables = { devices: [], account_devices: [], paid_unlocks: [], report_unlocks: [], report_concepts: [{ id: 'theme', title: '테스트 이야기', active: true, price_krw: 990 }] };
  global.fetch = async function (url, options = {}) {
    const parsed = new URL(url);
    if (parsed.hostname === 'pay.toss.im') {
      const body = JSON.parse(options.body);
      assert.equal(body.apiKey, 'sk_test_fake');
      const path = parsed.pathname.split('/').pop();
      if (path === 'payments') {
        assert.equal(body.autoExecute, false);
        assert.ok(body.retUrl.length <= 255);
        created.push(body);
        orders[body.orderNo] = { amount: body.amount, payStatus: 'PAY_STANDBY', payToken: 'pt_' + created.length };
        return Response.json({ code: 0, payToken: orders[body.orderNo].payToken, checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=' + orders[body.orderNo].payToken });
      }
      const o = orders[body.orderNo];
      if (path === 'status') return Response.json(o ? { mode: 'TEST', orderNo: body.orderNo, payToken: o.payToken, payStatus: o.payStatus, amount: o.amount } : { code: -1, errorCode: 'NOT_FOUND' });
      if (path === 'execute') {
        executes++;
        if (!o || o.payStatus !== 'PAY_APPROVED' || body.payToken !== o.payToken) return Response.json({ code: -1, errorCode: 'NOT_APPROVED' });
        o.payStatus = 'PAY_COMPLETE';
        return Response.json({ code: 0, mode: 'TEST', orderNo: body.orderNo, amount: o.amount, approvalTime: '2026-11-10 12:00:00' });
      }
    }
    if (parsed.hostname === 'api.tosspayments.com') throw new Error('card confirm must not run for TossPay');
    const name = parsed.pathname.split('/').pop(), table = tables[name];
    assert.ok(table, 'unexpected mock table ' + name);
    if (options.method === 'POST') {
      const row = JSON.parse(options.body);
      if (name === 'devices') { if (!table.some(r => r.device_id === row.device_id)) table.push(row); return Response.json({}); }
      if (table.some(r => (row.order_id && r.order_id === row.order_id) || (r.device_id === row.device_id && r.unlock_key && r.unlock_key === row.unlock_key))) return Response.json({}, { status: 409 });
      table.push(row); return Response.json([row], { status: 201 });
    }
    const match = (r, key, value) => value.startsWith('eq.') ? String(r[key]) === value.slice(3) : value.startsWith('in.(') ? value.slice(4, -1).split(',').map(v => v.replace(/^"|"$/g, '')).includes(String(r[key])) : true;
    return Response.json(table.filter(r => [...parsed.searchParams.entries()].every(([k, v]) => match(r, k, v))));
  };
}
async function call(handler, method, url, body = {}) {
  const req = { method, url, body, headers: { host: 'www.byeolcheop.com' } };
  const res = { code: 200, setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await handler(req, res); return { status: res.code, ...res.data };
}

test('config tells the page TossPay is in test mode', async () => {
  const r = await call(config, 'GET', '/api/config');
  assert.equal(r.tosspay, 'test');
});

test('TossPay 990 unlock: server sets the price, approves once after the buyer confirms, retry does not charge again', async () => {
  reset();
  const made = await call(unlock, 'POST', '/api/unlock', { action: 'tosspay-create', deviceId: 'dev-a', unlockKey: 'feature-today-premium', label: '이번 달 운세', tab: 'today' });
  assert.equal(made.ok, true); assert.equal(made.amount, 990); assert.ok(made.checkoutPage.startsWith('https://pay.toss.im/'));
  assert.ok(created[0].retUrl.startsWith('https://www.byeolcheop.com/success.html?pv=tp&type=unlock'));
  const claim = { provider: 'tosspay', orderId: made.orderId, deviceId: 'dev-a', unlockKey: 'feature-today-premium' };
  // 아직 토스 앱에서 인증 전이면 열리지 않는다
  assert.equal((await call(unlock, 'POST', '/api/unlock', claim)).ok, false);
  assert.equal(executes, 0); assert.equal(tables.paid_unlocks.length, 0);
  orders[made.orderId].payStatus = 'PAY_APPROVED';
  const first = await call(unlock, 'POST', '/api/unlock', claim);
  assert.equal(first.ok, true); assert.equal(executes, 1);
  assert.deepEqual(tables.paid_unlocks.map(r => [r.device_id, r.unlock_key, r.amount]), [['dev-a', 'feature-today-premium', 990]]);
  assert.equal((await call(unlock, 'POST', '/api/unlock', claim)).ok, true);
  assert.equal(executes, 1); assert.equal(tables.paid_unlocks.length, 1);
});

test('a 990 TossPay order cannot open the 4,900 item', async () => {
  reset();
  const made = await call(unlock, 'POST', '/api/unlock', { action: 'tosspay-create', deviceId: 'dev-a', unlockKey: 'compat-a-b' });
  orders[made.orderId].payStatus = 'PAY_APPROVED';
  const r = await call(unlock, 'POST', '/api/unlock', { provider: 'tosspay', orderId: made.orderId, deviceId: 'dev-a', unlockKey: 'feature-saju-deep' });
  assert.equal(r.ok, false); assert.equal(executes, 0); assert.equal(tables.paid_unlocks.length, 0);
});

test('TossPay story purchase opens the report; owned content is refused before a payment is made', async () => {
  reset();
  const made = await call(reportUnlock, 'POST', '/api/reports/unlock', { action: 'tosspay-create', deviceId: 'dev-b', conceptId: 'theme', stage: 'story' });
  assert.equal(made.ok, true); assert.equal(made.amount, 7900);
  orders[made.orderId].payStatus = 'PAY_APPROVED';
  const r = await call(reportUnlock, 'POST', '/api/reports/unlock', { provider: 'tosspay', orderId: made.orderId, deviceId: 'dev-b', conceptId: 'theme', stage: 'story' });
  assert.equal(r.ok, true); assert.equal(executes, 1);
  assert.equal(tables.paid_unlocks[0].unlock_key, 'report-story-theme'); assert.equal(tables.paid_unlocks[0].amount, 7900);
  const again = await call(reportUnlock, 'POST', '/api/reports/unlock', { action: 'tosspay-create', deviceId: 'dev-b', conceptId: 'theme', stage: 'story' });
  assert.equal(again.error, 'ALREADY_OWNED'); assert.equal(created.length, 1);
});

test('a cancelled TossPay order opens nothing', async () => {
  reset();
  const made = await call(reportUnlock, 'POST', '/api/reports/unlock', { action: 'tosspay-create', deviceId: 'dev-c', conceptId: 'theme', stage: 'story' });
  orders[made.orderId].payStatus = 'PAY_CANCEL';
  const r = await call(reportUnlock, 'POST', '/api/reports/unlock', { provider: 'tosspay', orderId: made.orderId, deviceId: 'dev-c', conceptId: 'theme', stage: 'story' });
  assert.equal(r.ok, false); assert.equal(executes, 0); assert.equal(tables.paid_unlocks.length, 0);
});
