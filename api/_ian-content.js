// "이안의 비밀". 조향사 이안이 내 사주를 읽어 주는 그림 위주 콘텐츠.
// 화면은 읽는 사람의 눈이고 말하는 사람은 이안뿐이다. 향은 장면을 옮기는 장치, 내용은 사주다.
// 남녀 모두 같은 장, 같은 사주 항목, 같은 풀이를 본다. 성별로 달라지는 건 그림(여성 화면엔 m- 남자 주인공 컷)과 말투, 전통 기준의 이성 글자(남 재성, 여 관성)뿐이다.
// 무료(들어가기, 1~2장)와 유료(3~7장)를 나눠, 결제 전에는 유료 문장이 응답에 실리지 않는다.
const concept = {
  id: '20270102-5c1b-4e8a-a3f7-2b9d6e0c4f18',
  title: '이안의 비밀',
  tagline: '내 사주 속 숨겨 둔 얼굴',
  category: '연애',
  cover_img_url: '/assets/ian/bottle.webp',
  active: true,
  price_krw: 7900
};

const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GAN_KR = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const ZHI_KR = {子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'};
const WX = ['목','화','토','금','수'];
const ganWx = g => WX[Math.floor(GAN.indexOf(g) / 2)];

// 일지 삼합으로 찾는 도화. index.html의 computeShinsal과 같은 기준이다.
const DOHWA = {寅:'卯',午:'卯',戌:'卯',亥:'子',卯:'子',未:'子',申:'酉',子:'酉',辰:'酉',巳:'午',酉:'午',丑:'午'};
// 일간으로 찾는 홍염. 널리 쓰는 표 하나로 고정한다.
const HONGYEOM = {甲:'午',乙:'午',丙:'寅',丁:'未',戊:'辰',己:'辰',庚:'戌',辛:'酉',壬:'子',癸:'申'};
const POS = ['year','month','day','time'];

function role(dayWx, wx) {
  const d = WX.indexOf(dayWx), w = WX.indexOf(wx);
  return ['bigyeop','siksang','jaeseong','gwanseong','inseong'][(w - d + 5) % 5];
}

// 그림의 세로·가로 비율. 화면이 이미지를 받기 전에 자리를 잡는 데 쓴다.
const RATIO = {'w-':'4/3','z-':'4/5','m-w':'4/3','m-z':'4/5','o-paper':'840/501','o-tie':'840/433',c05:'16/9',c10:'16/9',c12:'16/9'};
function ratioOf(img) {
  if (RATIO[img]) return RATIO[img];
  return RATIO[img.slice(0, 3)] || RATIO[img.slice(0, 2)] || '3/4';
}
const cut = (img, line, at) => ({t:'cut', img, ratio:ratioOf(img), line:line || '', at:at || 'b'});
const say = (text, tone) => ({t:'say', text, tone:tone || 'night'});
const big = text => ({t:'big', text});
const sfx = text => ({t:'sfx', text});
const real = rows => ({t:'real', rows});
const hold = label => ({t:'hold', label});
const head = (n, title, basis) => ({t:'chapter', n, title, basis});

const DAY_GAN = {
  甲:['곧게 크는 나무예요.','아무도 못 꺾을 것 같죠. 그래서 다들 한번 꺾어 보고 싶어 해요.','나무'],
  乙:['덩굴이에요.','약해 보여서 손을 내밀었는데, 정신 차리면 이미 감겨 있어요.','덩굴'],
  丙:['한낮의 해예요.','눈이 부셔서 고개를 돌려도, 눈을 감으면 잔상이 남아요.','해'],
  丁:['촛불이에요.','작아 보이죠. 그런데 불 꺼진 방에선 그것만 보여요.','촛불'],
  戊:['큰 산이에요.','말이 없어요. 그래서 다들 그 품에 한번 들어가 보고 싶어 해요.','산'],
  己:['젖은 흙이에요.','부드러워요. 그런데 한번 밟으면 발자국이 안 지워져요.','흙'],
  庚:['벼린 칼이에요.','차가워요. 베일 걸 알면서도 자꾸 손이 가요.','칼'],
  辛:['잘 다듬은 보석이에요.','함부로 못 만져요. 그걸 아는 사람일수록 더 애가 타요.','보석'],
  壬:['밤바다예요.','겉은 잔잔한데, 발을 담그면 깊이를 알 수가 없어요.','바다'],
  癸:['새벽비예요.','소리도 없이 와요. 알아챘을 땐 이미 다 젖어 있고요.','비']
};
const DOHWA_AT = {
  year:['년지의 도화예요.','타고난 얼굴이라는 뜻이에요. 처음 본 사람이 먼저 말을 걸죠.','본인은 평범하게 있었을 뿐인데, 소문은 늘 먼저 도착해요.'],
  month:['월지의 도화예요.','일터나 모임에서 피어요. 같이 일한 사람이 먼저 흔들려요.','일 얘기를 하는데, 상대는 다른 걸 보고 있었을 거예요.'],
  time:['시지의 도화예요.','낮엔 아무도 몰라요. 해가 지고, 둘만 남으면 피어요.','당신과 밤을 보낸 적 있는 사람만 아는 얼굴이 있어요.']
};
const NO_DOHWA = ['도화가 없네요.','실망했어요? 그럴 거 없어요.','도화 있는 사람은 금방 눈에 띄고 금방 잊혀요. 당신은 늦게 스며들어요.','그래서 한번 빠진 사람은, 빠져나오는 법을 몰라요.'];

const STRENGTH = {
  strong:{
    title:'신강이에요. 내 기운이 세서, 판을 내가 짜요.',
    m:'이끄는 쪽이죠. 사주도 그렇다고 해요.', f:'끌고 가는 쪽이죠. 사주도 그렇다고 해요.',
    turn:'그런데요. 전부 뜻대로 되면 금방 식어요.',
    end:'당신을 진짜 흔드는 건, 당신 말을 안 듣는 사람이에요.'
  },
  weak:{
    title:'신약이에요. 바깥 기운이 나보다 커요.',
    m:'앞장서는 쪽 같죠. 사주는, 맡기고 싶다고 말하네요.', f:'끌고 가는 쪽 같죠. 사주는, 맡기고 싶다고 말하네요.',
    turn:'약하다는 말이 아니에요. 믿는 사람 앞에서 힘을 빼고 싶은 거예요.',
    end:'이리 와, 그 한마디에 다 내려놓고 싶었던 적 있죠.'
  }
};
const ROLE = {
  bigyeop:['비겁이 가장 많아요. 나를 세우는 기운이요.','그래서 지기 싫은 상대에게 약해요.','눈 안 피하고 맞서는 사람. 싸우다가 분위기가 달라지는 사람이요.'],
  siksang:['식상이 가장 많아요. 밖으로 꺼내는 기운이요.','그래서 말에 약해요.','귓가에 낮게 깔리는 목소리, 농담인지 진심인지 모를 한마디에요.'],
  jaeseong:['재성이 가장 많아요. 손에 쥐는 기운이요.','그래서 감각에 약해요.','스치는 향, 손끝의 온도, 옷깃의 질감. 머리보다 몸이 먼저 기억해요.'],
  gwanseong:['관성이 가장 많아요. 나를 누르는 기운이요.','그래서 넘으면 안 되는 선에 약해요.','안 된다고 할수록 더 생각나요. 단호하게 나를 멈춰 세우는 사람이요.'],
  inseong:['인성이 가장 많아요. 나를 품어 주는 기운이요.','그래서 다정함에 약해요.','머리를 넘겨 주는 손, 괜찮다는 한마디에 그동안 세운 벽이 다 무너져요.']
};
const LOVER = {
  m:{name:'재성', none:'연인 자리를 뜻하는 재성이 없어요.', few:'연인 자리를 뜻하는 재성이 알맞게 있어요.', many:'연인 자리를 뜻하는 재성이 많아요.'},
  f:{name:'관성', none:'연인 자리를 뜻하는 관성이 없어요.', few:'연인 자리를 뜻하는 관성이 알맞게 있어요.', many:'연인 자리를 뜻하는 관성이 많아요.'}
};
const LOVER_READ = {
  none:'그래서 기준이 없어요. 걸리면 한 번에, 크게 걸려요.',
  few:'고르는 눈이 있어요. 아무한테나 안 넘어가는데, 넘어가면 오래가요.',
  many:'곁에 사람이 끊이지 않아요. 그런데 한 사람에게 오래 머무는 게 제일 어렵죠.'
};
const SPEED = {
  화:['화가 가장 많아요. 불이에요.','눈 마주친 순간 이미 달아올라요.','숨길 수가 없어요. 볼에, 목덜미에 다 티가 나요.'],
  목:['목이 가장 많아요. 자라는 기운이에요.','처음엔 아무렇지 않아요. 그런데 매일 조금씩 커져요.','정신 차렸을 땐 그 사람 생각이 온몸을 감고 있어요.'],
  토:['토가 가장 많아요. 땅이에요.','쉽게 안 데워져요. 대신 한번 데워지면 안 식어요.','다들 끝난 줄 알 때, 당신은 그제야 뜨거워요.'],
  금:['금이 가장 많아요. 쇠예요.','오래 차가워요. 다들 포기하고 돌아설 만큼이요.','그런데 쇠는 녹는 순간이 있어요. 그땐 손을 못 대요.'],
  수:['수가 가장 많아요. 물이에요.','겉으론 아무 일도 없어요. 속에서만 천천히 차올라요.','넘칠 때까지 아무도 몰라요. 본인만 빼고요.']
};
const COOL = {
  화:'화가 제일 적어서, 먼저 표현하는 게 서툴러요. 그 서툰 한마디가 오히려 사람을 잡아요.',
  목:'목이 제일 적어서, 먼저 시작하는 걸 망설여요. 누가 손을 끌어 주길 기다리죠.',
  토:'토가 제일 적어서, 한번 흔들리면 중심을 잃어요. 그래서 더 아찔해요.',
  금:'금이 제일 적어서, 끊어야 할 때 못 끊어요. 안 되는 줄 알면서 또 답장을 보내죠.',
  수:'수가 제일 적어서, 달아오른 뒤 식히는 법을 몰라요. 밤이 길어져요.'
};
const HONG_AT = {
  year:['년지에 홍염이 있어요.','타고난 열이에요. 일찍부터 나이보다 깊은 눈을 가졌다는 소리, 들었을 거예요.','무너지는 순간은요, 오래 참던 사람이 처음 내 이름을 부를 때예요.'],
  month:['월지에 홍염이 있어요.','매일 보는 사람 사이에서 불이 붙어요.','무너지는 순간은요, 모두 돌아간 뒤에 둘만 남았을 때예요.'],
  day:['일지에 홍염이 있어요.','내 가장 깊은 자리에 불이 앉아 있어요.','무너지는 순간은요, 사랑받고 있다고 믿은 그날 밤이에요. 겉은 단정한데 밑은 타고 있어요.'],
  time:['시지에 홍염이 있어요.','시간이 갈수록 짙어지는 불이에요. 나이 들수록 더 위험해져요.','무너지는 순간은요, 다 내려놓았다고 생각한 바로 그때예요.']
};
const NO_HONG = ['홍염은 없어요.','그럼 안 무너지느냐고요? 아니요. 무너지는 방식이 달라요.','불이 아니라 물처럼 무너져요. 소리도 없이요. 혼자 잠 못 드는 밤에 알게 되죠.'];
const DAY_ZHI = {
  子:['일지가 자수예요. 한밤중의 물이요.','낮에는 평범한데, 밤에만 다른 얼굴을 보여 주는 사람을 원해요.','비밀을 같이 가져 줄 사람이요.'],
  丑:['일지가 축토예요. 겨울 땅이요.','말없이 오래 곁에 있는 사람을 원해요.','화려한 사람에게 흔들려도, 결국 돌아가는 곳은 거기예요.'],
  寅:['일지가 인목이에요. 새벽의 호랑이요.','나를 가두지 않는 사람을 원해요.','잡으려 들면 도망가고 싶고, 놓아주면 돌아오고 싶어져요.'],
  卯:['일지가 묘목이에요. 봄 들판이요.','나를 예뻐해 주는 사람을 원해요.','말로, 눈으로, 손으로. 매일 확인받고 싶어 해요. 부끄러워서 말을 못 할 뿐이죠.'],
  辰:['일지가 진토예요. 물을 품은 땅이요.','속을 알 수 없는 사람을 원해요.','다 안 것 같은데 또 모르겠는 사람. 그런 사람에게 평생 궁금해하고 싶어 해요.'],
  巳:['일지가 사화예요. 똬리 튼 불이요.','나를 집요하게 원하는 사람을 원해요.','적당한 사랑은 시시하죠. 끝까지 파고드는 사람이어야 마음이 놓여요.'],
  午:['일지가 오화예요. 한낮의 말이요.','같이 달릴 수 있는 사람을 원해요.','뜨거워야 해요. 미지근한 건 사랑으로 안 쳐요.'],
  未:['일지가 미토예요. 데워진 땅이요.','나를 돌봐 주는 사람을 원해요.','겉으론 다 챙기는 쪽인데, 사실은 누가 먼저 나를 재워 주길 바라요.'],
  申:['일지가 신금이에요. 날이 선 쇠요.','똑똑해서 나를 긴장시키는 사람을 원해요.','편하기만 하면 금방 질려요. 한 수 위인 사람 앞에서만 순해지죠.'],
  酉:['일지가 유금이에요. 잘 다듬은 금이요.','흐트러짐 없는 사람을 원해요.','그런 사람이 나 앞에서만 흐트러질 때, 그때 완전히 무너져요.'],
  戌:['일지가 술토예요. 불씨를 묻은 땅이요.','내 편이 되어 줄 단 한 사람을 원해요.','의리로 시작해서 불로 끝나요. 한번 믿으면 다 줘요.'],
  亥:['일지가 해수예요. 밤바다요.','나를 다 받아 주는 사람을 원해요.','바닥까지 보여 줘도 안 떠나는 사람이요. 그걸 몇 번이고 시험해 봐요.']
};
// 각 장 끝의 현실 풀이. 남녀 모두 같은 문장을 본다.
const STRENGTH_REAL = {
  strong:['연애를 시작하면 일정도 결정도 어느새 당신이 다 하고 있어요. 상대는 편해하는데 당신은 점점 지쳐요. 왜 나만 애쓰지, 싶은 순간이 꼭 오죠.','이번엔 하나만 상대에게 맡겨 봐요. 약속 장소 하나라도요. 그걸 어떻게 고르는지 보면 오래 갈 사람인지 보여요.'],
  weak:['상대 기분에 하루가 좌우돼요. 서운해도 말을 삼키고, 괜찮다고 해 놓고 혼자 곱씹죠. 그러다 어느 날 갑자기 마음이 식어서 상대가 놀라요.','서운한 건 그날 안에 한 문장만 말해요. 그 한 문장을 받아 주는 사람이면 맡겨도 돼요.']
};
const ROLE_REAL = {
  bigyeop:['자존심 때문에 먼저 연락을 못 해요. 좋아할수록 더 아무렇지 않은 척하고요. 그래서 제일 좋아한 사람과 제일 많이 어긋났을 거예요.','당신을 이겨 먹으려는 사람이요. 처음엔 짜릿해도, 싸움이 일상이 되면 둘 다 지쳐요.'],
  siksang:['말 잘하는 사람에게 마음이 먼저 가요. 좋은 말 한마디로 며칠을 버티기도 하죠. 말과 행동이 다른 걸 알면서도요.','말은 달콤한데 약속은 흐린 사람이요. 말 말고, 지난달에 뭘 해 줬는지 세어 봐요.'],
  jaeseong:['분위기와 손길에 먼저 넘어가요. 머리로는 아닌 걸 아는데, 만나면 또 괜찮아져요. 그래서 끝내는 데 오래 걸려요.','만날 때만 좋은 사람이요. 안 만나는 날 연락이 없으면, 그게 그 사람의 답이에요.'],
  gwanseong:['안 될 사람에게 유독 마음이 가요. 바쁜 사람, 곁을 안 주는 사람, 마음이 딴 데 있는 사람이요. 쉬운 사랑은 심심하게 느껴지죠.','당신을 자꾸 고치려는 사람이요. 단호한 것과 통제하는 건 달라요.'],
  inseong:['챙겨 주는 사람에게 금방 마음을 열어요. 고마움과 사랑이 헷갈릴 때가 있고요. 그래서 안 맞는 걸 알면서도 못 떠나요.','다정한데 당신 없으면 아무것도 못 하는 사람이요. 돌봄을 받는 줄 알았는데, 어느새 당신이 돌보고 있을 거예요.']
};
const SPEED_REAL = {
  화:['시작은 제일 빨라요. 일주일 만에 미래까지 그려 봤을 거예요. 그래서 상대가 같은 속도가 아니면 혼자 먼저 식어요.','한 달만 속도를 늦춰요. 불은 오래 타게 두는 쪽이 더 뜨거워요.'],
  목:['친구처럼 지내다 어느 날 갑자기 좋아졌다는 걸 알아요. 그래서 고백할 때를 자주 놓치죠.','마음이 자랐다 싶으면 그 주 안에 말해요. 기다리면 다른 사람이 먼저 말해요.'],
  토:['사귀기까지 오래 걸려요. 상대가 지쳐서 떠난 적도 있을 거예요. 대신 헤어진 뒤엔 제일 오래 앓아요.','좋으면 좋다고 미리 말해 줘요. 당신 속도를 아는 사람만 기다려 줘요.'],
  금:['처음엔 마음이 없는 줄 알았다는 말을 자주 들어요. 기준이 높아서 시작하기도 전에 먼저 걸러 내고요.','기준 하나만 내려놓고 세 번은 만나 봐요. 쇠는 열을 받아야 녹아요.'],
  수:['티를 안 내서 상대는 당신 마음을 몰라요. 혼자 좋아하고 혼자 정리한 사랑이 꽤 있을 거예요.','답장 말고 마음을 한 번 먼저 보여 줘요. 넘치기 전까진 아무도 몰라요.']
};
const HONG_REAL = {
  year:['오래된 이름 하나에 약해요. 옛 사람의 연락 한 통에 몇 년 치 마음이 흔들려요.','늦은 밤에 온 연락은 아침에 답해요. 밤의 당신은 그 사람을 못 이겨요.'],
  month:['일터나 모임에서 자주 보는 사람에게 번져요. 매일 보는 사이라 끝난 뒤가 더 힘들고요.','그 사람을 낮에, 밖에서 한 번 만나 봐요. 그래도 좋으면 진짜예요.'],
  day:['좋아할수록 상대가 내 전부가 돼요. 친구도 일도 뒤로 밀리죠. 그 사람이 조금만 달라져도 세상이 무너지는 것 같아요.','사랑받는 날일수록 내 약속 하나는 지켜요. 그게 당신을 지켜 줘요.'],
  time:['나이 들수록 더 깊게 빠져요. 이제 그런 일 없다고 안심할 때가 제일 위험해요.','괜찮다고 말하는 버릇부터 의심해요. 믿는 사람 한 명에게는 털어놔요.'],
  none:['크게 울지 않아요. 잘 지내는 줄 알았다는 말을 듣죠. 그런데 몇 달 뒤에 혼자 탈이 나요.','힘들 땐 힘들다고 소리 내서 말해요. 말하지 않으면 아무도 못 알아봐요.']
};
const DAY_ZHI_REAL = {
  子:['비밀을 지켜 주는 사람. 당신 얘기를 밖으로 옮기지 않는 사람이요.','둘 사이의 일을 자꾸 떠벌리는 사람이요.'],
  丑:['말보다 곁에 오래 있는 사람. 기념일보다 아픈 날에 오는 사람이요.','화려한데 오래 못 있는 사람이요.'],
  寅:['각자의 시간을 존중해 주는 사람. 연락이 뜸해도 불안해하지 않는 사람이요.','어디냐고 먼저 묻는 사람이요.'],
  卯:['예쁘다는 말을 아끼지 않는 사람. 사소한 변화를 알아봐 주는 사람이요.','말 안 해도 알지, 하고 넘기는 사람이요.'],
  辰:['만날수록 새로운 얘기가 나오는 사람이요.','속을 모르겠는 게 아니라, 아무 속도 없는 사람이요.'],
  巳:['당신을 궁금해하고 끝까지 물어보는 사람. 표현이 분명한 사람이요.','집착을 사랑이라고 부르는 사람이요.'],
  午:['하고 싶은 게 있고, 같이 움직이는 사람이요.','뭐든 다음에 하자는 사람이요.'],
  未:['먼저 챙겨 주고, 밥 먹었냐고 묻는 사람이요.','당신이 챙겨 주는 걸 당연하게 여기는 사람이요.'],
  申:['자기 일을 잘하고, 당신과 대화가 되는 사람이요.','똑똑한 척 당신을 깎아내리는 사람이요.'],
  酉:['자기 관리를 하고, 약속을 지키는 사람이요.','깔끔한데 당신 앞에서도 끝내 안 풀어지는 사람이요.'],
  戌:['무슨 일이 있어도 당신 편에 서는 사람이요.','남들 앞에서 당신을 안 세워 주는 사람이요.'],
  亥:['바닥을 보여 줘도 곁에 남는 사람이요. 시험은 그만하고 믿어 봐요.','받아 주는 척 당신을 이용하는 사람이요.']
};
const STRENGTH_MATCH = {
  strong:'당신 말에 다 맞춰 주는 사람 말고, 싫은 건 싫다고 말하는 사람이요. 처음엔 거슬려도 그런 사람과 오래 가요.',
  weak:'말이 적어도 결정은 분명한 사람이요. 대신 당신 의견을 꼭 물어보는지 봐요. 묻지 않는 사람에게 맡기면 안 돼요.'
};
const ROLE_TIP = {
  bigyeop:'좋아하면 먼저 한 번만 연락해요. 지는 게 아니라, 그 사람이 받을 자격이 있는지 보는 거예요.',
  siksang:'좋은 말을 들은 날은 바로 답하지 말고, 사흘 뒤 행동을 봐요.',
  jaeseong:'끝낼지 고민될 땐 일주일만 만나지 말아 봐요. 안 볼 때도 좋으면 그게 진심이에요.',
  gwanseong:'내가 왜 이 사람을 좋아하는지 세 가지만 적어 봐요. 어렵다는 것 말고 없으면 놓아도 돼요.',
  inseong:'고마운 사람과 좋아하는 사람을 나눠 봐요. 고맙기만 하면 사랑이 아니에요.'
};
const SPEED_COOL = {
  화:'연락 속도가 줄었다고 느낄 때 제일 빨리 식어요.',
  목:'내 시간이 없어졌다고 느낄 때 조금씩 시들어요.',
  토:'약속이 자꾸 바뀔 때 말없이 닫아요. 한번 닫으면 잘 안 열려요.',
  금:'상대가 한 번 크게 실망시키면 그날로 끝이에요.',
  수:'내 얘기를 안 들어 준다고 느낄 때 조용히 빠져나가요.'
};
const HONG_KEEP = {
  year:'옛날 얘기보다 지금 당신 얘기를 궁금해하는 사람이요.',
  month:'일터 밖의 당신도 알고 싶어 하는 사람이요.',
  day:'당신 친구와 일을 존중해 주는 사람이요.',
  time:'오늘의 당신을 편하게 웃게 하는 사람이요.',
  none:'말이 없어도 안색을 먼저 알아채는 사람이요.'
};
const DAY_ZHI_KEEP = {
  子:'둘만의 시간을 꼭 남겨 둬요.',丑:'서두르지 말아요. 당신 사랑은 해를 넘겨야 깊어져요.',
  寅:'떠나고 싶을 땐 말하고 다녀와요. 말 없이 사라지면 끝나요.',卯:'받고 싶은 말을 먼저 알려 줘요. 말 안 하면 몰라요.',
  辰:'다 알려고 하지 말아요. 모르는 구석이 있어야 오래 가요.',巳:'의심이 들면 뒤지지 말고 물어봐요.',
  午:'같이 땀 흘리는 시간을 만들어요. 식었다 싶을 땐 일단 나가요.',未:'챙겨 주고 싶을 때 먼저 챙겨 달라고도 말해요.',
  申:'이기려고 하지 말아요. 틀렸다는 말을 한 번씩은 해요.',酉:'완벽하게 보이려 하지 말아요. 흐트러진 모습도 보여 줘요.',
  戌:'믿는다고 다 주지 말아요. 내 몫을 조금은 남겨 둬요.',亥:'확인은 한 번이면 돼요. 몇 번씩 시험하면 지쳐서 떠나요.'
};
const LAST_WORD = {
  甲:'꺾이지 않는 게 당신 매력이에요. 그래도 좋아하는 사람 앞에선 한 번쯤 휘어져 봐요.',
  乙:'감기는 게 당신 힘이에요. 다만 아무 데나 감기지 말아요. 튼튼한 쪽을 고르세요.',
  丙:'숨기지 말아요. 당신은 환할 때 제일 근사해요. 그늘에 오래 두는 사람이면 떠나도 돼요.',
  丁:'당신 불은 작아도 오래 가요. 바람 부는 사람 곁에 두지 말아요.',
  戊:'다 받아 주지 말아요. 산도 쉴 곳이 필요해요. 기대기만 하는 사람은 내려보내요.',
  己:'받아 주는 게 버릇이 되면 안 돼요. 당신 발자국은 당신이 먼저 남겨요.',
  庚:'날을 조금만 눕혀요. 베려던 게 아니라 지키려던 거잖아요. 그걸 아는 사람이 옆에 있어야 해요.',
  辛:'아무 손에나 안 가요. 잘하고 있어요. 다만 너무 오래 유리 안에 있지는 말아요.',
  壬:'깊은 건 죄가 아니에요. 바닥까지 들어와 볼 사람만 곁에 두세요.',
  癸:'소리 없이 사랑하지 말아요. 젖은 줄도 모르는 사람은 당신 비를 못 알아봐요.'
};
// 마지막 요약 카드에 넣는 짧은 말.
const CARD_ROLE = {bigyeop:'지기 싫은 상대',siksang:'낮은 목소리와 말',jaeseong:'향과 손끝의 감각',gwanseong:'넘으면 안 되는 선',inseong:'다정한 손길'};
const CARD_SPEED = {화:'눈 마주친 순간',목:'매일 조금씩',토:'늦게, 대신 오래',금:'오래 차갑다가 한순간',수:'속에서 천천히'};
const CARD_HONG = {year:'오래 참던 사람이 내 이름을 부를 때',month:'모두 돌아가고 둘만 남았을 때',day:'사랑받고 있다고 믿은 밤',time:'다 내려놓았다고 생각할 때',none:'혼자 잠 못 드는 밤'};
const NOTE_TOP = {甲:'삼나무',乙:'푸른 잎',丙:'오렌지 껍질',丁:'꺼진 초',戊:'마른 돌',己:'젖은 흙',庚:'차가운 쇠',辛:'흰 후추',壬:'밤바다',癸:'새벽 빗물'};
const NOTE_MID = {화:'붉은 장미',목:'무화과 잎',토:'따뜻한 꿀',금:'흰 백합',수:'젖은 재스민'};
const NOTE_BASE = {子:'검은 머스크',丑:'마른 이끼',寅:'호박',卯:'어린 나무',辰:'젖은 가죽',巳:'태운 향나무',午:'달군 앰버',未:'바닐라',申:'실버 머스크',酉:'샌달우드',戌:'연기',亥:'짠 바람'};

function parseChart(q) {
  const pillars = {};
  for (const k of POS) {
    const v = q && q[k];
    if (k === 'time' && !v) { pillars.time = null; continue; }
    if (typeof v !== 'string' || v.length !== 2 || !GAN.includes(v[0]) || !ZHI.includes(v[1])) return null;
    pillars[k] = {gan:v[0], zhi:v[1]};
  }
  return pillars;
}
function parseCounts(s, pillars) {
  const parts = String(s || '').split(',').map(Number);
  if (parts.length === 5 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 8) && parts.some(n => n > 0)) return parts;
  const zhiWx = {子:'수',丑:'토',寅:'목',卯:'목',辰:'토',巳:'화',午:'화',未:'토',申:'금',酉:'금',戌:'토',亥:'수'};
  const out = [0,0,0,0,0];
  for (const k of POS) if (pillars[k]) { out[WX.indexOf(ganWx(pillars[k].gan))]++; out[WX.indexOf(zhiWx[pillars[k].zhi])]++; }
  return out;
}
// 앱이 쓰는 dominantWx·weakestWx와 같은 규칙. 동률이면 목화토금수 순서에서 앞의 것.
function extremes(counts) {
  let dom = 0, weak = 0;
  counts.forEach((n, i) => { if (n > counts[dom]) dom = i; if (n < counts[weak]) weak = i; });
  return {dom:WX[dom], weak:WX[weak]};
}

