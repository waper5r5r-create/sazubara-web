// 궁합: 관계(연인·친구 …)와 성별에 따른 배우자 별.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.cr={computeSaju,computeCompat,compatRelOf,compatSpouse,compatLongReportHtml};})();');
const sandbox={document:{readyState:'loading',addEventListener(){}},window:{},localStorage:{getItem(){return null;}},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const {computeSaju,computeCompat,compatRelOf,compatSpouse,compatLongReportHtml}=sandbox.cr;
const base={hour:12,minute:0,isLunar:false,isLeapMonth:false,unknownTime:true,city:'서울',useCorrection:true};
const me=computeSaju({...base,year:1995,month:5,day:8,hour:14,minute:30,unknownTime:false,gender:'f',name:'지우'});
const text=h=>h.replace(/<[^>]*>/g,' ');
// 나(여성)를 다스리는 기운(관성)을 태어난 날에 가진 남성을 찾는다 → 서로의 배우자 자리
function findPartner(){for(let d=1;d<=60;d++){const b=computeSaju({...base,year:1994,month:1,day:d,gender:'m',name:'민준'});const sp=computeCompat(me,b).spouse;if(sp.aSeesB&&sp.bSeesA)return b;}throw new Error('no partner');}

test('relationship defaults by gender and keeps an explicit choice',()=>{
  const m=computeSaju({...base,year:1994,month:11,day:20,gender:'m',name:'민준'}),f=computeSaju({...base,year:1996,month:3,day:2,gender:'f',name:'서연'});
  assert.equal(compatRelOf(me,m),'lover');
  assert.equal(compatRelOf(me,f),'friend');
  f.rel='lover';assert.equal(compatRelOf(me,f),'lover');
  m._input={rel:'work'};assert.equal(compatRelOf(me,m),'work');
});

test('spouse star depends on gender: 관성 for women, 재성 for men',()=>{
  const f={gender:'f'},m={gender:'m'};
  assert.deepEqual({...compatSpouse(f,m,'keBack')},{aSeesB:true,bSeesA:true});
  assert.deepEqual({...compatSpouse(m,f,'ke')},{aSeesB:true,bSeesA:true});
  assert.deepEqual({...compatSpouse(f,m,'ke')},{aSeesB:false,bSeesA:false});
  assert.deepEqual({...compatSpouse(m,m,'ke')},{aSeesB:true,bSeesA:false});
});

test('a mutual spouse star adds a little only for lovers and shows in the report',()=>{
  const b=findPartner();
  b.rel='lover';const lover=computeCompat(me,b);
  b.rel='friend';const friend=computeCompat(me,b);
  assert.equal(lover.scores.love,Math.min(97,friend.scores.love+6));
  assert.equal(lover.scores.total,Math.min(97,friend.scores.total+3));
  b.rel='lover';const loveText=text(compatLongReportHtml(me,b,lover,false));
  assert.ok(loveText.includes('배우자 자리'));assert.ok(loveText.includes('우리, 결혼하면'));
  b.rel='friend';const friendText=text(compatLongReportHtml(me,b,friend,false));
  assert.ok(!friendText.includes('배우자 자리'));assert.ok(friendText.includes('우리, 오래 함께하면'));assert.ok(!friendText.includes('돈은 누가 쥐면'));
  assert.ok(!/undefined|NaN/.test(friendText+loveText));
});
