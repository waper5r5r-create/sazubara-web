// 결혼 사주 유료 본문이 사람마다 달라지는지(같은 해라도 내 글자·십신·나이로 다른 문장이 나오는지) 확인한다.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.T={computeSaju,marriageFlow,marriageTimeline,loveTimeline,wealthTimeline,palaceSSOf,marriageNextMonths};})();');
const noop=()=>{};
const sandbox={document:{readyState:'loading',addEventListener:noop},window:{},localStorage:{getItem(){return null;},setItem:noop},console,setTimeout:noop,clearTimeout:noop,URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const T=sandbox.T;
const m=require('../api/_marriage-content');
const chart=(year,month,day,gender)=>T.computeSaju({year,month,day,hour:12,minute:0,unknownTime:true,gender,name:'지은',city:'서울',useCorrection:true});
const owned=r=>T.marriageFlow(m.concept,{access:{story:true,detail:true},rows:[m.story],detailRows:[m.detail]},r);

test('every spouse-palace ten god has a line for both genders, and every year ten god has text',()=>{
 for(const ss of ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인']){
  const p=m.story.palace[ss];assert.ok(p&&p.title&&p.f&&p.m,ss);
  const y=m.story.yearSS[ss];assert.ok(typeof y==='string'?y:y.f&&y.m,ss);
 }
 for(const band of ['early','late20','early30','late30','forty'])for(const k of ['top','care','calm'])assert.ok(m.story.ageBand[band][k],band+k);
 assert.equal(m.detail.yearSS,m.story.yearSS);
});

test('the paid marriage text names the reader own characters, ten god and age for a year',()=>{
 const r=chart(1994,3,14,'f');const h=owned(r);
 assert.ok(h.includes('배우자 자리에 앉은 기운 · '+m.story.palace[T.palaceSSOf(r)].title));
 assert.ok(h.includes('배우자 자리 '+r.day.zhiKr+'('+r.day.zhi+')'));
 assert.ok(h.includes('일간 '+r.day.ganKr+'('+r.day.gan+')에게'));
 assert.ok(/만 \d+세가 되는 해예요/.test(h));
 assert.ok(!h.includes('undefined')&&!h.includes('NaN'));
});

test('two people reading the same year get different marriage text',()=>{
 const pick=h=>(h.match(/2027년 정미의[^<]*/)||[''])[0];
 const a=pick(owned(chart(1994,3,14,'f'))),b=pick(owned(chart(1990,11,2,'m')));
 assert.ok(a&&b);assert.notEqual(a,b);
});

test('marriage, love and wealth pick good years by their own rules',()=>{
 const r=chart(1994,3,14,'f');
 const mt=T.marriageTimeline(r,2027),lt=T.loveTimeline(r,2027),wt=T.wealthTimeline(r,2027);
 for(const rows of [mt,lt,wt]){assert.equal(rows.length,10);assert.equal(rows.filter(x=>x.top).length,3);}
 assert.ok(mt.some(x=>'spouse' in x)&&lt.some(x=>'dohwa' in x)&&wt.some(x=>'store' in x));
});

test('the marriage reading starts near: the next 12 months (each with reasons) and 3 years come before the 10-year view',()=>{
 const r=chart(1994,3,14,'f');
 const ms=T.marriageNextMonths(r,new Date(2026,10,21));assert.equal(ms.length,12);assert.equal(ms[0].year*100+ms[0].month,202612);assert.equal(ms[11].year*100+ms[11].month,202711);assert.equal(ms.filter(x=>x.top).length,3);
 const h=owned(r);const a=h.indexOf('aria-label="앞으로 12개월"'),b=h.indexOf('aria-label="3년 안의 흐름"'),c=h.indexOf('더 멀리, 10년의 큰 그림');
 assert.ok(a>0&&b>a&&c>b);
 const months=h.slice(a,b);assert.equal((months.match(/class="nm-item/g)||[]).length,12);assert.equal((months.match(/아직 상대가 없다면/g)||[]).length,3);
 assert.ok(months.includes('배우자 자리 '+r.day.zhiKr+'('+r.day.zhi+')')&&months.includes('이달 천간'));
});
