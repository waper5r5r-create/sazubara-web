const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TOSS_SECRET_KEY = 'test-secret-key';
const newyear = require('../api/_newyear-content');
const list = require('../api/reports/list');
const GANS = '甲乙丙丁戊己庚辛壬癸', ZHIS = '子丑寅卯辰巳午未申酉戌亥';

function call(handler, query, rows) {
  const realFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify(rows), {status: 200, headers: {'Content-Type': 'application/json'}});
  const qs = new URLSearchParams(query).toString();
  return new Promise(resolve => {
    const res = {statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { global.fetch = realFetch; resolve({status: this.statusCode, body: b}); }};
    handler({method: 'GET', url: '/api/reports/list?' + qs, query, headers: {host: 'x'}}, res);
  });
}
test('2027 ten gods follow the day stem against 丁', () => {
  const want = {甲:'sanggwan',乙:'siksin',丙:'geopjae',丁:'bigyeon',戊:'jeongin',己:'pyeonin',庚:'jeonggwan',辛:'pyeongwan',壬:'jeongjae',癸:'pyeonjae'};
  for (const g of GANS) assert.equal(newyear.shishen(g, '丁'), want[g]);
});
test('every saju gets 12 complete letters with no repeated text', () => {
  for (const gan of GANS) for (const zhi of ZHIS) {
    const c = newyear.compose({gan, zhi, weak: '금'});
    const all = [c.free.letter, ...c.paid.letters];
    assert.deepEqual(all.map(l => l.month), [1,2,3,4,5,6,7,8,9,10,11,12]);
    for (const l of all) for (const k of ['title','opening','love','money','work','health','tip','mood','pillar','ss','seal','scene']) assert.ok(l[k], gan + zhi + l.month + k);
    for (const k of ['title','love','money','work','health','tip']) assert.equal(new Set(all.map(l => l[k])).size, 12, gan + zhi + k);
    assert.equal(c.free.best.length, 3);
    assert.equal(c.free.teasers.length, 11);
  }
});
test('rejects a missing or invalid saju', () => {
  for (const bad of [undefined, {}, {gan: 'x', zhi: '子'}, {gan: '甲', zhi: 'x'}, {gan: '甲乙', zhi: '子'}]) assert.equal(newyear.compose(bad), null);
});
test('free response carries no paid letter text', async () => {
  const c = newyear.compose({gan: '甲', zhi: '子'});
  const {status, body} = await call(list, {conceptId: newyear.concept.id, device_id: 'd1', gan: '甲', zhi: '子'}, []);
  assert.equal(status, 200);
  assert.equal(body.paid, null);
  assert.equal(body.preview, true);
  const text = JSON.stringify(body);
  for (const l of c.paid.letters) for (const k of ['love','money','work','health','tip']) assert.ok(!text.includes(l[k]), 'leak ' + l.month + k);
  assert.ok(text.includes(c.free.letter.love));
});
test('owner receives the paid letters', async () => {
  const {body} = await call(list, {conceptId: newyear.concept.id, device_id: 'd1', gan: '甲', zhi: '子'}, [{unlock_key: 'report-story-' + newyear.concept.id, concept_id: newyear.concept.id}]);
  assert.equal(body.access.story, true);
  assert.equal(body.paid.letters.length, 11);
});
test('list stays hidden until launch', async () => {
  const {body} = await call(list, {}, []);
  assert.ok(!body.rows.some(r => r.id === newyear.concept.id));
});
