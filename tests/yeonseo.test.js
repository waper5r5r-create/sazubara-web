// 연서의 인연 장부(시제품): 두 사람 줄 모양과 90일 여우불 날짜가 실제 사주 계산에서 나오는지 확인한다.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
const noop=()=>{};
const sandbox={document:{readyState:'loading',addEventListener:noop},window:{},localStorage:{getItem(){return null;},setItem:noop},console,setTimeout:noop,clearTimeout:noop,URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
sandbox.document=undefined;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/yeonseo/yeonseo.js'),'utf8'),sandbox);
const E=sandbox.YS_ENGINE,C=sandbox.YeonseoCalc;
const chart=(y,m,d,g,name)=>E.computeSaju({year:y,month:m,day:d,hour:12,minute:0,unknownTime:true,gender:g,name,city:'서울',useCorrection:true});

test('engine and calc are exposed only as data, the screen code does not run without a page',()=>{
 assert.equal(typeof E.computeSaju,'function');assert.equal(typeof C.days,'function');
 assert.match(html,/\[\?&\]yeonseo=1\(&\|\$\)/);
});

test('the ink line follows the two spouse palaces',()=>{
 const me=chart(1995,5,20,'f','서윤'),them=chart(1993,8,14,'m','도현');
 const p=C.pair(me,them),rel=E.zhiRelation(me.day.zhi,them.day.zhi);
 assert.equal(p.rel,rel);
 assert.ok(['tied','cut','tangled','plain'].includes(p.line));
 assert.ok(p.meForThem&&p.themForMe);
 assert.equal(C.pair(me,null).line,'unknown');
 for(const k of ['tied','cut','tangled','plain','unknown'])assert.ok(C.LINE_TEXT[k]);
});

test('90 days: up to three foxfire days, a week apart, meeting at least one palace and clashing with neither',()=>{
 const start=new Date(2026,10,23);
 for(const [a,b] of [[[1995,5,20,'f'],[1993,8,14,'m']],[[1994,3,14,'f'],[1990,1,2,'m']],[[1998,11,30,'m'],[1997,6,6,'f']]]){
  const me=chart(...a,'가'),them=chart(...b,'나'),D=C.days(me,them,start);
  assert.equal(D.rows.length,90);
  assert.ok(D.lights.length<=3&&D.darks.length<=3);
  for(let i=1;i<D.lights.length;i++)assert.ok(D.lights[i].i-D.lights[i-1].i>=7);
  for(const r of D.lights){assert.ok(r.score>=2);assert.ok(['liuhe','sanhe'].includes(r.ra)||['liuhe','sanhe'].includes(r.rb));assert.ok(r.ra!=='chong'&&r.rb!=='chong');}
  for(const r of D.darks)assert.ok(r.ra==='chong'||r.rb==='chong');
  assert.ok(D.gauge>=20&&D.gauge<=95);
  assert.deepEqual(C.days(me,them,start).lights.map(r=>r.key),D.lights.map(r=>r.key));
 }
});

test('without the other birthday, days use only my palace',()=>{
 const D=C.days(chart(1995,5,20,'f','가'),null,new Date(2026,10,23));
 assert.ok(D.rows.every(r=>r.rb===null));
 for(const r of D.lights)assert.ok(['liuhe','sanhe'].includes(r.ra));
});

const T=require('../api/_yeonseo-text');
const Y=require('../api/_yeonseo-content');
const build=(me,them,P,D,ans)=>{const f=Y.parseFacts(JSON.stringify(C.factsOf(me,them,P,D,ans)));assert.ok(f,'facts rejected');return Y.compose(f);};
const texts=ch=>ch.flatMap(c=>[c.title,...c.blocks.flatMap(b=>[b.head,b.text,b.dark,...(b.items||[]).flatMap(x=>typeof x==='string'?[x]:[x.q,x.a,x.range,x.text]),...(b.lights||[]).map(x=>x.text)])]).filter(x=>x!==undefined);

test('the text tables cover every stem, ten god, palace meeting, answer and branch',()=>{
 for(const g of '甲乙丙丁戊己庚辛壬癸')assert.ok(T.loveStyle[g],g);
 for(const s of ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'])assert.ok(T.roleOfMe[s],s);
 for(const r of ['liuhe','sanhe','chong','xing','hai','yuanjin','same','none'])assert.ok(T.whyRel[r]&&T.again[r],r);
 for(const w of ['성격 차이·잦은 다툼','마음이 식음','일방적인 통보','장거리·취업 같은 바깥 사정','바람','잘 모르겠어'])assert.ok(T.whyPick[w],w);
 for(const who of ['나','그 사람','자연스럽게'])for(const b of ['up','flat','down'])assert.ok(T.nowHeart[who][b],who+b);
 for(const c of ['차단됐어','연락 안 해','가끔 해','자주 해'])assert.ok(T.move[c].plan&&T.move[c].lines.length===3,c);
 for(const z of '子丑寅卯辰巳午未申酉戌亥')assert.ok(T.nextOne[z],z);
 for(const w of ['목','화','토','금','수'])assert.ok(T.charm[w],w);
 for(const k of ['same','meFeeds','themFeeds','meCuts','themCuts'])assert.ok(T.stemBond[k],k);
 for(const g of '甲乙丙丁戊己庚辛壬癸')assert.ok(T.recall[g]&&T.change[g],g);
 for(const s of ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'])assert.ok(T.roleOfThem[s],s);
 for(const k of ['썸','연인','오래된 연인','부부','짝사랑'])assert.ok(T.kindNote[k],k);
 for(const w of Object.keys(T.whyPick))assert.ok(T.dont[w],w);
 for(const c of Object.keys(T.move))assert.ok(T.whenReply[c],c);
 for(const g of '甲乙丙丁戊己庚辛壬癸'){assert.ok(T.pattern[g]&&T.themFear[g]&&T.toneFor[g],g);assert.equal(T.themSign[g].length,4,g);}
 for(const w of Object.keys(T.whyPick))assert.ok(T.whyDeep[w]&&T.afterBack[w]&&T.letterReply[w],w);
 for(const c of Object.keys(T.move)){assert.equal(T.replyScript[c].length,3,c);assert.equal(T.faq[c].length,3,c);}
 for(const k of ['same','meFeeds','themFeeds','meCuts','themCuts'])assert.ok(T.fightRule[k],k);
 for(const w of ['목','화','토','금','수'])assert.ok(T.selfCare[w],w);
 for(const l of ['tied','cut','tangled','plain','unknown'])assert.ok(T.finalLetter[l],l);
 for(let i=0;i<3;i++)for(const b of ['up','flat','down'])assert.ok(T.month[i][b],i+b);
 assert.equal(T.dayPlan.length,3);
 for(const g of '甲乙丙丁戊己庚辛壬癸')assert.ok(T.yearNow[g]&&T.charmOf[g]&&T.dateFor[g],g);
 for(const l of ['tied','cut','tangled','plain','unknown'])for(const b of ['high','mid','low'])assert.ok(T.chance[l][b],l+b);
 for(const k of ['썸','연인','오래된 연인','부부','짝사랑'])assert.equal(T.talkTopics[k].length,4,k);
 for(const c of Object.keys(T.move))assert.equal(T.dontList[c].length,4,c);
 for(const z of '子丑寅卯辰巳午未申酉戌亥')assert.ok(T.spouseOf[z],z);
 for(const g of '甲乙丙丁戊己庚辛壬癸')assert.ok(T.innerVoice[g],g);
 for(const t of ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'])assert.ok(T.roleDeep[t],t);
 for(const w of ['목','화','토','금','수'])assert.ok(T.fill[w],w);
 for(const g of '甲乙丙丁戊己庚辛壬癸'){assert.equal(T.strengths[g].length,4,g);assert.ok(T.pattern[g].includes('한 달'),g);}
 for(const k of ['썸','연인','오래된 연인','부부','짝사랑'])assert.ok(T.kindDeep[k],k);
 for(const w of ['나','그 사람','자연스럽게'])assert.ok(T.whoDeep[w]&&T.ifTheyCome[w],w);
 for(const c of Object.keys(T.move))assert.equal(T.weekPlan[c].length,4,c);
 for(const w of Object.keys(T.whyPick))assert.equal(T.checklist[w].length,5,w);
 for(const l of ['tied','cut','tangled','plain','unknown'])assert.ok(T.rival[l],l);
 for(let i=0;i<3;i++)for(const b of ['up','flat','down'])assert.ok(T.mission[i][b],i+b);
 for(const w of Object.keys(T.whyPick))assert.ok(T.whyPickMore[w],w);
 for(const r of Object.keys(T.whyRel))assert.ok(T.whyRelMore[r],r);
 for(const who of ['나','그 사람','자연스럽게'])for(const x of ['up','flat','down'])assert.ok(T.nowHeartMore[who][x],who+x);
 for(const g of '甲乙丙丁戊己庚辛壬癸')assert.ok(T.recallMore[g],g);
 for(const t of Object.keys(T.roleOfThem))assert.ok(T.roleOfThemMore[t],t);
 for(const k of Object.keys(T.stemBond))assert.ok(T.stemBondMore[k],k);
 for(const k of ['low','mid','high'])assert.ok(T.letGoMore[k],k);
 for(const z of '子丑寅卯辰巳午未申酉戌亥')assert.ok(T.nextOneMore[z],z);
});

test('every pair and every answer set builds seven chapters plus a charm, with no blank or undefined text',()=>{
 const start=new Date(2026,10,23);
 const whys=Object.keys(T.whyPick),whos=['나','그 사람','자연스럽게'],contacts=Object.keys(T.move),lens=[];
 for(let i=0;i<60;i++){
  const me=chart(1985+i%15,1+i%12,1+(i*7)%28,i%2?'f':'m','가');
  const them=i%5===0?null:chart(1983+(i*3)%16,1+(i*5)%12,1+(i*11)%28,i%2?'m':'f','나');
  const P=C.pair(me,them),D=C.days(me,them,start);
  const kinds=['썸','연인','오래된 연인','부부','짝사랑'];
  const ch=build(me,them,P,D,{why:whys[i%whys.length],who:whos[i%3],contact:contacts[i%4],kind:kinds[i%5],letter:i%2?'하고 싶었던 말':null});
  const len=texts(ch).join('').length; lens.push(len);
  assert.equal(ch.length,8);
  assert.equal(ch.map(c=>c.no).join(','),'1,2,3,4,5,6,7,0');
  for(const t of texts(ch)){assert.equal(typeof t,'string');assert.ok(t.trim().length>0);assert.ok(!/undefined|null|NaN/.test(t),t);}
  if(!them)assert.ok(ch[2].blocks.some(b=>b.t==='note'));
  const flow=ch[3].blocks.find(b=>b.t==='flow');assert.equal(flow.items.length,12);assert.ok(flow.items.every(x=>/^(1[0-2]|[1-9])월$/.test(x.label)&&x.text));
 }
 console.log('chars per reading: min',Math.min(...lens),'max',Math.max(...lens),'withThem',Math.min(...lens.filter((x,i)=>i%5)),'noThem',Math.max(...lens.filter((x,i)=>i%5===0)));
 assert.ok(Math.min(...lens)>=13000);
});

test('paid text lives only on the server: no table in public assets, tampered facts are refused',()=>{
 assert.deepEqual(fs.readdirSync(path.join(__dirname,'../assets/yeonseo')).filter(x=>/^draft-content/.test(x)),[]);
 const screen=fs.readFileSync(path.join(__dirname,'../assets/yeonseo/yeonseo.js'),'utf8');
 assert.ok(!screen.includes(T.ch1Intro.slice(0,20)));assert.ok(!/YS_CONTENT|draft-content/.test(screen));
 const me=chart(1995,5,20,'f','가'),them=chart(1993,8,11,'m','나'),P=C.pair(me,them),D=C.days(me,them,new Date(2026,10,23));
 const good=C.factsOf(me,them,P,D,{why:'바람',who:'나',contact:'차단됐어',kind:'부부',letter:'x'});
 assert.ok(Y.parseFacts(JSON.stringify(good)));
 for(const bad of [{...good,me:{...good.me,gan:'X'}},{...good,rel:'__proto__'},{...good,ans:{...good.ans,why:'<b>'}},{...good,lights:[{md:'<script>',gz:'갑자',k:'me'}]},{...good,months:good.months.slice(0,2)}])assert.equal(Y.parseFacts(JSON.stringify(bad)),null);
 assert.equal(Y.parseFacts('not json'),null);
 assert.equal(Y.concept.price_krw,9900);
});

test('the list API sends the seven chapters only to a device that bought them',async()=>{
 process.env.SUPABASE_URL=process.env.SUPABASE_URL||'https://database.invalid';
 process.env.SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'test-service-key';
 const list=require('../api/reports/list');
 const call=(query,rows)=>{const realFetch=global.fetch;global.fetch=async()=>new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  return new Promise(resolve=>{const res={statusCode:200,setHeader(){},status(c){this.statusCode=c;return this;},json(b){global.fetch=realFetch;resolve({status:this.statusCode,body:b});}};
   list({method:'GET',url:'/api/reports/list?'+new URLSearchParams(query),query,headers:{host:'x'}},res);});};
 const me=chart(1995,5,20,'f','가'),them=chart(1993,8,11,'m','나'),P=C.pair(me,them),D=C.days(me,them,new Date(2026,10,23));
 const ys=JSON.stringify(C.factsOf(me,them,P,D,{why:'마음이 식음',who:'나',contact:'가끔 해',kind:'썸'}));
 const locked=await call({conceptId:Y.concept.id,device_id:'d1',ys},[]);
 assert.equal(locked.status,200);assert.equal(locked.body.paid,null);assert.equal(locked.body.preview,true);
 assert.ok(!JSON.stringify(locked.body).includes(T.ch1Intro.slice(0,20)));
 const owned=await call({conceptId:Y.concept.id,device_id:'d1',ys},[{unlock_key:'report-story-'+Y.concept.id,concept_id:Y.concept.id}]);
 assert.equal(owned.body.paid.length,8);assert.equal(owned.body.preview,false);
 const bad=await call({conceptId:Y.concept.id,device_id:'d1',ys:'{}'},[]);
 assert.equal(bad.status,400);
});

test('checkout for the ledger is 9,900 won and goes through the existing report unlock',async()=>{
 process.env.SUPABASE_URL=process.env.SUPABASE_URL||'https://database.invalid';
 process.env.SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'test-service-key';
 process.env.TOSS_SECRET_KEY=process.env.TOSS_SECRET_KEY||'test-secret-key';
 const unlock=require('../api/reports/unlock');
 const realFetch=global.fetch;global.fetch=async()=>new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
 const body={action:'prepare',deviceId:'dev-ys',conceptId:Y.concept.id,stage:'story'};
 const out=await new Promise(resolve=>{const res={statusCode:200,setHeader(){},status(c){this.statusCode=c;return this;},json(b){resolve({status:this.statusCode,body:b});}};
  const req={method:'POST',url:'/api/reports/unlock',headers:{host:'x','content-type':'application/json'},body,
   on(ev,cb){ if(ev==='data')cb(Buffer.from(JSON.stringify(body))); if(ev==='end')cb(); return this; }};
  unlock(req,res);});
 global.fetch=realFetch;
 assert.equal(out.status,200,JSON.stringify(out.body));assert.equal(out.body.amount,9900);assert.ok(out.body.quote);
});

test('the added text tables never overwrite a key of the original table',()=>{
 const seen=new Set(Object.keys(require('../api/_yeonseo-text')));
 for(const n of ['2','3','4'])for(const k of Object.keys(require('../api/_yeonseo-text-'+n))){assert.ok(!seen.has(k),n+':'+k);seen.add(k);}
});
