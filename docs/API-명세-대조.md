# API 명세 대조

프론트가 API 명세 v1.1(3장 외부 API)을 어떻게 구현했는지 엔드포인트별로 정리한다. 응답 필드 이름은 백엔드 `presentation` 계층의 DTO와도 맞춰 보았다.

- 호출 코드: `src/api/endpoints.ts`, 공통 요청·오류 처리: `src/api/client.ts`, 응답 타입: `src/api/types.ts`
- 모든 요청은 `/api` 상대 경로로 보낸다. 개발에서는 vite가, 그 외에는 같은 출처의 프록시가 게이트웨이로 넘긴다.

## 0. 공통 규칙 (명세 1장)

| 명세 | 구현 |
| --- | --- |
| 1.1 `Authorization: Bearer <accessToken>`, `Content-Type: application/json` | `client.ts`가 토큰이 있고 `auth`가 켜진 요청에 `Authorization`을 붙이고, 본문이 있으면 `Content-Type`을 넣는다. 회원가입·로그인은 `auth: false`로 토큰을 보내지 않는다 |
| 1.1 `X-User-Id`, `X-User-Role`, `X-Request-Received-At`는 게이트웨이가 설정 | 프론트는 이 헤더를 보내지 않는다 (보내도 게이트웨이가 지운다) |
| 1.3 성공 응답 `success`, `data`, `message` | `request()`가 `data`와 `message`, HTTP 상태를 `ApiResult`로 돌려준다. 201/200 구분이 필요한 API가 있어 상태 코드도 함께 넘긴다 |
| 1.4 목록 `items`, `page`, `size`, `totalElements`, `totalPages` | `PageResponse<T>` 타입. 화면에는 `items`와 `totalElements`를 쓴다 |
| 1.5 오류 `error.code`, `message`, `details[{field, reason}]` | `ApiError`(status, code, message, details). 화면에는 서버가 준 `message`를 그대로 보여 주고, 폼 필드는 `details`의 `field`로 해당 입력 아래에 표시한다 |
| 1.6 401 `UNAUTHORIZED`, `TOKEN_EXPIRED` | 토큰이 필요한 요청에서 401을 받으면 세션을 지우고 로그인 화면으로 보낸다. `TOKEN_EXPIRED`면 "로그인이 만료됐습니다", 그 외는 "로그인이 필요합니다"를 보여 준다 |
| 1.6 404는 "없음" 또는 "본인 것이 아님" | 두 경우를 구분하지 않고 "찾을 수 없음"으로 안내한다 |
| 1.6 5xx, 502, 503 | 서버 메시지가 있으면 그대로, 응답 본문이 JSON이 아니면 "요청을 처리하지 못했습니다."를 보여 준다 |
| 응답을 받지 못함 (명세 밖) | 10초 타임아웃. `status 0`, `NETWORK_ERROR`로 만들어 5xx와 같이 "다시 시도해도 되는 실패"로 본다 |

### requestId (멱등 요청 ID)

`requestId`는 계좌 개설, 가상 입금, 청약 신청 세 곳에서 필수이고, 프론트가 UUID로 만들어 보낸다.

- 생성: `src/lib/requestId.ts`. `crypto.randomUUID()`는 HTTPS나 localhost에서만 있어서, 배포 주소(HTTP)에서도 되도록 `crypto.getRandomValues()`로 UUID v4를 직접 만든다. 서버의 UUID 형식 검증 패턴을 통과하는지 단위 테스트로 확인했다.
- 재사용 규칙: `src/lib/useRequestId.ts`. 요청 내용(청약은 종목·계좌·수량, 입금은 계좌·금액)이 같으면 같은 `requestId`를 쓰고, 내용이 바뀌면 새로 만든다. 연타·타임아웃·5xx 뒤 재전송은 같은 값이 나가 서버가 한 번만 반영한다. 같은 `requestId`에 다른 내용을 보내면 서버가 충돌(409)로 처리하기 때문이다.
- 성공하면 새 값으로 바꾼다.

