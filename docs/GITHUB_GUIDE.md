# GitHub 협업 가이드 (프론트)

백엔드(`ipo-subscription`)의 `docs/GITHUB_GUIDE.md`에서 프론트에 맞게 가져왔다. 이슈 번호는 백엔드와 별개로 이 저장소에서 따로 매긴다.

## 1. 작업 흐름

```
① 이슈 생성 (라벨 + 담당자)       ex) 청약 화면 구현 #12
② develop에서 브랜치              feat/12-subscription-form
③ 커밋                            [feat] 청약 신청 폼 추가 #12
④ develop으로 PR                  Closes #12
⑤ 머지 → 이슈 자동 종료 → 브랜치 삭제(선택)
```

## 2. 브랜치

- `main`: 최종본 (발표, 제출). 직접 push 하지 않는다
- `develop`: 개발 통합, 모든 PR의 대상. 직접 push 하지 않는다
- 작업 브랜치: 이슈 1개 = 브랜치 1개, `develop`에서 만든다

이름 규칙: `{타입}/{이슈번호}-{설명}` (영어 소문자, 하이픈)

| 타입 | 예시 |
| --- | --- |
| `feat` | `feat/12-subscription-form` |
| `fix` | `fix/20-token-expired-redirect` |
| `refactor` | `refactor/31-api-client` |
| `chore` | `chore/5-vite-proxy` |
| `docs` | `docs/8-api-spec` |
| `test` | `test/40-request-id` |

## 3. 이슈

작업 전에 이슈부터 만든다. 제목은 `[FEAT]`, `[BUG]`, `[REFACTOR]` 머리말을 붙인다.

**이슈 1개 = PR 1개 = 1~2일 안에 끝나는 작업**

- 좋은 예: 공모주 목록 화면 / 청약 신청 폼 / 로그인·회원가입 화면
- 나쁜 예: 프론트 개발 (너무 큼) / 버튼 색 바꾸기 (너무 작음)
- 백엔드 API가 먼저 필요한 작업은 이슈 본문에 백엔드 이슈나 PR 링크를 적는다

## 4. 커밋

```
[타입] 한글 요약 #이슈번호

- 변경 내용
```

| 타입 | 용도 |
| --- | --- |
| `[feat]` | 기능 |
| `[fix]` | 버그 |
| `[refactor]` | 개선 (동작 동일) |
| `[chore]` | 설정, 빌드, 의존성 |
| `[docs]` | 문서 |
| `[test]` | 테스트 |

- 커밋 1개 = 변경 1개
- 커밋 전에 `npm run typecheck`와 `npm test`를 통과시킨다 (`npm run build`는 타입 검사 + 빌드)

## 5. PR

1. 브랜치 push → Compare & pull request
2. base = `develop` (main 아님)
3. 제목: `[feat] 청약 신청 폼 추가 (#12)`
4. 본문에 `Closes #12`
5. 리뷰는 필수가 아니다. 백엔드 API 계약이 걸린 변경이나 큰 구조 변경이면 연관 담당자에게 요청한다
6. 머지는 작성자가 한다 (Create a merge commit)

PR 전 확인:

- 용어: 화면 문구, 타입, 상태값 이름이 [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md)와 맞는지
- API: 요청·응답 필드가 [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md)와 [API-명세-대조.md](./API-명세-대조.md)와 맞는지. 백엔드가 바뀌었으면 문서도 같이 고친다
- 오류: 401, 404, 5xx, 네트워크 실패 때 화면이 어떻게 보이는지
- 돈이 걸린 요청(입금, 청약)은 `requestId`를 재사용 규칙대로 보내는지

## 6. 명령어

```bash
# 시작
git switch develop && git pull origin develop
git switch -c feat/12-subscription-form

# 커밋, 푸시
git add src/pages/
git commit -m "[feat] 청약 신청 폼 추가 #12"
git push -u origin feat/12-subscription-form

# develop 최신화
git fetch origin && git merge origin/develop

# 머지 후 정리
git switch develop && git pull origin develop
git branch -d feat/12-subscription-form

# 되돌리기
git restore 파일명              # 변경 취소
git restore --staged 파일명     # add 취소
git commit --amend             # 마지막 커밋 수정 (push 전만)
```

## 7. 금지

- `main`, `develop` 직접 push
- force push
- `node_modules/`, `dist/`, `*.tsbuildinfo` 커밋
- 비밀값 커밋 (`.env`). 환경 변수 예시는 `.env.example`에만 적는다
- 프론트 코드나 번들에 비밀값(JWT 키, 비밀번호)을 넣지 않는다. `VITE_` 변수는 브라우저에 그대로 노출된다

> 비밀값을 올렸다면 즉시 팀에 알리고 키를 재발급한다. 커밋을 지워도 히스토리에 남는다.

---

문제를 해결했을 때는 **상황 → 원인 → 해결 → 효과**를 정리해 공유한다.
