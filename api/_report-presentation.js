// Keep existing concept IDs and purchase history; unify catalogue and reader presentation.
const presentation = {
 '운명의-사람은-언제-올까-fyq1z': {title:'연애 사주',tagline:'끌리는 사람과 편안한 연애의 속도',cover_img_url:'/assets/webtoon/reader-v2/love-f-2.webp'},
 '타고난-재물복은-얼마나-될까-k7dxw': {title:'재물 사주',tagline:'돈이 모이는 선택, 새는 습관',cover_img_url:'/assets/webtoon/reader-v2/wealth-f-0.webp'}
};
function presentConcept(concept){return {...concept,...(presentation[concept.id]||{})};}
module.exports={presentConcept};
