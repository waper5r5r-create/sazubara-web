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
  tables={report_concepts:[{id:'theme',title:'테스트 이야기',active:true,price_krw:990}], report_panels:Array.from({length:20},(_,i)=>({id:i+1,concept_id:'theme',sort_order:i+1,img_url:i%2===0?'https://image.invalid/'+i:null,caption_template:'{{branch:domWx|수::차분한 마음이에요. 생각이 깊어요. 마음을 표현해보세요.||화::솔직한 마음이에요. 먼저 다가가요.||else::}}'})),paid_unlocks:[],report_unlocks:[],devices:[]};
  global.fetch=async function(url,options={}) {
    const parsed=new URL(url);
    if(parsed.hostname==='api.tosspayments.com') {
      if(options.method==='POST')confirms++;
      const body=JSON.parse(options.body);
      return Response.json({totalAmount:body.amount,orderId:body.orderId,status:'DONE',currency:'KRW',approvedAt:'2026-10-12T00:00:00+09:00'});
    }
    const name=parsed.pathname.split('/').pop(),table=tables[name];assert.ok(table,'unexpected mock table '+name);
    if(options.method==='POST') {
      const row=JSON.parse(options.body);
      if(name==='devices')return Response.json({});
      if(table.some(r=>r.order_id===row.order_id||(r.device_id===row.device_id&&(r.unlock_key&&r.unlock_key===row.unlock_key||r.concept_id&&r.concept_id===row.concept_id))))return Response.json({},{status:409});
      table.push(row);return Response.json([row],{status:201});
    }
    let rows=table.filter(r=>[...parsed.searchParams.entries()].every(([key,value])=>!value.startsWith('eq.')||String(r[key])===value.slice(3)));
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
test('two purchases grant different content, retry is idempotent',async()=>{
  reset();
  const free=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=test-device');
  assert.equal(free.rows.length,1);assert.equal(free.detailRows.length,0);assert.equal(free.access.story,false);
  assert.equal((await prepare('detail')).error,'STORY_REQUIRED');assert.equal(confirms,0);
  const first=await buy('story');assert.equal(first.result.ok,true);assert.equal(confirms,1);
  const story=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=test-device');
  assert.equal(story.rows.length,20);assert.equal(story.detailRows.length,0);assert.equal(story.access.story,true);assert.equal(story.access.detail,false);
  assert.ok(story.rows[0].caption_template.includes('마음을 표현해보세요')); 
  const second=await buy('detail');assert.equal(second.result.ok,true);assert.equal(confirms,2);
  const full=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=test-device');assert.equal(full.detailRows.length,20);assert.equal(full.access.detail,true);
  assert.equal((await call(reportUnlock,'POST','/api/reports/unlock',second.body)).ok,true);assert.equal(confirms,2);
  assert.equal((await prepare('story')).error,'ALREADY_OWNED');
});
test('price and stage tampering fail before approval',async()=>{
  reset();const checkout=await prepare('story');
  const body={paymentKey:'test',orderId:checkout.orderId,amount:4900,quote:checkout.quote,deviceId:'test-device',conceptId:'theme',stage:'story'};
  for(const overrides of [{amount:1},{stage:'detail'},{conceptId:'another-theme'},{deviceId:'another-device'},{quote:'tampered'}]) {
    const r=await call(reportUnlock,'POST','/api/reports/unlock',{...body,...overrides});assert.equal(r.ok,false);
  }
  assert.equal(confirms,0);assert.equal(tables.paid_unlocks.length,0);
});
test('old full-report buyers retain both stages',async()=>{
  reset();tables.report_unlocks.push({device_id:'existing-buyer',concept_id:'theme',order_id:'old-order',amount:4900});
  const r=await call(listReports,'GET','/api/reports/list?conceptId=theme&device_id=existing-buyer');assert.deepEqual(r.access,{story:true,detail:true,legacy:true});assert.equal(r.detailRows.length,20);
  assert.equal((await prepare('detail','existing-buyer')).error,'ALREADY_OWNED');
});
test('a signed detail purchase still needs story ownership',async()=>{
  reset();const fields={orderId:'detail-order',deviceId:'test-device',conceptId:'theme',stage:'detail',amount:12900};
  const r=await call(reportUnlock,'POST','/api/reports/unlock',{...fields,paymentKey:'test',quote:signQuote(fields)});assert.equal(r.error,'STORY_REQUIRED');assert.equal(confirms,0);
});
test('catalogue prices and every category plus today/couple match 990',async()=>{
  reset();const catalogue=await call(listReports,'GET','/api/reports/list');assert.equal(catalogue.rows[0].price_krw,4900);assert.equal(catalogue.rows[0].detail_price_krw,12900);
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
