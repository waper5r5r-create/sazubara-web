// 콘텐츠 등록표(index.html의 CONTENTS)가 결제 취소 화면, 약관 가격표, 서버 값과 어긋나지 않는지 확인한다.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=read('index.html'),fail=read('fail.html'),legal=read('legal.html');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.reg={CONTENTS,contentOf,contentPrice,withRegistered,storyCategory,HOME_BANNERS,CONTENT_INTRO};})();');
const sandbox={document:{readyState:'loading',addEventListener(){}},window:{},localStorage:{getItem(){return null;}},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const {CONTENTS,contentOf,contentPrice,withRegistered,storyCategory,HOME_BANNERS,CONTENT_INTRO}=sandbox.reg;
const SERVER={newyear:'_newyear-content',ian:'_ian-content',yeonseo:'_yeonseo-content',love:'_love-content',wealth:'_wealth-content',pocha:'_career-content',marriage:'_marriage-content'};

test('each content is registered once, with its own address',()=>{
  assert.equal(new Set(CONTENTS.map(e=>e.id)).size,CONTENTS.length);
  assert.equal(new Set(CONTENTS.map(e=>e.slug)).size,CONTENTS.length);
  for(const e of CONTENTS){
    assert.equal(storyCategory({id:e.id}),e.kind,e.slug);
    assert.ok(['year','story','topic'].includes(e.group),e.slug);
    assert.equal(CONTENT_INTRO[e.id].slug,e.slug);
  }
  assert.equal(HOME_BANNERS.length,CONTENTS.filter(e=>e.banner).length);
});

test('every registered content matches the server id, title and price',()=>{
  for(const e of CONTENTS){
    const c=require('../api/'+SERVER[e.kind]).concept;
    assert.equal(e.id,c.id,e.slug);
    if(e.concept){assert.equal(e.concept.title,c.title,e.slug);assert.equal(e.concept.price_krw,c.price_krw,e.slug+' price');}
    assert.equal(contentPrice({id:e.id}),c.price_krw,e.slug+' shown price');
  }
});

test('cancelling a payment can go back to every registered content',()=>{
  for(const e of CONTENTS)assert.ok(fail.includes("'"+e.id+"':"),e.slug+' missing from fail.html');
});

test('the terms price table lists every content sold on its own',()=>{
  for(const e of CONTENTS.filter(x=>x.concept)){
    const won=e.concept.price_krw.toLocaleString('ko-KR')+'원';
    assert.ok(legal.includes('<tr><th>'+e.concept.title+'</th><td>'+won+'</td></tr>'),e.concept.title+' '+won);
  }
});

test('contents the server list does not have yet are added in registry order',()=>{
  const ny=CONTENTS[0].id,ian=CONTENTS[1].id,ys=CONTENTS[2].id;
  const rows=withRegistered([{id:ny},{id:ian},{id:'server-only'}]);
  assert.deepEqual(rows.map(r=>r.id),[ny,ian,ys,'server-only']);
  assert.equal(withRegistered(rows).length,rows.length,'nothing is added twice');
  assert.ok(contentOf(ys).single&&contentOf(ian).single&&!contentOf('운명의-사람은-언제-올까-fyq1z').single);
});

test('the server registry has the same contents as the page registry',()=>{
  const S=require('../api/_contents');
  assert.deepEqual(S.CONTENTS.map(c=>c.concept.id).sort(),[...CONTENTS].map(e=>String(e.id)).sort());
  for(const c of S.CONTENTS)assert.equal(contentPrice({id:c.concept.id}),S.priceOf(c.concept.id,7900),c.concept.title);
});

test('checkout asks the same price as before for every content sold without a database row',async()=>{
  process.env.SUPABASE_URL=process.env.SUPABASE_URL||'https://database.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'test-service-key';
  process.env.TOSS_SECRET_KEY=process.env.TOSS_SECRET_KEY||'test-secret-key';
  const unlock=require('../api/reports/unlock'),S=require('../api/_contents');
  const BEFORE={'2027 신년운세':4900,'이안의 비밀':7900,'여우의 인연 장부':9900,'직업 사주':7900,'결혼 사주':7900};
  const sold=S.CONTENTS.filter(c=>c.sold).map(c=>c.concept);
  assert.deepEqual(sold.map(c=>c.title).sort(),Object.keys(BEFORE).sort());
  const realFetch=global.fetch;global.fetch=async()=>new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  try{
    for(const c of sold){
      const body={action:'prepare',deviceId:'dev-reg',conceptId:c.id,stage:'story'};
      const out=await new Promise(resolve=>{const res={statusCode:200,setHeader(){},status(x){this.statusCode=x;return this;},json(b){resolve({status:this.statusCode,body:b});}};
        unlock({method:'POST',url:'/api/reports/unlock',headers:{host:'x','content-type':'application/json'},body,on(ev,cb){if(ev==='data')cb(Buffer.from(JSON.stringify(body)));if(ev==='end')cb();return this;}},res);});
      assert.equal(out.status,200,c.title+' '+JSON.stringify(out.body));assert.equal(out.body.amount,BEFORE[c.title],c.title);
    }
  } finally { global.fetch=realFetch; }
});
