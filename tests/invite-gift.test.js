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
  delete require.cache[require.resolve('../api/_account.js')];
  delete require.cache[require.resolve('../api/invite.js')];
  return {handler:require('../api/invite.js'),calls};
}
// 로그인으로 PC와 휴대폰이 같은 계정에 묶여 있는 상황
function linkedResponder(rows){
  return p=>{
    const j=d=>({ok:true,status:200,json:async()=>d,text:async()=>''});
    if(p.startsWith('/account_devices?device_id='))return j([{user_id:'u1'}]);
    if(p.startsWith('/account_devices?user_id='))return j([{device_id:'PC'},{device_id:'PHONE'}]);
    if(p.startsWith('/invite_redemptions?'))return j(rows(p));
    if(p.startsWith('/devices?'))return j([{device_id:'FRIEND1',saju_opts:{y:1}}]);
    return j([]);
  };
}
function get(handler,action,deviceId){
  return new Promise(resolve=>{const res={setHeader(){},status(c){this.code=c;return this;},json(d){resolve({code:this.code,data:d});}};
    handler({method:'GET',query:{action,device_id:deviceId}},res);});
}
test('logged-in devices share one 별첩: friends from both devices, once each, without my own devices',async()=>{
  const {handler,calls}=loadInvite(linkedResponder(()=>[
    {invitee_device_id:'FRIEND1',invitee_name:'민지',created_at:'3'},
    {invitee_device_id:'PHONE',invitee_name:'나',created_at:'2'},
    {invitee_device_id:'FRIEND1',invitee_name:'민지',created_at:'1'},
    {invitee_device_id:'FRIEND2',invitee_name:'수아',created_at:'0'}
  ]));
  const r=await get(handler,'list','PC');
  assert.deepEqual(r.data.rows.map(x=>x.invitee_device_id),['FRIEND1','FRIEND2']);
  const q=calls.find(c=>c.p.startsWith('/invite_redemptions?')).p;
  assert.ok(q.includes('inviter_device_id=in.(') && q.includes('PC') && q.includes('PHONE'));
});
test('received list also merges linked devices and skips my own devices',async()=>{
  const {handler}=loadInvite(linkedResponder(()=>[
    {inviter_device_id:'FRIEND1',created_at:'2'},{inviter_device_id:'PC',created_at:'1'},{inviter_device_id:'FRIEND1',created_at:'0'}
  ]));
  const r=await get(handler,'received','PHONE');
  assert.deepEqual(r.data.rows.map(x=>x.inviter_device_id),['FRIEND1']);
});
test('opening my own PC link on my logged-in phone is a self invite',async()=>{
  const {handler,calls}=loadInvite(linkedResponder(()=>[]));
  const r=await run(handler,{code:'PC',inviteeDeviceId:'PHONE',sajuOpts:{y:1}});
  assert.equal(r.data.error,'SELF_INVITE');
  assert.equal(calls.filter(c=>c.p==='/invite_redemptions'||c.p==='/paid_unlocks').length,0);
});
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

test('opening an invite link with a saved saju registers right away, and 별첩 refetches so new friends appear',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/if \(invited && STATE\.mySaju && STATE\.lastForm\) attemptInviteRedeem\(STATE\.lastForm\);/);
  assert.match(html,/if \(data\.registered\)\{ INVITE_MYROOM_CACHE = null;/);
  assert.match(html,/INVITE_MYROOM_AT = Date\.now\(\);/);
  assert.match(html,/if \(name==='compat'\)\{refreshCompatPersonA\(\);setupAlbumEntry\(\);if\(INVITE_MYROOM_CACHE!==null&&Date\.now\(\)-INVITE_MYROOM_AT>15000\)/);
});

test('the invited person sees the inviter in 별첩, marked as the friend who invited them',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/action=received&device_id=/);assert.match(html,/fromInviter:true/);
  assert.match(html,/e\.fromInviter\?'나를 초대한 친구 · ':''/);
});

test('invite links carry the code as ?invite= (messengers can drop #...), old #invite- links still work',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/function shareUrl\(\)\{ return 'https:\/\/www\.byeolcheop\.com\/\?invite=' \+ encodeURIComponent\(DEVICE\.shareCode\); \}/);
  const src=html.slice(html.indexOf('function parseInviteHash(){'),html.indexOf('/* 리포트 관리자 화면 진입용'));
  const vm=require('node:vm');const run=(search,hash)=>{const ctx={location:{search,hash},URLSearchParams};vm.createContext(ctx);vm.runInContext(src+';this.r=parseInviteHash();',ctx);return ctx.r;};
  assert.equal(run('?invite=abc123',''),'abc123');assert.equal(run('?utm_source=x&invite=abc123',''),'abc123');
  assert.equal(run('','#invite-old99'),'old99');assert.equal(run('?invite=<x>',''),null);assert.equal(run('',''),null);
  assert.match(html,/_u\.searchParams\.delete\('invite'\)/);
});
