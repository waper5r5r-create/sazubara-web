const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const fail = fs.readFileSync(path.join(__dirname, '..', 'fail.html'), 'utf8');

test('lunar birthdays such as 2/29 and 2/30 can be submitted, and days missing from a lunar month are refused', () => {
  assert.match(html, /native\.type='text';native\.classList\.add\('birth-native'\)/);
  assert.match(html, /if\(iso&&isLunar\(\)&&!lunarDayExists\(p\)\)iso='';/);
  assert.match(html, /function lunarDayExists\(p\)\{\s*return \[false,true\]\.some/);
  assert.ok(html.includes(`$all('input[type="date"],input.birth-native').forEach(function(input){input.max=maxBirthday;});`));
});

test('a cancelled content payment offers a way back to that content, for every paid content id', () => {
  for (const name of ['love', 'wealth', 'career', 'marriage', 'newyear', 'ian']) {
    const id = require('../api/_' + name + '-content').concept.id;
    assert.ok(fail.includes("'" + id + "':"), name + ' id missing from fail.html');
  }
  assert.ok(fail.includes('[hidden]{display:none!important;}'));
});

test('read requests retry twice on network errors or 5xx, and the catalogue falls back to the built-in list', async () => {
  const vm = require('node:vm');
  const start = html.indexOf('var REPORT_LIST_CACHE = null;'), end = html.indexOf('function loadReportPanels');
  let calls = 0, plan = [];
  const ctx = { setTimeout: (f) => f(), Promise, Object, Error,
    fetch: async () => { calls++; const s = plan.shift(); if (s === 'net') throw new Error('offline'); return { status: s, ok: s < 400, json: async () => ({ ok: true, rows: [{ id: 'server' }] }) }; } };
  vm.createContext(ctx); vm.runInContext(html.slice(start, end), ctx);
  plan = ['net', 503, 200]; calls = 0; assert.equal((await ctx.apiGet('/x')).status, 200); assert.equal(calls, 3);
  plan = [404]; calls = 0; assert.equal((await ctx.apiGet('/x')).status, 404); assert.equal(calls, 1, '4xx is not retried');
  plan = ['net', 'net', 'net']; calls = 0; await assert.rejects(ctx.apiGet('/x')); assert.equal(calls, 3);
  plan = [500, 500, 500]; const list = await ctx.loadReportList(true);
  assert.deepEqual(list.map(x => x.id), ctx.REPORT_LIST_FALLBACK.map(x => x.id)); assert.equal(ctx.REPORT_LIST_CACHE, null, 'fallback is not cached');
  plan = [200]; assert.deepEqual((await ctx.loadReportList(true)).map(x => x.id), ['server']);
  for (const name of ['love', 'wealth', 'career', 'marriage', 'newyear', 'ian']) {
    const c = require('../api/_' + name + '-content').concept;
    const f = ctx.REPORT_LIST_FALLBACK.find(x => x.id === c.id);
    assert.ok(f, name + ' missing from fallback'); assert.equal(f.title, c.title, name + ' title');
  }
  assert.ok(html.includes("'<p class=\"section-desc reader-slow\">연결이 느려 조금 오래 걸리고 있어요.</p>"));
});

test('the payment note promises no fixed delivery time on errors', () => {
  const legal = fs.readFileSync(path.join(__dirname, '..', 'legal.html'), 'utf8');
  assert.ok(!html.includes('1영업일'));
  assert.ok(!legal.includes('영업일 기준 1일'));
  assert.ok(html.includes('제공 기간: 결제 즉시 제공<br>이용 기간: 결제일로부터 1년간 다시 보기'));
});

test('a name is required everywhere a birth chart is entered, so partners never show up as "상대방"', () => {
  // 별자리 입력: 이름 칸이 성별보다 먼저 나오고, 이름이 비면 성별을 눌러도 넘어가지 않는다
  const page1 = html.slice(html.indexOf('data-page="1"><p class="bf-kicker">'), html.indexOf('data-page="2"><p class="bf-kicker">'));
  assert.ok(page1.indexOf('data-bf="name"') < page1.indexOf('data-bf="gender"'));
  assert.ok(!page1.includes('비워 둬도'));
  assert.match(html, /S\.gender=b\.dataset\.val;syncWho\(\);if\(whoDone\(\)\)setTimeout\(function\(\)\{go\(2\);\},420\);/);
  assert.match(html, /function whoDone\(\)\{S\.name=\$b\('name'\)\.value\.trim\(\);if\(!S\.name\)\{/);
  // 기본 입력폼
  assert.ok(html.includes('<label for="f-name">이름</label>'));
  assert.match(html, /if\(SAJU_FORM_STEP===0&&sajuNameMissing\(\)\)return;/);
  assert.match(html, /if\(sajuNameMissing\(\)\)return;/);
  // 궁합: 두 사람 모두 이름 필수
  assert.ok(!/이름 <span class="hint">\(선택\)<\/span>/.test(html));
  assert.match(html, /function readPersonForm\(suf\)\{\s*if \(!\$\('#c-name-'\+suf\)\.value\.trim\(\)\) throw/);
});
