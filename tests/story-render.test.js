const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.storyTest={everydayTraitsHtml,everydaySajuHtml,worryPreviewHtml,computeSaju,sajuDepthHtml,fillReportTemplate,reportImageSource,reportSectionHtml,prologueDialogue,detailReportHtml,stageOfferHtml,readerStepsHtml,reportCardHtml,myroomTier,collectibleCardHtml,cardDexEntries,cardBackHtml,cardTypeOf,cardAlbumIntro,cardMeaningHtml,storyFlowHtml,storyPaidScenes,storyAtlasArt,storyNarrativePlan,reportSituationGuides,CARD_SPIRITS,STATE,DEVICE,REPORT_READER,isWorryUnlocked};})();');
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


test('reader keeps free opening and separate purchase gates without reviews',()=>{
 const data={access:{story:false,detail:false},rows:[{caption_template:'PRIVATE_SENTENCE'}]};
 const text=api.storyFlowHtml(concept,data,result);
 assert.equal(api.readerStepsHtml(data,'story'),'');
 assert.equal((text.match(/class="story-frame /g)||[]).length,4);
 assert.ok(!text.includes('PRIVATE_SENTENCE'));
 assert.ok(text.indexOf('data-gate="story"')<text.indexOf('data-gate="detail"'));
 assert.ok(!text.includes('story-reviews'));
 assert.ok(!text.includes('01 ·'));assert.ok(text.includes('4,900'));assert.ok(text.includes('12,900'));
});
test('paid story keeps all personal interpretation in eight distinct illustrated scenes',()=>{
 const rows=Array.from({length:23},(_,i)=>({caption_template:'UNIQUE_'+i+'_END'}));
 const text=api.storyPaidScenes(concept,{rows},result);
 for(const row of rows)assert.equal(text.split(row.caption_template).length-1,1);
 assert.equal((text.match(/class="story-frame /g)||[]).length,8);
 assert.equal(new Set([...text.matchAll(/src="([^"]+)"/g)].map(x=>x[1])).size,8);
 assert.ok(api.storyAtlasArt(concept,{...result,gender:'m'},0).includes('love-m-0'));
});
test('story interpretation escapes markup once and preserves readable punctuation',()=>{const text=api.storyPaidScenes(concept,{rows:[{caption_template:"'나 자신' <script>alert(1)</script>"}]},result);assert.ok(text.includes('&#39;나 자신&#39;'));assert.ok(text.includes('&lt;script&gt;'));assert.ok(!text.includes('&amp;#39;'));assert.ok(!text.includes('<script>'));});


test('owned content has no purchase gate or misleading locked report sample',()=>{const data={access:{story:true,detail:true},rows:[],detailRows:[]};const full=api.storyFlowHtml(concept,data,result);assert.ok(full.includes('reader-owned-badge'));assert.ok(!full.includes('data-gate='));assert.ok(!full.includes('sample-lock'));assert.ok(!full.includes('story-locked-preview'));const story=api.storyFlowHtml(concept,{...data,access:{story:true,detail:false}},result);assert.ok(!story.includes('data-gate="story"'));assert.ok(story.includes('data-gate="detail"'));});
test('opening develops a personal conflict and ends with an unanswered saju question',()=>{const plan=api.storyNarrativePlan(concept,result);assert.equal(plan.length,12);assert.ok(plan[2][1].includes('임(수)'));assert.ok(plan[3][1].includes('왜 설레는 순간'));const fire=api.storyNarrativePlan(concept,{...result,dayGanWx:'화'});assert.notEqual(plan[2][0],fire[2][0]);});
test('reader removes reviews and exposes purchased interpretation without disclosures',()=>{const text=api.storyFlowHtml(concept,{access:{story:true,detail:false},rows:[{caption_template:'PRIVATE_INTERPRETATION'}]},result);assert.ok(text.includes('PRIVATE_INTERPRETATION'));assert.ok(!text.includes('<details'));assert.ok(!text.includes('story-reviews'));assert.ok(!text.includes('후기'));});
test('report adds eight actionable scenario guides with examples and cautions',()=>{for(const c of [concept,{...concept,category:'재물'}]){const text=api.reportSituationGuides(c,result);assert.equal((text.match(/class="report-analysis situation-guide"/g)||[]).length,8);assert.equal((text.match(/<dt>주의할 점<\/dt>/g)||[]).length,8);assert.ok(text.includes('내 성향에 맞춰'));assert.ok(text.includes('premium-15'));}});

const birth={year:1990,month:5,day:15,hour:14,minute:30,isLunar:false,unknownTime:false,useCorrection:false,gender:'f',name:'홍길동'};
test('depth uses calculated hidden stems and excludes unknown time',()=>{
 const r=api.computeSaju(birth);assert.equal(r.deepPillars.length,4);
 for(const p of r.deepPillars){assert.ok(p.hidden.length>0);assert.equal(p.hidden.length,p.hiddenSS.length);assert.ok(p.hidden.every(x=>/^[가-힣]+$/.test(x)));}
 const text=api.sajuDepthHtml(r);assert.ok(text.includes('지장간'));assert.ok(text.includes('간이 분류'));assert.ok(text.includes('성명학 분석은 제공하지 않습니다'));
 const unknown=api.computeSaju({...birth,unknownTime:true});assert.equal(unknown.deepPillars.length,3);assert.ok(api.sajuDepthHtml(unknown).includes('시주의 지장간은 제외'));
});
test('name changes salutation only and input explains its scope',()=>{
 const a=api.computeSaju(birth),b=api.computeSaju({...birth,name:'다른이름'});assert.deepEqual(a.deepPillars,b.deepPillars);assert.equal(api.sajuDepthHtml(a),api.sajuDepthHtml(b));assert.ok(html.includes('이름을 입력해주세요 (예: 홍길동)'));assert.ok(!html.includes('어떤 이름으로 불러드릴까요?'));assert.ok(!html.includes('내 이야기를 시작해볼까요?'));
});

test('summary has three distinct traits grounded in the chart',()=>{
 const text=api.everydayTraitsHtml(result);assert.equal((text.match(/<li>/g)||[]).length,3);assert.ok(text.includes('기본 성향'));assert.ok(text.includes('발휘하기 쉬운 강점'));assert.ok(text.includes('균형을 위한 힌트'));
 assert.notEqual(text,api.everydayTraitsHtml({...result,dayGanWx:'화',wxCount:{목:1,화:6,토:0,금:0,수:1}}));
});
test('all five topics have a personalised free reading before checkout',()=>{
 for(const cat of ['연애','직장','재물','건강','인간관계']){const a=api.worryPreviewHtml(result,cat),b=api.worryPreviewHtml({...result,dayGanWx:'화'},cat);assert.ok(a.includes(cat+' 무료 맛보기'));assert.ok(a.replace(/<[^>]*>/g,'').length>230);assert.notEqual(a,b);assert.ok(!a.includes('unlock-btn'));}
 assert.equal(api.worryPreviewHtml(result,'invalid'),'');assert.ok(api.worryPreviewHtml(result,'건강').includes('건강은 사주로 판단할 수 없어요'));
 const main=api.everydaySajuHtml(result);assert.ok(!main.includes('좋아할수록 조심스러울까'));assert.ok(main.includes('나의 연애와 인연'));
});
