# Feature Slice: F-013 마이페이지 기본 화면

## Metadata

- GitHub Issue: #13
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260621_161528`
- Seed: `seed_3e8ccf7a5e0c`
- PM Document: N/A
- Notes: Ambiguity score `0.0805`. Ouroboros clarified that F-013 should add a minimal authenticated `홈`/`마이` bottom menu, remove API/DB diagnostic copy from home, move account/logout actions from home into mypage, and keep follow-up items hidden instead of rendering placeholders.

Context clarified before drafting:

- Real Apple/Kakao OAuth provider verification is not required to implement this mypage shell.
- Local/internal verification may use the existing dev OAuth path from F-005.
- Real OAuth-based smoke verification is deferred until #6/#7 are complete.
- Bottom navigation is confirmed as a minimal 2-item menu: `홈`, `마이`.
- Home should not show `API 연결 성공`, `DB 연결 성공`, account management, or logout actions after F-013.
- Mypage owns account management and logout actions.

## Goal

로그인한 사용자가 인증 후 화면 하단의 `홈`/`마이` 메뉴를 통해 마이페이지로 이동하고, 내 프로필 요약, 내 여행 진입점, 설정/계정 관리 진입점을 확인할 수 있다.

F-013은 이후 내 여행 목록과 마이페이지 고도화 기능을 얹기 위한 최소 하단 메뉴 shell과 마이페이지 shell이다. 실제 여행 목록 조회나 여행 상태 구분은 후속 feature에서 다룬다.

## Problem

- 현재 인증 후 홈 화면은 API/DB 진단과 계정 화면 진입이 섞여 있어 사용자용 마이페이지 구조가 없다.
- 사용자는 하단 메뉴에서 `홈`과 `마이`를 명확히 오가며 내 정보와 여행 관련 행동으로 이동할 수 있어야 한다.
- 사용자는 내 이름과 연결된 로그인 방법을 한 곳에서 확인하고, 여행 관련 행동과 계정 관리로 이동할 수 있어야 한다.
- #14~#18 마이페이지 기능을 안정적으로 확장하려면 기본 하단 메뉴와 마이페이지 화면 구조를 먼저 고정해야 한다.

## User Flow

1. 사용자가 로그인한 상태로 홈 화면을 연다.
2. 앱은 인증 후 화면 하단에 2개 메뉴 `홈`, `마이`를 표시한다.
3. 사용자가 하단 메뉴의 `마이`를 누른다.
4. 앱이 저장된 session으로 `GET /auth/me`를 호출한다. access token이 만료되었으면 기존 refresh 흐름을 사용한다.
5. 앱이 마이페이지에 프로필 요약, 내 여행 섹션, 설정 섹션을 표시하고 하단 메뉴의 `마이`를 selected 상태로 보여준다.
6. 사용자는 하단 메뉴의 `홈`으로 돌아가거나, `새 여행 만들기`로 여행 생성 화면에 진입하거나, `계정 관리`로 기존 계정 화면에 진입할 수 있다.
7. session이 없거나 refresh가 실패하면 앱은 로그인 필요 상태를 보여주고 로그인 화면으로 이동할 수 있게 한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 인증 후 홈/마이 화면에서 사용하는 하단 메뉴 shell (`홈`, `마이`)
- [ ] App UI: 홈 화면에서 API/DB diagnostic copy를 제거하고 account/logout action을 노출하지 않는다
- [ ] App UI: 마이페이지 기본 화면, loading/error/login-required 상태
- [ ] App UI: 프로필 요약 카드, `내 여행` 섹션, `설정` 섹션
- [ ] App UI: `새 여행 만들기` CTA는 기존 `/trips/new` 흐름으로 이동한다
- [ ] App UI: `계정 관리` CTA는 기존 `/account` 흐름으로 이동한다
- [ ] App UI: `로그아웃` CTA는 기존 logout flow를 호출하고 `/login`으로 이동한다
- [ ] API Contract: 새 계약 없음. 기존 `GET /auth/me`와 generated client를 사용한다
- [ ] API Server: 새 서버 동작 없음. 기존 auth/me와 refresh/logout/link 흐름을 재사용한다
- [ ] DB: 새 migration 없음. 기존 `users`, `auth_identities`, `auth_sessions`를 사용한다
- [ ] Tests: 모바일 typecheck와 필요한 경우 auth/mypage 상태 매핑 단위 검증 또는 수동 검증 기록
- [ ] Deployment: local/internal build에서 dev auth 또는 실제 OAuth 가능 환경으로 mypage happy path를 확인하고 결과를 기록한다

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 내가 참여 중인 실제 여행 목록 조회/표시 (#14)
- 진행 중/예정/지난 여행 상태별 구분 (#15)
- 현재 여행 바로가기 강조 (#16)
- 여행 카드별 내 역할/참여자 수 표시 (#17)
- 앱 정보, 약관, 개인정보처리방침 링크 (#18)
- 여행 생성 후 목록 반영 (#20)
- 여행 상세 화면 이동 (#21)
- 내 표시 이름 수정 (#11)
- 계정 삭제 (#12)
- Apple/Kakao 실제 provider 연결 및 internal build 검증 (#6/#7)
- `홈`, `마이` 외 추가 하단 메뉴 항목 또는 전체 앱 navigation 구조 개편
- mock 여행 데이터, fake count, fake role 표시

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx` 또는 현재 인증 후 홈 화면
  - 인증 후 하단 메뉴를 표시하고 `홈`을 selected 상태로 보여준다.
  - 하단 메뉴의 `마이`를 누르면 마이페이지로 이동한다.
  - `API 연결 성공`, `DB 연결 성공`, schema/status 같은 diagnostic copy를 사용자 화면에서 제거한다.
  - `계정`, `로그아웃` action은 홈에 노출하지 않고 마이페이지로 옮긴다.
  - 기존 `새 여행 만들기` 동작을 불필요하게 깨지 않는다.