## 1. 인증 (3.1)

### `POST /api/v1/users` 회원가입 — `AuthPage.tsx`

| 명세 | 구현 |
| --- | --- |
| `loginId` 4~20자, 영문 소문자·숫자 | 정규식 `^[a-z0-9]{4,20}$`로 입력 중에 검사, 맞을 때만 가입 버튼 활성화 |
| `password` 8~20자 | 길이 검사 |
| `name` 1~20자 | 공백만 입력 불가, 20자 초과 불가 |
| `role`은 받지 않음 | 보내지 않음 |
| 201, 계좌는 자동 생성하지 않음 | 가입 성공 후 로그인 탭으로 전환, 로그인 ID를 채워 둔다 |
| 400 `VALIDATION_ERROR` (details에 필드별 사유) | `details`의 `field`별로 해당 입력 아래에 표시 |
| 409 `DUPLICATE_RESOURCE` | 로그인 ID 입력 아래에 "이미 사용 중인 로그인 ID입니다." |

### `POST /api/v1/auth/login` 로그인 — `AuthPage.tsx`, `AuthContext.tsx`

| 명세 | 구현 |
| --- | --- |
| `loginId`, `password` 필수 | 둘 다 있어야 버튼 활성화 |
| 응답 `accessToken`, `tokenType`, `expiresIn`(3600초) | `accessToken`을 세션에 저장, `expiresIn`으로 만료 시각을 계산해 그 시각에 자동 로그아웃 |
| 401 `INVALID_CREDENTIALS` (ID 없음과 비밀번호 불일치를 구분하지 않음) | 서버 메시지를 폼 위에 표시. 로그인 요청은 토큰 없이 보내므로 이 401이 "세션 만료"로 처리되지 않는다 |

저장 위치는 명세에 없어서 `sessionStorage`로 정했다(탭을 닫으면 사라짐). 토큰은 React 상태가 아니라 요청마다 이 저장소에서 읽는다. 새로고침 직후 화면이 그리는 첫 요청에도 토큰이 붙어야 하기 때문이다. 로그아웃하거나 401을 받으면 조회 캐시도 비워 이전 사용자의 계좌·청약이 남지 않게 한다.

## 2. 계좌 (3.2) — `AccountsPage.tsx`

| API | 명세 | 구현 |
| --- | --- | --- |
| `POST /accounts` 계좌 개설 | `requestId` 필수. 201 신규, 200 같은 `requestId` 재요청 (본문 동일) | `requestId`를 만들어 보내고, 상태가 200이면 "이미 개설된 계좌입니다", 201이면 "개설했습니다"로 안내. 개설 후 목록을 다시 불러온다 |
| | 409 `DUPLICATE_RESOURCE` (다른 사용자가 쓴 `requestId`) | 서버 메시지 표시 |
| `GET /accounts` 내 계좌 목록 | `page`, `size`(최대 100), 정렬 `createdAt DESC`(다른 `sort`는 400) | `page=0&size=100`으로 호출, `sort`는 보내지 않음. `accountNumber`(12자리)를 4자리씩 띄워 표시 |
| `GET /accounts/{accountId}` 상세 | `cashBalance`, `marginBalance` | **함수(`getAccount`)만 있고 화면에서는 쓰지 않는다.** 잔고는 목록 응답으로 충분해서 |
| `POST /accounts/{accountId}/deposits` 가상 입금 | `requestId` 필수, `amount`는 1 이상의 정수, 1회 상한 미정 | 1 이상의 안전한 정수만 허용(쉼표 제거 후 검사). 상한은 명세에 없어 두지 않았다 |
| | 201 신규, 200 같은 `requestId` 재요청 | 200이면 "이미 처리된 입금입니다"로 안내 |
| | 409 `DUPLICATE_RESOURCE` (같은 `requestId`에 다른 `amount`나 계좌) | "같은 요청 ID로 다른 금액이나 계좌가 전송됐습니다. 금액을 다시 입력해 주세요." |
| | 응답 `cashBalance`, `marginBalance` | 입금 안내 문구에 입금 후 예수금 표시, 계좌 목록 갱신 |

