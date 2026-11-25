// 서버 콘텐츠 등록표. 새 콘텐츠는 본문 파일(api/_이름-content.js)을 만들고 여기에 한 칸을 더한다.
// 화면 쪽 등록표(index.html의 CONTENTS)와 약관 가격표가 이 표와 맞는지는 tests/contents.test.js가 확인한다.
//   concept  콘텐츠 정보(id·제목·값)
//   place    전체 목록에 보이는 자리: 'front' DB 콘텐츠 앞, 'back' DB 콘텐츠 뒤, null 이면 DB(report_concepts)에 있는 콘텐츠라 여기서 넣지 않는다
//   sold     DB 없이 이 표만으로 결제할 수 있는 콘텐츠
//   ownPrice 단계 공통 값(STAGE_PRICE) 대신 concept.price_krw로 파는 콘텐츠
//   read(q, access) 콘텐츠 하나를 열 때 내려줄 본문. 내 사주가 필요한데 없으면 null(→ 400 MISSING_SAJU)
const career = require('./_career-content');
const marriage = require('./_marriage-content');
const love = require('./_love-content');
const wealth = require('./_wealth-content');
const newyear = require('./_newyear-content');
const ian = require('./_ian-content');
const yeonseo = require('./_yeonseo-content');

// 직업·연애·재물·결혼: 이야기와 심층 리포트가 한 번에 열린다.
const storyAndDetail = mod => (q, access) => ({ rows: access.story ? [mod.story] : [], detailRows: access.detail ? [mod.detail] : [], access, preview: !access.story, storyCount: 1 });

const CONTENTS = [
  { concept: newyear.concept, place: 'front', sold: true, ownPrice: true,
    read(q, access) { const l = newyear.compose({ gan: q.gan, zhi: q.zhi, weak: q.weak }); return l && { rows: [], access, preview: !access.story, free: l.free, paid: access.story ? l.paid : null }; } },
  { concept: ian.concept, place: 'front', sold: true,
    read(q, access) { const s = ian.compose(q); return s && { rows: [], access, preview: !access.story, free: s.free, teasers: s.teasers, paid: access.story ? s.paid : null }; } },
  { concept: yeonseo.concept, place: 'front', sold: true, ownPrice: true,
    read(q, access) { const f = yeonseo.parseFacts(q.ys); return f && { rows: [], access, preview: !access.story, paid: access.story ? yeonseo.compose(f) : null }; } },
  { concept: love.concept, place: null, sold: false, read: storyAndDetail(love) },
  { concept: wealth.concept, place: null, sold: false, read: storyAndDetail(wealth) },
  { concept: career.concept, place: 'back', sold: true, read: storyAndDetail(career) },
  { concept: marriage.concept, place: 'back', sold: true, read: storyAndDetail(marriage) }
];

const byId = id => CONTENTS.find(c => c.concept.id === id) || null;
// 결제에 쓰는 고정 콘텐츠(DB 조회 없이 확인한다)
const SOLD = Object.fromEntries(CONTENTS.filter(c => c.sold).map(c => [c.concept.id, c.concept]));
// 이 콘텐츠의 값. 단계 공통 값은 호출하는 쪽이 넘긴다.
function priceOf(conceptId, stagePrice) { const c = byId(conceptId); return c && c.ownPrice ? c.concept.price_krw : stagePrice; }
// 전체 목록: 앞 콘텐츠 + DB 콘텐츠 + 뒤 콘텐츠
function catalog(dbRows) {
  const at = p => CONTENTS.filter(c => c.place === p).map(c => c.concept);
  return at('front').concat(dbRows, at('back'));
}

module.exports = { CONTENTS, byId, SOLD, priceOf, catalog };
