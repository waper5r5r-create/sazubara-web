# SAZUBARA — 독립 웹 배포판

claude.ai Artifact(`https://claude.ai/artifact/HaGiD9QkHwJfVJbo6J6s9V`)로 만들었던 사주바라를,
자체 도메인에서 돌릴 수 있는 일반 웹사이트 형태로 옮긴 버전입니다. UI·콘텐츠·사주 계산 로직은
Artifact 버전과 동일하고, 크레딧 충전 부분만 "실제 결제(토스페이먼츠)"로 바꿨습니다.

## 지금 상태 — 뭐가 진짜고 뭐가 아직 스텁인지

- ✅ 사주풀이 / 오늘의 운세 / 궁합보기 / 챗봇(키워드 기반) — Artifact 버전과 100% 동일하게 동작합니다.
- ✅ 결제 승인(`/api/toss/confirm`)은 서버에서만 처리되고, 실제로 지급할 크레딧 개수도 서버가 토스의
  승인 금액을 직접 확인해서 정합니다(브라우저가 보낸 값을 그대로 믿지 않음). 같은 주문번호로 다시
  호출돼도 Supabase의 unique 제약 때문에 중복 적립되지 않습니다(멱등 처리).
- ✅ 초대 보너스는 "친구가 카카오톡 버튼을 눌렀을 때"가 아니라 "친구가 그 링크로 들어와서 **자기
  사주를 직접 입력**했을 때"만 지급됩니다. 지급·검증 모두 서버(Supabase)에서 처리하고, 같은 사람이
  여러 번 받아가지 못하도록 기기 단위로 1회만 적립됩니다.
- ✅ 마이룸은 이제 "내가 초대해서 실제로 등록한 친구"만 보여줍니다(이전처럼 아무나 내가 직접 입력한다고
  바로 뜨지 않습니다).
- ℹ️ 로그인 계정 시스템은 없습니다. 사람을 식별하는 단위는 "기기(브라우저)"이고(`CREDITS.shareCode`를
  device_id로 사용), 이 식별자 자체는 여전히 브라우저에 저장돼 있어서 브라우저 데이터를 지우면 그
  기기의 크레딧 잔액·초대 내역과의 연결이 끊깁니다. 여러 기기에서 로그인해서 잔액을 동기화하려면
  별도의 회원가입(이메일/소셜 로그인) 기능이 필요합니다 — 지금 구조에서 가장 자연스러운 다음 확장이며,
  Supabase Auth를 그대로 이어서 쓰면 됩니다.

### Supabase 프로젝트

사용 중인 프로젝트: `sazubara` (리전: 서울/ap-northeast-2). 아래 환경변수를 Vercel에 등록해야
결제·초대 기능이 동작합니다 (Vercel 프로젝트 > Settings > Environment Variables):

