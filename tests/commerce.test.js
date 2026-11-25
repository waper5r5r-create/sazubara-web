const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.TOSS_SECRET_KEY = 'test-secret-key';
const reportUnlock = require('../api/reports/unlock');
const listReports = require('../api/reports/list');
const unlock = require('../api/unlock');
const { signQuote } = require('../api/_payment-quote');
let tables, confirms;
function reset() {
  confirms=0;
  tables={devices:[],account_devices:[],device_secrets:[],report_concepts:[{id:'theme',title:'테스트 이야기',active:true,price_krw:990}], report_panels:Array.from({length:20},(_,i)=>({id:i+1,concept_id:'theme',sort_order:i+1,img_url:i%2===0?'https://image.invalid/'+i:null,caption_template:'{{branch:domWx|수::차분한 마음이에요. 생각이 깊어요. 마음을 표현해보세요.||화::솔직한 마음이에요. 먼저 다가가요.||else::}}'})),paid_unlocks:[],report_unlocks:[],devices:[]};
  global.fetch=async function(url,options={}) {
    const parsed=new URL(url);
    if(parsed.hostname==='api.tosspayments.com') {
      if(options.method==='POST')confirms++;
      const body=JSON.parse(options.body);
      return Response.json({totalAmount:body.amount,orderId:body.orderId,status:'DONE',currency:'KRW',approvedAt:'2026-10-12T00:00:00+09:00'});
    }
    if(parsed.pathname==='/auth/v1/user'){const token=(options.headers||{}).Authorization||'';return token==='Bearer good-login-token-123456789'?Response.json({id:'11111111-1111-4111-8111-111111111111'}):Response.json({},{status:401});}
    if(parsed.pathname.startsWith('/auth/v1/admin/users/'))return (tables.realUsers||[]).includes(decodeURIComponent(parsed.pathname.split('/').pop()))?Response.json({id:'x'}):Response.json({},{status:404});
    const name=parsed.pathname.split('/').pop(),table=tables[name];assert.ok(table,'unexpected mock table '+name);
    if(options.method==='POST') {
      const row=JSON.parse(options.body);
      if(name==='devices'){if(!table.some(r=>r.device_id===row.device_id))table.push(row);return Response.json({});}
      if(table.some(r=>(row.order_id&&r.order_id===row.order_id)||(row.secret_hash&&r.device_id===row.device_id)||(row.user_id&&r.user_id===row.user_id&&r.device_id===row.device_id)||(r.device_id===row.device_id&&(r.unlock_key&&r.unlock_key===row.unlock_key||r.concept_id&&r.concept_id===row.concept_id))))return Response.json({},{status:409});
      table.push(row);return Response.json([row],{status:201});
    }
    const match=(r,key,value)=>value.startsWith('eq.')?String(r[key])===value.slice(3):value.startsWith('in.(')?value.slice(4,-1).split(',').map(v=>v.replace(/^"|"$/g,'')).includes(String(r[key])):value==='not.is.null'?r[key]!=null:true;
    let rows=table.filter(r=>[...parsed.searchParams.entries()].every(([key,value])=>match(r,key,value)));
    return Response.json(rows);
  };
}
async function call(handler,method,url,body={}) {
  const req={method,url,body,headers:{}};
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
  await handler(req,res);return {status:res.code,...res.data};
}
async function prepare(stage,deviceId='test-device') {return call(reportUnlock,'POST','/api/reports/unlock',{action:'prepare',deviceId,conceptId:'theme',stage});}
async function buy(stage,deviceId='test-device') {
  const checkout=await prepare(stage,deviceId);assert.equal(checkout.ok,true);
  const body={paymentKey:'test-payment-'+checkout.orderId,orderId:checkout.orderId,amount:checkout.amount,quote:checkout.quote,deviceId,conceptId:'theme',stage};
  return {body,result:await call(reportUnlock,'POST','/api/reports/unlock',body)};
}
test('one 7,900 purchase opens the story and the report together, retry is idempotent',async()=>{
  reset();
  const free=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=test-device');
  assert.equal(free.rows.length,1);assert.equal(free.detailRows.length,0);assert.equal(free.access.story,false);
  assert.equal((await prepare('detail')).error,'MISSING_FIELDS');assert.equal(confirms,0);
  const first=await buy('story');assert.equal(first.result.ok,true);assert.equal(first.body.amount,7900);assert.equal(confirms,1);
  const full=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=test-device');
  assert.equal(full.rows.length,20);assert.equal(full.detailRows.length,20);assert.equal(full.access.story,true);assert.equal(full.access.detail,true);
  assert.ok(full.rows[0].caption_template.includes('마음을 표현해보세요'));
  assert.equal((await call(reportUnlock,'POST','/api/reports/unlock',first.body)).ok,true);assert.equal(confirms,1);
  assert.equal((await prepare('story')).error,'ALREADY_OWNED');
});
test('price and stage tampering fail before approval',async()=>{
  reset();const checkout=await prepare('story');
  const body={paymentKey:'test',orderId:checkout.orderId,amount:7900,quote:checkout.quote,deviceId:'test-device',conceptId:'theme',stage:'story'};
  for(const overrides of [{amount:1},{amount:4900},{stage:'detail'},{conceptId:'another-theme'},{deviceId:'another-device'},{quote:'tampered'}]) {
    const r=await call(reportUnlock,'POST','/api/reports/unlock',{...body,...overrides});assert.equal(r.ok,false);
  }
  assert.equal(confirms,0);assert.equal(tables.paid_unlocks.length,0);
});
test('old full-report buyers and earlier single-stage buyers keep everything',async()=>{
  reset();tables.report_unlocks.push({device_id:'existing-buyer',concept_id:'theme',order_id:'old-order',amount:4900});
  const r=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=existing-buyer');assert.deepEqual(r.access,{story:true,detail:true,legacy:true});assert.equal(r.detailRows.length,20);
  assert.equal((await prepare('story','existing-buyer')).error,'ALREADY_OWNED');
  for(const stage of ['story','detail']){
   reset();tables.paid_unlocks.push({device_id:'stage-buyer',unlock_key:'report-'+stage+'-theme',order_id:'o-'+stage,amount:stage==='story'?4900:12900});
   const s=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=stage-buyer');assert.equal(s.access.story,true);assert.equal(s.access.detail,true);assert.equal(s.detailRows.length,20);
  }
});
test('a signed old detail-stage quote can no longer be approved',async()=>{
  reset();const fields={orderId:'detail-order',deviceId:'test-device',conceptId:'theme',stage:'detail',amount:12900};
  const r=await call(reportUnlock,'POST','/api/reports/unlock',{...fields,paymentKey:'test',quote:signQuote(fields)});assert.equal(r.error,'INVALID_STAGE');assert.equal(confirms,0);
});
test('catalogue prices and every category plus today/couple match 990',async()=>{
  reset();const catalogue=await call(listReports,'GET','/api/reports/list');assert.equal(catalogue.rows[0].price_krw,4900);const ys=require('../api/_yeonseo-content').concept;assert.equal(catalogue.rows.find(x=>x.id===ys.id).price_krw,9900);assert.ok(catalogue.rows.slice(1).filter(x=>x.id!==ys.id).every(x=>x.price_krw===7900));assert.equal(catalogue.rows[0].detail_price_krw,undefined);
  const keys=['연애','직장','재물','건강','인간관계'].map(cat=>'feature-saju-deep:'+cat).concat(['feature-today-premium','compat-test-pair']);
  for(const [i,unlockKey] of keys.entries()) {
    const bad=await call(unlock,'POST','/api/unlock',{paymentKey:'test',orderId:'bad-'+i,amount:2900,deviceId:'test-device',unlockKey});assert.equal(bad.error,'AMOUNT_MISMATCH');
    const r=await call(unlock,'POST','/api/unlock',{paymentKey:'test',orderId:'order-'+i,amount:990,deviceId:'test-device',unlockKey});assert.equal(r.ok,true);
  }
  assert.equal(confirms,keys.length);assert.equal(tables.paid_unlocks.filter(r=>r.unlock_key.startsWith('feature-saju-deep:')).length,5);
});

