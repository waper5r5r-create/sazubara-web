const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.storyTest={fillReportTemplate,reportImageSource,reportSectionHtml,prologueDialogue,detailReportHtml,stageOfferHtml,readerStepsHtml,reportCardHtml,myroomTier,collectibleCardHtml,cardDexEntries,cardBackHtml,cardTypeOf,cardAlbumIntro,cardMeaningHtml,storyFlowHtml,storyPaidScenes,storyReviewsHtml,storyAtlasArt,CARD_SPIRITS,STATE,DEVICE,REPORT_READER,isWorryUnlocked};})();');
const sandbox={document:{readyState:'loading',addEventListener(){}},window:{},localStorage:{getItem(){return null;}},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const api=sandbox.storyTest;
const result={name:'테스트',day:{ganKr:'임'},dayGanWx:'수',wxCount:{목:0,화:1,토:1,금:0,수:6},strength:'strong',gender:'f',yearSS:'편재',monthSS:'정재',timeSS:'식신'};
const concept={id:'theme',category:'연애',title:'테스트 이야기'};
api.STATE.mySaju=result;api.REPORT_READER.concept=concept;
test('computed element and gender select matching text AND art',()=>{
 const p={img_url:'fallback.png',caption_template:'{{branch:domWx|수::마음을 깊이 품어요.||화::마음을 표현해요.||else::}}',img_variants:{수:'water.png',화:'fire.png'}};
 assert.equal(api.reportImageSource(p,result),'water.png');assert.equal(api.fillReportTemplate(p.caption_template,result),'마음을 깊이 품어요.');
 const g={img_url:'fallback.png',caption_template:'{{branch:gender|여성::여성 풀이||남성::남성 풀이||else::}}',img_variants:{여성:'female.png',남성:'male.png'}};
 assert.equal(api.reportImageSource(g,result),'female.png');assert.equal(api.fillReportTemplate(g.caption_template,result),'여성 풀이');
 assert.equal(api.reportImageSource(g,{...result,gender:'m'}),'male.png');
});
test('speech slots stay short and report includes full interpretation',()=>{
 const p={caption_template:'첫 번째 문장이에요. 두 번째 설명이에요. 세 번째는 리포트에 남아요.',img_url:'scene.png'};
 const scene=api.reportSectionHtml(p,result);assert.ok(scene.includes('scene-result-bubble'));assert.ok(scene.includes('첫 번째 문장이에요.'));assert.ok(scene.includes('세 번째는'));
 const full=api.detailReportHtml(concept,Array.from({length:20},(_,i)=>({...p,id:i+1})),result);
 assert.ok(full.includes('세 번째는 리포트에 남아요.'));assert.ok(full.includes('report-evidence'));assert.equal((full.match(/class="report-analysis"/g)||[]).length,12);
});
test('separate prices are disclosed before the first checkout',()=>{
 const offer=api.stageOfferHtml(concept,'story');assert.ok(offer.includes('별도 12,900원'));assert.ok(offer.includes('총 17,800원'));
 const detail=api.stageOfferHtml(concept,'detail');assert.ok(detail.includes('이야기와 별도 결제'));
});
test('a category purchase opens only that category, historic bundle opens all',()=>{
 api.DEVICE.unlocked={'feature-saju-deep:연애':true};assert.equal(api.isWorryUnlocked('연애'),true);assert.equal(api.isWorryUnlocked('재물'),false);
 api.DEVICE.unlocked={'feature-saju-deep':true};assert.equal(api.isWorryUnlocked('재물'),true);
});
test('generated prologue wording changes with real saju',()=>{
 assert.ok(api.prologueDialogue(concept,result)[1].includes('생각은 깊은데'));
 assert.ok(api.prologueDialogue(concept,{...result,wxCount:{목:0,화:6,토:1,금:0,수:1}})[1].includes('숨기고 싶지'));
});

test('premium report adds substantive personalised chapters',()=>{ const full=api.detailReportHtml(concept,[],result);assert.ok(full.includes('십신으로'));assert.ok(full.includes('일주일 실천'));assert.ok(full.includes('수 6개'));assert.ok(full.replace(/<[^>]*>/g,'').length>3000);});

test('cover and sticky stage labels omit all amounts',()=>{const card=api.reportCardHtml({...concept,price_krw:4900});assert.ok(!card.includes('4,900'));assert.ok(!card.includes('990'));const steps=api.readerStepsHtml({access:{story:false,detail:false}},'story');assert.ok(!steps.includes('원'));assert.ok(api.stageOfferHtml(concept,'detail').includes('12,900'));});

test('collectible grades use compatibility boundaries and symbolic art uses the partner',()=>{for(const [score,grade] of [[90,'S'],[89,'A'],[70,'A'],[69,'B'],[50,'B'],[49,'C'],[0,'C']])assert.equal(api.myroomTier(score).grade,grade);for(const [wx,key] of [['목','wood'],['화','fire'],['토','earth'],['금','metal'],['수','water']]){const card=api.collectibleCardHtml({id:'test',nameB:'상대',score:95,dayGanWxA:'화',dayGanWxB:wx,cardPolarity:'yin',shinsalB:['dohwa']},false);assert.ok(card.includes('/assets/cards/evolved/'+key+'-yin.webp'));assert.ok(card.includes('data-grade="S"'));assert.ok(card.includes('꽃의 인장'));assert.ok(card.includes('음의 기운'));}});

test('grades use distinct finishes without replacing the character',()=>{const e={id:'sample',nameB:'친구',dayGanWxB:'목'};assert.ok(api.collectibleCardHtml({...e,score:80},false).includes('/assets/cards/evolved/wood.webp'));assert.ok(api.collectibleCardHtml({...e,score:95},false).includes('tier-s'));});

test('codex has 40 unique types, missing backs, and duplicate ownership counts',()=>{const empty=api.cardDexEntries([]);assert.equal(empty.length,40);assert.equal(new Set(empty.map(r=>r.id)).size,40);assert.equal(empty.filter(r=>r.entry).length,0);assert.ok(api.cardBackHtml(empty[0]).includes('미보유'));assert.ok(!api.cardBackHtml(empty[0]).includes('<img'));const e={id:'friend',score:80,dayGanWxB:'목',dayGanB:'을',cardPolarity:'yin',nameB:'친구'};const rows=api.cardDexEntries([e,{...e,id:'another'}]);assert.equal(rows.filter(r=>r.entry).length,1);assert.equal(rows.find(r=>r.entry).count,2);assert.equal(rows.find(r=>r.entry).id,'wood-yin-a');assert.ok(api.collectibleCardHtml(e,false).includes('/assets/cards/evolved/wood-yin.webp'));});

test('album omits tier collection status panel',()=>{assert.equal(api.cardAlbumIntro([{score:90},{score:70}]),'');});

test('all grades preserve the named animal and have distinct grade finishes',()=>{const types=[['을','목','새싹토끼','wood-yin'],['기','토','포근곰','earth-yin'],['신','금','별빛고양','metal-yin'],['계','수','이슬수달','water-yin']];for(const [stem,wx,title,asset] of types){const cards=[40,60,80,95].map(score=>api.collectibleCardHtml({id:'test',score,dayGanB:stem,dayGanWxB:wx},false));for(const [i,card] of cards.entries()){assert.ok(card.includes('/assets/cards/'+(i?'evolved/':'')+asset+'.webp'));if(i)assert.ok(card.includes('--art-panel:'+({1:0,2:1,3:2}[i])));assert.ok(card.includes(title));assert.ok(!card.includes('/premium/'));assert.ok(card.includes('card-tier-ribbon'));}assert.equal(new Set(cards).size,4);}});

test('card detail uses two short relationship metaphors instead of design explanations',()=>{const text=api.cardMeaningHtml({dayGanB:'을',dayGanWxB:'목',score:80});assert.ok(text.includes('곁에서 다시 새싹'));assert.ok(text.includes('서로의 빈자리'));assert.ok(!text.includes('왜 '));assert.ok(!text.includes('프레임'));assert.ok(!text.includes('일간'));assert.ok(text.replace(/<[^>]*>/g,'').length<150);});


test('story reader is outside the app disabled while reading',()=>{assert.match(html, /id="toast-root"><\/div>\s*<\/div>\s*<!--[\s\S]*?-->\s*<div id="report-sheet-root">/);assert.equal((html.match(/id="report-sheet-root"/g)||[]).length,1);assert.ok(html.includes('touch-action:pan-y'));});


test('continuous reader shows short opening then two gates separated by reviews',()=>{
 const data={access:{story:false,detail:false},rows:[{caption_template:'PRIVATE_SENTENCE'}]};
 const text=api.storyFlowHtml(concept,data,result);
 assert.equal(api.readerStepsHtml(data,'story'),'');
 assert.equal((text.match(/class="story-frame /g)||[]).length,2);
 assert.ok(!text.includes('PRIVATE_SENTENCE'));
 assert.ok(text.indexOf('data-gate="story"')<text.indexOf('class="story-reviews"'));
 assert.ok(text.indexOf('class="story-reviews"')<text.indexOf('data-gate="detail"'));
 assert.ok(!text.includes('01 ·'));assert.ok(text.includes('4,900'));assert.ok(text.includes('12,900'));
});
test('paid story keeps all personal interpretation in ten distinct illustrated scenes',()=>{
 const rows=Array.from({length:23},(_,i)=>({caption_template:'UNIQUE_'+i+'_END'}));
 const text=api.storyPaidScenes(concept,{rows},result);
 for(const row of rows)assert.equal(text.split(row.caption_template).length-1,1);
 assert.equal((text.match(/class="story-frame /g)||[]).length,10);
 assert.equal(new Set([...text.matchAll(/src="([^"]+)"/g)].map(x=>x[1])).size,10);
 assert.ok(api.storyAtlasArt(concept,{...result,gender:'m'},0).includes('love-m-0'));
});
test('reviews show only verified supplied entries and no invented proof',()=>{
 const blank=api.storyReviewsHtml({});assert.ok(blank.includes('아직 등록된 후기가 없어요'));assert.ok(!blank.includes('별점'));
 const rendered=api.storyReviewsHtml({reviews:[{verified:false,text:'UNVERIFIED'},{verified:true,text:'REAL_REVIEW',displayName:'Reader'}]});
 assert.ok(!rendered.includes('UNVERIFIED'));assert.ok(rendered.includes('REAL_REVIEW'));
});


test('story interpretation escapes markup once and preserves readable punctuation',()=>{const text=api.storyPaidScenes(concept,{rows:[{caption_template:"'나 자신' <script>alert(1)</script>"}]},result);assert.ok(text.includes('&#39;나 자신&#39;'));assert.ok(text.includes('&lt;script&gt;'));assert.ok(!text.includes('&amp;#39;'));assert.ok(!text.includes('<script>'));});
