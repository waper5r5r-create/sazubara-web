const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test-secret-key';
const success = fs.readFileSync(path.join(__dirname, '..', 'success.html'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('payment return confirms with the device that started the payment, read from the signed quote (Korean content ids too)', () => {
  const src = success.match(/function quoteDevice\(q\)\{[\s\S]*?\n    \}/)[0];
  const quoteDevice = new Function(src + '; return quoteDevice;')();
  const { signQuote } = require('../api/_payment-quote');
  const q = signQuote({ orderId: 'sazubara_x', deviceId: 'insta-abc', conceptId: '운명의-사람은-언제-올까-fyq1z', stage: 'story', amount: 7900 });
  assert.equal(quoteDevice(q), 'insta-abc');
  assert.equal(quoteDevice('garbage'), null);
  assert.equal(quoteDevice(null), null);
  assert.match(success, /deviceId = quoteDevice\(quote\) \|\| urlDevice \|\| localDevice;/);
  assert.ok(html.includes("+'&device='+encodeURIComponent(DEVICE.shareCode||''),"));
});

test('payment errors are shown in plain Korean with the order number, and every failure is logged', () => {
  assert.ok(!success.includes("'결제 승인에 실패했습니다: '"));
  for (const code of ['INVALID_CHECKOUT', 'AMOUNT_MISMATCH', 'PAYMENT_MISMATCH', 'ALREADY_OWNED', 'UNLOCK_INSERT_FAILED', 'NETWORK']) assert.ok(success.includes(code + ':'), code);
  assert.ok(success.includes('id="order"') && success.includes('ieumlab22@gmail.com'));
  assert.match(success, /showError\(friendly\(data\), data\.error\);\s*logFail\(/);
  assert.match(success, /logFail\('DEVICE_SWITCHED'/);
});

test('returning from payment in another browser links this browser to the order before loading purchases', () => {
  assert.match(html, /accountCall\(\{action:'restore',orderId:order\}\)\.catch\(function\(\)\{\}\)/);
  assert.match(html, /linkOrder\.then\(function\(\)\{return Promise\.all\(\[pullPaidUnlocks\(\),pullReportUnlocks\(\)\]\);\}\)/);
});

test('pay-log stores a trimmed row and refuses junk codes', async () => {
  const rows = [];
  global.fetch = async (url, o) => { rows.push({ url: String(url), body: JSON.parse(o.body) }); return Response.json({}, { status: 201 }); };
  const log = require('../api/pay-log');
  const call = async body => { const res = { code: 200, setHeader() {}, status(n) { this.code = n; return this; }, json(d) { this.data = d; return this; } }; await log({ method: 'POST', body, headers: { 'user-agent': 'x'.repeat(500) } }, res); return res; };
  assert.equal((await call({ code: 'drop table;' })).code, 400);
  const ok = await call({ code: 'INVALID_CHECKOUT', orderId: 'sazubara_1', message: 'm'.repeat(1000), hadLocalDevice: 1 });
  assert.equal(ok.code, 200);
  assert.equal(rows.length, 1); assert.ok(rows[0].url.endsWith('/rest/v1/payment_failures'));
  assert.equal(rows[0].body.message.length, 300); assert.equal(rows[0].body.user_agent.length, 300); assert.equal(rows[0].body.had_local_device, true);
});