test('generic payment rejects mismatched approval and reused orders',async()=>{
 for(const wrong of [{orderId:'different'},{status:'WAITING_FOR_DEPOSIT'},{currency:'USD'}]) {
  reset();const realFetch=global.fetch;global.fetch=async(url,options)=>String(url).includes('api.tosspayments.com') ? Response.json({...JSON.parse(options.body),totalAmount:990,status:'DONE',currency:'KRW',...wrong}) : realFetch(url,options);
  const r=await call(unlock,'POST','/api/unlock',{paymentKey:'test',orderId:'test-order',amount:990,deviceId:'test-device',unlockKey:'feature-today-premium'});assert.equal(r.ok,false);assert.equal(tables.paid_unlocks.length,0);
 }
 reset();tables.paid_unlocks.push({order_id:'reused',device_id:'other-device',unlock_key:'compat-other',amount:990});
 const r=await call(unlock,'POST','/api/unlock',{paymentKey:'test',orderId:'reused',amount:990,deviceId:'test-device',unlockKey:'feature-today-premium'});assert.equal(r.error,'ORDER_CONFLICT');assert.equal(confirms,0);
});

test('career catalogue, one paid purchase and protected report work without a database concept row',async()=>{
 reset();const c=require('../api/_career-content').concept;
 const catalogue=await call(listReports,'GET','/api/reports/list');assert.equal(catalogue.rows.filter(x=>x.id===c.id).length,1);
 const url='/api/reports/list?conceptId='+c.id+'&device_id=test-device';
 const free=await call(listReports,'GET',url);assert.equal(free.rows.length,0);assert.equal(free.detailRows.length,0);
 const checkout=await call(reportUnlock,'POST','/api/reports/unlock',{action:'prepare',deviceId:'test-device',conceptId:c.id,stage:'story'});assert.equal(checkout.ok,true);assert.equal(checkout.amount,7900);
 const approved=await call(reportUnlock,'POST','/api/reports/unlock',{paymentKey:'mock',orderId:checkout.orderId,amount:checkout.amount,quote:checkout.quote,deviceId:'test-device',conceptId:c.id,stage:'story'});assert.equal(approved.ok,true);
 const read=await call(listReports,'GET',url);assert.equal(read.rows.length,1);assert.ok(read.rows[0].cards);assert.equal(read.detailRows.length,1);assert.ok(read.detailRows[0].stemView);
 const anonymous=await call(listReports,'GET','/api/reports/list?conceptId='+c.id);assert.equal(anonymous.rows.length,0);assert.equal(anonymous.detailRows.length,0);
});

