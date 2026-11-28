const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');

// api/reports/reviews.js — 구매 확인 후기
function harness({ owned = true, status = 201, mine = [] } = {}) {
  const writes = [], module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/reports/reviews.js'), 'utf8'), {
    module, encodeURIComponent,
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (name === '../_supabase') return { getQuery: r => r.query || {}, sbFetch: async (p, opt) => { writes.push(JSON.parse(opt.body)); return { ok: status < 400, status }; } };
      if (name === '../_review-products') return {
        productOf: id => (['love', 'compat'].includes(id) ? { title: id } : null),
        ownsProduct: async () => owned,
        rowsAt: async p => p.includes('reviewer_hash=eq.') ? mine
          : p.includes('select=rating&') || p.endsWith('select=rating') ? [{ rating: 5 }, { rating: 4 }]
          : [{ rating: 5, text: '실제 구매자가 남긴 후기입니다.', reply: '고마워요', created_at: '2026-10-12', reviewer_hash: 'PRIVATE_TOKEN' }]
      };
      throw Error(name);
    }
  });
  return { call: async req => { const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await module.exports(req, res); return res; }, writes };
}
const body = { conceptId: 'love', deviceId: 'random-secret-device-123', rating: 5, text: '이야기를 읽고 제 마음을 돌아볼 수 있었어요.', publishConsent: true };

test('review writes require purchase, a 1-5 rating, length and publication consent', async () => {
  for (const [h, payload, expected] of [
    [harness({ owned: false }), body, 403],
    [harness(), { ...body, publishConsent: false }, 400],
    [harness(), { ...body, text: '짧음' }, 400],
    [harness(), { ...body, rating: 0 }, 400],
    [harness(), { ...body, rating: 6 }, 400],
    [harness(), { ...body, rating: 4.5 }, 400]
  ]) { const r = await h.call({ method: 'POST', body: payload }); assert.equal(r.code, expected); assert.equal(h.writes.length, 0); }
});

test('verified review stores rating and a one-way key, never the device id, and rejects duplicates', async () => {
  const h = harness(), r = await h.call({ method: 'POST', body });
  assert.equal(r.code, 201);
  assert.equal(h.writes[0].rating, 5);
  assert.equal(h.writes[0].reviewer_hash.length, 64);
  assert.ok(!JSON.stringify(h.writes).includes(body.deviceId));
  assert.equal((await harness({ status: 409 }).call({ method: 'POST', body })).code, 409);
});

test('public list shows ratings, average and replies but no reviewer credential', async () => {
  const r = await harness().call({ method: 'GET', query: { conceptId: 'love' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.count, 2);
  assert.equal(r.body.average, 4.5);
  assert.equal(r.body.rows[0].reply, '고마워요');
  assert.equal(r.body.rows[0].verified, true);
  assert.equal(r.body.canWrite, false);
  assert.ok(!JSON.stringify(r.body).includes('PRIVATE_TOKEN'));
});

test('canWrite is true only for an owner who has not reviewed yet', async () => {
  const q = { conceptId: 'love', deviceId: body.deviceId };
  assert.equal((await harness().call({ method: 'GET', query: q })).body.canWrite, true);
  assert.equal((await harness({ owned: false }).call({ method: 'GET', query: q })).body.canWrite, false);
  assert.equal((await harness({ mine: [{ id: 'x' }] }).call({ method: 'GET', query: q })).body.canWrite, false);
});

test('unknown products and unsafe ids are refused', async () => {
  assert.equal((await harness().call({ method: 'GET', query: { conceptId: 'nope' } })).code, 404);
  assert.equal((await harness().call({ method: 'GET', query: { conceptId: '../private?token=bad' } })).code, 400);
});

// api/_review-products.js — 무료로 연 것은 구매가 아니다
function ownsHarness(paidRows, legacyRows = []) {
  const module = { exports: {} }, seen = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/_review-products.js'), 'utf8'), {
    module, encodeURIComponent,
    require(name) {
      if (name === './_supabase') return { sbFetch: async p => { seen.push(p); return { ok: true, json: async () => p.startsWith('/paid_unlocks') ? paidRows : legacyRows }; } };
      if (name === './_account') return { linkedDeviceIds: async id => [id], deviceFilter: ids => 'eq.' + ids[0] };
      if (name === './_contents') return { CONTENTS: [{ concept: { id: 'love', title: '연애 사주' } }] };
      throw Error(name);
    }
  });
  return { ...module.exports, seen };
}

test('ownership only counts paid rows (amount > 0), per product', async () => {
  const h = ownsHarness([{ unlock_key: 'compat-abc' }]);
  assert.equal(await h.ownsProduct('dev-123456', 'compat'), true);
  assert.ok(h.seen[0].includes('amount=gt.0'));
  assert.equal(await h.ownsProduct('dev-123456', 'today-premium'), false);
  assert.equal(await ownsHarness([{ unlock_key: 'report-story-love' }]).ownsProduct('dev-123456', 'love'), true);
  assert.equal(await ownsHarness([], [{ concept_id: 'love' }]).ownsProduct('dev-123456', 'love'), true);
  assert.equal(await ownsHarness([]).ownsProduct('dev-123456', 'love'), false);
  assert.equal(await ownsHarness([{ unlock_key: 'compat-abc' }]).ownsProduct('dev-123456', 'unknown'), false);
});
