const test=require('node:test');const assert=require('node:assert');
// 유료 글 본문에는 사주 용어를 그대로 쓰지 않는다. 제목의 괄호 표기만 허용한다.
const TERMS=/일간|일지|비겁|비견|겁재|식상|재성|편재|정재|(?<!습)관성|편관|정관|편인(?!가)|정인|신강|신약|대운|십신|신살|천간|육합|삼합|원진|월주|연주|시주/;
const strings=(o,out=[])=>{if(typeof o==='string')out.push(o);else if(o&&typeof o==='object')Object.values(o).forEach(v=>strings(v,out));return out;};
for(const name of ['love','wealth','career','marriage'])test(name+' content uses plain words',()=>{
 const m=require('../api/_'+name+'-content.js');
 const bad=strings({story:m.story,detail:m.detail}).map(t=>t.replace(/\((식상|재성|관성|인성|비겁|정재|편재)\)/g,'')).filter(t=>TERMS.test(t));
 assert.deepEqual(bad,[]);
});

test('content copy has correct particles, no term brackets, and no medical claims',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
 const files=fs.readdirSync(path.join(root,'api')).filter(f=>/^_(career|love|marriage|wealth)-/.test(f)).map(f=>fs.readFileSync(path.join(root,'api',f),'utf8')).join('\n');
 assert.doesNotMatch(files,/(병화|정화|무토|기토|임수|계수)은 /);
 assert.doesNotMatch(files,/\((재성|식상|관성|인성|비겁)\)/);
 assert.doesNotMatch(files,/그해엔 배우자 자리에 큰 움직임이 없어요/);
 const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.doesNotMatch(page,/간 기능 저하|혈압과 심박|오행의 결/);
});

test('payment review: footer shows business details and the price list matches real prices',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
 const page=fs.readFileSync(path.join(root,'index.html'),'utf8'),legal=fs.readFileSync(path.join(root,'legal.html'),'utf8');
 const foot=page.slice(page.indexOf('<footer class="site-legal"'),page.indexOf('</footer>'));
 for(const v of ['이음랩(IEUM LAB)','정계준','195-50-01151','010-5440-0335','ieumlab22@gmail.com','legal.html#refund','legal.html#price','mailto:ieumlab22@gmail.com?subject=','결제·환불 문의'])assert.ok(foot.includes(v),v);
 assert.ok(!foot.includes('301호'),'home address stays off the footer');
 assert.match(legal,/address: '[^']*301호'/);
 const fmt=n=>n.toLocaleString('en-US')+'원';
 const ny=require('../api/_newyear-content.js').concept.price_krw,ian=require('../api/_ian-content.js').concept.price_krw,{STAGE_PRICE}=require('../api/_report-access.js');
 assert.match(legal,new RegExp('2027 신년운세</th><td>'+fmt(ny)));
 assert.match(legal,new RegExp('이안의 비밀</th><td>'+fmt(ian)));
 assert.match(legal,new RegExp('결혼 사주</th><td>각 '+fmt(STAGE_PRICE.story)));
});

test('today: a steady (정재) day does not get the push-hard time blocks, and the birth form avoids jargon',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/==='정재' \? TIME_BLOCK_JEONGJAE : TIME_BLOCK_TEXT\[relKey\]/);
  const calm=html.slice(html.indexOf('var TIME_BLOCK_JEONGJAE'),html.indexOf('var TIME_BLOCK_TEXT'));
  assert.ok(!/추진력|밀어붙/.test(calm));
  for(const w of ['경도 보정','진태양시','동경 135'])assert.ok(!html.includes(w),w);
});

test('free previews: when the nearest best year is far, the sooner good year is named; no 술(戌)와 or repeated spouse lines',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const src=html.slice(html.indexOf('function soonerYearHtml('),html.indexOf('function loveSoonerHtml('));
  const ctx={esc:s=>s,josaIeyo:w=>{const c=w.charCodeAt(w.length-1)-0xAC00;return c%28?'이에요':'예요';}};vm.createContext(ctx);vm.runInContext(src,ctx);
  const rows=[{year:2027,score:1},{year:2028,score:2,label:'사랑받는 해'},{year:2034,score:4,top:1,label:'설레는 인연이 오는 해'}];
  assert.match(ctx.soonerYearHtml(rows,rows[2],r=>r.label,'끝.'),/그 전에도 <strong class="wolha-year">2028년<\/strong>은 사랑받는 해예요\. 끝\./);
  assert.equal(ctx.soonerYearHtml(rows,{year:2028},r=>r.label,'끝.'),'');
  assert.match(html,/hasBatchim\(dz\.charAt\(0\)\)\?'과':'와'/);
  assert.ok(!html.includes("<h3>만나기 쉬운 자리</h3><p>'+esc(SPOUSE_FREE[zhi]"));
});