예수금(`cashBalance`)과 청약증거금(`marginBalance`)은 유비쿼터스 언어의 이름과 뜻 그대로 쓴다. 합계는 두 값을 더해 화면에서 계산한다(별도 필드 아님).

## 3. 공모주 (3.3)

### `GET /api/v1/ipos` 목록 — `IpoListPage.tsx`

| 명세 | 구현 |
| --- | --- |
| `page`, `size`(최대 100). 상태로 거르는 파라미터는 없음 | 탭 필터와 요약 건수를 정확히 하려고 `size=100`으로 `totalPages`까지 모두 받는다(최대 10쪽, 1,000건). 같은 종목이 두 번 오면 한 번만 둔다. 화면에서는 20건씩 나눠 페이지 이동을 보여 주고, 쪽 번호(`?page=`, 1부터)와 선택한 상태 탭(`?status=`)을 모두 주소에 둔다. 새로고침과 뒤로 가기에서도 유지된다 |
| 응답 `ipoId`, `name`, `offerPrice`, `retailQuantity`, `subscriptionStartAt`, `subscriptionEndAt`, `status` | 모두 표에 사용 |
| `status`는 `OPEN`, `CLOSED`, `ALLOCATED` | 화면에 쓰는 "청약 예정 / 청약 중 / 마감 / 배정 완료"는 서버 상태에 청약 기간을 함께 본 값(`lib/domain.ts`의 `ipoPhase`) |
| "`OPEN`이라도 시작 전이거나 마감 시각이 지나면 청약 불가" | `OPEN`이고 `now < 시작`이면 청약 예정, `now >= 마감`이면 마감. 청약 가능은 `시작 <= now < 마감` (명세 3.4와 같은 경계) |
| 실시간 경쟁률은 MVP 제외 | 표시하지 않음 |
| 공모주가 없으면 `items`는 빈 배열 | "해당 상태의 공모주가 없습니다." |

상단 요약 띠의 건수(청약 중, 오늘 마감, 청약 예정)는 받은 목록에서 세고, 예수금·청약증거금은 계좌 목록 합계다. 새로운 서버 필드를 쓰지 않는다.

### `GET /api/v1/ipos/{ipoId}` 상세 — `IpoDetailPage.tsx`

| 명세 | 구현 |
| --- | --- |
| 응답 `equalQuantity`, `minQuantity`, `maxQuantity`, `marginRate`, `refundDate` | 모두 사용. 증거금률은 `marginRate x 100`(%)로 표시 |
| `refundDate`는 화면 표시용 | 날짜만 있는 값이라 한국 시간 자정으로 보고 "11.06 (금)" 형식으로 표시 |
| 필요 증거금 = 청약 수량 x 공모가 x 증거금률 | `requiredMargin()`이 같은 식으로 계산 (원 단위 정수로 반올림) |
| 400 (UUID 형식 오류), 404 | 경로의 ID가 UUID가 아니면 요청 없이 안내, 404는 서버 메시지 표시 |

## 4. 청약 (3.4)

### `POST /api/v1/subscriptions` 청약 신청 — `IpoDetailPage.tsx`

