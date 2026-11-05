# ipo-subscription-front (팀 공용)

공모주 청약 서비스(`ipo-subscription`, 백엔드 MSA)의 웹 프론트. React + TypeScript + Vite. 백엔드가 주고 프론트는 화면을 맡는다. 서버 코드는 이 저장소에 없다.

## 꼭 따를 문서
- 용어, 코드명, 상태값: @docs/UBIQUITOUS_LANGUAGE.md
- 인증, 응답 형식, 오류 코드, `requestId`: @docs/BACKEND_CONTRACT.md
- 엔드포인트별 구현 현황: @docs/API-명세-대조.md
- 이슈, 브랜치, 커밋, PR: @docs/GITHUB_GUIDE.md

## 규칙
- 타입, 변수, 상태값 이름과 화면 문구는 유비쿼터스 언어 표의 코드명, 한글을 그대로 쓴다. 표에 없는 이름이 필요하면 임의로 만들지 말고 먼저 묻는다
- 문서에 없는 필드, 상태값, API 형식은 임의로 정하지 않고 먼저 묻는다. 백엔드 계약이 바뀌면 문서도 같이 고친다
- 화면에 삭제 기능을 만들지 않는다. 취소, 거절, 반환은 상태값으로 보여 준다
- 잔고, 환불액, 정산액은 서버가 계산한 값을 보여 준다. 프론트가 계산해 확정하지 않는다
- 청약 마감 판단은 서버(게이트웨이 도착 시각) 기준이다. 화면 카운트다운은 안내용이다
- 계좌 개설, 입금, 청약 신청은 `requestId` 재사용 규칙(`src/lib/useRequestId.ts`)을 지킨다
- 오류는 서버가 준 `message`를 그대로 보여 준다
- `main`, `develop`에 직접 push하지 않는다. `develop`에서 브랜치를 따서 PR한다
- 커밋 전에 `npm run typecheck`와 `npm test`를 통과시킨다
- 비밀값(JWT 키, 비밀번호)은 출력하거나 커밋하지 않는다. `.env`는 커밋하지 않고 예시는 `.env.example`에만 적는다. `VITE_` 변수는 브라우저에 노출되므로 비밀값을 넣지 않는다
