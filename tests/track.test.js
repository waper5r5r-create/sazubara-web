const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {eventRow}=require('../api/track.js');

test('track keeps only known steps from a real device id and never personal fields',()=>{
  const r=eventRow({device_id:'abc123xyz',name:'visit',source:'blog',campaign:'day02',landing:'/?go=love',birth:'1995-01-01',userName:'민지'});
  assert.deepEqual(r,{device_id:'abc123xyz',name:'visit',source:'blog',campaign:'day02',landing:'/?go=love'});
  assert.equal(eventRow({device_id:'abc123xyz',name:'drop_table'}),null);
  assert.equal(eventRow({device_id:'<script>',name:'visit'}),null);
  assert.equal(eventRow({device_id:'abc123xyz',name:'pay_done'}).source,'direct');
  assert.equal(eventRow({device_id:'abc123xyz',name:'visit',source:'x"><img onerror=1>'}).source.includes('<'),false);
});

function client(url,referrer,stored){
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const src=html.slice(html.indexOf('function visitSourceNow('),html.indexOf('function isUnlocked('));
  const sent=[],session={};const u=new URL(url);
  const ctx={URL,URLSearchParams,Blob,JSON,location:{search:u.search,pathname:u.pathname,hostname:u.hostname},document:{referrer},
    DEVICE:Object.assign({shareCode:'abc123xyz'},stored||{}),saveDevice(){},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>{session[k]=v;}},
    navigator:{sendBeacon:(u,b)=>{sent.push(b);return true;}},fetch(){return Promise.resolve();}};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return {ctx,sent:async()=>Promise.all(sent.map(b=>b.text().then(JSON.parse)))};
}

test('a blog visitor is counted once per visit and the source follows them to payment',async()=>{
  const c=client('https://www.byeolcheop.com/?go=love&utm_source=blog&utm_campaign=day02','');
  c.ctx.trackVisit();c.ctx.trackVisit();c.ctx.track('pay_start');
  const rows=await c.sent();
  assert.deepEqual(rows.map(r=>r.name),['visit','pay_start']);
  assert.equal(rows[1].source,'blog');assert.equal(rows[1].campaign,'day02');assert.equal(rows[0].landing,'/?go=love');
});

test('without utm the referring site is used, and internal or empty referrers count as direct',async()=>{
  let c=client('https://www.byeolcheop.com/','https://m.blog.naver.com/abc/123');c.ctx.trackVisit();
  assert.equal((await c.sent())[0].source,'blog.naver.com');
  c=client('https://www.byeolcheop.com/','https://www.byeolcheop.com/legal.html');c.ctx.trackVisit();
  assert.equal((await c.sent())[0].source,'direct');
});

test('saju_done is sent only once per device',async()=>{
  const c=client('https://www.byeolcheop.com/','');c.ctx.trackOnce('saju_done');c.ctx.trackOnce('saju_done');
  assert.equal((await c.sent()).length,1);
});

test('the visit source and sent steps survive a page reload',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const save=html.slice(html.indexOf('function saveDevice(){'),html.indexOf('function saveDevice(){')+400);
  assert.match(save,/lastSource:DEVICE\.lastSource/);assert.match(save,/tracked:DEVICE\.tracked/);
});