- `apps/mobile/app/mypage.tsx` 또는 동등한 Expo Router 경로
  - 사용자용 마이페이지 shell을 제공한다.
  - 인증 후 하단 메뉴를 표시하고 `마이`를 selected 상태로 보여준다.
  - 정확한 파일명은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, 사용자 흐름과 상태는 유지한다.
- `apps/mobile/app/account.tsx`
  - F-013에서는 기존 계정 관리 화면으로 유지하고, 마이페이지의 `계정 관리` 진입점으로 연결한다.

### Bottom Menu

- 메뉴 항목은 2개만 둔다: `홈`, `마이`.
- `홈`은 인증 후 홈 화면으로 이동한다.
- `마이`는 마이페이지로 이동한다.
- 현재 화면에 해당하는 메뉴는 selected 상태로 구분한다.
- #13에서는 `여행`, `일정`, `정산`, `프로필` 같은 추가 하단 메뉴를 만들지 않는다.
- 아이콘은 도입하지 않는다. 텍스트 label만 사용한다.

### Layout

- 디자인 기준은 `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 단일 컬럼 portrait mobile 화면으로 구성한다.
- 하단 메뉴가 주요 콘텐츠를 가리지 않도록 content padding 또는 safe area를 확보한다.
- 화면 좌우 padding은 theme spacing/token을 사용한다.
- 프로필, 내 여행, 설정은 white card + subtle border + 낮은 shadow 패턴을 사용한다.
- 화면 코드에 raw hex color, 임의 spacing/radius 값을 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.

### Sections

#### Profile Summary

- 현재 사용자 display name을 가장 먼저 보여준다.
- displayName은 내부 user의 필수값으로 본다. 예외적으로 비어 있으면 `이름을 불러올 수 없어요.`를 표시하고 `null`/`undefined`를 노출하지 않는다.
- `GET /auth/me` 응답에 email이 있으면 보조 정보로 표시하고, 없으면 email row를 숨긴다.
- 연결된 provider 목록을 사용자 친화 label로 표시한다.
  - `apple` → `Apple`
  - `kakao` → `Kakao`
- linkedProviders가 예외적으로 비어 있으면 `연결된 로그인 없음`을 표시한다.

#### My Trips

- 섹션 title: `내 여행`
- F-013에서는 실제 목록이나 count를 표시하지 않는다.
- 기존 여행 생성 화면으로 이동하는 `새 여행 만들기` CTA를 제공한다.
- copy는 후속 목록 기능을 약속하기보다 현재 가능한 행동을 안내한다.

#### Settings

- 섹션 title: `설정`
- `계정 관리` row 또는 button을 제공하고 기존 `/account` 화면으로 이동한다.
- `로그아웃` button을 제공하고 기존 `logoutCurrentSession` 흐름을 사용해 현재 session을 revoke/clear한 뒤 `/login`으로 replace 이동한다.
- 약관/개인정보/앱 정보 링크는 #18에서 추가한다.

### States

- Loading: `마이페이지를 불러오는 중...`을 표시하고 주요 CTA를 비활성화한다.
- Empty: 인증된 사용자의 프로필은 항상 있어야 하므로 별도 empty profile state는 없다. 내 여행 목록 empty state는 #14에서 다룬다.
- Error: 일시적인 네트워크/API 오류로 `/auth/me` 조회를 완료할 수 없으면 `마이페이지를 불러올 수 없어요. 다시 시도해주세요.`와 retry CTA를 표시한다.
- Login required: 저장된 session이 없거나 refresh token이 invalid/revoked처럼 인증 복구가 불가능하면 session을 정리하고 `로그인이 필요합니다.`와 `로그인하기` CTA를 표시한다.
- Success: 프로필 요약, 내 여행 섹션, 설정 섹션을 표시한다.

### Copy / Labels

- Screen title: `마이페이지`
- Screen subtitle: `내 정보와 여행을 한곳에서 확인해요.`
- Bottom menu home label: `홈`
- Bottom menu my label: `마이`
- Loading: `마이페이지를 불러오는 중...`
- Login required: `로그인이 필요합니다.`
- Login CTA: `로그인하기`
- Generic error: `마이페이지를 불러올 수 없어요. 다시 시도해주세요.`
- Retry CTA: `다시 시도`
- Profile section title: `내 프로필`
- Linked providers label: `연결된 로그인`
- My trips section title: `내 여행`
- My trips helper: `새 여행을 만들고 여정을 이어가요.`
- Create trip CTA: `새 여행 만들기`
- Settings section title: `설정`
- Account management CTA: `계정 관리`
- Logout CTA: `로그아웃`
- Back/Home CTA if needed: `홈으로`

## API Contract

No new API changes.

F-013 uses the existing generated TypeScript client for:

```text
GET /auth/me
```

Authenticated endpoint. 현재 access token의 user와 linked provider 목록을 반환한다. Access token 만료 시 기존 mobile auth refresh flow를 사용한다.

### Existing Response Shape

```json
{
  "user": {
    "id": "user_123",
    "displayName": "민수",
    "email": "minsu@example.com",
    "avatarUrl": null
  },
  "linkedProviders": ["apple"]
}
```

### Existing Errors

Unauthorized:

HTTP status: `401`

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "unauthorized",
    "details": []
  }
}
```

