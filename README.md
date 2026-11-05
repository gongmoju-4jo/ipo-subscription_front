# ipo-subscription-front

공모주 청약 서비스(`ipo-subscription`)의 웹 프론트. React + TypeScript + Vite.

## 빠른 실행 (로컬)

백엔드를 먼저 띄우고, 프론트를 띄우면 따로 설정 없이 연결된다.

```bash
# 1) 백엔드 — ipo-subscription 폴더
./gradlew build -x test
docker-compose up -d --build api-gateway account-service subscription-service allocation-service
docker-compose ps      # 서비스가 모두 healthy가 될 때까지 (1~2분)

# 2) 프론트 — 이 폴더 (npm install은 처음 한 번)
npm install
npm run dev            # http://localhost:5173
```

- 필요: Node(24에서 확인), JDK 21, Docker. 백엔드 `.env`(DB 비밀번호, `JWT_SECRET`)는 백엔드 레포의 `docs/PROJECT_SETUP.md` "빠른 시작"대로 먼저 만든다.
- 백엔드 서비스를 IntelliJ로 띄워도 된다. 게이트웨이가 `8080`이면 같다.
- 브라우저는 `http://localhost:5173`만 본다. 개발 서버가 `/api` 요청을 게이트웨이(`http://localhost:8080`)로 넘기므로 같은 출처가 되어 **백엔드에 CORS 설정이 필요 없고, 백엔드 코드를 고칠 일도 없다.**
- 게이트웨이 주소가 다르면 `.env`에 `VITE_PROXY_TARGET`을 적는다 (`.env.example` 참고).

```
브라우저 ──► vite :5173 ──(/api 프록시)──► api-gateway :8080 ──► account / subscription / allocation
```

### 연결 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/unknown   # 401 이면 게이트웨이 정상
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/v1/ipos      # 401 이면 프록시까지 정상 (토큰이 없어서)
```

### 처음 써보는 순서

1. 회원가입 → 로그인
2. 계좌 메뉴에서 계좌 개설 → 입금
3. 공모주 목록에서 "청약 중" 종목 선택 → 계좌와 수량을 정해 청약
4. 몇 초 뒤 "확정"이 되면 내 청약에서 상태를 본다 (배정은 청약 마감 후에 자동으로 진행된다)

### 막힐 때

| 증상 | 확인 |
| --- | --- |
| 화면은 뜨는데 API 호출이 모두 실패 | 게이트웨이가 떠 있는지(`docker-compose ps`, 위 연결 확인) |
| 게이트웨이를 켠 직후 첫 요청이 503 | 서비스가 Eureka에 등록되는 데 최대 30초 걸린다. 잠시 뒤 새로고침 |
| 로그인했는데 곧 로그인 화면으로 돌아감 | 토큰 만료(1시간)이거나, 백엔드를 다시 띄우며 DB를 초기화해 회원이 없어진 경우. 다시 로그인(또는 가입) |
| 청약 중인 종목이 없다 | 공모주 시드는 DB를 처음 만든 날 기준으로 일정이 정해진다. 날짜가 지나 모두 마감됐으면 백엔드 `docs/PROJECT_SETUP.md` 10장의 PostgreSQL 볼륨 초기화(DB 데이터가 지워진다)가 필요하다 |
| `5173` 포트 사용 중 | vite가 `5174` 등으로 올라간다. 프록시는 똑같이 동작한다 |
| 글꼴이 시스템 글꼴로 보임 | 글꼴(Wanted Sans)은 CDN에서 받는다. 인터넷이 막혀 있으면 대체 글꼴로 표시된다 |

## 명령

| 명령 | 내용 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 프로덕션 빌드 (`dist/`) |
| `npm run typecheck` | 타입 검사만 |
| `npm test` | 단위, 화면 테스트 |

## 구조

```
src/
├── api/        client.ts(요청, 오류 처리), endpoints.ts(API 함수), types.ts(응답 타입)
├── auth/       AuthContext.tsx(로그인 세션, 401 처리), session.ts(세션 저장소)
├── lib/        requestId(멱등 ID), domain(상태·계산), format(표시), pagination,
│               useMediaQuery, usePointerEffects, useIndicator, useSingleFlight, useNow
├── components/ Layout(상단 메뉴, 모바일 하단 탭), Seg(슬라이딩 탭), Sheet(하단 시트), Toast,
│               Num(카운트업), Pagination, Chips, QueryState, Icons
└── pages/      AuthPage, AccountsPage, IpoListPage, IpoDetailPage, SubscriptionsPage
```

- 서버 데이터는 TanStack Query로 캐시하고, 로그인 세션만 React Context에 둔다.
- 용어와 상태값은 백엔드 `UBIQUITOUS_LANGUAGE.md`의 코드명을 그대로 쓴다.
- API 명세와 구현을 하나씩 맞춘 내용은 [docs/API-명세-대조.md](./docs/API-명세-대조.md).

## 화면 동작

- 반응형은 CSS 줄바꿈이 아니라 화면 크기에 따라 구성을 바꾼다 (`useMediaQuery`, 기준 960px, 720px).
  - 960px 이하: 종목 상세의 청약 입력이 옆 패널에서 하단 청약 바 + 하단 시트로 바뀐다. 내 청약은 목록 → 상세로 화면을 오간다.
  - 720px 이하: 상단 메뉴가 하단 탭 바로 바뀐다. 요약 카드와 계좌 카드는 옆으로 밀어 넘긴다. 일정은 세로로 놓인다.
- 커서 반응은 한 곳에서 처리한다 (`usePointerEffects`): 카드 위에서 커서를 따라가는 빛(`data-spot`), 주요 버튼이 살짝 끌려오는 효과(`data-magnetic`). 터치 기기와 "동작 줄이기" 설정에서는 꺼진다.
- 글꼴은 Wanted Sans Variable(CDN)이다. 금액은 같은 폭 숫자(`tabular-nums`)로 맞춘다.

## Docker (로컬 확인용)

`Dockerfile`, `nginx/`, `docker-compose.yml`은 빌드한 프론트를 nginx로 서빙하면서 `/api`를 게이트웨이로 넘겨 보는 **로컬 확인용**이다. 배포 방식은 아직 정하지 않았다.

```bash
docker compose up -d --build   # http://localhost:8088
```

게이트웨이 주소는 기본값 `http://host.docker.internal:8080`이다. 다르면 `.env`에 `GATEWAY_URL`을 적는다.