| 명세 | 구현 |
| --- | --- |
| 본문 `requestId`, `ipoId`, `accountId`, `requestedQuantity` | 그대로 전송. `userId`, `receivedAt`은 보내지 않는다 (게이트웨이가 채움) |
| 수량은 최소~한도 범위 | `minQuantity`~`maxQuantity` 밖이면 버튼 비활성화와 안내. 최종 판정은 서버(400) |
| 예수금 | 필요 증거금이 선택한 계좌의 예수금을 넘으면 "예수금이 N원 부족합니다"와 입금 화면 링크를 보여 주고 버튼을 막는다. 서버 판정(`INSUFFICIENT_BALANCE`)은 접수 뒤 비동기 결과로 따로 받는다 |
| 202 `ACCEPTED`는 접수일 뿐 확정이 아님 | 접수 패널을 보여 주고 "증거금 인출 중…"으로 시작, 확정·거절은 아래 조회로 반영 |
| 같은 `requestId` 재요청은 같은 `subscriptionId` | 화면의 재시도가 같은 `requestId`를 쓰므로 중복 접수되지 않는다. 5xx·네트워크 오류 안내에 그 사실을 적는다 |
| 오류 400, 401, 404, 409 `INVALID_STATUS_TRANSITION`, 422 `SUBSCRIPTION_CLOSED`, 500 | 서버 `message`를 폼 아래에 표시(`requestedQuantity` 필드 오류는 그 사유 우선) |

### 접수 직후 상태 확인 (`GET /api/v1/subscriptions/{subscriptionId}`)

명세: 202 직후에는 아직 DB에 청약이 없어 404일 수 있고, 클라이언트는 이를 최종 거절로 보지 않고 일정 간격으로 다시 조회한다.

- 202에서 받은 `subscriptionId`로 1.5초마다 조회한다. 응답의 `statusUrl` 문자열은 쓰지 않고 같은 경로를 직접 만든다.
- 404는 "아직 저장 전"으로 보고 계속 조회, `PENDING`도 계속 조회, `CONFIRMED`·`REJECTED`·`CANCELLED`가 되면 멈춘다.
- 거절이면 `rejectReason`, 취소면 `cancelReason`을 한국어로 보여 준다. 결과가 정해지면 계좌와 청약 목록을 다시 불러온다.
- **조회 횟수 상한 40회(약 60초)는 명세에 없어 임의로 정한 값이다.** 넘으면 폴링을 멈추고 "내 청약에서 확인해 주세요"로 안내한다.

### `GET /api/v1/subscriptions` 내 청약 목록 — `SubscriptionsPage.tsx`

| 명세 | 구현 |
| --- | --- |
| `page`(0부터), `size`(최대 100), 정렬 `createdAt DESC` | 서버 페이지네이션을 그대로 쓴다. `size=20`, 주소의 `?page=`(1부터)에서 1을 빼 `page`로 보낸다. 범위를 넘은 쪽은 서버가 200과 빈 목록을 주므로(확인함) 마지막 쪽으로 맞춘다. 서버 정렬 그대로 |
| 응답 `subscriptionId`, `ipoId`, `ipoName`, `accountId`, `requestedQuantity`, `marginAmount`, `status`, `receivedAt`, `confirmedAt` | 목록 행에 종목명, 상태, 수량, 증거금, 접수 시각 표시 |
| `REJECTED`, `CANCELLED`도 포함 | 그대로 표시 |
| 접수 직후에는 목록에 없을 수 있음 | 접수 패널에서 결과가 정해질 때 목록을 다시 불러온다 |
| 내역이 없으면 빈 배열 | "아직 청약 내역이 없습니다." |

### `GET /api/v1/subscriptions/{subscriptionId}` 상세 — `SubscriptionsPage.tsx`