Invalid refresh token during existing refresh flow:

HTTP status: `401`

```json
{
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "refresh token is invalid",
    "details": [
      {
        "result": "invalid_refresh_token"
      }
    ]
  }
}
```

## DB Changes

No DB changes.

F-013 reads existing auth/user data through existing endpoints only.

## Business Rules

- 마이페이지는 인증된 사용자만 볼 수 있다.
- 인증 후 하단 메뉴는 `홈`, `마이` 2개 항목만 제공한다.
- 하단 메뉴 selected 상태는 현재 화면과 일치해야 한다.
- 홈 화면은 API/DB 연결 성공, schema/status 등 개발 diagnostic 정보를 사용자에게 노출하지 않는다.
- 홈 화면은 계정 관리와 로그아웃 action을 노출하지 않는다.
- 프로필 요약은 mock data가 아니라 `GET /auth/me` 응답을 사용한다.
- linked provider는 raw enum을 그대로 노출하지 않고 사용자 label로 매핑한다.
- displayName이 예외적으로 비어 있으면 `null`/`undefined` 대신 안전 문구를 표시한다.
- email이 없으면 빈 문자열이나 `null`을 사용자에게 그대로 표시하지 않고 row를 숨긴다.
- linkedProviders가 예외적으로 비어 있으면 `연결된 로그인 없음`을 표시한다.
- F-013에서는 여행 목록, 여행 개수, 현재 여행, role, participant count를 표시하지 않는다.
- `내 여행` 섹션은 현재 가능한 행동인 `새 여행 만들기` 진입만 제공한다.
- 로그아웃은 기존 `logoutCurrentSession` 흐름을 재사용하고 성공/실패와 관계없이 local session을 정리한 뒤 `/login`으로 이동한다.
- public staging/prod에서 dev OAuth를 활성화하지 않는다.

