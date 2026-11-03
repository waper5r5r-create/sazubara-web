const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TOSS_SECRET_KEY = 'test-secret-key';
const ian = require('../api/_ian-content');
const list = require('../api/reports/list');
const GANS = '甲乙丙丁戊己庚辛壬癸', ZHIS = '子丑寅卯辰巳午未申酉戌亥';
const base = {year:'癸酉', month:'乙卯', day:'甲午', time:'丙寅', gender:'f', strength:'weak', wx:'3,2,0,1,1'};

function call(handler, query, rows) {
  const realFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify(rows), {status: 200, headers: {'Content-Type': 'application/json'}});
  const qs = new URLSearchParams(query).toString();
  return new Promise(resolve => {
    const res = {statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { global.fetch = realFetch; resolve({status: this.statusCode, body: b}); }};
    handler({method: 'GET', url: '/api/reports/list?' + qs, query, headers: {host: 'x'}}, res);
  });
}
const allBlocks = c => c.free.intro.concat(...c.free.sections, ...c.paid.sections);
const words = c => JSON.stringify(allBlocks(c).filter(b => b.t === 'say' || b.t === 'big' || b.t === 'real' || b.t === 'card' || b.line).map(b => b.text || b.line || b.rows));
const paidChars = c => c.paid.sections.flat().map(b => (b.text || '') + (b.line || '') + (b.rows || []).map(r => r.join('')).join('')).join('').replace(/\s/g, '').length;

