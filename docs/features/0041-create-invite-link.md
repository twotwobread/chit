# Feature Slice: F-041 초대 링크 생성

## Metadata

- GitHub Issue: #41
- Status: Implementation Complete (Manual Smoke Pending)
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Initial Interview Session: `interview_20260623_145426`
- Kakao/Deep Link Ambiguity Review Session: `interview_20260623_153212`
- Seed: N/A
- PM Document: N/A
- Notes: Initial ambiguity score `0.08`; follow-up ambiguity review completed at `0.11`. Ouroboros clarified F-041 as the Owner-only invite-link generation slice. MVP uses one current active invite link per trip, a fixed 7-day expiry, create-or-return-current idempotency, and an explicit Owner action. Follow-up review added KakaoTalk SDK primary sharing, explicit fallback choice, installed-app deep linking to `/invite/{token}`, a placeholder invite route before #42, and app-not-installed web fallback that sends recipients to the app store. Invite acceptance, login handoff after auth, invited-trip list reflection, revoke/regenerate controls, and pending invitee display are deferred to #42~#44 and follow-ups.

## Goal

Owner가 여행의 현재 active 초대 링크를 생성하거나 다시 불러와 링크를 복사하고 카카오톡으로 공유할 수 있다.

F-041은 초대 수락 전에 필요한 링크 발급 기반 slice다. Owner는 여행 맥락에서 명시적으로 초대 링크를 만들고, 앱은 generated API client로 서버가 발급한 `inviteUrl`을 받아 복사하거나 KakaoTalk SDK 공유로 전송한다.

## Problem

