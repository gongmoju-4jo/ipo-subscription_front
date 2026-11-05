# 백엔드 계약 (프론트 발췌)

백엔드(`ipo-subscription`)의 `docs/PROJECT_SETUP.md` 중 프론트가 알아야 하는 부분(게이트웨이 인증, 응답 형식, 오류 코드)만 옮겼다. **원본이 기준이다.** 엔드포인트별 구현 현황은 [API-명세-대조.md](./API-명세-대조.md)에 있다.

## 1. 연결 구조

```
브라우저 ──► vite :5173 ──(/api 프록시)──► api-gateway :8080 ──► account / subscription / allocation
```

- 프론트는 `/api` 상대 경로로만 호출한다. 같은 출처라 백엔드에 CORS 설정이 필요 없다
- 서비스 포트로 직접 호출하지 않는다. 게이트웨이를 거쳐야 인증, 마감 시각 판단이 적용된다

## 2. 게이트웨이 인증

- 게이트웨이를 거치는 요청은 토큰이 필요하다. 공개 경로만 예외다
  - `POST /api/v1/users` (회원가입), `POST /api/v1/auth/login` (로그인), Swagger
  - 공개 경로는 메서드와 경로가 정확히 맞아야 한다 (끝 슬래시가 붙으면 공개가 아니다)
- 토큰: `Authorization: Bearer <accessToken>` (JWT, HS256)
- 실패하면 401. 만료는 `TOKEN_EXPIRED`, 그 외는 `UNAUTHORIZED`
- 역할은 `USER`, `ADMIN`. `/api/v1/admin/**`은 `ADMIN`만 되고, 일반 회원은 403 `FORBIDDEN`
- `X-User-Id`, `X-User-Role`, `X-Request-Received-At`는 게이트웨이가 설정한다. 프론트는 보내지 않는다 (보내도 지운다)
- 청약 마감 판단은 게이트웨이 도착 시각(`X-Request-Received-At`) 기준이다. 브라우저 시계로 마감 여부를 확정하지 않고, 화면의 카운트다운은 안내용으로만 쓴다
- JWT 서명 키는 서버만 가진다. 프론트는 토큰을 검증하지 않고 만료 응답(401)에 반응한다

## 3. 응답 형식

```json
// 성공
{ "success": true, "data": { "id": "8b2d..." }, "message": "요청이 성공했습니다." }

// 목록
{ "success": true,
  "data": { "items": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 },
  "message": "목록을 조회했습니다." }

// 실패 (details는 없으면 생략)
{ "success": false,
  "error": { "code": "RESOURCE_NOT_FOUND", "message": "존재하지 않는 계좌입니다.",
             "details": [{ "field": "accountId", "reason": "존재하지 않는 계좌입니다." }] } }
```

- 반환 데이터가 없으면 `data` 필드가 빠진다
- 목록 요청: `?page=0&size=20&sort=createdAt,desc`. 기본 `page=0`, `size=20`(최대 100), 정렬 미지정이면 `createdAt DESC`. 정렬 가능 필드는 API마다 제한이 있고, 없는 필드는 400 `VALIDATION_ERROR`

## 4. 공통 오류 코드

| HTTP | 코드 | 의미 | 화면 처리 |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_STATUS` | 필수값 누락, 형식 오류, 잘못된 상태값 | `details`의 `field`로 해당 입력 아래에 표시 |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED` | 인증 실패, 만료 | 세션 삭제 후 로그인 화면 |
| 403 | `FORBIDDEN` | 권한 부족 | 권한 없음 안내 |
| 404 | `RESOURCE_NOT_FOUND` | 없는 리소스 (본인 것이 아닌 경우 포함) | "찾을 수 없음". 없음과 본인 것이 아님을 구분하지 않는다 |
| 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 메서드 | 호출 코드 점검 (사용자 오류가 아님) |
| 409 | `DUPLICATE_RESOURCE` | 중복 (같은 `requestId`에 다른 내용 포함) | 서버 메시지 표시 |
| 422 | `BUSINESS_RULE_VIOLATION` | 업무 규칙 위반 | 서버 메시지 표시 |
| 429 | `TOO_MANY_REQUESTS` | 요청 횟수 제한 | 잠시 후 다시 시도 안내 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류 | 다시 시도 안내 |
| 502 | `DEPENDENCY_FAILURE` | 다른 서비스 호출 실패 | 다시 시도 안내 |
| 503 | `SERVICE_UNAVAILABLE` | 서비스 이용 불가 | 다시 시도 안내 |

- 도메인 오류 코드(예: 잔액 부족)는 서비스별로 따로 있고 API 명세 오류 표에 있다. 이 문서에 임의로 추가하지 않는다
- 화면에는 서버가 준 `message`를 그대로 보여 준다. 오류 코드로 문구를 새로 만들지 않는다

## 5. 멱등 요청 (`requestId`)

- 계좌 개설, 가상 입금, 청약 신청은 `requestId`(UUID)가 필수다
- 같은 요청의 재전송(연타, 타임아웃, 5xx 뒤 재시도)은 같은 `requestId`를 보내야 서버가 한 번만 반영한다
- 같은 `requestId`에 다른 내용을 보내면 409다. 내용이 바뀌면 새로 만든다
- 구현: `src/lib/requestId.ts`, `src/lib/useRequestId.ts` ([API-명세-대조.md](./API-명세-대조.md) 참고)

## 6. 원칙 (백엔드 CLAUDE.md 규칙 중 화면에 걸리는 것)

- 삭제 기능이 없다 (소프트 삭제도 없음). 취소, 거절, 반환은 상태값으로 남는다. 화면에 "삭제" 버튼을 만들지 않는다
- 원장(`LedgerEntry`)은 추가만 되고 수정이 없다. 화면은 조회 전용이다
- 잔고 계산(환불액, 정산액)은 서버가 한다. 프론트는 서버가 준 값을 보여 주고 직접 계산해 확정하지 않는다
- 비밀값(JWT 키, 비밀번호)은 출력하거나 커밋하지 않는다
