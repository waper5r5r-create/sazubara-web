const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function load(){
  const src=fs.readFileSync(path.join(root,'middleware.js'),'utf8').replace(/export default /,'').replace(/export (const|function) /g,'$1 ');
  const ctx={URL,Response:class{},fetch(){}};vm.createContext(ctx);vm.runInContext(src+';this.cardKey=cardKey;this.applyCard=applyCard;this.config=config;',ctx);return ctx;
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('each topic link picks its own card, even with utm values attached',()=>{
  const {cardKey}=load();const k=q=>cardKey(new URLSearchParams(q));
  assert.equal(k('?newyear&utm_source=blog&utm_campaign=day02'),'newyear');
  assert.equal(k('?go=love&utm_source=blog'),'love');
  assert.equal(k('?utm_source=blog&go=marriage'),'marriage');
  assert.equal(k('?ian'),'ian');assert.equal(k('?compat'),'compat');assert.equal(k('?today&utm_source=x'),'today');
  assert.equal(k('?go=hack'),null);assert.equal(k('?utm_source=blog'),null);assert.equal(k(''),null);
});

test('the card swaps title, description and image and leaves the rest of the page alone',()=>{
  const {applyCard}=load();const out=applyCard(html,'love');
  assert.match(out,/<meta property="og:title" content="연애 사주 \| 별첩사주">/);
  assert.match(out,/<meta property="og:image" content="https:\/\/www\.byeolcheop\.com\/og\/love\.jpg">/);
  assert.match(out,/<meta name="twitter:image" content="https:\/\/www\.byeolcheop\.com\/og\/love\.jpg">/);
  assert.match(out,/<meta property="og:description" content="2027년 내 연애 흐름/);
  assert.match(out,/<title>연애 사주 \| 별첩사주<\/title>/);
  assert.equal(out.length-html.length<400,true);
  assert.equal(applyCard(html,'nope'),html);
});

test('every card has its 1200x630 image and only the home page is touched',()=>{
  const {config}=load();assert.equal(config.matcher,'/');
  for(const k of ['newyear','love','wealth','career','marriage','ian','compat','today']){
    const b=fs.readFileSync(path.join(root,'og',k+'.jpg'));let i=2;let size=null;
    while(i<b.length){const m=b[i+1],len=b.readUInt16BE(i+2);if(m>=0xc0&&m<=0xc2){size=[b.readUInt16BE(i+7),b.readUInt16BE(i+5)];break;}i+=2+len;}
    assert.deepEqual(size,[1200,630],k);
  }
});

test('?compat and ?today open their tabs, because # never reaches the server',()=>{
  assert.match(html,/startTab=\/\[\?&\]compat/);assert.match(html,/\[\?&\]today/);
});
