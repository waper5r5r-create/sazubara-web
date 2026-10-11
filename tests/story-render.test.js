const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.storyTest={fillReportTemplate,reportImageSource,reportSectionHtml,prologueDialogue,detailReportHtml,stageOfferHtml,readerStepsHtml,reportCardHtml,STATE,DEVICE,REPORT_READER,isWorryUnlocked};})();');
const sandbox={document:{readyState:'loading',addEventListener(){}},window:{},console,setTimeout(){},clearTimeout(){},URLSearchParams,URL,Date,Math,Intl};
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