| 명세 | 구현 |
| --- | --- |
| 상태 `PENDING`, `CONFIRMED`, `REJECTED`, `COMPENSATING`, `CANCEL_REQUESTED`, `CANCELLED`, `ALLOCATED`, `REFUNDED` | 8개 모두 한국어 이름(접수됨, 확정, 거절, 보상 중, 취소 요청, 취소됨, 배정 완료, 환불 완료)과 색으로 표시. 이름은 유비쿼터스 언어와 같다 |
| `rejectReason` `ALREADY_SUBSCRIBED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_NOT_FOUND` | 각각 "이미 청약한 종목 (이중청약)", "예수금 부족", "계좌를 찾을 수 없음". 거절은 돈이 움직이기 전이라 빠져나간 돈이 없다고 안내하고, 다음 행동은 사유별로 다르다: 이중청약은 먼저 청약한 건이 유효하다고만 안내(다시 청약 링크 없음), 예수금 부족은 입금과 다시 청약 링크, 계좌 없음은 다시 청약 링크. 거절 건은 증거금이 인출되지 않았으므로 목록에는 수량만, 상세에는 "필요 증거금 (인출되지 않음)"으로 표시한다 |
| `cancelReason` `CONFIRM_FAILED`, `TIMEOUT`, `USER_CANCEL` | 각각 확정 실패, 처리 시간 초과, 투자자 취소로 증거금 반환됐다고 안내 |
| `allocatedQuantity`, `allocatedAmount`, `refundAmount`는 배정·정산 전 null | null이면 표시하지 않는다. 환불액이 null이고 배정 대금이 있으면 "정산 중" |
| `receivedAt`, `confirmedAt` (+09:00) | 한국 시간으로 표시. 배정·환불 단계는 시각 필드가 없어 "완료"만 표시 |
| 진행 중 상태 | `PENDING`, `COMPENSATING`, `CANCEL_REQUESTED`이면 3초마다 다시 조회 |
| 404 (없음 또는 본인 것이 아님) | "청약 내역을 찾을 수 없습니다" |

### `POST /api/v1/subscriptions/{subscriptionId}/cancel` 청약 취소 (SHOULD)

**구현하지 않았다.** 취소 버튼도 없다. 상태값 `CANCEL_REQUESTED`와 취소 사유 `USER_CANCEL`은 서버가 내려줄 때 표시만 한다.

## 5. 배정 (3.5)

### `GET /api/v1/allocations/subscriptions/{subscriptionId}` — `SubscriptionsPage.tsx`

| 명세 | 구현 |
| --- | --- |
| 균등·비례 수량은 이 API에서만 확인 | 청약 상태가 `ALLOCATED` 또는 `REFUNDED`일 때만 호출해 균등/비례 수량을 보여 준다 |
| 환불액은 여기서 주지 않고 청약 상세의 `refundAmount` | 환불액은 청약 상세 값을 쓴다 |
| 응답 `status` `RUNNING` / `DONE`, 진행 중이면 수량 필드 없음 | 타입은 `status`와 수량을 optional로 두었고, 수량이 있을 때만 균등/비례를 표시한다 |
| 404 (배정 시작 전, 배정 대상 아님, 본인 것이 아님) | 호출하지 않는 상태가 대부분이고, 호출해서 실패해도 청약 상세의 합계(배정 수량, 대금, 환불액)는 그대로 보여 준다 |

**명세와 백엔드 코드의 차이:** 명세 v1.1은 배정 진행 중에 `status: "RUNNING"` 응답을 준다고 하지만, 현재 `AllocationResponse`에는 `status` 필드가 없고 배정이 끝나기 전에는 404를 준다(`AllocationService`의 주석과 예외). 프론트는 둘 다 처리하지만, 어느 쪽이 맞는지는 배정 담당과 확인이 필요하다.

## 6. 구현하지 않은 API

| 명세 | 이유 |
| --- | --- |
| 3.2 `GET /accounts/{accountId}/ledger-entries` 거래내역 | 이번 화면 범위에 없음 (시안에도 없음) |
| 3.4 `POST .../cancel` 청약 취소 (SHOULD) | 위 참고 |
| 3.6 `POST /admin/ipos` 공모주 등록 (SHOULD, 관리자) | 일반 투자자 화면만 만듦 |
| 4장 내부 API (`/internal/**`), 5장 Kafka 이벤트 | 프론트가 쓰는 API가 아님 |

