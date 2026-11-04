const test=require('node:test');const assert=require('node:assert');
// 유료 글 본문에는 사주 용어를 그대로 쓰지 않는다. 제목의 괄호 표기만 허용한다.
const TERMS=/일간|일지|비겁|비견|겁재|식상|재성|편재|정재|(?<!습)관성|편관|정관|편인(?!가)|정인|신강|신약|대운|십신|신살|천간|육합|삼합|원진|월주|연주|시주/;
const strings=(o,out=[])=>{if(typeof o==='string')out.push(o);else if(o&&typeof o==='object')Object.values(o).forEach(v=>strings(v,out));return out;};
for(const name of ['love','wealth','career','marriage'])test(name+' content uses plain words',()=>{
 const m=require('../api/_'+name+'-content.js');
 const bad=strings({story:m.story,detail:m.detail}).map(t=>t.replace(/\((식상|재성|관성|인성|비겁|정재|편재)\)/g,'')).filter(t=>TERMS.test(t));
 assert.deepEqual(bad,[]);
});