// 사주에서 읽어 낸 사실만 모은다. 문장은 아래 compose가 조합한다.
function readChart(pillars, counts) {
  const d = pillars.day, marks = {};
  const add = (pos, label) => { (marks[pos] = marks[pos] || []).push(label); };
  const dohwaZhi = DOHWA[d.zhi], hongZhi = HONGYEOM[d.gan];
  const dohwa = ['year','month','time'].filter(k => pillars[k] && pillars[k].zhi === dohwaZhi);
  const hong = POS.filter(k => pillars[k] && pillars[k].zhi === hongZhi);
  dohwa.forEach(k => add(k, '도화'));
  hong.forEach(k => add(k, '홍염'));
  const {dom, weak} = extremes(counts);
  return {dohwa, hong, marks, dom, weak, dayWx:ganWx(d.gan), domRole:role(ganWx(d.gan), dom)};
}
function loverLevel(counts, dayWx, gender) {
  const want = gender === 'm' ? 'jaeseong' : 'gwanseong';
  const n = counts[WX.findIndex(w => role(dayWx, w) === want)];
  return n === 0 ? 'none' : n <= 2 ? 'few' : 'many';
}

function compose(q) {
  const pillars = parseChart(q);
  if (!pillars) return null;
  const gender = q.gender === 'm' ? 'm' : 'f', strength = q.strength === 'strong' ? 'strong' : 'weak';
  const counts = parseCounts(q.wx, pillars), r = readChart(pillars, counts);
  const male = gender === 'm', d = pillars.day, g = DAY_GAN[d.gan];
  const dayName = GAN_KR[d.gan] + r.dayWx + ' 일간', noTime = !pillars.time;
  const dohwaSummary = r.dohwa.length ? '도화 ' + r.dohwa.length + '개' : '도화 없음';
  const hongSummary = r.hong.length ? '홍염 ' + r.hong.length + '개' : '홍염 없음';
  const firstDohwa = r.dohwa[0];

  const intro = [
    cut('w-alley'),
    say('비 오는 밤이에요. 불 켜진 가게가 하나 있어요.', 'soft'),
    {t:'door', img:'c01', ratio:'3/4', alt:'비 오는 밤, 유리문 손잡이를 잡은 내 손과 그 너머의 이안'}
  ];
  const lobby = [
    sfx('딸랑.'),
    cut('c02', '어서 와요.\n기다렸어요.'),
    cut('c06'),
    say('향 맡으러 온 거 아니죠?\n다들 그러면서 들어와요.', 'room'),
    cut('c04', '태어난 날이랑 시간, 적어 봐요.'),
    cut('o-paper'),
    {t:'chart', marks:r.marks, noTime},
    say(dayName + '. ' + dohwaSummary + ', ' + hongSummary + '.', 'room'),
    say('도화는 사람 눈길이 머무는 기운, 홍염은 속에 숨은 불이에요.', 'room'),
    say(r.dohwa.length || r.hong.length ? '이게 당신 비밀이에요.\n남들한테 안 보여 준 쪽이요.' : '둘 다 겉으로 안 드러나 있네요.\n그래서 다들 당신을 잘못 봐요. 그게 당신 비밀이에요.', 'room'),
    cut('c05'),
    say('향을 맡으면 그 자리로 데려다줄게요.\n눈 감아요.', 'room'),
    cut('o-wrist'),
    hold('첫 번째 시향지')
  ];
  const ch1 = [
    head(1, '내 매력', '일간 ' + GAN_KR[d.gan] + r.dayWx),
    cut(male ? 'dress-stool' : 'm-p-glass', '눈 떠요.\n당신을 보는 사람들 자리예요.'),
    say(g[0], 'night'),
    cut('z-chin'),
    big(g[1]),
    cut(male ? 'dress-lean' : 'dress-mirror'),
    say('본인만 몰라요. 그게 제일 위험하고요.', 'night'),
    cut('c07'),
    say('다음은 당신한테 빠지는 사람들 볼까요.', 'night'),
    hold('두 번째 시향지')
  ];
  const dohwaLines = r.dohwa.length ? DOHWA_AT[firstDohwa] : NO_DOHWA;
  const ch2 = [
    head(2, '누가 왜 나에게 빠지는지', r.dohwa.length ? '도화 ' + ZHI_KR[DOHWA[d.zhi]] : '도화 없음'),
    cut('w-ballroom'),
    cut(male ? 'party-laugh' : 'm-w-party', '봐요.\n다들 여기 있는데, 누굴 보고 있는지.'),
    say(dohwaLines[0], 'night'),
    cut(male ? 'c09' : 'z-glass'),
    big(dohwaLines[1])
  ].concat(r.dohwa.length > 1 ? [say('도화가 ' + r.dohwa.length + '개나 있어요. 곁에서 조용할 날이 없었겠네요.', 'night')] : [], [
    cut('o-glass'),
    say(dohwaLines[2], 'night')
  ], dohwaLines[3] ? [say(dohwaLines[3], 'night')] : [], [
    cut('party-glass', '여기까지가 남들이 보는 당신이에요.')
  ]);

  const st = STRENGTH[strength], rl = ROLE[r.domRole], level = loverLevel(counts, r.dayWx, gender);
  const ch3 = [
    head(3, '주도권', strength === 'strong' ? '신강' : '신약'),
    cut(male ? 'lift-lean' : 'm-p-lift', '문 닫혔어요.\n이제 둘뿐이에요.'),
    say(st.title, 'night'),
    cut(male ? 'lift-tug' : 'o-tie'),
    big(st[gender]),
    cut('z-ear'),
    say(st.turn, 'night'),
    ...(male ? [cut('o-tie')] : []),
    say(st.end, 'night'),
    cut('lift-hand'),
    real([['반복되는 모습', STRENGTH_REAL[strength][0]], ['이렇게 해 봐요', STRENGTH_REAL[strength][1]], ['잘 맞는 사람', STRENGTH_MATCH[strength]]]),
    hold('네 번째 시향지')
  ];
  const ch4 = [
    head(4, '유독 약한 것', '십성 ' + {bigyeop:'비겁',siksang:'식상',jaeseong:'재성',gwanseong:'관성',inseong:'인성'}[r.domRole]),
    cut('w-corridor'),
    cut(male ? 'hall' : 'm-w-hall', '이 복도에 있는 방은 전부 당신 약점이에요.', male ? 't' : 'b'),
    say(rl[0], 'night'),
    cut(male ? 'o-heel' : 'm-z-ear'),
    big(rl[1]),
    cut(male ? 'o-strap' : 'm-z-hair'),
    say(rl[2], 'night'),
    cut('hall-heels'),
    say(LOVER[gender][level], 'night'),
    cut('card'),
    say(LOVER_READ[level], 'night'),
    cut('door-back'),
    real([['반복되는 모습', ROLE_REAL[r.domRole][0]], ['조심할 사람', ROLE_REAL[r.domRole][1]], ['이렇게 해 봐요', ROLE_TIP[r.domRole]]]),
    hold('다섯 번째 시향지')
  ];
  const sp = SPEED[r.dom];
  const ch5 = [
    head(5, '달아오르는 속도', '가장 많은 ' + r.dom + ', 가장 적은 ' + r.weak),
    cut('w-pool'),
    cut(male ? 'pool-rise' : 'm-w-pool', '물에 들어와요.\n온도를 재 볼게요.'),
    say(sp[0], 'night'),
    cut(male ? 'pool-splash' : 'z-water'),
    big(sp[1]),
    cut(male ? 'pool' : 'm-z-water'),
    say(sp[2], 'night'),
    ...(male ? [cut('z-water')] : []),
    say(COOL[r.weak], 'night'),
    real([['반복되는 모습', SPEED_REAL[r.dom][0]], ['이럴 때 식어요', SPEED_COOL[r.dom]], ['이렇게 해 봐요', SPEED_REAL[r.dom][1]]]),
    hold('여섯 번째 시향지')
  ];
  const hg = r.hong.length ? HONG_AT[r.hong[0]] : NO_HONG, hgKey = r.hong[0] || 'none';
  const ch6 = [
    head(6, '무너지는 순간', r.hong.length ? '홍염 ' + ZHI_KR[HONGYEOM[d.gan]] : '홍염 없음'),
    cut('w-rain'),
    cut('o-handprint'),
    say(hg[0], 'night'),
    cut(male ? 'wet' : 'm-w-rain'),
    big(hg[1]),
    cut(male ? 'z-wet' : 'm-z-wet'),
    say(hg[2], 'night'),
    cut(male ? 'hand' : 'm-p-window'),
    sfx('…'),
    cut('o-candle'),
    real([['반복되는 모습', HONG_REAL[hgKey][0]], ['버티는 법', HONG_REAL[hgKey][1]], ['곁에 둘 사람', HONG_KEEP[hgKey]]]),
    say('불 꺼지기 전에 하나만 더 보여 줄게요.', 'night'),
    hold('마지막 시향지')
  ];
  const dz = DAY_ZHI[d.zhi];
  const ch7 = [
    head(7, '끝내 원하는 사람', '일지 ' + ZHI_KR[d.zhi]),
    cut('w-rooftop'),
    cut(male ? 'robe-window' : 'm-w-roof', '일지는 배우자 자리예요.\n내 가장 깊은 곳이고요.'),
    say(dz[0], 'night'),
    cut(male ? 'z-robe' : 'robe-window'),
    big(dz[1]),
    cut('o-shadow'),
    say(dz[2], 'night'),
    real([['잡아야 할 사람', DAY_ZHI_REAL[d.zhi][0]], ['놓아야 할 사람', DAY_ZHI_REAL[d.zhi][1]], ['오래 가는 법', DAY_ZHI_KEEP[d.zhi]]]),
    cut(male ? 'morning' : 'm-p-coffee'),
    say('아침이에요.\n여기까지가 당신 비밀이에요.', 'soft'),
    cut(male ? 'robe-bed' : 'm-z-hands'),
    say(LAST_WORD[d.gan], 'night'),
    {t:'card', top:NOTE_TOP[d.gan], mid:NOTE_MID[r.dom], base:NOTE_BASE[d.zhi], rows:[
      ['타고난 모습', g[2]],
      ['주도권', strength === 'strong' ? '내가 이끄는 쪽' : '맡기고 싶은 쪽'],
      ['유독 약한 것', CARD_ROLE[r.domRole]],
      ['달아오르는 속도', CARD_SPEED[r.dom]],
      ['무너지는 순간', CARD_HONG[hgKey]],
      ['끝내 원하는 사람', dz[1].replace(/을 원해요\.$/, '')]
    ]},
    cut('c13', '오늘 들은 건, 우리 둘만 아는 걸로 해요.')
  ];

  return {
    summary:{dayName, dohwa:dohwaSummary, hong:hongSummary},
    free:{intro, sections:[lobby, ch1, ch2]},
    teasers:[
      {title:'3장 주도권', note:(strength === 'strong' ? '신강' : '신약') + ', 연애에서 왜 같은 장면이 반복되는지'},
      {title:'4장 유독 약한 것', note:'유독 못 버티는 사람, 조심해야 할 사람'},
      {title:'5장 달아오르는 속도', note:'언제 달아오르고, 왜 먼저 식는지'},
      {title:'6장 무너지는 순간', note:(r.hong.length ? '홍염이 있는 사주, ' : '홍염이 없는 사주, ') + '내가 무너지는 때와 버티는 법'},
      {title:'7장 끝내 원하는 사람', note:'일지 ' + ZHI_KR[d.zhi] + ', 끝내 원하는 사람과 잡아야 할 사람'}
    ],
    paid:{gate:hold('세 번째 시향지'), sections:[ch3, ch4, ch5, ch6, ch7]}
  };
}

module.exports = {concept, compose, readChart, parseChart, role, loverLevel, DOHWA, HONGYEOM};
