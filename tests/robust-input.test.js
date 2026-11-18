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
