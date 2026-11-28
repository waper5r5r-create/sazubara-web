const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
function harness({ authorized = true, exists = true } = {}) {
  const calls = [], module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/admin/reviews.js'), 'utf8'), {
    module, encodeURIComponent, Date,
    require(name) {
      if (name === '../_supabase') return {
        checkAdminSecret: () => authorized,
        readJsonBody: async req => req.body,
        sbFetch: async (p, opt = {}) => {
          calls.push({ path: p, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
          const rows = p.startsWith('/report_reviews?id=eq.') && !opt.method ? (exists ? [{ id: ID, concept_id: 'love', rating: 2 }] : []) : [];
          return { ok: true, status: 200, json: async () => rows };
        }
      };
      if (name === '../_review-products') return { PRODUCTS: { love: { title: '연애 사주' } } };
      throw Error(name);
    }
  });
  return { calls, call: async body => { const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await module.exports({ method: 'POST', body }, res); return res; } };
}

test('admin endpoint needs the admin secret', async () => {
  const h = harness({ authorized: false });
  assert.equal((await h.call({ action: 'list' })).code, 401);
  assert.equal(h.calls.length, 0);
});

test('admin cannot edit review text or create reviews', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../api/admin/reviews.js'), 'utf8');
  for (const action of ['edit', 'create', 'update', 'save']) {
    const h = harness();
    assert.equal((await h.call({ action, id: ID, text: '바꾼 글입니다 바꾼 글입니다' })).code, 400);
    assert.ok(!h.calls.some(c => c.method !== 'GET'));
  }
  assert.ok(!/text:\s*body\./.test(src));
  assert.ok(!/method:\s*'POST'[^;]*'\/report_reviews'/.test(src));
});

test('hide and delete require a listed reason and are logged', async () => {
  for (const action of ['hide', 'delete']) {
    let h = harness();
    assert.equal((await h.call({ action, id: ID })).code, 400);
    assert.equal((await h.call({ action, id: ID, reason: '별점이 낮아서' })).code, 400);
    assert.ok(!h.calls.some(c => c.method !== 'GET'));
    h = harness();
    assert.equal((await h.call({ action, id: ID, reason: '욕설·비방' })).code, 200);
    const logged = h.calls.find(c => c.path === '/review_moderation_log');
    assert.equal(logged.body.action, action);
    assert.equal(logged.body.reason, '욕설·비방');
    assert.ok(!('text' in logged.body));
  }
});

test('hide only changes status fields; reply only changes reply fields', async () => {
  let h = harness();
  await h.call({ action: 'hide', id: ID, reason: '광고·스팸' });
  assert.deepEqual(Object.keys(h.calls.find(c => c.method === 'PATCH').body).sort(), ['hidden_at', 'hidden_reason', 'status']);
  h = harness();
  await h.call({ action: 'reply', id: ID, reply: '소중한 후기 고마워요.' });
  assert.deepEqual(Object.keys(h.calls.find(c => c.method === 'PATCH').body).sort(), ['replied_at', 'reply']);
});

test('bad ids and missing reviews are refused', async () => {
  assert.equal((await harness().call({ action: 'hide', id: "x' or 1=1", reason: '욕설·비방' })).code, 400);
  assert.equal((await harness({ exists: false }).call({ action: 'unhide', id: ID })).code, 404);
});
