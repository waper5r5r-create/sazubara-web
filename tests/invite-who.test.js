// 초대 화면의 "○○님이 보낸 궁합 초대": 서버는 보낸 사람 이름만 돌려준다.
const test=require('node:test'),assert=require('node:assert/strict');
function load(rows){
  const calls=[];
  const supa=require.resolve('../api/_supabase.js');
  require.cache[supa]={id:supa,filename:supa,loaded:true,exports:{
    ensureDevice:async()=>{},getQuery:req=>req.query,readJsonBody:async req=>req.body,
    sbFetch:async(p,o)=>{calls.push({p,o});return {ok:true,status:200,json:async()=>rows,text:async()=>''};}
  }};
  delete require.cache[require.resolve('../api/_account.js')];
  delete require.cache[require.resolve('../api/invite.js')];
  return {handler:require('../api/invite.js'),calls};
}
function who(handler,code,method){
  return new Promise(resolve=>{const res={setHeader(){},status(c){this.code=c;return this;},json(d){resolve({code:this.code,data:d});}};
    handler({method:method||'GET',query:{action:'who',code}},res);});
}
test('who returns only the sender name, read-only',async()=>{
  const {handler,calls}=load([{saju_opts:{name:'지우',year:1995,month:5,day:8}}]);
  const r=await who(handler,'abc123xyz');
  assert.deepEqual(r.data,{ok:true,name:'지우'});
  assert.equal(calls.length,1);assert.ok(calls[0].p.startsWith('/devices?device_id=eq.abc123xyz&select=saju_opts'));
  assert.equal(calls[0].o.method,'GET');
});
test('who strips markup, shortens long names and handles missing senders',async()=>{
  const long=(await who(load([{saju_opts:{name:'<b>김수한무거북이와두루미삼천갑자</b>'}}]).handler,'abc123xyz')).data.name;
  assert.ok(!/[<>"'&]/.test(long));assert.ok(long.length<=12);assert.ok(long.includes('김수한무'));
  assert.deepEqual((await who(load([]).handler,'abc123xyz')).data,{ok:true,name:''});
  assert.equal((await who(load([]).handler,'x')).code,400);
  assert.equal((await who(load([]).handler,'abc123xyz','POST')).code,405);
});
