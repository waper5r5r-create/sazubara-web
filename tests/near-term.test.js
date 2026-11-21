// 연애·직업·재물 유료 본문도 가까운 것부터(앞으로 12개월 → 3년 → 10년) 보여 주고, 해마다 내 글자를 짚는 근거가 붙는지 확인한다.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.T={computeSaju,loveFlow,careerFlow,wealthFlow,nearMonthsFor};})();');
const noop=()=>{};
const sandbox={document:{readyState:'loading',addEventListener:noop},window:{},localStorage:{getItem(){return null;},setItem:noop},console,setTimeout:noop,clearTimeout:noop,URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const T=sandbox.T;
const chart=(year,month,day,gender)=>T.computeSaju({year,month,day,hour:12,minute:0,unknownTime:true,gender,name:'지은',city:'서울',useCorrection:true});
const topics={love:['_love-content',T.loveFlow,'연인 자리',r=>r.day],career:['_career-content',T.careerFlow,'일터 자리',r=>r.month],wealth:['_wealth-content',T.wealthFlow,'내 자리(일지)',r=>r.day]};

for(const [t,[file,flow,name,palace]] of Object.entries(topics)){
 const m=require('../api/'+file);
 test(t+': text tables cover every ten god, age band and month type',()=>{
  for(const ss of ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'])for(const k of ['yearSS','monthSS']){const v=m.story[k][ss];assert.ok(typeof v==='string'?v:v.f&&v.m,t+k+ss);}
  for(const b of ['early','late20','early30','late30','forty'])for(const k of ['top','care','calm'])assert.ok(m.story.ageBand[b][k],t+b+k);
  for(const rel of ['liuhe','sanhe','chong','same','xing','hai','yuanjin','none'])assert.ok(m.story.nearA[rel]&&m.story.nearB[rel],t+rel);
  assert.equal(m.detail.yearSS,m.story.yearSS);
 });
 test(t+': owned reading shows 12 months and 3 years before the 10-year view, with the reader own characters',()=>{
  const r=chart(1994,3,14,'f'),p=palace(r);
  const h=flow(m.concept,{access:{story:true,detail:true},rows:[m.story],detailRows:[m.detail]},r);
  const a=h.indexOf('aria-label="앞으로 12개월"'),b=h.indexOf('aria-label="3년 안의 흐름"');
  assert.ok(a>0&&b>a,t);
  const months=h.slice(a,b);assert.equal((months.match(/class="nm-item/g)||[]).length,12);assert.equal((months.match(/★ 좋은 달/g)||[]).length,3);
  assert.ok(h.includes(name+' '+p.zhiKr+'('+p.zhi+')'),t);
  assert.ok(h.includes('이달 천간')&&h.includes('그해 천간'),t);
  assert.ok(/만 \d+세가 되는 해예요/.test(h),t);
  assert.ok(!/undefined|NaN/.test(h.replace(/<[^>]+>/g,'')),t);
  const ms=T.nearMonthsFor(t,r,new Date(2026,10,21));assert.equal(ms.length,12);assert.equal(ms[0].month,12);assert.equal(ms.filter(x=>x.top).length,3);
 });
 test(t+': free preview teases three good months without naming them',()=>{
  const h=flow(m.concept,{access:{story:false,detail:false},rows:[],detailRows:[]},chart(1994,3,14,'f'));
  assert.ok(h.includes('앞으로 12개월 중'),t);assert.ok(h.includes('<span>??월</span>'),t);assert.ok(!h.includes('aria-label="앞으로 12개월"'),t);
 });
}