- F-040 참여자 목록은 현재 참여자만 보여주며, 새로운 동행자를 초대하는 경로가 없다.
- 동행자 초대는 이후 초대 수락(#42), 로그인 handoff(#43), 초대받은 여행의 마이페이지 반영(#44)의 선행 조건이다.
- 초대 링크는 권한과 만료가 있는 서버 데이터여야 하므로, 단순히 모바일에서 임의 URL을 만드는 방식으로는 안전한 수락 검증을 할 수 없다.
- Owner만 초대 링크를 만들 수 있어야 하며, Member가 stale UI나 직접 API 호출로 링크를 만들 수 없어야 한다.

## User Flow

1. Owner가 로그인된 상태에서 `/trips/{tripId}` 여행 상세 화면을 연다.
2. Owner가 `참여자 모두 보기`를 눌러 `/trips/{tripId}/participants` 화면으로 이동한다.
3. 참여자 화면은 기존 참여자 목록과 함께 Owner에게만 초대 링크 card/action을 보여준다.
4. Owner가 `초대 링크 만들기`를 누른다.
5. 앱은 generated client로 `POST /trips/{tripId}/invites`를 호출한다.
6. 서버는 인증, `tripId` 형식, trip 존재 여부, Owner 권한을 확인한다.
7. 해당 trip에 unexpired current invite가 있으면 서버는 기존 invite를 `200`과 `created: false`로 반환한다.
8. current invite가 없거나 만료되었으면 서버는 새 token/row를 만들고 `201`과 `created: true`로 반환한다.
9. 앱은 `inviteUrl`, 만료 시각, 생성/재사용 안내 문구를 표시한다.
10. Owner가 `링크 복사`를 누르면 앱은 `inviteUrl`을 clipboard에 복사하고 `링크를 복사했어요.` 메시지를 보여준다.
11. Owner가 `카카오톡으로 공유`를 누르면 앱은 KakaoTalk SDK 공유 API를 열고 결정된 Kakao invite payload를 전달한다.
12. KakaoTalk이 설치되어 있지 않거나 SDK 공유를 열 수 없으면 앱은 fallback 안내를 보여주고 `링크 복사`와 `다른 앱으로 공유`를 제공한다.
13. 수신자가 KakaoTalk 메시지의 `이음에서 참여하기` 버튼을 누르면 설치된 i-um 앱이 `/invite/{token}` route로 열린다.
14. F-041 시점에는 `/invite/{token}` 앱 화면이 placeholder를 보여주고, 실제 참여 수락은 #42에서 처리한다.
15. 수신자 기기에 i-um 앱이 설치되어 있지 않거나 app/universal link가 열리지 않으면, 같은 `inviteUrl`의 web fallback page가 열리고 App Store/Play Store 설치 이동을 제공한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: `/trips/{tripId}/participants` 화면의 Owner-only 초대 링크 card/action, loading/success/error/copy/Kakao share/fallback 상태
- [x] App UI: `/invite/{token}` deep-link placeholder 화면. 실제 invite accept API 호출 없이 명확한 준비 중 안내를 표시
- [x] Web/Deep Link Fallback: `inviteUrl`의 `/invite/{token}` web fallback page 또는 static/API-hosted equivalent. 앱 미설치/미클레임 상황에서 App Store/Play Store 설치 이동 제공
- [x] App UI: Owner 여부 확인을 위해 기존 trip detail/current session 정보를 사용하거나 동등한 방식으로 Owner에게만 action 노출
- [x] App Logic: invite response를 화면 상태로 변환, expiry 표시, clipboard payload helper, KakaoTalk share payload/helper, fallback OS share payload helper, API/Kakao error mapping, invite placeholder route parsing
- [x] API Contract: authenticated `POST /trips/{tripId}/invites` endpoint, `TripInvite`, `CreateTripInviteResponse`, `200` reused / `201` created success schemas
- [x] API Server: invite create-or-return handler/service/repository, Owner authorization, token generation, invite URL building, clock/token generator injection for tests
- [x] DB: `trip_invites` table migration, token uniqueness, one current invite per trip enforcement, trip cascade delete
- [x] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- [x] Tests: API auth/authorization/lifecycle/idempotency tests, repository transaction/constraint tests, mobile invite state/copy/Kakao share/fallback helper tests, generated drift/typecheck gates
- [ ] Deployment: staging 또는 internal build에서 Owner link creation/reuse/copy/Kakao share/fallback happy path와 Member no-action/forbidden path smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 초대 링크 수락 및 `TripParticipant` member 생성 (#42)
- 비로그인 사용자의 초대 링크 진입 후 로그인 handoff (#43)
- 초대받은 여행이 마이페이지에 표시되는 흐름 (#44)
- pending invitee 표시, pending invite count, 초대 발송 이력, 초대받은 사람 목록
- link revoke button, regenerate button, 만료 기간 선택, 여러 active invite 동시 관리
- 초대 링크 클릭 후 실제 참여를 확정하는 완성된 수락 UI/API. F-041은 `/invite/{token}` placeholder route까지만 포함하고 실제 수락은 #42에서 구현한다
- push notification, SMS/KakaoTalk 직접 발송 API, 연락처 선택, 인앱 알림
- Member의 초대 권한, 역할별 초대 권한 설정, Owner 이전/role management
- 참여자 제거 (#45)
- 공동 일정 편집 반영(#46) 또는 realtime participant updates
- 초대 링크 사용 횟수 제한, domain allowlist, abuse/rate-limit 정책. 필요하면 보안 follow-up으로 분리한다
- Kakao custom template ID 관리, 마케팅 이미지/프로필 기반 rich template, 서버 사이드 Kakao 메시지 발송 API
- KakaoTalk 친구 목록 선택, 연락처 기반 초대, 카카오톡 채널 메시지
- Web에서 초대 수락 처리, Web 회원가입/로그인, Web app 전체 구현. F-041 web fallback은 설치 안내와 store 이동만 제공한다
- App Store/Play Store listing 생성 자체. F-041은 store URL을 설정값으로 받는다
- analytics/event tracking

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/participants.tsx`
  - 기존 F-040 참여자 목록 화면에 초대 링크 card/action을 추가한다.
  - Owner에게만 초대 링크 card/action을 보여준다.
  - Member에게는 기존 읽기 전용 참여자 목록만 보여준다.
  - Owner 여부는 서버 보안 경계가 아니다. 서버의 `POST /trips/{tripId}/invites` Owner authorization이 최종 판단이다.
  - 초대 링크를 자동 생성하지 않는다. 화면 진입만으로 `POST /trips/{tripId}/invites`를 호출하지 않는다.

- `apps/mobile/app/invite/[token].tsx`
  - 수신자가 installed-app deep link로 진입하는 placeholder route를 제공한다.
  - 화면은 token 형식만 방어적으로 확인하고, F-041에서는 서버 accept API를 호출하지 않는다.
  - Copy: `초대 링크를 열었어요. 참여 기능은 곧 지원될 예정이에요.`
  - CTA: `홈으로` 또는 `로그인하기` 등 기존 auth/session 상태에 맞는 안전한 이동을 제공한다.

- `apps/mobile/lib/trips/invite.ts` 또는 동등 helper
  - invite response view model, expiry label, Kakao share payload, fallback share payload, failure status, placeholder route state를 pure helper로 분리해 테스트한다.
  - clipboard/Kakao share/OS share 호출은 주입 가능한 wrapper 또는 작은 함수로 감싸 payload와 상태 전이를 테스트 가능하게 한다.

- Web fallback host for `/invite/{token}`
  - `inviteUrl`의 HTTPS domain에서 앱 미설치/미클레임 시 열릴 lightweight page를 제공한다.
  - user agent 또는 platform hint로 iOS는 App Store URL, Android는 Play Store URL을 제공한다.
  - 플랫폼을 판단할 수 없으면 두 store link를 모두 보여준다.
  - Store URL은 deploy/config 값으로 둔다. 실제 store listing이 아직 없으면 internal/TestFlight/closed testing install URL 등 팀이 사용하는 설치 URL을 설정한다.
  - Web fallback은 token을 URL path에 유지하되, F-041에서는 Web에서 token 검증/수락 API를 호출하지 않는다.

정확한 파일 구조는 구현 시 기존 Expo Router/API/static hosting 구조에 맞춰 조정할 수 있지만, 사용자 flow는 `/trips/{tripId}/participants`에서 Owner가 명시적으로 초대 링크를 만드는 의미와 `/invite/{token}` link target을 유지한다.

### Invite Card States

- Hidden
  - 현재 사용자가 Owner가 아니면 초대 링크 card/action을 표시하지 않는다.
- Idle
  - Owner에게 `초대 링크 만들기` action을 표시한다.
  - helper text: `동행자에게 보낼 링크를 만들 수 있어요.`
- Creating / Loading
  - `초대 링크를 만들고 있어요...`를 표시한다.
  - 중복 tap을 막기 위해 create/copy/Kakao share/fallback share action을 비활성화한다.
- Success: newly created
  - Title: `초대 링크가 준비됐어요.`
  - `inviteUrl`과 expiry label을 표시한다.
  - `카카오톡으로 공유`, `링크 복사` action을 제공한다.
- Success: reused existing
  - Title: `기존 초대 링크를 불러왔어요.`
  - 같은 active link와 expiry label을 표시한다.
  - `카카오톡으로 공유`, `링크 복사` action을 제공한다.
- Copy success
  - `링크를 복사했어요.` 메시지를 표시한다.
- KakaoTalk Share
  - KakaoTalk SDK 공유 API를 연다.
  - KakaoTalk share completion/cancel 여부는 별도 product state로 저장하지 않는다.
- KakaoTalk Unavailable / Failure
  - `카카오톡 공유를 열 수 없어요. 링크를 복사하거나 다른 앱으로 공유해보세요.`를 표시한다.
  - fallback으로 `링크 복사`와 `다른 앱으로 공유`를 제공한다.
  - `다른 앱으로 공유`는 React Native platform share sheet를 연다.
- Auth error
  - `다시 로그인해주세요.`와 로그인 action을 보여준다.
- Permission error
  - stale UI 또는 직접 호출로 `403`이 오면 `Owner만 초대 링크를 만들 수 있어요.`를 표시한다.
- Not found / invalid trip
  - `400`, `404`는 `여행을 찾을 수 없어요.` 또는 기존 safe navigation 상태를 사용한다.
- Retryable error
  - network, `5xx`, unknown error는 `초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.`와 retry action을 보여준다.

### Copy / Labels

- Invite card title before creation: `동행자 초대`
- Create action: `초대 링크 만들기`
- Loading: `초대 링크를 만들고 있어요...`
- Created title: `초대 링크가 준비됐어요.`
- Reused title: `기존 초대 링크를 불러왔어요.`
- Expiry label: `<YYYY.MM.DD HH:mm>까지 사용할 수 있어요.`
- Copy action: `링크 복사`
- Copy success: `링크를 복사했어요.`
- Kakao share action: `카카오톡으로 공유`
- Kakao unavailable/failure: `카카오톡 공유를 열 수 없어요. 링크를 복사하거나 다른 앱으로 공유해보세요.`
- Fallback share action: `다른 앱으로 공유`
- Permission error: `Owner만 초대 링크를 만들 수 있어요.`
- Generic error: `초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.`

### KakaoTalk Share Payload

기본 공유 payload는 helper에서 결정한다.

```text
Title: <여행 이름>에 초대받았어요.
Description: 아래 링크로 이음에서 여행에 참여해보세요.
Button: 이음에서 참여하기
Link: <inviteUrl>
```

- Primary share action은 `카카오톡으로 공유`다.
- 모바일은 KakaoTalk SDK의 client-side share API를 사용한다. 서버 사이드 Kakao 메시지 발송은 F-041 범위가 아니다.
- Kakao custom template ID 없이 SDK 기본 feed/template 방식으로 구현한다. 구현 시 해당 방식을 지원하는 Kakao share SDK를 선택한다.
- `inviteUrl`은 API response의 값을 그대로 사용한다.
- raw token만 공유하지 않는다.
- 여행 이름을 사용할 수 없으면 title을 `이음 여행에 초대받았어요.`로 대체한다.
- `inviteUrl`의 scheme/domain은 Kakao Developers 앱 설정에서 공유 link target으로 허용되어 있어야 한다.
- `inviteUrl`의 domain은 iOS Universal Links / Android App Links 또는 동등한 deep-link mechanism으로 앱의 `/invite/{token}` route와 연결되어야 한다.
- 현재 Kakao 로그인 dependency가 공유 API를 제공하지 않으면, 모바일에 최소 Kakao share SDK dependency를 추가한다.

### Invite Link Target / Deep Link Behavior

`inviteUrl`은 단순 복사용 URL이 아니라 KakaoTalk 메시지 버튼의 link target이다.

- 앱이 설치되어 있으면 i-um 앱의 `/invite/{token}` route를 열어야 한다.
- F-041의 `/invite/{token}` 앱 route는 placeholder screen만 제공한다.
- Placeholder copy: `초대 링크를 열었어요. 참여 기능은 곧 지원될 예정이에요.`
- 실제 invite token 검증, 로그인 handoff, `TripParticipant` 생성, 여행 상세 이동은 #42/#43에서 구현한다.
- 앱이 설치되어 있지 않거나 app/universal link가 열리지 않으면 같은 HTTPS URL의 web fallback이 열려야 한다.
- Web fallback은 App Store/Play Store 설치 이동을 제공한다.
- Web fallback은 F-041에서 초대 수락을 처리하지 않는다.

### Fallback OS Share Payload

KakaoTalk이 설치되어 있지 않거나 SDK 공유를 열 수 없는 경우에만 OS share sheet fallback을 제공한다.

```text
<여행 이름>에 초대받았어요.
아래 링크로 이음에서 여행에 참여해보세요.
<inviteUrl>
```

Fallback payload도 `inviteUrl`을 사용하고 raw token을 공유하지 않는다.

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 초대 card는 F-040 participant list card 패턴과 조화되게 배치한다.
- copy/Kakao share/fallback share button이 다른 화면에서도 필요해지면 이번 변경에서 생기는 중복만 작은 primitive/helper로 정리한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
POST /trips/{tripId}/invites
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다. Trip Owner만 호출할 수 있다.

### Path Parameters

```text
tripId: string
```

`tripId`는 서버 내부 id 형식에 맞는 string이다. 현재 DB 구현이 UUID라면 유효하지 않은 UUID 형식은 `400 VALIDATION_ERROR`로 처리한다.

### Request

No request body.

### Response: New invite created

HTTP status: `201`

```json
{
  "invite": {
    "id": "invite_123",
    "tripId": "trip_123",
    "token": "base64url-random-token",
    "inviteUrl": "https://i-um.app/invite/base64url-random-token",
    "expiresAt": "2026-06-30T15:00:00Z",
    "createdAt": "2026-06-23T15:00:00Z",
    "createdBy": "user_123"
  },
  "created": true
}
```

### Response: Existing active invite reused

HTTP status: `200`

```json
{
  "invite": {
    "id": "invite_123",
    "tripId": "trip_123",
    "token": "base64url-random-token",
    "inviteUrl": "https://i-um.app/invite/base64url-random-token",
    "expiresAt": "2026-06-30T15:00:00Z",
    "createdAt": "2026-06-23T15:00:00Z",
    "createdBy": "user_123"
  },
  "created": false
}
```

### Schemas

```yaml
TripInvite:
  type: object
  required:
    - id
    - tripId
    - token
    - inviteUrl
    - expiresAt
    - createdAt
    - createdBy
  properties:
    id:
      type: string
    tripId:
      type: string
    token:
      type: string
      minLength: 32
      maxLength: 128
      pattern: '^[A-Za-z0-9_-]+$'
      description: Opaque base64url token. UI copies inviteUrl instead of raw token.
    inviteUrl:
      type: string
      format: uri
    expiresAt:
      type: string
      format: date-time
      description: UTC ISO 8601 timestamp.
    createdAt:
      type: string
      format: date-time
      description: UTC ISO 8601 timestamp.
    createdBy:
      type: string

CreateTripInviteResponse:
  type: object
  required:
    - invite
    - created
  properties:
    invite:
      $ref: '#/components/schemas/TripInvite'
    created:
      type: boolean
      description: true when this request created a new invite, false when an existing unexpired current invite was reused.
```

Schema notes:

- `expiresAt` and `createdAt` are UTC ISO 8601 date-time strings.
- `token` is opaque and must not encode trip id or user id.
- Returning `token` is an intentional Owner-only MVP contract decision so #42 acceptance and API regression tests can look up the invite directly. Product UI still displays/copies `inviteUrl`, not the raw token.
- `inviteUrl` is built by the API server from configured invite base URL plus `/invite/{token}`.
- `inviteUrl` must use the configured HTTPS invite domain that is also used for app/universal link association and web fallback.
- The mobile UI should copy or Kakao-share `inviteUrl`, not the raw token.
- API handlers/services must avoid logging raw `token` values in normal request logs.
- #42 uses token lookup/expiry validation for acceptance; F-041 does not implement accept behavior.

### Errors

공통 에러 포맷을 따른다.

Invalid `tripId`:

HTTP status: `400`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid trip id",
    "details": []
  }
}
```

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

Authenticated user is not the trip Owner:

HTTP status: `403`

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "forbidden",
    "details": []
  }
}
```

Trip not found:

HTTP status: `404`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "trip not found",
    "details": []
  }
}
```

Unexpected server error:

HTTP status: `500`

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

## DB Changes

F-041 adds persistent invite rows. The table is also the source of truth for #42 invite acceptance.

### Tables

- `trip_invites`: 여행 초대 링크 token과 lifecycle metadata를 저장한다.

Suggested migration: `apps/api/migrations/00007_create_trip_invites.sql`

```sql
CREATE TABLE trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_invites_token_length_check CHECK (char_length(token) BETWEEN 32 AND 128),
  CONSTRAINT trip_invites_expiry_after_create_check CHECK (expires_at > created_at)
);
```

### Constraints / Indexes

- `trip_invites_token_unique`: unique index on `token`.
- `trip_invites_one_current_per_trip`: partial unique index on `trip_id` where `deactivated_at IS NULL`.
- `trip_invites_trip_id_idx`: index on `trip_id` for trip-scoped lookup.
- `trip_invites_expires_at_idx`: index on `expires_at` for future cleanup/acceptance checks.

Example:

```sql
CREATE UNIQUE INDEX trip_invites_token_unique ON trip_invites (token);
CREATE UNIQUE INDEX trip_invites_one_current_per_trip ON trip_invites (trip_id) WHERE deactivated_at IS NULL;
CREATE INDEX trip_invites_trip_id_idx ON trip_invites (trip_id);
CREATE INDEX trip_invites_expires_at_idx ON trip_invites (expires_at);
```

### Migration Notes

- `ON DELETE CASCADE` from `trips` ensures deleting a trip removes its invite rows.
- `deactivated_at` is set when the current invite is expired and replaced. F-041 does not expose a manual revoke action.
- The partial unique index makes one current invite per trip enforceable. Because `now()` cannot be used in a partial index, application logic deactivates expired current rows before inserting a new invite.
- Down migration drops `trip_invites` and related indexes.

### Repository / Transaction Notes

The create-or-return operation must be race-safe.

1. Start a transaction.
2. Lock the trip row with `SELECT id FROM trips WHERE id = $1 FOR UPDATE` before checking invite state. Advisory locks or other alternatives are out of scope unless this spec is updated.
3. Query the current invite row with `trip_id = $1 AND deactivated_at IS NULL` inside the same transaction.
4. If that row exists and `expires_at > now`, return it without mutation.
5. If that row exists and is expired, update `deactivated_at = now` for that row.
6. Insert a new invite row with a fresh token and `expires_at = now + 7 days`.
7. Treat the partial unique index and token unique index as backstops. Token collision should retry with a new token without returning a partial response.

## Business Rules

- Only authenticated trip Owners can create or read the current active invite link through `POST /trips/{tripId}/invites`.
- Member participants and non-participants receive `403 FORBIDDEN` if the trip exists but they are not Owner.
- Missing trip returns `404 NOT_FOUND`.
- Invalid `tripId` format returns `400 VALIDATION_ERROR`.
- The create-or-return invite operation runs in a transaction and locks the trip row with `SELECT ... FOR UPDATE` so concurrent Owner taps cannot create two current invite rows.
- A trip has at most one current invite row where `deactivated_at IS NULL`.
- A current invite is active only when `deactivated_at IS NULL` and `expires_at > now`.
- Invite expiry is fixed at 7 days from creation for MVP.
- If an active current invite exists, `POST /trips/{tripId}/invites` returns it without changing token, `createdAt`, or `expiresAt`.
- If the current invite is expired, the service deactivates it and creates a brand-new token/row. It does not revive or extend the old token.
- Token generation uses cryptographically secure randomness and opaque base64url format.
- `inviteUrl` is derived from API configuration and the token. The server normalizes trailing slash behavior so the URL has exactly one `/invite/{token}` suffix.
- `inviteUrl` must target an installed-app `/invite/{token}` route and a web fallback page on the same HTTPS path.
- F-041 does not create `TripParticipant` rows and does not affect participant counts.
- Future #42 acceptance must reject tokens with `expires_at <= now` or `deactivated_at IS NOT NULL`.

## Acceptance Criteria

- [ ] AC-01: 참여자 화면 진입만으로 초대 링크가 자동 생성되지 않고, Owner가 `초대 링크 만들기`를 명시적으로 눌렀을 때만 `POST /trips/{tripId}/invites`가 호출된다.
- [ ] AC-02: `packages/api-contract/openapi.yaml`에 `POST /trips/{tripId}/invites`, success schemas, and error responses가 정의되어 있다.
- [ ] AC-03: generated Go server artifact와 TypeScript client/type이 invite endpoint/types를 포함하도록 갱신되어 있다.
- [ ] AC-04: `trip_invites` migration이 token uniqueness, one-current-invite-per-trip, trip cascade delete를 보장한다.
- [ ] AC-05: Owner가 active invite가 없는 trip에 `POST /trips/{tripId}/invites`를 호출하면 `201`, `created: true`, token, absolute `inviteUrl`, `expiresAt = createdAt + 7 days`가 반환된다.
- [ ] AC-06: Owner가 unexpired current invite가 있는 trip에 다시 호출하면 `200`, `created: false`, 기존 invite의 같은 token/url/expiry가 반환된다.
- [ ] AC-07: current invite가 만료된 뒤 Owner가 호출하면 기존 row가 deactivated되고 새 token/row가 `201`, `created: true`로 반환된다.
- [ ] AC-08: invalid `tripId`, unauthenticated request, non-owner request, missing trip은 각각 `400`, `401`, `403`, `404`를 공통 에러 포맷으로 반환한다.
- [ ] AC-09: Member에게는 참여자 화면의 초대 링크 action이 표시되지 않는다.
- [ ] AC-10: Owner가 참여자 화면에서 `초대 링크 만들기`를 누르면 loading state 후 invite link card가 표시된다.
- [ ] AC-11: invite link card는 created/reused 상태에 맞는 문구, `inviteUrl`, expiry label, `카카오톡으로 공유`, `링크 복사` action을 제공한다.
- [ ] AC-12: `링크 복사`는 `inviteUrl`을 clipboard payload로 사용하고 성공 메시지를 표시한다.
- [ ] AC-13: `카카오톡으로 공유`는 KakaoTalk SDK share payload에 `inviteUrl`을 포함하고, KakaoTalk unavailable/failure 시 `링크 복사`와 `다른 앱으로 공유` fallback을 제공한다.
- [ ] AC-14: 앱에 설치된 i-um이 `inviteUrl`을 열면 `/invite/{token}` placeholder route가 표시되고, F-041에서는 accept API나 participant 생성이 실행되지 않는다.
- [ ] AC-15: 앱 미설치/미클레임 상황의 `/invite/{token}` web fallback은 App Store/Play Store 설치 이동을 제공하고 Web에서 초대 수락을 처리하지 않는다.
- [ ] AC-16: F-041 구현은 초대 수락, pending invitee 표시, participant count 변경, revoke/regenerate UI를 포함하지 않는다.
- [ ] AC-17: staging 또는 internal build에서 Owner create/reuse/copy/Kakao share/fallback happy path와 Member no-action/forbidden path를 확인하고 결과를 기록한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-01: invite API is called only after explicit Owner action, not on participants screen load | Mobile logic/state | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-02, AC-03: invite endpoint/schema/generated clients stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-04: `trip_invites` migration creates table, constraints, indexes, cascades, and rolls back | DB migration/repository | goose migration gates, `apps/api/internal/storage/trip_repository_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate && DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback && DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate` |
| AC-05: Owner with no active invite receives `201 created=true` with 7-day expiry and absolute URL | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-06: Owner with existing unexpired current invite receives `200 created=false` and same token/url/expiry | API service/repository/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/server/server_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| AC-07: expired current invite is deactivated and replaced by a new token/row | API service/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-08: invalid id, unauthenticated, non-owner, missing trip map to `400/401/403/404` common error responses | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-05, AC-07: token generation is opaque/base64url and collision handling does not expose partial rows | API service | `apps/api/internal/trip/service_test.go` or dedicated invite tests | `pnpm --filter @i-um/api test` |
| AC-09, AC-10: Owner-only mobile visibility and invite mutation states are deterministic | Mobile logic/state | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-11: expiry label and created/reused copy are formatted correctly | Mobile logic | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-12, AC-13: clipboard, Kakao share, and fallback OS share payload helpers use `inviteUrl`, not raw token | Mobile logic | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-14: `/invite/{token}` app route resolves to placeholder state without accept API side effects | Mobile route/logic | `apps/mobile/lib/trips/invite.test.mts` and route typecheck | `pnpm --filter @i-um/mobile test` |
| AC-15: web fallback route/page chooses store install links and never attempts web invite acceptance | Web/API/static fallback logic | fallback page/helper test or API handler test depending on implementation | `pnpm --filter @i-um/api test` or equivalent web fallback test |
| AC-16: implementation does not add accept/pending-count/revoke/regenerate behavior | Contract/API/Mobile review gate | code review plus absence of new accept endpoint/routes outside spec | `pnpm verify` |
| AC-09~AC-15: participants screen, invite placeholder route, and fallback integration compile with generated invite client/types | Mobile typecheck | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| API server builds after OpenAPI/sqlc changes | API build | Go build gate | `pnpm --filter @i-um/api build` |
| Full regression suite remains green | All | Workspace verify | `pnpm verify` |

AC-01~AC-16 are mapped to automated regression coverage above. AC-17 is covered by the Manual Smoke checklist below and does not replace automated regression coverage.

## Regression Gaps

- Actual KakaoTalk share and deep-link opening on real iOS/Android devices are not release blockers for F-041.
  - Risk: Platform association, Kakao app behavior, and store redirection regressions may only be caught during later device testing.
  - Follow-up: Record real-device manual verification before public release or in the #42/#43 implementation PR.

Native clipboard, KakaoTalk share sheet, OS share sheet, and app-store redirection visual behavior are covered by Manual Smoke or follow-up manual verification. Deterministic URL/share payload/fallback/placeholder state behavior must still be covered by automated tests with injectable wrappers.

## TDD Implementation Plan

Red-Green-Refactor 순서로 작성한다. 구현 계획보다 실패 테스트와 회귀 테스트 게이트를 먼저 고정한다.

1. Red: API invite service lifecycle tests 작성
   - 작업: fake repository, injected clock, deterministic token generator/base URL로 no-active create, active reuse, expired replace, owner authorization, not found, forbidden, validation cases를 먼저 작성한다.
   - Verify: `pnpm --filter @i-um/api test`가 invite service 미구현으로 실패한다.
2. Red: API handler/contract behavior tests 작성
   - 작업: `POST /trips/{tripId}/invites`의 `201`, `200`, `400`, `401`, `403`, `404` response status/body tests를 추가한다.
   - Verify: `pnpm --filter @i-um/api test`가 route/handler 미구현으로 실패한다.
3. Red: DB repository/migration tests 작성
   - 작업: `trip_invites` table/query expectations, one-current constraint, active reuse query, expired deactivation, trip delete cascade tests를 추가한다.
   - Verify: DB-backed `pnpm --filter @i-um/api test` 또는 migration command가 table/query 미구현으로 실패한다.
4. Red: Mobile invite helper/state/deep-link tests 작성
   - 작업: Owner visibility, created/reused view model, expiry label, failure status mapping, copy/Kakao share/fallback share payload helpers, `/invite/{token}` placeholder route state를 `apps/mobile/lib/trips/invite.test.mts`에 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.
5. Green: OpenAPI 계약 작성 및 generated code 갱신
   - 작업: `packages/api-contract/openapi.yaml`에 endpoint/schemas/responses를 추가하고 `pnpm generate`로 Go/TS artifacts를 갱신한다.
   - Verify: `pnpm verify:generated`가 통과한다.
6. Green: DB migration, sqlc query, repository 구현
   - 작업: `00007_create_trip_invites.sql`, invite query, sqlc generation, repository methods를 추가한다.
   - Verify: `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`, `pnpm --filter @i-um/api generate`, repository tests 통과.
7. Green: API service/handler/config 구현
   - 작업: invite base URL config, clock/token generator, create-or-return transaction, Owner authorization, error mapping, OpenAPI handler registration을 구현한다.
   - Verify: `pnpm --filter @i-um/api test`와 `pnpm --filter @i-um/api build`가 통과한다.
8. Green: Mobile generated client 연결 및 UI 구현
   - 작업: `createTripInvite(tripId)` client helper, invite helper, participant screen Owner-only card/action, loading/success/error/copy/Kakao share/fallback states, `/invite/{token}` placeholder route를 구현한다. 필요 시 `expo-clipboard`와 Kakao share SDK dependency를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`와 `pnpm --filter @i-um/mobile typecheck`가 통과한다.
9. Green: Web fallback/store install target 구현
   - 작업: `inviteUrl` domain의 `/invite/{token}` web fallback page 또는 API/static equivalent를 추가하고 iOS/Android store URL config를 연결한다. Web fallback은 accept API를 호출하지 않는다.
   - Verify: fallback helper/handler test와 config validation test가 통과한다.
10. Refactor: 중복/스타일 정리
   - 작업: 이번 변경으로 생긴 button/card/status helper 중복만 정리하고, F-040 participant list style과 design tokens를 유지한다.
   - Verify: 관련 API/mobile tests 재실행.
11. Regression gate
   - Verify: `pnpm verify`와 DB migration apply/rollback 검증을 실행한다.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

### Implementation Verification Results

Executed during F-041 implementation:

```text
pnpm verify:generated                                                   # pass
pnpm db:migrate                                                        # pass, applied 00007_create_trip_invites.sql
pnpm db:status                                                         # pass, schema at version 7
pnpm db:rollback && pnpm db:migrate                                    # pass
(cd apps/api && go test -count=1 ./internal/storage)                   # pass
pnpm --filter @i-um/api test                                           # pass
pnpm --filter @i-um/api build                                          # pass
pnpm --filter @i-um/mobile test                                        # pass
pnpm --filter @i-um/mobile typecheck                                   # pass
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=dummy-native-key \
  EXPO_PUBLIC_INVITE_LINK_HOST=invite.i-um.app \
  pnpm --filter @i-um/mobile exec expo config --type public --json     # pass
```

`pnpm verify` as a single combined command was not rerun after the final copy-only adjustment; the same generated/API/mobile gates above were run individually.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Owner 계정으로 여행 상세 → 참여자 화면에 진입하면 `동행자 초대` card와 `초대 링크 만들기` action이 보인다.
- [ ] Owner가 `초대 링크 만들기`를 누르면 link card가 표시되고 `초대 링크가 준비됐어요.` 문구, `inviteUrl`, expiry label이 보인다.
- [ ] 같은 Owner가 다시 `초대 링크 만들기`를 누르거나 화면을 다시 열어 action을 실행하면 기존 active link가 재사용되고 `기존 초대 링크를 불러왔어요.` 문구가 보인다.
- [ ] `링크 복사` 후 clipboard에 `inviteUrl`이 들어가고 성공 메시지가 보인다.
- [ ] KakaoTalk이 설치된 내부 빌드/기기에서 `카카오톡으로 공유`가 KakaoTalk 공유 화면을 열고 payload에 `inviteUrl`이 포함된다. F-041에서는 추후 수동 검증 가능하며 release blocker가 아니다.
- [ ] KakaoTalk 미설치 또는 SDK 실패 상태에서 fallback 안내가 표시되고 `링크 복사`와 `다른 앱으로 공유`를 사용할 수 있다.
- [ ] fallback `다른 앱으로 공유`가 platform share sheet를 열고 payload에 `inviteUrl`이 포함된다.
- [ ] 설치된 앱에서 `inviteUrl`을 열면 `/invite/{token}` placeholder가 표시된다. F-041에서는 추후 수동 검증 가능하며 release blocker가 아니다.
- [ ] 앱 미설치 상태에서 `inviteUrl`을 열면 web fallback이 열리고 App Store/Play Store 설치 이동을 제공한다. F-041에서는 추후 수동 검증 가능하며 release blocker가 아니다.
- [ ] Member 계정으로 같은 여행의 참여자 화면에 진입하면 초대 링크 action이 보이지 않는다.
- [ ] stale Owner UI 또는 직접 API 요청으로 `403`이 발생하면 권한 오류 문구가 표시된다.
- [ ] staging/internal build에서 configured invite base URL이 기대한 domain/scheme으로 생성된다.
- [ ] staging/internal build의 `inviteUrl` domain/scheme이 Kakao Developers 앱 설정의 link target/domain 허용 목록과 맞아 KakaoTalk 공유가 차단되지 않는다.

## Release Notes

```text
- 여행 Owner가 참여자 화면에서 동행자에게 보낼 초대 링크를 만들고 복사하거나 카카오톡으로 공유할 수 있게 한다.
- 공유된 링크는 설치된 앱의 초대 placeholder route로 열리고, 앱 미설치 시 store 설치 fallback을 제공한다.
- 초대 링크 수락과 로그인 handoff는 후속 기능에서 연결한다.
```

## Open Questions

- None.

MVP decisions fixed by this spec:

- 한 trip당 current active invite 1개
- 7일 고정 만료
- active invite 재사용, expired invite는 deactivated 후 새 row 생성
- Owner-only 생성
- API가 absolute `inviteUrl` 반환
- primary 공유 action은 KakaoTalk SDK 기반 `카카오톡으로 공유`, OS share sheet는 fallback
- `inviteUrl`은 설치된 i-um 앱의 `/invite/{token}` route를 열어야 함
- F-041은 `/invite/{token}` placeholder screen을 포함하고 실제 수락은 #42로 분리
- 앱 미설치/미클레임 시 `/invite/{token}` web fallback은 App Store/Play Store 설치 이동 제공
- 실제 iOS/Android KakaoTalk E2E와 app-store redirection은 F-041 release blocker가 아니며 추후 수동 검증으로 기록

## Follow-up Issues

- #42: 초대 링크 수락
- #43: 초대 링크 로그인 handoff
- #44: 초대 후 마이페이지 반영
- #45: 참여자 제거
- #46: 공동 일정 편집 반영
