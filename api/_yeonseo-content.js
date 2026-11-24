// "여우의 인연 장부". 여우 연서가 재회를 읽어 주는 웹툰형 콘텐츠.
// 사주 계산(두 사람 연인 자리, 90일 여우불 날짜)은 화면이 하고, 서버는 그 결과(facts)로 문장 표에서 골라 일곱 장을 엮는다.
// 결제 전에는 유료 문장이 응답에 실리지 않는다. facts를 바꿔 보내도 다른 사주의 글이 나올 뿐, 결제 없이 열리지는 않는다.
const T = require('./_yeonseo-text');

const concept = {
  id: '20271201-7a3e-4f1b-9c62-5d8e0b4a1f73',
  title: '여우의 인연 장부',
  tagline: '끊긴 줄, 아직 이어져 있을까',
  category: '연애',
  cover_img_url: '/assets/yeonseo/hero.webp',
  active: true,
  price_krw: 9900
};

const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const WX = ['목', '화', '토', '금', '수'];
const TEN = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
const LINES = ['tied', 'cut', 'tangled', 'plain', 'unknown'];
const BANDS = ['up', 'flat', 'down'];
const MD = '(?:1[0-2]|[1-9])월 (?:3[01]|[12][0-9]|[1-9])일';
const MD_RE = new RegExp('^' + MD + '$'), RANGE_RE = new RegExp('^' + MD + ' ~ ' + MD + '$');
const WX_OF = {甲:'목',乙:'목',丙:'화',丁:'화',戊:'토',己:'토',庚:'금',辛:'금',壬:'수',癸:'수'};
const SHENG_OF = {목:'화',화:'토',토:'금',금:'수',수:'목'}, KE_OF = {목:'토',토:'수',수:'화',화:'금',금:'목'};

function stemBond(a, b) {
  const x = WX_OF[a], y = WX_OF[b];
  if (x === y) return 'same';
  if (SHENG_OF[x] === y) return 'meFeeds';
  if (SHENG_OF[y] === x) return 'themFeeds';
  if (KE_OF[x] === y) return 'meCuts';
  return 'themCuts';
}
const isGan = g => typeof g === 'string' && g.length === 1 && GAN.includes(g);
const isZhi = z => typeof z === 'string' && z.length === 1 && ZHI.includes(z);
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

