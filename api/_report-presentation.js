// Keep existing concept IDs and purchase history; unify catalogue and reader presentation.
const presentation = {
 '운명의-사람은-언제-올까-fyq1z': {title:'나는 왜 이런 사랑을 할까?',tagline:'내가 끌리는 사람과 마음을 표현하는 방식',cover_img_url:'/assets/webtoon/reader-v2/love-f-2.webp'},
 '타고난-재물복은-얼마나-될까-k7dxw': {title:'나는 돈 앞에서 왜 이럴까?',tagline:'소비와 기회 앞에서 드러나는 나의 선택',cover_img_url:'/assets/webtoon/reader-v2/wealth-f-0.webp'}
};
function presentConcept(concept){return {...concept,...(presentation[concept.id]||{})};}
module.exports={presentConcept};