## Acceptance Criteria

- [ ] 로그인된 사용자는 인증 후 홈 화면 하단에서 `홈`, `마이` 메뉴를 볼 수 있다.
- [ ] 홈 화면에서는 하단 메뉴의 `홈`이 selected 상태다.
- [ ] 하단 메뉴의 `마이`를 누르면 마이페이지로 이동한다.
- [ ] 마이페이지에서는 하단 메뉴의 `마이`가 selected 상태다.
- [ ] 홈 화면은 `API 연결 성공`, `DB 연결 성공`, schema/status 같은 diagnostic copy를 표시하지 않는다.
- [ ] 홈 화면은 `계정`, `로그아웃` action을 표시하지 않는다.
- [ ] `마이페이지` 진입 시 앱은 generated client/auth helper를 통해 현재 user 정보를 조회한다.
- [ ] 프로필 요약에 현재 user의 display name이 표시된다.
- [ ] displayName이 예외적으로 비어 있어도 `null`/`undefined`가 아니라 안전 문구가 표시된다.
- [ ] `GET /auth/me` 응답에 email이 있으면 프로필 보조 정보로 표시되고, 없으면 email row가 숨겨진다.
- [ ] 연결된 provider가 `Apple`, `Kakao` 같은 사용자 label로 표시된다.
- [ ] linkedProviders가 예외적으로 비어 있으면 `연결된 로그인 없음`이 표시된다.
- [ ] `내 여행` 섹션에 `새 여행 만들기` CTA가 있고 기존 여행 생성 화면으로 이동한다.
- [ ] `설정` 섹션에 `계정 관리` CTA가 있고 기존 계정 관리 화면으로 이동한다.
- [ ] `설정` 섹션에 `로그아웃` CTA가 있고 기존 logout flow를 호출한 뒤 로그인 화면으로 이동한다.
- [ ] loading, generic error, login-required 상태가 화면 안에서 처리된다.
- [ ] session이 없거나 refresh token이 invalid/revoked이면 로그인 필요 상태로 전환되고 저장된 session이 정리된다.
- [ ] F-013은 fake trip list/count/role을 표시하지 않는다.
- [ ] F-013은 OpenAPI, DB schema, API server behavior를 변경하지 않는다.
- [ ] 모바일 typecheck가 통과한다.
- [ ] local/internal 환경에서 dev auth 또는 실제 OAuth 가능 환경으로 마이페이지 happy path가 확인되고 결과가 기록된다.

## Implementation Plan

1. Spec approval 및 scope 고정
   - Verify: #13 issue/spec가 승인되고 Open Questions가 없음을 확인한다.
2. 하단 메뉴 shell 추가
   - Add: 인증 후 홈/마이 화면에서 재사용할 수 있는 최소 bottom menu UI.
   - Include: `홈`, `마이` label, current route selected 상태, route 이동.
   - Verify: 홈에서는 `홈`, 마이페이지에서는 `마이`가 selected 상태로 보인다.
3. 마이페이지 route 추가
   - Add: `apps/mobile/app/mypage.tsx` 또는 동등 route.
   - Use: existing `getCurrentUserWithRefresh`, `MobileAuthError`, design `theme`.
   - Verify: unauthenticated/loading/success/error 상태가 TypeScript상 exhaustively 처리된다.
