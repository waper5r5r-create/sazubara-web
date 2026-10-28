const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function wireSky('),html.indexOf('function skyPageHtml('));
function fixture(reduce=false){
 const timers=new Map();let clock=0,id=0;
 function el(classes=[]){const set=new Set(classes);return {style:{},dataset:{},hidden:true,isConnected:true,clientWidth:360,clientHeight:560,handlers:{},classList:{add(...v){v.forEach(x=>set.add(x));},remove(...v){v.forEach(x=>set.delete(x));},contains(x){return set.has(x);},toggle(x,on){on?set.add(x):set.delete(x);}},addEventListener(t,f){this.handlers[t]=f;},contains(x){return x===star;},insertBefore(){},setPointerCapture(){this.captured=true;},hasPointerCapture(){return !!this.captured;},scrollIntoView(){},offsetWidth:360};}
 const stage=el(['is-far']),cam=el(),focus=el(),panel=el(),img=el(),neb=el(),depth=el(),star=el(),close=el(),enter=el();star.dataset.skyStar='0';
 const map={'[data-sky]':stage,'[data-sky-cam]':cam,'[data-sky-focus]':focus,'[data-sky-panel]':panel,'[data-sky-fimg]':img,'.sky-nebula-art':neb,'[data-sky-depth]':depth,'[data-sky-close]':close,'[data-sky-enter]':enter};
 const ctx={window:{matchMedia:()=>({matches:reduce}),addEventListener(){}},$:(q)=>map[q]||null,$all:()=>[star],skyLayout:()=>[{x:90,y:150}],cardTypeOf:()=>({asset:'fire-yin'}),skyPanelHtml:()=>'<p>friend</p>',performance:{now:()=>clock},setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:n=>timers.delete(n),requestAnimationFrame:()=>++id,cancelAnimationFrame(){},soundTap(){},soundReveal(){},hapticPulse(){}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.wireSky({},[{nameB:'test'}]);
 return {stage,cam,focus,star,close,enter,timers,advance(){clock+=16;},run(ms){for(const [n,t]of [...timers])if(t.ms===ms){timers.delete(n);t.f();}}};
}
test('a star tap remains a click; pointer capture starts only when dragging',()=>{
 const f=fixture();f.enter.handlers.click();const e={clientX:50,clientY:50,pointerId:1,target:{closest:()=>null}};
 f.stage.handlers.pointerdown(e);assert.ok(!f.stage.captured);
 f.advance();f.stage.handlers.pointermove({...e,clientX:90});assert.ok(f.stage.captured);
});
test('closing during travel cancels the pending card reveal',()=>{
 const f=fixture();f.enter.handlers.click();f.star.handlers.click();assert.ok([...f.timers.values()].some(t=>t.ms===1220));
 f.close.handlers.click();f.run(1220);assert.equal(f.focus.hidden,true);assert.ok(!f.stage.classList.contains('is-focus'));
});
test('card opens after travel; camera geometry uses its actual container',()=>{
 const f=fixture();f.enter.handlers.click();f.star.handlers.click();assert.equal(f.cam.style.height,'480px');assert.equal(f.focus.hidden,true);
 f.run(1220);assert.equal(f.focus.hidden,false);assert.ok(f.focus.classList.contains('in'));
});
test('reduced motion reveals the card without travel delay',()=>{
 const f=fixture(true);f.enter.handlers.click();f.star.handlers.click();f.run(0);assert.equal(f.focus.hidden,false);assert.equal(f.cam.style.transition,'none');
});
