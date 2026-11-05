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
 for(const v of ['이음랩(IEUM LAB)','정계준','195-50-01151','301호','010-5440-0335','ieumlab22@gmail.com','legal.html#refund','legal.html#price'])assert.ok(foot.includes(v),v);
 const fmt=n=>n.toLocaleString('en-US')+'원';
 const ny=require('../api/_newyear-content.js').concept.price_krw,ian=require('../api/_ian-content.js').concept.price_krw,{STAGE_PRICE}=require('../api/_report-access.js');
 assert.match(legal,new RegExp('2027 신년운세</th><td>'+fmt(ny)));
 assert.match(legal,new RegExp('이안의 비밀</th><td>'+fmt(ian)));
 assert.match(legal,new RegExp('결혼 사주</th><td>각 '+fmt(STAGE_PRICE.story)));
});