## 7. 명세에 없어서 프론트가 정한 것

| 항목 | 정한 값 | 이유 |
| --- | --- | --- |
| 토큰 저장 위치 | `sessionStorage` | 탭을 닫으면 사라지게 |
| 로그인한 사용자 표시 | 로그인 때 입력한 `loginId` | 내 정보 조회 API가 없음 |
| "마감까지", "오늘 마감" 계산 | 브라우저 시계 | 서버 시각을 주는 API가 없음. 서버의 마감 판단은 게이트웨이 도착 시각 기준이라 몇 초 차이가 날 수 있고, 최종 판정은 서버(422 `SUBSCRIPTION_CLOSED`) |
| 목록 크기 | 계좌: 100건까지. 공모주: 서버에서 최대 1,000건을 받아 화면 20건씩. 청약: 서버 20건씩 | 계좌는 페이지 UI가 없어 100개를 넘으면 나머지가 보이지 않는다(청약 화면의 계좌 선택도 같다). 공모주가 1,000건을 넘으면 최신 1,000건만 불러오고 안내 문구를 보여 준다 |
| 접수 직후 폴링 | 1.5초 간격, 최대 40회 | 위 참고 |
| 청약 상세 폴링 | 3초 간격 | 처리 중인 상태에서만 |
| 요청 타임아웃 | 10초 | 응답이 없을 때 같은 `requestId`로 다시 시도할 수 있게 |

## 8. 검증한 것과 못 한 것

- 한 것
  - 타입 검사(`tsc`), 테스트 34개, 프로덕션 빌드. 테스트는 화면 크기에 따른 구성 변경(좁은 화면의 하단 시트와 목록 → 상세 이동), 그 외에 `requestId` 생성과 형식, 청약 가능 시간 경계, 필요 증거금 계산, 단계 계산, 남은 시간 표시, 페이지 번호 계산과 페이지 이동 마크업, 요청의 토큰 처리(새로고침 직후 첫 요청, 만료, 공개 경로, 401 처리), 더블클릭 중복 실행 방지, 공모주 목록 화면의 쪽·필터 주소 동작(실제 라우터 사용)을 다룬다.
  - 실제 백엔드(게이트웨이, 서비스 3개, Kafka, PostgreSQL)를 띄우고 프론트 개발 서버의 프록시를 거쳐 화면과 같은 순서로 요청을 보냈다: 가입·로그인, 계좌 개설과 입금(같은 `requestId` 재전송, 다른 금액 충돌), 청약 접수와 `PENDING` → `CONFIRMED`, 이중청약 거절(`ALREADY_SUBSCRIBED`), 배정 전 404, 공모주 224건을 100건씩 모두 받기, 범위를 넘은 쪽과 잘못된 `page`·`size` 응답. 응답 상태 코드와 오류 `details`의 `field` 이름이 이 문서의 구현과 맞았다.
- 브라우저(Chrome)로 누른 확인: 가입·로그인·계좌·입금(더블클릭 포함)·공모주 목록(요약, 12쪽 이동)·상세·청약·내 청약·390px 폭·콘솔 오류 없음. **이 확인 뒤에 코드를 바꿨으므로** 새로고침 뒤 로그인 유지, 마지막 쪽에서 필터 전환, 거절 안내, 입금 중복 안내는 위 테스트로만 확인했고 브라우저에서 다시 눌러 보지는 않았다.
- 못 한 것: 실제 창 크기 변경으로 본 반응형(390px은 iframe으로 대신 확인됨), 5개 화면 전체의 글꼴·겹침 확인, 마감 시각에 도달하는 순간의 동작. 배정이 끝난 청약(`ALLOCATED`, `REFUNDED`)의 화면과 균등·비례 수량 조회도 실제 데이터로는 확인하지 못했다(테스트 시점에 마감된 청약이 없었다).
