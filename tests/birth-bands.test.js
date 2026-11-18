const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.T={computeSaju,birthBandsFor,bandClockShift,birthBandIndex,sameBandIn,BIRTH_BANDS};})();');
const sb={document:{readyState:'loading',addEventListener(){}},window:{},localStorage:{getItem(){return null;}},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sb);vm.runInContext(source,sb);const T=sb.T;
const SI=['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'],ZHI='자축인묘진사오미신유술해';
const at=(y,m,d,hm,o)=>{const [h,mi]=hm.split(':').map(Number);return T.computeSaju({year:y,month:m,day:d,hour:h,minute:mi,isLunar:false,isLeapMonth:false,unknownTime:false,gender:'f',name:'',city:'서울',useCorrection:true,...(o||{})});};

test('clock shift by birth date: 0 now, +60 in summer time, -30 on the 127.5° clock, +30 when both',()=>{
  assert.equal(T.bandClockShift(1994,5,12,false,false),0);
  assert.equal(T.bandClockShift(1988,7,1,false,false),60);
  assert.equal(T.bandClockShift(1987,6,15,false,false),60);
  assert.equal(T.bandClockShift(1988,11,1,false,false),0);
  assert.equal(T.bandClockShift(1960,1,1,false,false),-30);
  assert.equal(T.bandClockShift(1958,7,1,false,false),30);
  assert.equal(T.bandClockShift(1988,5,20,true,false),60,'음력 1988-05-20 = 양력 7월');
  assert.equal(T.bandClockShift(0,0,0,false,false),0);
  assert.equal(T.birthBandsFor(0),T.BIRTH_BANDS);
});

test('on every kind of clock, each time band picks its own 시진 and its range covers the whole day without gaps',()=>{
  for(const [y,m,d] of [[1994,5,12],[1988,7,1],[1987,8,20],[1960,1,1],[1958,7,1]]){
    const shift=T.bandClockShift(y,m,d,false,false),bands=T.birthBandsFor(shift);
    let covered=0;
    bands.forEach((b,i)=>{
      const r=at(y,m,d,b.t);assert.equal(r.time.zhiKr+'시',b.name,y+'-'+m+'-'+d+' '+b.range+' '+b.t);
      assert.equal(T.birthBandIndex(b.t,bands),i);
      if(b.s!=null)covered+=b.e-b.s;
    });
    if(shift)assert.equal(covered,1440);
    assert.ok(bands.length===12||bands.length===13);
  }
  // 서머타임 날: 진시는 시계로 아침 8:30~10:30, 9:00생은 진시(전에는 7:30~9:30 버튼이라 묘시로 나왔다)
  const dst=T.birthBandsFor(60),jin=dst.find(b=>b.name==='진시');
  assert.equal(jin.range,'아침 8:30~10:30');assert.equal(at(1988,7,1,'09:00').time.zhiKr,'진');
  assert.ok(dst.some(b=>b.range==='자정~새벽 12:30'&&b.name==='해시'),'자정을 넘는 해시는 둘로 나뉜다');
});

test('changing the date keeps the chosen 시진 and side of midnight',()=>{
  const base=T.BIRTH_BANDS,dst=T.birthBandsFor(60);
  const j=T.sameBandIn(base[4],dst);assert.equal(dst[j].name,'진시');
  const late=T.sameBandIn(base[12],dst);assert.equal(dst[late].name,'자시');
  assert.equal(T.sameBandIn(null,dst),-1);
});

test('compat partner is calculated with the same local-time fix as my own chart',()=>{
  assert.match(html,/city:'서울', useCorrection:true\n  \}\);\n\}/);
  assert.ok(!/city:'서울', useCorrection:false\n  \}\);/.test(html));
});

test('a lunar day missing from the leap month is reported as a missing day, not as a missing leap month',()=>{
  const lunar=(y,m,d,leap)=>{try{T.computeSaju({year:y,month:m,day:d,hour:12,minute:0,isLunar:true,isLeapMonth:leap,unknownTime:true,gender:'f',name:'',city:'서울',useCorrection:true});return 'ok';}catch(e){return e.message;}};
  assert.match(lunar(2020,4,30,true),/윤4월에는 30일이 없어요/);
  assert.match(lunar(2023,3,15,true),/3월에는 윤달이 없어요/);
  assert.match(lunar(1990,1,30,false),/음력 1월에는 30일이 없어요/);
  assert.equal(lunar(2020,4,29,true),'ok');
});