// 화면이 보낸 계산 결과를 검사한다. 하나라도 어긋나면 null.
function parseFacts(raw) {
  let f;
  try { f = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
  if (!f || typeof f !== 'object') return null;
  const me = f.me, them = f.them || null, a = f.ans || {};
  if (!me || !isGan(me.gan) || !isZhi(me.zhi) || !WX.includes(me.weak)) return null;
  if (them && (!isGan(them.gan) || !isZhi(them.zhi) || typeof them.fills !== 'boolean')) return null;
  if (them) {
    if (!has(T.whyRel, f.rel) || f.rel === 'unknown' || !LINES.includes(f.line) || f.line === 'unknown') return null;
    if (f.meForThem && !TEN.includes(f.meForThem)) return null;
    if (f.themForMe && !TEN.includes(f.themForMe)) return null;
  } else if (f.line !== 'unknown') return null;
  if (!isInt(f.near, -200, 200) || !isInt(f.gauge, 0, 100)) return null;
  if (!Array.isArray(f.lights) || f.lights.length > 3 || !f.lights.every(l => l && MD_RE.test(l.md) && /^[가-힣]{2}$/.test(l.gz) && ['both', 'me', 'them'].includes(l.k))) return null;
  if (!Array.isArray(f.darks) || f.darks.length > 3 || !f.darks.every(d => MD_RE.test(d))) return null;
  if (!Array.isArray(f.months) || f.months.length !== 3 || !f.months.every(m => m && RANGE_RE.test(m.range) && BANDS.includes(m.band))) return null;
  if (!has(T.whyPick, a.why) || !has(T.nowHeart, a.who) || !has(T.move, a.contact)) return null;
  if (a.kind && !has(T.kindDeep, a.kind)) return null;
  if (typeof a.letter !== 'boolean') return null;
  return {
    me: {gan: me.gan, zhi: me.zhi, weak: me.weak},
    them: them ? {gan: them.gan, zhi: them.zhi, fills: them.fills} : null,
    rel: them ? f.rel : null, line: f.line,
    meForThem: them ? (f.meForThem || '') : '', themForMe: them ? (f.themForMe || '') : '',
    near: f.near, gauge: f.gauge,
    lights: f.lights.map(l => ({md: l.md, gz: l.gz, k: l.k})), darks: f.darks.slice(),
    months: f.months.map(m => ({range: m.range, band: m.band})),
    ans: {kind: a.kind || '', why: a.why, who: a.who, contact: a.contact, letter: a.letter}
  };
}

const band = s => s >= 4 ? 'up' : (s <= -3 ? 'down' : 'flat');
const plus = (a, b) => b ? a + '\n\n' + b : a;
const nth = (v, n) => Array.isArray(v) ? v[n % v.length] : v;
const say = t => ({t: 'say', text: t}), box = t => ({t: 'box', text: t}), sec = (h, t) => ({t: 'sec', head: h, text: t});

// 같은 facts면 늘 같은 일곱 장(+부적)이 나온다.
function compose(f) {
  const C = T, me = f.me, them = f.them, ans = f.ans;
  const who = ans.who, contact = ans.contact, why = ans.why, rel = f.rel || 'none';
  const g = f.gauge < 45 ? 'low' : (f.gauge < 70 ? 'mid' : 'high'), tg = them ? them.gan : null;
  const ck = C.replyScript[contact] ? contact : '연락 안 해';
  const wk = (who === '나' && why === '바람' && C.whoDeep['나·바람']) ? '나·바람' : who;
  const ch = [];
  ch.push({no: 1, img: 'P1', title: '장부에 적힌 두 사람', blocks: [
    say(C.ch1Intro),
    box('너는 ' + C.loveStyle[me.gan]),
    {t: 'list', head: C.strengthHead, items: C.strengths[me.gan]},
    sec(C.patternHead, C.pattern[me.gan]),
    sec(C.yearHead, C.yearNow[me.gan]),
    them ? box('그 사람은 ' + C.loveStyle[tg]) : box('그 사람 생일을 모르니, 그 사람 칸은 비워 둘게. 생일을 알게 되면 이 칸도 채워 줄게.'),
    them ? sec(C.patternThemHead, C.pattern[tg]) : null,
    them ? sec(C.yearThemHead, C.yearNow[tg]) : null,
    them ? sec(C.spouseThemHead, C.spouseOf[them.zhi]) : null,
    them ? say(plus(C.stemBond[stemBond(me.gan, tg)], C.stemBondMore[stemBond(me.gan, tg)])) : null,
    them && f.meForThem ? sec(C.roleHead, C.roleDeep[f.meForThem]) : null,
    them ? sec(C.fillHead, them.fills ? C.fill[me.weak] : C.fillNone) : null,
    them && f.themForMe ? say(plus(C.roleOfThem[f.themForMe], C.roleOfThemMore[f.themForMe])) : null].filter(Boolean)});
  ch.push({no: 2, img: 'P2', title: '줄이 끊긴 진짜 이유', blocks: [
    say(C.ch2Intro), say(plus(C.whyPick[why], C.whyPickMore[why])),
    box(them ? plus(C.whyRel[rel], C.whyRelMore[rel]) : plus(C.whyRel.unknown, C.whyRelMore.unknown)),
    sec(C.whyDeepHead, C.whyDeep[why]),
    sec(C.whoHead, C.whoDeep[wk] || C.whoDeep['자연스럽게']),
    ans.kind && C.kindDeep[ans.kind] ? sec(C.kindHead, C.kindDeep[ans.kind]) : null,
    ans.kind && C.kindNote[ans.kind] ? say(C.kindNote[ans.kind]) : null].filter(Boolean)});
  ch.push({no: 3, img: 'P3', title: '그 사람의 지금 마음', blocks: [
    say(C.ch3Intro),
    box(plus((C.nowHeart[who] || C.nowHeart['자연스럽게'])[band(f.near)], (C.nowHeartMore[who] || C.nowHeartMore['자연스럽게'])[band(f.near)])),
    them ? say(plus(C.recall[tg], C.recallMore[tg])) : {t: 'note', text: '그 사람 생일 없이 본 풀이라 정확도가 낮아. 생일을 알게 되면 다시 펼쳐 봐.'},
    sec(C.innerHead, them ? C.innerVoice[tg] : C.innerNone),
    them ? {t: 'note', text: C.innerNote} : null,
    sec(C.charmHead, C.charmOf[me.gan]),
    {t: 'list', head: C.themSignHead, items: them ? C.themSign[tg] : C.themSignNone}].filter(Boolean)});
  const seen = {};
  const lights = f.lights.map((l, i) => ({md: l.md, gz: l.gz, text: nth(C.lightDay[l.k], (seen[l.k] = (seen[l.k] || 0) + 1) - 1) + '\n\n' + C.dayPlanHead + ' — ' + C.dayPlan[i]}));
  const months = f.months.map((m, i) => ({range: m.range, text: C.month[i][m.band] + '\n\n' + C.missionHead + ' — ' + C.mission[i][m.band]}));
  ch.push({no: 4, img: 'P4', title: '여우불이 켜지는 날', blocks: [say(C.ch4Intro), {t: 'months', head: C.monthHead, items: months},
    sec(C.chanceHead, (C.chance[f.line] || C.chance.unknown)[g]),
    {t: 'days', lights, darks: f.darks.map(md => ({md})), dark: C.darkDay},
    contact === '차단됐어' && C.blockedDayNote ? {t: 'note', text: C.blockedDayNote} : null,
    say(C.ch4Outro)].filter(Boolean)});
  const mv = C.move[contact] || C.move['연락 안 해'];
  const when = contact === '차단됐어' ? (lights[1] ? ' 두 번째 여우불 날은 ' + lights[1].md + '이야.' : '') : (lights[0] ? ' 가장 가까운 여우불 날은 ' + lights[0].md + '이야.' : '');
  ch.push({no: 5, img: 'P5', title: '여우의 한 수', blocks: [say(C.ch5Intro), box(mv.plan + when), {t: 'lines', items: mv.lines},
    sec(C.toneHead, them ? C.toneFor[tg] : C.toneNone),
    box(C.dont[why]), say(C.whenReply[contact]),
    {t: 'steps', head: C.replyHead, items: C.replyScript[ck]},
    {t: 'list', head: C.topicHead, items: C.talkTopics[ans.kind] || C.talkTopics['연인']},
    {t: 'list', head: C.dontListHead, items: C.dontList[ck]},
    {t: 'steps', head: C.weekHead, items: C.weekPlan[ck]},
    {t: 'list', head: C.checkHead, items: C.checklist[why]},
    sec(C.comeHead, C.ifTheyCome[wk] || C.ifTheyCome['자연스럽게']),
    {t: 'qa', head: C.faqHead, items: C.faq[ck]}]});
  ch.push({no: 6, img: 'P6', title: '다시 엮는다면', blocks: [say(C.ch6Intro), box(them ? C.again[rel] : C.again.unknown), say(C.change[me.gan]),
    sec(C.afterBackHead, C.afterBack[why]),
    sec(C.dateHead, them ? C.dateFor[tg] : C.dateNone),
    sec(C.rivalHead, C.rival[f.line] || C.rival.unknown),
    {t: 'note', text: C.rivalNote},
    them ? sec(C.fightHead, C.fightRule[stemBond(me.gan, tg)]) : null].filter(Boolean)});
  ch.push({no: 7, img: 'P7', title: '먹을 씻어낼 때, 그리고 다음 이름', blocks: [say(C.ch7Intro), box(plus(C.letGo[g], C.letGoMore[g])), {t: 'list', head: C.signsHead, items: C.signs}, say(C.washNote),
    sec(C.selfCareHead, C.selfCare[me.weak]),
    sec(C.letterHead, ans.letter ? C.letterReply[why] : C.letterNone),
    box(plus(C.nextOne[me.zhi], C.nextOneMore[me.zhi])),
    sec(C.finalHead, C.finalLetter[f.line] || C.finalLetter.unknown),
    say(C.outro)]});
  ch.push({no: 0, img: 'P8', title: '여우의 부적', blocks: [{t: 'charm', text: C.charm[me.weak]}]});
  return ch;
}

module.exports = {concept, parseFacts, compose, stemBond};
