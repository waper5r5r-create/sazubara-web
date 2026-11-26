// 궁합 리포트: 앞 4개 장은 무료, 깊이 보기(2,900원)에서 속마음·가까워지는 날·결혼하면이 열린다.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.cd={computeSaju,computeCompat,compatLongReportHtml,crCloseDays,COMPAT_DETAIL_PRICE};})();');
const sandbox={document:{readyState:'loading',addEventListener(){}},window:{},localStorage:{getItem(){return null;}},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const {computeSaju,computeCompat,compatLongReportHtml,crCloseDays,COMPAT_DETAIL_PRICE}=sandbox.cd;
const a=computeSaju({year:1995,month:5,day:8,hour:14,minute:30,isLunar:false,isLeapMonth:false,unknownTime:false,gender:'f',name:'지우',city:'서울',useCorrection:true});
const b=computeSaju({year:1994,month:11,day:20,hour:9,minute:0,isLunar:false,isLeapMonth:false,unknownTime:true,gender:'m',name:'민준',city:'서울',useCorrection:true});
const text=h=>h.replace(/<[^>]*>/g,' ');

test('the free preview has four chapters and only names what the depth view opens',()=>{
  const free=text(compatLongReportHtml(a,b,computeCompat(a,b),true));
  for(const t of ['한눈에 보는 우리','두 사람은 이런 사람','서로 채워 주는 기운','대화할 때','깊이 보기에서 열리는 것','민준님 눈에 지우님은','같이 살면'])assert.ok(free.includes(t),t);
  for(const t of ['처음 끌린 점','마음을 드러내는 방식','돈은 누가 쥐면 좋을까','함께하기 좋은 달은'])assert.ok(!free.includes(t),t);
});

test('the depth view adds the heart, close days and marriage chapters',()=>{
  const full=text(compatLongReportHtml(a,b,computeCompat(a,b),false));
  for(const t of ['그 사람 속마음','처음 끌린 점','우리가 가까워지는 날','우리, 결혼하면','돈은 누가 쥐면 좋을까','앞으로 12달','서로에게 힘이 되는 말'])assert.ok(full.includes(t),t);
  assert.ok(!/undefined|NaN/.test(full));
  assert.equal(COMPAT_DETAIL_PRICE,2900);
});

test('close days are three good days at least ten days apart within ninety days',()=>{
  const from=new Date(2026,10,26),r=crCloseDays(a,b,from);
  assert.equal(r.good.length,3);
  for(let i=1;i<r.good.length;i++)assert.ok(r.good[i].d-r.good[i-1].d>=10*864e5);
  for(const x of r.good){assert.ok(x.d>from);assert.ok(x.d-from<=91*864e5);}
});

test('the server asks 2,900 for the compat depth view and the terms list it',()=>{
  const unlock=fs.readFileSync(path.join(__dirname,'..','api','unlock.js'),'utf8');
  assert.match(unlock,/const COMPAT_DETAIL_PRICE = 2900;/);
  const legal=fs.readFileSync(path.join(__dirname,'..','legal.html'),'utf8');
  assert.ok(legal.includes('<tr><th>궁합 깊이 보기</th><td>2,900원</td></tr>'));
});