4. 홈 화면 정리 및 연결
   - Update: 인증된 홈 화면에 하단 메뉴 shell을 추가한다.
   - Remove: `API 연결 성공`, `DB 연결 성공`, schema/status diagnostic copy.
   - Move: `계정`, `로그아웃` action은 홈에서 제거하고 마이페이지에서 제공한다.
   - Verify: 기존 `새 여행 만들기` flow를 깨지 않고 홈에는 계정/logout action이 남지 않는다.
5. 프로필/내 여행/설정 섹션 구현
   - Add: profile summary card, my trips CTA card, settings card.
   - Add: settings section의 `계정 관리`, `로그아웃` actions.
   - Verify: display name/provider labels/email optional rendering이 mock 없이 동작하고 logout이 `/login`으로 이동한다.
6. 인증 실패/refresh 실패 상태 처리
   - Reuse: existing session clearing behavior where available.
   - Verify: no session 또는 invalid refresh token 시 login-required state와 `로그인하기` CTA가 보인다.
7. 검증 실행 및 feature 문서 결과 업데이트
   - Verify: `pnpm --filter @i-um/mobile typecheck`, 필요 시 `pnpm verify`, manual local/internal smoke 결과를 기록한다.

## Verification Plan

### Automated

```text
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

`pnpm verify`는 OpenAPI/DB 생성물 변경이 없음을 확인하고 기존 API/mobile checks를 함께 돌리기 위해 실행한다. 환경 제약으로 전체 verify가 불가능하면 실패 이유와 대체 검증을 완료 보고에 기록한다.

### Manual

- [ ] local API에서 `AUTH_ALLOW_DEV_OAUTH=true`로 dev OAuth 로그인을 한다.
- [ ] 모바일 앱에서 로그인 후 홈 화면 하단에 `홈`, `마이` 메뉴가 보이고 `홈`이 selected 상태다.
- [ ] 홈 화면에 `API 연결 성공`, `DB 연결 성공`, schema/status diagnostic copy가 보이지 않는다.
- [ ] 홈 화면에 `계정`, `로그아웃` action이 보이지 않는다.
- [ ] 하단 메뉴의 `마이`를 누르면 마이페이지로 이동하고 `마이`가 selected 상태다.
- [ ] `마이페이지` 진입 시 display name과 연결된 로그인 provider가 표시된다.
- [ ] email이 없는 계정에서도 `null`/`undefined` 문구가 보이지 않는다.
- [ ] `새 여행 만들기`를 누르면 기존 여행 생성 화면으로 이동한다.
- [ ] `계정 관리`를 누르면 기존 계정 관리 화면으로 이동한다.
- [ ] `로그아웃`을 누르면 현재 session이 정리되고 로그인 화면으로 이동한다.
- [ ] 저장된 session이 없는 상태에서 마이페이지 접근 시 로그인 필요 상태가 보인다.
- [ ] 네트워크/API 오류 상황에서 retry 가능한 오류 상태가 보인다.
- [ ] public staging/prod에서 dev OAuth를 켜지 않았음을 확인한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass, installed workspace dependencies in `.worktrees/F013-mypage-basic-screen`.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- Manual device/simulator smoke: not run in this environment.
- Staging/internal build verification: not run; real provider verification remains deferred to #6/#7.

## Release Notes

```text
- 인증 후 화면에 `홈`, `마이` 하단 메뉴를 추가한다.
- 로그인한 사용자가 내 프로필, 내 여행 진입점, 계정 관리 진입점을 볼 수 있는 마이페이지 기본 화면을 추가한다.
- 내 여행 실제 목록과 상태별 구분은 후속 기능에서 제공한다.
```

## Open Questions

None for implementation.

Spec approved for implementation by user request on 2026-06-22.

## Follow-up Issues

- #6: Sign in with Apple 실제 provider 연결 및 internal build 검증
- #7: Kakao Login 실제 provider 연결 및 internal build 검증
- #11: 내 이름 수정
- #12: 계정 삭제
- #14: 내가 참여 중인 여행 목록
- #15: 여행 상태별 구분
- #16: 현재 여행 바로가기
- #17: 여행 내 역할/참여자 수 표시
- #18: 앱 정보/약관/개인정보 링크
- #20: 여행 생성 후 마이페이지 반영
