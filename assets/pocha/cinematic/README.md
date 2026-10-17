# 앞으로 뭐 해 먹고 살지? — 20장 이미지

- 이번 콘텐츠에만 사용하는 서도윤: 슬림한 30대 중반 성인 남성, 짙은 웨이브 흑발, 얇은 안경, 검은 셔츠.
- 여성 주인공: 긴 웨이브 갈색 머리, 갈색 눈, 흰 핀스트라이프 셔츠, 네이비 사원증 끈. 외출할 때 베이지 트렌치와 검은 가방.
- 고급 2D K웹툰, 딥 네이비·다크 브라운과 따뜻한 앰버 조명. 직장·진로 고민과 작은 실천에 집중한다.
- 20개 독립 이미지이며 시트를 잘라 만든 이미지가 아니다. 장면 01·04·13은 이전 제작 원본을 재활용했고, 나머지 17장은 내장 imagegen으로 새로 제작했다.
- 신규 이미지: 1536×1024. 재활용 이미지: 1402×1122. 원본 비율을 유지한 WebP(quality 94), 크기와 SHA-256은 `manifest.json`에 기록했다.
- 그림에 대사·사주풀이·설명은 넣지 않는다. `index.html`의 `pochaPlan`과 서버의 `caption_template`을 접근 가능한 HTML로 별도 표시한다.
- 모든 이미지 경로는 `api/_pocha-content.js`의 0-based `sort_order`와 파일의 1-based 번호를 대응시킨다.

| 장면 | 이미지 내용 | 제작 |
|---|---|---|
| 01 | 비 오는 퇴근길 | 기존 재활용 |
| 02 | 채용 공고 앞에서 고민하는 얼굴과 무문자 휴대전화 | 신규 |
| 03 | 골목 끝 포장마차로 향하는 뒷모습, 하이앵글 | 신규 |
| 04 | 포장마차에 앉아 생각하는 주인공 | 기존 재활용 |
| 05 | 물잔에 비친 얼굴과 망설이는 손 | 신규 |
| 06 | 검은 셔츠와 안경을 착용한 서도윤의 옆얼굴 | 신규 |
| 07 | 대화 중 떠올리는 서재와 업무 상담 | 신규 |
| 08 | 오행을 상징하는 무문자 도형과 책 | 신규 |
| 09 | 업무에 집중하는 주인공 | 신규 |
| 10 | 동료들의 칭찬 속 피로 | 신규 |
| 11 | 다섯 방향으로 갈라지는 육교 | 신규 |
| 12 | 집중 공간과 회의 공간의 대비 | 신규 |
| 13 | 쌓인 업무 자료와 지친 표정 | 기존 재활용 |
| 14 | 새 제안을 비교하는 주인공 | 신규 |
| 15 | 스튜디오에서 작은 프로젝트 시도 | 신규 |
| 16 | 가계부·시계·노트북 정물 | 신규 |
| 17 | 서도윤의 차분한 조언 | 신규 |
| 18 | 세 가지 선택 기준을 상징하는 무문자 카드 | 신규 |
| 19 | 일주일의 작은 실험을 마무리하는 모습 | 신규 |
| 20 | 비가 그친 뒤 골목을 떠나는 주인공 | 신규 |

## 제작 프롬프트 기준

각 장면의 요청은 위 표의 독립된 장면 설명 + 다음 공통 조건으로 구성했다. 여성/남성의 기존 원본은 인물 동일성과 그림체 참고용으로 사용했다.

> Use case: illustration-story. ONE independent high-resolution landscape 1536x1024 premium 2D Korean webtoon illustration. Fine clean drawn line art, subtle cel shading, deep navy, dark walnut and warm amber lighting. Same adult Korean woman, age 31, long wavy dark brown hair, brown eyes, white fine pinstripe shirt, navy lanyard; beige trench and black shoulder bag outdoors. Same Seo Doyun, age 36, slim mature intelligent Korean man, dark wavy black hair, thin metal glasses, black collared shirt. Professional career reflection; no romance, flirting, intimate poses or romantic gazes. No captions, dialogue, speech bubbles, text, numerals, lettering, pseudo-writing, watermark or logo. Screens and papers use blank geometric blocks. Single continuous composition, not a multi-panel collage.

## 표시·권한

- 무료 도입: 01–06. 이야기 보유: 01–20. 심층 리포트: 기존 별도 권한 유지.
- 이야기 4,900원 / 심층 리포트 12,900원, 별도 결제 안내와 합계 안내 유지.
- 개인화: 실제 계산 결과의 일간·표면 오행·간이 신강/신약·표면 십신과 기존 서버 템플릿 유지.
- `node --test tests/*.test.js`: 결제 승인 모의 응답을 사용한다. 실거래 결제 검증으로 해석하지 않는다.
