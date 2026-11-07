// 주제별 링크 카드. 네이버·카카오 같은 미리보기는 화면 스크립트를 실행하지 않고 처음 받은 HTML만 읽어요.
// 그래서 첫 화면(/) 주소에 ?newyear, ?go=love 같은 값이 있으면 서버에서 og:title·og:description·og:image를 바꿔서 보내요.
// utm 같은 다른 값이 함께 붙어 있어도 같은 카드가 나와요. 값이 없으면 손대지 않고 원래 index.html을 그대로 보내요.
export const config = { matcher: '/' };

const SITE = 'https://www.byeolcheop.com';
const CARDS = {
  newyear: { title: '2027 신년운세 | 별첩사주', desc: '정미년, 내 한 해 흐름을 달마다 알려 드려요.' },
  love: { title: '연애 사주 | 별첩사주', desc: '2027년 내 연애 흐름, 언제 인연이 올까요?' },
  wealth: { title: '재물 사주 | 별첩사주', desc: '돈 모으기 좋은 달, 내 사주로 찾아봐요.' },
  career: { title: '직업 사주 | 별첩사주', desc: '이직, 움직일 때와 버틸 때를 알려 드려요.' },
  marriage: { title: '결혼 사주 | 별첩사주', desc: '배우자 자리와 앞으로 10년 결혼 흐름을 봐요.' },
  ian: { title: '이안의 비밀 | 별첩사주', desc: '향으로 읽는 내 사주 이야기예요.' },
  compat: { title: '궁합 | 별첩사주', desc: '두 사람이 어디서 엇갈리는지 알려 드려요.' },
  today: { title: '오늘의 운세 | 별첩사주', desc: '오늘, 그리고 이번 달 내 흐름을 봐요.' }
};

export function cardKey(params) {
  if (params.has('newyear')) return 'newyear';
  if (params.has('ian')) return 'ian';
  const go = params.get('go');
  if (go && ['love', 'wealth', 'career', 'marriage'].indexOf(go) !== -1) return go;
  if (params.has('compat')) return 'compat';
  if (params.has('today')) return 'today';
  return null;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function setMeta(html, attr, name, value) {
  const re = new RegExp('(<meta ' + attr + '="' + name + '" content=")[^"]*(")');
  return html.replace(re, (m, a, b) => a + esc(value) + b);
}

export function applyCard(html, key) {
  const card = CARDS[key];
  if (!card) return html;
  const image = SITE + '/og/' + key + '.jpg';
  html = setMeta(html, 'property', 'og:title', card.title);
  html = setMeta(html, 'property', 'og:description', card.desc);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'property', 'og:image:alt', card.title);
  html = setMeta(html, 'name', 'twitter:title', card.title);
  html = setMeta(html, 'name', 'twitter:image', image);
  html = setMeta(html, 'name', 'description', card.desc);
  return html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(card.title) + '</title>');
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const key = cardKey(url.searchParams);
  if (!key) return;
  const res = await fetch(new URL('/index.html', url));
  if (!res.ok) return;
  const html = applyCard(await res.text(), key);
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' }
  });
}