test('logging in links devices: purchases follow the account, the saju carries over, and a wrong device key is refused',async()=>{
 reset();const link=(deviceId,deviceSecret,accessToken='good-login-token-123456789')=>call(require('../api/account/link'),'POST','/api/account/link',{deviceId,deviceSecret,accessToken});
 const bought=await buy('story','phone-a');assert.equal(bought.result.ok,true);
 tables.devices.find(r=>r.device_id==='phone-a').saju_opts={year:1995,month:3,day:21};
 assert.equal((await link('phone-a','secret-a-0123456789abcdefghij','bad')).error,'NOT_LOGGED_IN');
 const a=await link('phone-a','secret-a-0123456789abcdefghij');assert.equal(a.ok,true);assert.equal(a.devices,1);
 const before=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=phone-b');assert.equal(before.access.story,false);
 const b=await link('phone-b','secret-b-0123456789abcdefghij');assert.equal(b.ok,true);assert.equal(b.devices,2);assert.deepEqual(b.saju,{year:1995,month:3,day:21});
 const after=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=phone-b');assert.equal(after.access.story,true);assert.equal(after.detailRows.length,20);
 assert.equal((await prepare('story','phone-b')).error,'ALREADY_OWNED');
 assert.equal((await link('phone-a','someone-else-guessing-the-key-123')).error,'DEVICE_MISMATCH');
 assert.equal(tables.account_devices.length,2);
 const stranger=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=phone-c');assert.equal(stranger.access.story,false);
});

