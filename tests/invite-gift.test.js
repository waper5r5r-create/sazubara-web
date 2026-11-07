const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');

function loadInvite(responder){
  const calls=[];
  const supa=require.resolve('../api/_supabase.js');
  require.cache[supa]={id:supa,filename:supa,loaded:true,exports:{
    ensureDevice:async()=>{},
    getQuery:req=>req.query,
    readJsonBody:async req=>req.body,
    sbFetch:async(p,o)=>{calls.push({p,o});return responder(p,o);}
  }};
  delete require.cache[require.resolve('../api/invite.js')];
  return {handler:require('../api/invite.js'),calls};
}
function run(handler,body){
  return new Promise(resolve=>{const res={setHeader(){},status(c){this.code=c;return this;},json(d){resolve({code:this.code,data:d});}};
    handler({method:'POST',query:{action:'redeem'},body},res);});
}
const ok={ok:true,status:201,text:async()=>''};

test('first invite gives both people the compat detail for each other, free',async()=>{
  const {handler,calls}=loadInvite(()=>ok);
  const r=await run(handler,{code:'AAA',inviteeDeviceId:'BBB',inviteeName:'민지',sajuOpts:{y:1}});
  assert.equal(r.data.registered,true);assert.equal(r.data.gifted,true);
  const gifts=calls.filter(c=>c.p==='/paid_unlocks').map(c=>JSON.parse(c.o.body));
  assert.deepEqual(gifts.map(g=>[g.device_id,g.unlock_key,g.amount]),[['AAA','invite-compat-BBB',0],['BBB','invite-compat-AAA',0]]);
  assert.equal(new Set(gifts.map(g=>g.order_id)).size,2);
});

test('a device that was already invited gets no second gift',async()=>{
  const {handler,calls}=loadInvite(p=>p==='/invite_redemptions'?{ok:false,status:409,text:async()=>''}:ok);
  const r=await run(handler,{code:'AAA',inviteeDeviceId:'BBB',sajuOpts:{y:1}});
  assert.equal(r.data.already,true);
  assert.equal(calls.filter(c=>c.p==='/paid_unlocks').length,0);
});

test('self invite is refused and gives nothing',async()=>{
  const {handler,calls}=loadInvite(()=>ok);
  const r=await run(handler,{code:'AAA',inviteeDeviceId:'AAA',sajuOpts:{y:1}});
  assert.equal(r.data.error,'SELF_INVITE');assert.equal(calls.length,0);
});

test('a friend card with the invite gift opens the compat detail without payment',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const src=html.slice(html.indexOf('function skyCompatPair('),html.indexOf('var COMPAT_DETAIL_PRICE'));
  const ctx={STATE:{mySaju:{day:{gan:'甲',zhi:'子'}}},DEVICE:{unlocked:{'invite-compat-BBB':true}},renderCompatDetailSection(){}};
  vm.createContext(ctx);vm.runInContext(src,ctx);
  ctx.renderSkyPremium({id:'invite-BBB',_otherId:'BBB',_sajuB:{day:{gan:'乙',zhi:'丑'}}},{});
  assert.equal(ctx.DEVICE.unlocked['compat-甲子-乙丑'],true);
  ctx.renderSkyPremium({id:'invite-CCC',_otherId:'CCC',_sajuB:{day:{gan:'丙',zhi:'寅'}}},{});
  assert.equal(ctx.DEVICE.unlocked['compat-甲子-丙寅'],undefined);
  assert.ok(html.includes('두 사람 모두 궁합 상세(990원)를 무료로'));
});