test('도화 and 홍염 are read from the chart', () => {
  const r = ian.readChart(ian.parseChart(base), [3,2,0,1,1]);
  assert.deepEqual(r.dohwa, ['month']);
  assert.deepEqual(r.hong, ['day']);
  assert.deepEqual(r.marks, {month:['도화'], day:['홍염']});
  const none = ian.readChart(ian.parseChart({year:'甲子', month:'丙子', day:'甲申', time:'甲子'}), [3,0,0,1,4]);
  assert.deepEqual(none.hong, []);
  const noTime = ian.readChart(ian.parseChart({year:'癸酉', month:'甲子', day:'甲申'}), [2,0,0,2,2]);
  assert.deepEqual(noTime.dohwa, ['year']);
});
test('the 재성 of a man and the 관성 of a woman are the opposite-sex stars', () => {
  assert.equal(ian.role('목', '토'), 'jaeseong');
  assert.equal(ian.role('목', '금'), 'gwanseong');
  assert.equal(ian.loverLevel([1,1,0,3,1], '목', 'm'), 'none');
  assert.equal(ian.loverLevel([1,1,0,3,1], '목', 'f'), 'many');
});
test('every day pillar gets complete chapters with existing art and no banned words', () => {
  const dir = path.join(__dirname, '..', 'assets', 'ian');
  for (const g of GANS) for (const z of ZHIS) for (const gender of ['m', 'f']) for (const strength of ['strong', 'weak']) {
    const c = ian.compose({...base, day: g + z, gender, strength});
    assert.equal(c.free.sections.length, 3);
    assert.equal(c.paid.sections.length, 5);
    assert.equal(c.teasers.length, 5);
    for (const b of allBlocks(c)) {
      for (const [k, v] of Object.entries(b)) if (k !== 'line') assert.ok(v !== undefined && v !== '', g + z + b.t + k);
      if (b.t === 'cut') assert.ok(fs.existsSync(path.join(dir, b.img + '.webp')), b.img);
    }
    assert.doesNotMatch(words(c), /끌림|궁합|환각|성인|19금|undefined|일간|일지|월지|년지|시지|신강|신약|비겁|식상|재성|관성|인성/);
  }
});
test('men and women read the same chapters and the same reading', () => {
  const heads = c => allBlocks(c).filter(b => b.t === 'chapter').map(b => b.n + b.title + b.basis);
  const m = ian.compose({...base, gender: 'm'}), f = ian.compose({...base, gender: 'f'});
  assert.deepEqual(heads(m), heads(f));
  assert.equal(heads(m).length, 7);
});
test('a chart with neither mark is never told what it lacks', () => {
  const say = c => c.free.sections[0].filter(b => b.t === 'say').map(b => b.text).join(' ');
  const none = ian.compose({year:'癸酉', month:'乙卯', day:'乙未', time:'癸未', gender:'m', strength:'strong', wx:'2,0,3,1,2'});
  assert.doesNotMatch(JSON.stringify(none.free) + JSON.stringify(none.teasers), /없음|없어요|없네요|도화|홍염/);
  assert.match(say(ian.compose(base)), /도화.*홍염/);
});
test('every paid chapter ends with a real-life reading and the ending has a summary card', () => {
  for (const g of GANS) for (const z of ZHIS) for (const gender of ['m', 'f']) {
    const c = ian.compose({...base, day: g + z, gender});
    for (const sec of c.paid.sections) assert.equal(sec.filter(b => b.t === 'real').length, 1);
    assert.ok(paidChars(c) >= 1100, g + z + paidChars(c));
    const card = c.paid.sections[4].find(b => b.t === 'card');
    assert.equal(card.rows.length, 6);
    assert.ok(card.rows.every(r => r[1] && !/원해요/.test(r[1])));
  }
});
test('the male lead appears only on the female path, and the swimwear and bedsheet cuts only on the male path', () => {
  const imgs = c => allBlocks(c).filter(b => b.t === 'cut').map(b => b.img);
  const f = imgs(ian.compose({...base, gender: 'f'})), m = imgs(ian.compose({...base, gender: 'm'}));
  assert.equal(new Set(f.filter(i => i.startsWith('m-'))).size, 14);
  assert.equal(m.filter(i => i.startsWith('m-')).length, 0);
  for (const i of ['pool', 'pool-rise', 'pool-splash', 'pool-water', 'hand', 'morning']) assert.ok(!f.includes(i), i);
  assert.ok(f.filter(i => i.startsWith('m-w-')).every(i => ian.compose({...base, gender: 'f'}).free.sections.flat().concat(...ian.compose({...base, gender: 'f'}).paid.sections).find(b => b.img === i).ratio === '4/3'));
});
test('rejects a missing or invalid saju', () => {
  for (const bad of [undefined, {}, {...base, day: 'xx'}, {...base, year: undefined}, {...base, month: '甲'}]) assert.equal(ian.compose(bad), null);
  assert.ok(ian.compose({...base, time: ''}));
});
test('free response carries no paid chapter text', async () => {
  const {status, body} = await call(list, {...base, conceptId: ian.concept.id, device_id: 'd1'}, []);
  assert.equal(status, 200);
  assert.equal(body.paid, null);
  const text = JSON.stringify(body), c = ian.compose(base);
  for (const sec of c.paid.sections) for (const b of sec) {
    if (b.t === 'big') assert.ok(!text.includes(b.text), 'leak ' + b.text);
    if (b.t === 'real') for (const r of b.rows) assert.ok(!text.includes(r[1]), 'leak ' + r[1]);
  }
  assert.equal(body.free.sections.length, 3);
});
test('owner receives the paid chapters', async () => {
  const {body} = await call(list, {...base, conceptId: ian.concept.id, device_id: 'd1'}, [{unlock_key: 'report-story-' + ian.concept.id, concept_id: ian.concept.id}]);
  assert.equal(body.access.story, true);
  assert.equal(body.paid.sections.length, 5);
});
test('is listed once, right after the new year content', async () => {
  const {body} = await call(list, {}, []);
  assert.equal(body.rows.filter(r => r.id === ian.concept.id).length, 1);
  assert.equal(body.rows[1].id, ian.concept.id);
  assert.equal(body.rows[1].category, '연애');
});
test('free readers get the offer, owners get every chapter and no offer', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  let source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
  source = source.replace(/\}\)\(\);\s*$/, 'globalThis.ianTest={ianPageHtml};})();');
  const sandbox = {document: {readyState: 'loading', addEventListener() {}}, window: {}, localStorage: {getItem() { return null; }}, console, setTimeout() {}, clearTimeout() {}, URLSearchParams, URL, Date, Math, Intl};
  require('node:vm').createContext(sandbox);
  require('node:vm').runInContext(source, sandbox);
  const p = (g, z) => ({ganKr: g, zhiKr: z});
  const my = {name: '민지', year: p('계', '유'), month: p('을', '묘'), day: p('갑', '오'), time: p('병', '인')};
  const c = ian.compose(base);
  const free = sandbox.ianTest.ianPageHtml(my, {access: {story: false}, free: c.free, teasers: c.teasers, paid: null});
  assert.ok(free.includes('data-ian-buy'));
  assert.equal((free.match(/data-ian-sec=/g) || []).length, 3);
  const owned = sandbox.ianTest.ianPageHtml(my, {access: {story: true}, free: c.free, teasers: c.teasers, paid: c.paid});
  assert.ok(!owned.includes('data-ian-buy'));
  assert.equal((owned.match(/data-ian-sec=/g) || []).length, 8);
  assert.ok(owned.includes('당신의 향'));
  assert.ok(owned.includes('data-ian-save'));
  assert.ok(owned.includes('현실에선요.'));
  assert.ok(!free.includes('현실에선요.'));
  assert.ok(free.includes('<em>도화</em>'));
  assert.ok(free.includes('<em>홍염</em>'));
});
