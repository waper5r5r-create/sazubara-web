// Keep existing concept IDs and purchase history; unify catalogue and reader presentation.
const presentation = {
 '운명의-사람은-언제-올까-fyq1z': {title:'연애 사주',tagline:'끌리는 사람과 앞으로 10년의 인연 흐름',cover_img_url:'/assets/love/scenes/cover.webp'},
 '타고난-재물복은-얼마나-될까-k7dxw': {title:'재물 사주',tagline:'돈이 들어오는 힘과 새는 구멍, 10년 돈 흐름',cover_img_url:'/assets/wealth/scenes/cover.webp'}
};
function presentConcept(concept){return {...concept,...(presentation[concept.id]||{})};}
module.exports={presentConcept};