- `SUPABASE_URL` — Supabase 프로젝트 Settings > API 에서 확인 (`https://<project-ref>.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — 같은 화면의 **service_role** 시크릿 키 (절대 외부 노출 금지 — `anon`/`publishable` 키가 아닙니다)

테이블 구조(`devices`, `credit_ledger`, `invite_redemptions`)는 이미 만들어져 있고, Row Level
Security가 켜져 있어서 이 service_role 키를 가진 서버 코드(`api/*.js`)만 접근할 수 있습니다.

## 1. 배포하기 — GitHub + Vercel (한 번만 연결하면 이후 자동 업데이트)

원하신 "코드를 고치면 사이트가 자동으로 반영되는" 방식은 **GitHub + Vercel 조합**으로 됩니다.
사이트를 새로 만들거나 수동으로 재배포할 필요가 없고, 도메인/링크도 그대로 유지됩니다.

1. 이 폴더로 깃 저장소를 만들고 GitHub에 올립니다.
   ```bash
   cd sazubara-web
   git init
   git add .
   git commit -m "init: SAZUBARA standalone web"
   # GitHub에서 새 저장소(예: sazubara-web)를 만든 뒤
   git remote add origin https://github.com/<your-id>/sazubara-web.git
   git branch -M main
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) 에 GitHub 계정으로 가입 → "Add New Project" → 방금 올린
   `sazubara-web` 저장소 선택 → Framework Preset은 **Other** 선택 → Deploy.
3. 끝입니다. 이제 `main` 브랜치에 새 커밋을 push할 때마다 Vercel이 자동으로 재배포합니다.
   (제가 코드를 수정해서 보내드리면, 그 파일을 같은 저장소에 커밋 → push만 하면 몇십 초 안에
   실제 사이트에 반영됩니다. 사이트 주소도 그대로 유지돼요.)
4. Vercel이 기본으로 주는 `sazubara-web.vercel.app` 같은 주소 대신 실제 구매한 도메인을 쓰려면
   Vercel 프로젝트 > Settings > Domains 에서 도메인을 연결하면 됩니다 (네임서버 또는 CNAME 설정 1회).

## 2. 결제(크레딧 충전) 연동 켜기 — 사업자등록 없이 지금 바로 테스트 가능

토스페이먼츠는 **가입만 하면 테스트 키를 바로 내려줍니다** (사업자등록 불필요). 실제 돈이 오가는
"라이브 키"는 가맹심사를 통과해야 나옵니다. 그래서 지금 당장은 테스트 키로 결제 흐름 전체를
끝까지 확인할 수 있고, 나중에 사업자등록이 끝나면 **환경변수 2개만 교체**하면 됩니다(코드 수정 없음).

1. [토스페이먼츠 개발자센터](https://developers.tosspayments.com) 가입 → 테스트 상점 자동 생성 →
   "API 개별 연동 키"에서 테스트용 **클라이언트 키(`test_ck_...`)**와 **시크릿 키(`test_sk_...`)**를 복사.
2. Vercel 프로젝트 > Settings > Environment Variables 에 추가:
   - `TOSS_CLIENT_KEY` = `test_ck_...`
   - `TOSS_SECRET_KEY` = `test_sk_...`
3. 재배포(또는 다음 push 때 자동 반영) 후, 크레딧 충전 버튼을 누르면 토스 결제창이 뜨고 테스트
   카드번호로 결제 흐름을 끝까지(승인 → 크레딧 적립) 확인할 수 있습니다.
   - 테스트 카드번호 등은 [토스페이먼츠 테스트 가이드](https://docs.tosspayments.com/guides/test)에 안내돼 있습니다.

로컬 컴퓨터에서 먼저 확인하고 싶다면:
```bash
npm i -g vercel
vercel dev
```
그 다음 `.env.example`을 참고해서 `.env.local` 파일을 만들고 테스트 키를 넣으면 로컬에서도
결제창까지 동일하게 테스트할 수 있습니다.

## 3. 실제로 "돈 받는" 서비스로 열기 전 체크리스트

사주/운세 콘텐츠를 유료로 판매하는 것 자체는 문제없지만, 전자상거래법상 아래 절차가 필요합니다.
순서대로 진행하시면 됩니다 (전부 본인이 직접 해야 하는 행정 절차라, 제가 대신 처리할 수는 없어요).

1. **사업자등록** — 홈택스(hometax.go.kr)에서 온라인으로 당일 처리 가능, 무료.
   (개인사업자 간이과세자로도 시작 가능 — 세무사와 한 번 상담 추천)
2. **통신판매업 신고** — 정부24(gov.kr)에서 신청. 사업자등록증 + (결제대행사와의 계약 확인 서류)가
   필요한 경우가 많아서, 보통 1번 → 토스페이먼츠 가맹 신청과 병행 → 2번 순서로 진행합니다.
   (직전연도 거래 50회 미만 등 일부 면제 조건이 있으니, 정확한 대상 여부는 관할 구청/세무사에 확인하세요)
3. **토스페이먼츠 라이브 가맹 심사 신청** — 사업자등록증, 통신판매업 신고증, 서비스 소개 자료 제출.
   심사 통과하면 라이브 키(`live_ck_...`, `live_sk_...`)가 발급됩니다.
4. Vercel 환경변수의 `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY`를 라이브 키로 교체 → 재배포.
   (이 순간부터 실제 결제가 발생합니다. 코드 변경은 필요 없습니다.)
5. **이용약관 / 개인정보처리방침 / 환불(청약철회) 정책** 페이지를 만들어 사이트에 링크해두세요.
   디지털 콘텐츠(크레딧) 특성상 "콘텐츠를 사용하기 시작하면 환불이 제한될 수 있다"는 내용을
   명확히 고지해야 분쟁을 줄일 수 있습니다 (콘텐츠산업진흥법 관련 조항 — 세무사/법률 상담 권장).
6. ~~크레딧 지급을 서버 DB로 옮기기~~ — 완료. `api/toss/confirm.js`가 Supabase의 `credit_ledger`에
   직접 기록하고, 지급할 크레딧 개수도 서버가 토스 승인 금액으로 직접 계산합니다.

## 4. PG(결제대행사)를 토스페이먼츠로 고른 이유

개인/소규모 사업자도 가입·심사가 비교적 쉽고, 문서와 테스트 환경이 잘 갖춰져 있어서 1인 개발
서비스에서 가장 많이 쓰입니다. 나중에 카카오페이·네이버페이 등을 더 붙이고 싶으면, 토스페이먼츠
결제창 안에서 대부분 함께 지원되거나, 포트원(아이엠포트)으로 바꿔서 여러 PG를 한 번에 묶어
관리할 수도 있습니다.

## 폴더 구조

```
index.html             메인 앱 (Artifact 버전과 동일한 UI/로직 + 실결제·초대 연동)
success.html           결제 성공 리다이렉트 처리 페이지
fail.html              결제 실패/취소 페이지
api/_supabase.js       Supabase REST(PostgREST) 호출 공용 헬퍼 (서버 전용, 시크릿 키 보관)
api/config.js          토스 클라이언트 키를 내려주는 공개 엔드포인트
api/toss/confirm.js    결제 승인 + 크레딧 적립(Supabase) — 지급액은 서버가 직접 계산
api/invite/redeem.js   초대받은 사람이 사주를 등록했을 때, 초대한 사람에게 보너스 적립
api/invite/list.js     내가 초대해서 등록된 친구 목록 (마이룸용)
api/credits/pull.js    이 기기에 쌓인 새 크레딧 장부를 가져오는 엔드포인트
.env.example           필요한 환경변수 샘플 (Toss + Supabase)
```