test('purchases move to another browser without login: by saved link or by order number, never by a 0원 order or a forged link',async()=>{
 reset();const api=require('../api/account/link'),A='secret-a-0123456789abcdefghij',B='secret-b-0123456789abcdefghij',C='secret-c-0123456789abcdefghij';
 const post=body=>call(api,'POST','/api/account/link',body);
 const owns=async d=>(await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id='+d)).access.story;
 const bought=await buy('story','insta-a');assert.equal(bought.result.ok,true);
 assert.equal(await owns('safari-b'),false);
 const issued=await post({action:'restore-issue',deviceId:'insta-a',deviceSecret:A});assert.equal(issued.ok,true);assert.ok(issued.token.length<200);
 assert.equal((await post({action:'restore-issue',deviceId:'insta-a',deviceSecret:'someone-else-guessing-the-key-123'})).error,'DEVICE_MISMATCH');
 assert.equal((await post({action:'restore',token:issued.token+'x',deviceId:'safari-b',deviceSecret:B})).error,'RESTORE_LINK_INVALID');
 const [p,s]=issued.token.split('.');const forged=Buffer.from(JSON.stringify({d:'someone-else',e:Date.now()+1e9})).toString('base64url')+'.'+s;
 assert.equal((await post({action:'restore',token:forged,deviceId:'safari-b',deviceSecret:B})).error,'RESTORE_LINK_INVALID');
 const r=await post({action:'restore',token:issued.token,deviceId:'safari-b',deviceSecret:B});assert.equal(r.ok,true);assert.equal(r.devices,2);
 assert.equal(await owns('safari-b'),true);assert.equal((await prepare('story','safari-b')).error,'ALREADY_OWNED');
 assert.equal((await post({action:'restore',token:issued.token,deviceId:'safari-b',deviceSecret:B})).ok,true);assert.equal(tables.account_devices.length,2);
 // 주문번호로도 가져올 수 있다. 0원(초대·쿠폰) 주문번호는 짐작할 수 있어서 쓸 수 없다.
 tables.paid_unlocks.push({device_id:'insta-a',unlock_key:'invite-compat-x',order_id:'invite_insta-a_friend-device-01',amount:0});
 assert.equal((await post({action:'restore',orderId:'invite_insta-a_friend-device-01',deviceId:'chrome-c',deviceSecret:C})).error,'ORDER_NOT_FOUND');
 assert.equal((await post({action:'restore',orderId:'sazubara_doesnotexist0000000000',deviceId:'chrome-c',deviceSecret:C})).error,'ORDER_NOT_FOUND');
 assert.equal(await owns('chrome-c'),false);
 assert.equal((await post({action:'restore',orderId:bought.body.orderId,deviceId:'chrome-c',deviceSecret:C})).ok,true);assert.equal(await owns('chrome-c'),true);
 assert.equal(await owns('stranger-d'),false);
});
test('restore joins a Kakao account the buyer already has, but never merges two different Kakao accounts',async()=>{
 reset();const api=require('../api/account/link'),post=body=>call(api,'POST','/api/account/link',body);
 const owns=async d=>(await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id='+d)).access.story;
 const K1='11111111-1111-4111-8111-111111111111',K2='22222222-2222-4222-8222-222222222222';tables.realUsers=[K1,K2];
 await buy('story','phone-a');tables.account_devices.push({user_id:K1,device_id:'phone-a'});
 const t=(await post({action:'restore-issue',deviceId:'phone-a',deviceSecret:'secret-a-0123456789abcdefghij'})).token;
 assert.equal((await post({action:'restore',token:t,deviceId:'new-b',deviceSecret:'secret-b-0123456789abcdefghij'})).ok,true);
 assert.ok(tables.account_devices.some(r=>r.user_id===K1&&r.device_id==='new-b'));assert.equal(await owns('new-b'),true);
 tables.account_devices.push({user_id:K2,device_id:'family-c'});
 const refused=await post({action:'restore',token:t,deviceId:'family-c',deviceSecret:'secret-c-0123456789abcdefghij'});assert.equal(refused.error,'OTHER_ACCOUNT');assert.equal(await owns('family-c'),false);
});
test('the page restores from ?restore= once, removes the link from the address bar, and offers the order-number box',()=>{
 const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/restoreFromUrl\(\);\s*pullPaidUnlocks\(\);/);
 assert.match(html,/searchParams\.delete\('restore'\);history\.replaceState/);
 assert.ok(html.includes('data-restore-order')&&html.includes('data-restore-share'));
 assert.ok(html.includes("kind==='paid'?'<button type=\"button\" class=\"share-btn\" data-restore-share>"));
});

test('new year costs 4,900 at checkout, other content stays 7,900, and the old amount is refused',async()=>{
 reset();const ny=require('../api/_newyear-content').concept,ian=require('../api/_ian-content').concept;
 const start=(conceptId,deviceId='test-device')=>call(reportUnlock,'POST','/api/reports/unlock',{action:'prepare',deviceId,conceptId,stage:'story'});
 const checkout=await start(ny.id);assert.equal(checkout.ok,true);assert.equal(checkout.amount,4900);
 assert.equal((await start(ian.id)).amount,7900);
 const old=await call(reportUnlock,'POST','/api/reports/unlock',{paymentKey:'mock',orderId:checkout.orderId,amount:7900,quote:signQuote({orderId:checkout.orderId,deviceId:'test-device',conceptId:ny.id,stage:'story',amount:7900}),deviceId:'test-device',conceptId:ny.id,stage:'story'});
 assert.equal(old.ok,false);assert.equal(confirms,0);
 const paid=await call(reportUnlock,'POST','/api/reports/unlock',{paymentKey:'mock',orderId:checkout.orderId,amount:4900,quote:checkout.quote,deviceId:'test-device',conceptId:ny.id,stage:'story'});
 assert.equal(paid.ok,true);assert.equal(confirms,1);
});