test('paid reports: month lines rotate instead of repeating, and wealth income titles carry no term brackets',()=>{
  const m=require('../api/_marriage-deep-extra.js').monthTenGod;
  for(const k of Object.keys(m)){assert.ok(Array.isArray(m[k])&&m[k].length>=3,k);assert.equal(new Set(m[k]).size,m[k].length);}
  const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','api','_wealth-deep.js'),'utf8');
  assert.ok(!/\((정재|편재)\)/.test(src));
});

test('paid 10-year lists: a year with the same relation as an earlier one points back instead of repeating the long blocks',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const src=html.slice(html.indexOf('function sameRelBefore('),html.indexOf('function pickLine('));
  const ctx={};vm.createContext(ctx);vm.runInContext(src,ctx);
  const rows=[{year:2027,rel:'none'},{year:2028,rel:'liuhe',top:1},{year:2029,rel:'none'},{year:2030,rel:'liuhe'}];
  assert.equal(ctx.sameRelBefore(rows,0),null);assert.equal(ctx.sameRelBefore(rows,2).year,2027);
  assert.equal(ctx.sameRelBefore(rows,3),null,'a best year is never the reference');assert.equal(ctx.sameRelBefore(rows,1),null);
  assert.match(ctx.yearSameHtml(rows[0]),/2027년과 흐름이 비슷해요/);
  assert.equal((html.match(/rows\.map\(function\(r,ri\)\{var rp=sameRelBefore\(rows,ri\)/g)||[]).length,3);
});

test('first screen and result reveal use stars only; content characters stay inside the contents',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const stars=html.match(/var HERO_STARS=(\[[^;]*\]);/);assert.ok(stars);assert.equal(JSON.parse(stars[1]).length,8);
  const hero=html.slice(html.indexOf('function starHeroHtml('),html.indexOf('/* 결과 화면 맨 위: 원국표'));
  const reveal=html.slice(html.indexOf('function sajuRevealHtml('),html.indexOf('/* 생년월일·태어난 시간 입력'));
  for(const part of [hero,reveal])assert.ok(!/faces|daon|\/ian\//.test(part));
  assert.ok(html.includes('(BF_SKIP_REVEAL?function(r,cb){BF_SKIP_REVEAL=false;cb();}:showSajuReveal)(result, function(){'));
  assert.match(reveal,/prefers-reduced-motion/);assert.match(reveal,/addEventListener\('click',finish\)/);
});

test('birth input: 8 digits or separated numbers become a real date, and every time band maps back to itself',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const src=html.slice(html.indexOf('var BIRTH_BANDS='),html.indexOf('var BIRTH_UIS='));const ctx={};vm.createContext(ctx);vm.runInContext(src,ctx);
  const iso=(t,l)=>ctx.birthDateIso(ctx.parseBirthDigits(t),l);
  assert.equal(iso('19940512'),'1994-05-12');assert.equal(iso('1994. 5. 12'),'1994-05-12');assert.equal(iso('1994-05-12'),'1994-05-12');
  assert.equal(iso('19940231'),'');assert.equal(iso('1994051'),'');assert.equal(iso('19941301'),'');
  assert.equal(iso('19940230',true),'1994-02-30','lunar months can have a 30th');
  assert.equal(ctx.BIRTH_BANDS.length,13);
  ctx.BIRTH_BANDS.forEach((b,i)=>assert.equal(ctx.birthBandIndex(b.t),i,b.range));
  assert.equal(ctx.birthBandIndex('23:10'),11);assert.equal(ctx.birthBandIndex('23:40'),12);assert.equal(ctx.birthBandIndex('00:10'),0);assert.equal(ctx.birthBandIndex('07:29'),3);assert.equal(ctx.birthBandIndex('07:30'),4);
  assert.match(html,/enhanceBirthDate\(\$\('#f-date'\)/);assert.match(html,/enhanceBirthDate\(\$\('#c-date-'\+suf\)/);
});

test('birth flow: page-by-page input opens from the first screen, 다시 입력 and topic links, fills the hidden form and skips the cover',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const flow=html.slice(html.indexOf('function openBirthFlow('),html.indexOf('function closeBirthFlow('));
  assert.match(html,/data-open-birth>생년월일 넣고 시작하기<\/button>/);
  assert.match(html,/openBirthFlow\(STATE\.lastForm\);/);assert.match(html,/openBirthFlow\(null,\{note:concept\.title\}\)/);
  for(const id of ['#f-name','#f-date','#f-time','#f-unknown-time','#f-city','#f-leap'])assert.ok(flow.includes("$('"+id+"')"),id);
  assert.match(flow,/BF_SKIP_REVEAL=true/);assert.match(flow,/requestSubmit/);
  assert.match(flow,/autocomplete="off"/);assert.ok(!/autocomplete="bday"/.test(flow));
  for(const k of ['첫째 장','둘째 장','셋째 장','넷째 장','별자리 완성','윤달이에요','태어난 곳','시간을 몰라요'])assert.ok(flow.includes(k),k);
  assert.ok(!/faces|daon|\/ian\//.test(flow));
});

test('no top-level name is declared twice with different values (ZHI_ANIMAL once broke the weekly day sheet this way)',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const src=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
  const seen={};
  for(const m of src.matchAll(/^var ([A-Z][A-Z0-9_]+)\s*=\s*([^\n]*)/gm)){const v=m[2].replace(/\s+/g,'').replace(/;$/,'');if(seen[m[1]]!==undefined)assert.equal(v,seen[m[1]],m[1]+' declared twice with different values');seen[m[1]]=v;}
  assert.equal((src.match(/\bZHI_ANIMAL\s*=/g)||[]).length,1);
  assert.match(src,/'子':\{animal:'쥐', emoji:'🐭'/);
});

test('dark menu drawer uses light text, the star-page detail button stands out, no sound toggle',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/\.site-menu\{background:linear-gradient\(170deg,#15213a,#0e1629\);--fg:#f3ecdf;--fg-muted:#b3b9cf;/);
  assert.match(html,/\.sky-page \.share-btn\{[^}]*background:linear-gradient\(110deg,#f0d38c,#d9a957\);color:#2a1f0c/);
  assert.ok(!html.includes('id="btn-sound-toggle"'));assert.match(html,/function isSoundOn\(\)\{ return false; \}/);
  for(const c of ["color:'#ff6f91'","color:'#b39ddb'"])assert.ok(!html.slice(html.indexOf('dohwa:{'),html.indexOf('dohwa:{')+600).includes(c),c);
});

test('no regex lookbehind anywhere in the page (older iPhone Safari fails to parse the whole script)',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.ok(!/\(\?<[=!]/.test(html));
});

test('UX pass: back closes layers before leaving, compat tab is called 궁합, returning visitors get today first, empty 별첩 has a send button, skeleton loaders',()=>{
  const fs=require('node:fs'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/var NAV_LAYERS=\['#intro-sheet-root','#report-sheet-root','#myroom-sheet-root','#brief-sheet-root','#site-menu-root','#persona-sheet-root'\];/);
  assert.match(html,/initBackNav\(startTab\);/);assert.match(html,/if\(typeof BF!=='undefined'&&BF\)return;/);
  assert.match(html,/<span class="ico" id="tab-ico-compat"><\/span><span>궁합<\/span>/);
  assert.match(html,/SHOW_TODAY_PEEK=true;renderSajuResult\(STATE\.mySaju\);SHOW_TODAY_PEEK=false;/);
  assert.match(html,/아직 내 하늘에 별이 없어요/);assert.ok(html.includes('sky-nostar-btn\\" data-album-invite>링크 보내기')||html.includes('sky-nostar-btn" data-album-invite>링크 보내기'));
  assert.ok(!html.includes('<p class="hint">불러오는 중...</p>'));
});
