const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.storyTest={reportEmphasis,readingPreviewHtml,reportCoverSource,storyProfile,reportSampleHtml,storyCategory,ZHI_REL_TEXT,GAN_REL_TEXT,ZHI_REL_MARRIAGE_TEXT,DATE_GUIDE_TEXT,GAN_REL_TALK_TEXT,CONFLICT_TEXT,COUPLE_TODAY_DETAIL,scoreLabel,everydayTraitsHtml,everydaySajuHtml,worryPreviewHtml,computeSaju,sajuDepthHtml,fillReportTemplate,reportImageSource,reportSectionHtml,prologueDialogue,detailReportHtml,stageOfferHtml,readerStepsHtml,reportCardHtml,myroomTier,collectibleCardHtml,cardDexEntries,cardBackHtml,cardTypeOf,cardAlbumIntro,cardMeaningHtml,storyFlowHtml,storyPaidScenes,storyAtlasArt,storyNarrativePlan,reportSituationGuides,CARD_SPIRITS,STATE,DEVICE,REPORT_READER,isWorryUnlocked};})();');
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
 const offer=api.stageOfferHtml(concept,'story');assert.ok(offer.includes('별도 선택 구매 · 12,900원'));assert.ok(offer.includes('별도 선택 구매 · 12,900원'));
 const detail=api.stageOfferHtml(concept,'detail');assert.ok(detail.includes('콘텐츠와 별도 결제'));
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
 assert.equal((text.match(/class="story-frame /g)||[]).length,0);
 assert.ok(!text.includes('PRIVATE_SENTENCE'));
 assert.ok(text.includes('data-gate="story"'));assert.ok(!text.includes('data-gate="detail"'));
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
test('opening provides a broad personal question without assuming hesitation',()=>{const plan=api.storyNarrativePlan(concept,result);assert.equal(plan.length,12);assert.ok(plan[2][1].includes('임(수)'));assert.ok(plan[3][0].endsWith('?'));const fire=api.storyNarrativePlan(concept,{...result,dayGanWx:'화'});assert.notEqual(plan[1][0],fire[1][0]);assert.notEqual(plan[8][1],fire[8][1]);});
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

test('compatibility guidance includes all relationships without assuming romance',()=>{
 for(const data of [api.ZHI_REL_TEXT,api.GAN_REL_TEXT,api.ZHI_REL_MARRIAGE_TEXT,api.DATE_GUIDE_TEXT,api.GAN_REL_TALK_TEXT,api.CONFLICT_TEXT,api.COUPLE_TODAY_DETAIL])assert.ok(!/결혼|신혼|데이트|스킨십|커플/.test(JSON.stringify(data)));
 assert.equal(Object.keys(api.DATE_GUIDE_TEXT).length,8);assert.equal(Object.keys(api.ZHI_REL_MARRIAGE_TEXT).length,8);assert.equal(api.scoreLabel('love'),'친밀감');assert.equal(api.scoreLabel('money'),'금전 성향');assert.ok(html.includes('우리, 진짜 잘 맞는 걸까?'));assert.ok(!html.includes('친구·가족·동료·지인·연인, 누구와도.'));
});

test('each element changes the response and concrete next action across both themes',()=>{
 for(const category of ['연애','재물']){const plans=['목','화','토','금','수'].map(wx=>api.storyNarrativePlan({...concept,category},{...result,dayGanWx:wx}));assert.equal(new Set(plans.map(p=>p[1][0])).size,5);assert.equal(new Set(plans.map(p=>p[8][1])).size,5);for(const p of plans)assert.equal(p.length,12);}
 const base=api.storyNarrativePlan(concept,result),diff=api.storyNarrativePlan(concept,{...result,yearSS:'정관',monthSS:'정인',timeSS:'비견',strength:'weak',wxCount:{목:4,화:2,토:1,금:0,수:1}});for(const i of [5,6,7,9])assert.notEqual(base[i][1],diff[i][1]);
});
test('second offer follows the full story and a real personalised sample',()=>{
 const owned=api.storyFlowHtml(concept,{access:{story:true,detail:false},rows:[]},result);assert.ok(owned.indexOf('scene-11')<owned.indexOf('report-real-sample'));assert.ok(owned.indexOf('report-real-sample')<owned.indexOf('data-gate="detail"'));assert.ok(owned.includes('수 6개'));assert.ok(!owned.includes('report-sample-lines'));assert.ok(!owned.includes('sample-lock'));
 const free=api.storyFlowHtml(concept,{access:{story:false,detail:false},rows:[]},result);assert.ok(!free.includes('data-gate="detail"'));assert.ok(free.includes('별도 선택 구매 · 12,900원'));
});
test('new categories cannot silently reuse the romance story',()=>{assert.equal(api.storyCategory({category:'직장'}),'unsupported');const card=api.reportCardHtml({id:'new',title:'직장 이야기',category:'직장'});assert.ok(card.includes(' disabled'));assert.ok(card.includes('준비 중'));assert.ok(!card.includes('4,900'));});

test('content navigation and cards are neutral about format and future themes',()=>{
 assert.ok(html.includes('<span>콘텐츠</span>'));assert.ok(!html.includes('<span>사주 이야기</span>'));
 const card=api.reportCardHtml({...concept,title:'나만의 제목'});assert.ok(card.includes('나만의 제목'));assert.ok(!card.includes('웹툰'));assert.ok(!card.includes(' · 콘텐츠'));
 const offer=api.stageOfferHtml({...concept,title:'나만의 제목'},'story');assert.ok(offer.includes('내 연애 패턴 확인하기'));assert.ok(!offer.includes('웹툰'));
});

test('pocha opening, owned story and detail respect separate gates with career-specific text',()=>{
 const {concept:c,panels}=require('../api/_pocha-content');
 const free=api.storyFlowHtml(c,{access:{story:false,detail:false},rows:[{caption_template:'DO_NOT_LEAK'}]},result);
 assert.equal((free.match(/class="pocha-scene"/g)||[]).length,0);assert.ok(free.includes('임(수)'));assert.ok(!free.includes('DO_NOT_LEAK'));assert.ok(free.includes('별도 선택 구매 · 12,900원'));assert.ok(!free.includes('data-gate="detail"'));
 const paid=api.storyFlowHtml(c,{access:{story:true,detail:false},rows:panels},result);
 assert.equal((paid.match(/class="pocha-scene"/g)||[]).length,20);assert.ok(paid.includes('오늘 챙겨갈 것'));assert.ok(!paid.includes('data-gate="story"'));assert.ok(paid.indexOf('오늘 챙겨갈 것')<paid.indexOf('data-gate="detail"'));
 const full=api.storyFlowHtml(c,{access:{story:true,detail:true},rows:panels,detailRows:panels},result);
 assert.equal((full.match(/id="pocha-detail-/g)||[]).length,20);assert.ok(!full.includes('data-gate='));assert.ok(!full.includes('연애'));assert.ok(!full.includes('love-'));assert.ok(!full.includes('{{branch:'));assert.ok(full.includes('이직보다 먼저 살펴볼 것'));
 const all=['목','화','토','금','수'].map(wx=>api.storyFlowHtml(c,{access:{story:false,detail:false},rows:[]},{...result,dayGanWx:wx}));assert.equal(new Set(all).size,5);
 assert.equal(api.storyCategory({...c,id:'unknown'}),'unsupported');
});

test('career story maps twenty independent assets in order and keeps every paid interpretation',()=>{
 const path=require('node:path'),{concept:c,panels}=require('../api/_pocha-content');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/pocha/cinematic/manifest.json'),'utf8'));
 assert.equal(panels.length,20);assert.equal(manifest.length,20);
 assert.equal(new Set(manifest.map(x=>x.sha256)).size,20);
 for(const [i,p] of panels.entries()){
  assert.equal(p.sort_order,i);assert.equal(p.img_url,'/assets/pocha/cinematic/scene-'+String(i+1).padStart(2,'0')+'.webp');
  const asset=fs.readFileSync(path.join(__dirname,'..',p.img_url));
  assert.ok(asset.length>0);assert.equal(require('node:crypto').createHash('sha256').update(asset).digest('hex'),manifest[i].sha256);
  assert.ok(manifest[i].width>=1400);assert.ok(manifest[i].height>=1024);
 }
 const rows=panels.map((p,i)=>({...p,caption_template:'PERSONAL_'+i+'_END'}));
 const paid=api.storyFlowHtml(c,{access:{story:true,detail:false},rows},result);
 for(const [i,row] of rows.entries()){
  assert.equal(paid.split(row.caption_template).length-1,1);
  assert.ok(paid.indexOf('data-scene="'+(i+1)+'"')<paid.indexOf(row.caption_template));
 }
 const art=[...paid.matchAll(/<img src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(art.slice(1),panels.map(p=>p.img_url));assert.equal(art[0],'/assets/pocha/cinematic/scene-08.webp');assert.ok(!paid.includes('사장님'));
 const free=api.storyFlowHtml(c,{access:{story:false,detail:false},rows},result);
 assert.ok(!free.includes('PERSONAL_'));assert.ok(!free.includes('scene-07.webp'));
 assert.equal((free.match(/class="pocha-scene"/g)||[]).length,0);
});

test('career reader speaks to the reader and never labels them as a fictional protagonist',()=>{
 const {concept:c,panels}=require('../api/_pocha-content');
 const render=r=>api.storyFlowHtml(c,{access:{story:true,detail:false},rows:panels},r);
 const text=render({...result,name:'지민'});
 assert.ok(!text.includes('주인공'));assert.ok(!text.includes('서재가 그려'));
 assert.ok(text.includes('지민님은 어떤 방식으로 일할 때 편한지'));
 assert.ok(text.includes('지민님의 사주 풀이'));
 assert.ok(text.includes('<span>서도윤</span>'));
 assert.ok(text.includes('나, 앞으로 뭐 해 먹고 살지?'));
 const water=render({...result,name:''}),fire=render({...result,name:'',dayGanWx:'화'});
 assert.notEqual(water,fire);assert.ok(!water.includes('undefined'));assert.ok(!water.includes('님은 어떤'));
 const unsafe=render({...result,name:'<script>악성</script>'});
 assert.ok(!unsafe.includes('<script>악성</script>'));assert.ok(unsafe.includes('&lt;script&gt;'));
 for(const row of panels)assert.ok(!row.caption_template.includes('\n\n'));
});

test('all three catalogue covers match reader art and never load the retired auntie cover',()=>{
 const {presentConcept}=require('../api/_report-presentation'),{concept:c}=require('../api/_pocha-content');
 const love=presentConcept({id:'운명의-사람은-언제-올까-fyq1z',category:'연애'});
 const money=presentConcept({id:'타고난-재물복은-얼마나-될까-k7dxw',category:'재물'});
 assert.equal(love.title,'나는 왜 이런 사랑을 할까?');assert.equal(money.title,'나는 돈 앞에서 왜 이럴까?');
 for(const row of [love,money,c]){
  const cover=api.reportCoverSource(row,result);assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',cover)));
  assert.ok(api.reportCardHtml(row).includes(cover));assert.ok(!row.tagline.includes('타이밍'));
 }
 assert.ok(api.reportCoverSource(love,{...result,gender:'m'}).includes('love-m-2'));
 assert.ok(api.reportCoverSource(money,{...result,gender:'m'}).includes('wealth-m-0'));
 assert.ok(!html.includes('/assets/pocha/auntie-'));assert.ok(html.includes('esc(reportCoverSource(concept,STATE.mySaju))'));
});

test('forty stored interpretation slots use reviewed copy while preserving panel identities and personal branches',()=>{
 const {editPanel}=require('../api/_report-editorial');
 for(const id of ['운명의-사람은-언제-올까-fyq1z','타고난-재물복은-얼마나-될까-k7dxw']){
  for(let i=1;i<=20;i++){
   const row=editPanel(id,{id:'original-'+i,sort_order:i,img_url:'keep.webp',caption_template:'OLD_COPY'});
   assert.equal(row.id,'original-'+i);assert.equal(row.img_url,'keep.webp');assert.notEqual(row.caption_template,'OLD_COPY');
   for(const wx of ['목','화','토','금','수']){
    const text=api.fillReportTemplate(row.caption_template,{...result,dayGanWx:wx,wxCount:{목:0,화:0,토:0,금:0,수:0,[wx]:8}});
    assert.ok(!text.includes('{{branch:'));assert.ok(!text.includes('undefined'));assert.ok(text.length>35);
    assert.ok(!/베팅|사주에 새겨진|겉으로는.*척/.test(text));
   }
  }
 }
 const original={sort_order:1,caption_template:'OTHER_STORY'};assert.equal(editPanel('other',original),original);
});

test('all three free openings lead with personalised readings instead of illustrated stories',()=>{
 const {concept:career}=require('../api/_pocha-content');
 for(const c of [concept,{...concept,category:'재물'},career]){
  const render=wx=>api.storyFlowHtml(c,{access:{story:false,detail:false},rows:[{caption_template:'PAID_ONLY'}]},{...result,dayGanWx:wx});
  const text=render('수');
  assert.ok(text.includes('내 사주 무료 풀이'));assert.ok(text.includes('임(수)'));
  assert.equal((text.match(/class="reading-point"/g)||[]).length,3);
  assert.ok(!text.includes('class="story-frame'));assert.ok(!text.includes('class="pocha-scene'));
  assert.ok(!text.includes('PAID_ONLY'));assert.ok(!text.includes('story-locked-preview'));
  assert.ok(text.indexOf('reading-preview')<text.indexOf('data-gate="story"'));
  assert.equal(new Set(['목','화','토','금','수'].map(render)).size,5);
 }
});

test('highlights require an authored phrase and never trigger on isolated astrology keywords',()=>{
 assert.equal(api.reportEmphasis('일간과 오행으로 내 마음을 읽어요.'),'일간과 오행으로 내 마음을 읽어요.');
 assert.equal(api.reportEmphasis('지금은 **꼭 필요한 조건부터 확인해보세요.**'),'지금은 <strong>꼭 필요한 조건부터 확인해보세요.</strong>');
 assert.equal(api.reportEmphasis('<strong>핵심 해석</strong>'),'<strong>핵심 해석</strong>');
});

 test('preview lead precedes art and actual heavenly-stem roles change the explanation',()=>{
 const render=r=>api.storyFlowHtml(concept,{access:{story:false,detail:false},rows:[]},r);
 const a=render({...result,yearSS:'정관',monthSS:null,timeSS:null});
 const b=render({...result,yearSS:'정인',monthSS:null,timeSS:null});
 assert.notEqual(a,b);assert.ok(a.includes('관계의 약속과 책임'));assert.ok(b.includes('상대의 뜻을 이해'));
 assert.ok(a.indexOf('<h2>')<a.indexOf('reading-intro-art'));assert.ok(!a.includes('내 사주부터 살펴볼게요'));
 });
