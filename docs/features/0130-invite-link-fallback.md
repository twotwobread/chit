# Feature Slice: F-130 초대 링크 앱 미설치/앱 링크 fallback 핸들링

## Metadata

- GitHub Issue: #130
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-26
- Updated: 2026-06-26

## Source

- Issue: #130 — https://github.com/twotwobread/i-um/issues/130
- Ouroboros/PM/Seed: Interview `interview_20260626_023145`; Seed `seed_03f1674f97ad`; ambiguity score `0.10`
- Notes: Ouroboros와 사용자 확인으로 F-130 MVP는 fallback page + 명시적 token/link 보존 재시도 안내로 한정한다. Deferred deep link / 설치 후 자동 resume은 #130 범위가 아니다.

## Goal

초대 링크 수신자가 앱 설치 여부나 HTTPS 앱 링크 동작 여부와 관계없이 초대 token을 잃지 않고 i-um 앱의 `/invite/{token}` 수락 화면까지 도달할 수 있게 한다.

F-130은 앱 링크 운영 연결과 웹 fallback UX를 닫는 slice다. 앱에 들어온 뒤의 로그인 handoff는 F-043, 실제 수락 API/상태 처리는 F-042를 재사용한다.

## User Flow

### A. 앱 설치 + HTTPS 앱 링크가 정상 동작하는 경우

1. 수신자가 `https://<invite-host>/invite/{token}` 링크를 누른다.
2. OS가 invite host의 association file을 확인하고 i-um 앱을 연다.
3. 앱은 Expo Router `/invite/{token}` 화면으로 진입한다.
4. 로그인 상태이면 기존 F-042 흐름이 `POST /invites/{token}/accept`를 호출하고 결과 상태를 보여준다.
5. 비로그인/세션 만료 상태이면 기존 F-043 handoff가 같은 `/invite/{token}`로 로그인 후 복귀시킨다.

### B. 앱 미설치 또는 HTTPS 앱 링크가 앱으로 열리지 않는 경우

1. 같은 초대 링크가 브라우저/KakaoTalk 인앱 브라우저에서 API 서버의 `/invite/{token}` fallback page로 열린다.
2. fallback page는 설치 버튼, 앱에서 열기 재시도, 전체 초대 링크 복사, token 표시, “설치 후 이 초대 링크를 다시 열어주세요.” 안내를 제공한다.
3. 앱이 이미 설치되어 있으면 사용자는 `앱에서 열기`로 custom scheme deep link를 재시도하거나, 전체 초대 링크를 복사해 기본 브라우저에서 다시 연다.
4. 앱이 없으면 사용자는 App Store / Google Play에서 설치한 뒤 원래 메시지의 초대 링크 또는 복사해둔 초대 링크를 다시 연다.
5. 앱이 `/invite/{token}`로 열리면 이후는 A flow와 동일하다.

### C. 앱 설치 + 비로그인 사용자의 연결

1. fallback 또는 앱 링크 재시도 후 앱이 `/invite/{token}` 화면으로 열린다.
2. 저장된 세션이 없거나 손상되어 있으면 앱은 accept API를 호출하지 않고 F-043의 로그인 안내를 보여준다.
3. 로그인 성공 후 F-043은 같은 `/invite/{token}`로 돌아오고, F-042 수락 화면이 기존 수락 흐름을 실행한다.

## Scope

- App UI: no new invite acceptance UI expected
  - Existing `apps/mobile/app/invite/[token].tsx` and `apps/mobile/app/login.tsx` behavior from F-042/F-043 is reused.
  - `apps/mobile/app.config.ts` invite host / associated domain / intent filter configuration must remain aligned with the server invite host.
- Web/Fallback UI: yes
  - `apps/api/internal/server/invite_fallback.go` fallback HTML copy/actions.
- API Contract: no OpenAPI changes
  - Add/serve non-OpenAPI public web/app-link endpoints under `/.well-known/*`.
- API Server: yes
  - `GET /invite/{token}` fallback page improvements.
  - `GET /.well-known/apple-app-site-association`.
  - `GET /.well-known/assetlinks.json`.
  - Environment/config plumbing for app association metadata.
- DB: no changes.
- Tests: API server handler tests, mobile/app-config regression gate if touched, existing F-042/F-043 mobile tests, manual device smoke.
- Deploy/Smoke: needed — staging invite host must serve well-known files and fallback page; iPhone actual device Safari/KakaoTalk smoke is required before release.

## Out of Scope

- Deferred deep linking or automatic post-install resume.
- Web에서 로그인하거나 초대를 수락하는 flow.
- 새 invite code 입력 화면 또는 token 수동 입력 UI. Fallback의 token 표시는 보존/지원용이며, 사용자가 앱에 코드를 입력하는 경로를 의미하지 않는다.
- F-042 invite acceptance API, token 만료/무효/이미 참여/owner 처리 규칙 변경.
- F-043 login handoff 내부 설계 변경. F-130은 해당 흐름이 같은 token으로 연결되는지 회귀 확인만 한다.
- 초대 링크 생성 정책, revoke/regenerate, pending invitee 표시, rate limit.
- App Store / Play Store listing 생성 자체. Store URL은 기존 env/config 값을 사용한다.

## Requirements

### UI / UX

#### `/invite/{token}` fallback page

- Page language is Korean, friendly, short, and action-oriented.
- The page must not call `POST /invites/{token}/accept` or imply that invite acceptance can happen on web.
- Missing token still returns `404`.
- The fallback page does not need to determine whether the token exists, is expired, or is already used. F-042/F-043 remain the source of truth after the app route opens.
- Required visible content/actions:
  - Title: `이음 앱에서 초대 링크를 열어주세요.` or equivalent.
  - Main guidance: `앱이 없다면 먼저 설치한 뒤, 이 초대 링크를 다시 열어주세요.`
  - Installed-app retry guidance: `앱이 설치되어 있는데 열리지 않으면 앱에서 열기 또는 초대 링크 복사를 사용해주세요.`
  - Primary install CTA based on User-Agent:
    - iOS UA: App Store button only.
    - Android UA: Google Play button only.
    - unknown/desktop UA: App Store and Google Play buttons.
  - Installed-app retry CTA: `앱에서 열기` linking to the custom scheme route for the same token, e.g. `ium://invite/{token}`. The scheme should be configurable with default `ium` to match `apps/mobile/app.json`.
  - Copy/reopen section:
    - Display the canonical HTTPS invite URL, not only `/invite/{token}`.
    - Provide `초대 링크 복사` using `navigator.clipboard` when available.
    - Keep the URL visible/selectable for browsers where clipboard JS is blocked.
    - Display the token as `초대 코드` or `초대 token` for support/reference, but do not present it as an in-app entry code.
- Store button URLs use existing `INVITE_APP_STORE_URL` / `INVITE_PLAY_STORE_URL` config with existing defaults.
- Canonical invite URL uses configured `INVITE_BASE_URL` when available, with exactly one `/invite/{token}` suffix. Local/test fallback may use the request host only when config is absent.
- User-provided token values must be HTML-escaped in the page and URL/scheme-encoded in links.

#### iOS Universal Link association

- The invite host must serve `GET /.well-known/apple-app-site-association` without authentication and without redirect.
- Response requirements:
  - Status `200` only when iOS app association config is present.
  - `Content-Type: application/json`.
  - Body includes configured full Apple App IDs, e.g. `<TEAM_ID>.com.twotwobread.ium.staging`.
  - Body restricts app links to `/invite/*` paths.
- Proposed config:
  - `INVITE_IOS_APP_IDS`: comma-separated full Apple App IDs (`TEAM_ID.bundleIdentifier`).
- If config is missing, the endpoint must not serve an invalid association file. Return `404` or equivalent safe disabled behavior, and staging/release verification must mark this as blocking until configured.
- `apps/mobile/app.config.ts` must keep `ios.associatedDomains` containing `applinks:<EXPO_PUBLIC_INVITE_LINK_HOST>` for the same invite host that serves the AASA file.

#### Android App Link association

- The invite host must serve `GET /.well-known/assetlinks.json` without authentication and without redirect.
- Response requirements:
  - Status `200` only when Android package/fingerprint config is present.
  - `Content-Type: application/json`.
  - Body includes relation `delegate_permission/common.handle_all_urls`.
  - Body includes package name matching the Android build (`com.twotwobread.ium` by current app config) and SHA-256 signing certificate fingerprints.
- Proposed config:
  - `INVITE_ANDROID_PACKAGE_NAME`: defaults to `com.twotwobread.ium` if absent.
  - `INVITE_ANDROID_SHA256_CERT_FINGERPRINTS`: comma-separated SHA-256 certificate fingerprints for the relevant EAS/Play signing certs.
- If fingerprint config is missing, the endpoint must not serve an invalid assetlinks file. Return `404` or equivalent safe disabled behavior, and record Android verification as a gap/follow-up for that environment.
- `apps/mobile/app.config.ts` must keep an Android intent filter with `autoVerify: true`, scheme `https`, invite host, and `pathPrefix: '/invite'`.

#### Installed app route and login handoff

- App link / custom scheme entry must resolve to the existing Expo Router `/invite/{token}` route.
- F-130 does not change F-042 token validation or accept-state copy.
- Logged-out users who reach `/invite/{token}` must see F-043 login handoff copy and return to the same token after successful login.
- Unsafe URLs, query strings, path traversal, or non-invite paths must not be stored as login handoff paths; this remains governed by F-043 tests.

### API Contract

No OpenAPI contract changes.

F-130 adds public web/app-link endpoints outside `packages/api-contract/openapi.yaml`:

```text
GET /invite/{token}
GET /.well-known/apple-app-site-association
GET /.well-known/assetlinks.json
```

The existing invite acceptance API remains unchanged and is called only by the mobile app route:

```text
POST /invites/{token}/accept
```

### DB Changes

No DB changes.

F-130 stores no new invite state. The fallback page is stateless and only echoes the URL token safely.

### Business Rules

- The exact token embedded in `/invite/{token}` must be preserved across fallback, copy, custom scheme retry, app route, and login handoff.
- Fallback page must be useful both for app-not-installed users and installed users whose HTTPS app link did not open the app.
- Web fallback must never become a second acceptance surface.
- Missing app association config should fail closed instead of publishing malformed AASA/assetlinks metadata.
- iOS/Android OS-level app link behavior is a deployment/device concern; automated tests cover server output and config shape, while manual smoke proves real opening behavior.

## Acceptance Criteria

- [x] AC-01: `docs/features/0130-invite-link-fallback.md` contains the reviewed F-130 spec and TDD implementation plan with Ouroboros interview/seed metadata.
- [x] AC-02: The invite host serves `/.well-known/apple-app-site-association` with configured Apple App ID(s), `/invite/*` restriction, `application/json`, no auth, and no redirect.
- [x] AC-03: The invite host serves `/.well-known/assetlinks.json` with configured Android package/fingerprint metadata, `application/json`, no auth, and no redirect; if Android staging support is intentionally deferred, the missing verification is recorded as a follow-up.
- [x] AC-04: `apps/mobile/app.config.ts` invite host config matches the staging invite host and retains iOS associated domain + Android `autoVerify` intent filter for `/invite` paths.
- [ ] AC-05: App-installed iOS users opening `https://<invite-host>/invite/{token}` from Safari reach the mobile `/invite/{token}` screen in an internal/staging build.
- [ ] AC-06: App-installed Android users opening `https://<invite-host>/invite/{token}` reach the mobile `/invite/{token}` screen, or Android actual-device verification is explicitly deferred with a follow-up.
- [x] AC-07: App-not-installed users opening the invite URL see the fallback page with correct platform install button(s), not a web accept flow.
- [x] AC-08: Installed users whose HTTPS app link opens the fallback page can preserve the token via `앱에서 열기`, full invite-link copy, and visible URL/token guidance.
- [x] AC-09: Fallback page copy clearly says to install the app and reopen the same invite link; it does not imply deferred automatic resume.
- [x] AC-10: Fallback page HTML safely escapes token values and builds canonical HTTPS/custom-scheme links without double slashes or raw unescaped token injection.
- [x] AC-11: Logged-out users who eventually reach `/invite/{token}` continue through existing F-043 login handoff and return to the same token after login.
- [x] AC-12: Existing F-042 invite acceptance result/error states remain unchanged after F-130.
- [ ] AC-13: iPhone actual-device smoke records Safari and KakaoTalk/in-app-browser results for installed, uninstalled/fallback, and logged-out paths.
- [x] AC-14: No OpenAPI, DB migration, sqlc, generated API/server/client artifacts change for F-130.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02: AASA endpoint serves configured app IDs, `/invite/*`, JSON content type, no auth, and fail-closed missing config | API server handler | `apps/api/internal/server/server_test.go` or `apps/api/internal/server/invite_app_links_test.go` | `pnpm --filter @i-um/api test` |
| AC-03: assetlinks endpoint serves configured Android package/fingerprints, JSON content type, no auth, and fail-closed missing fingerprint config | API server handler | `apps/api/internal/server/server_test.go` or `apps/api/internal/server/invite_app_links_test.go` | `pnpm --filter @i-um/api test` |
| AC-07~AC-10: fallback page shows install buttons by User-Agent, canonical full invite URL, app-open custom scheme, copy guidance, safe escaping, and no web accept copy/action | API server handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-04: mobile app config still emits associated domain and Android intent filter for the configured invite host | Mobile config/type gate | `apps/mobile/app.config.ts`; add a focused config test if app config import remains practical | `pnpm --filter @i-um/mobile typecheck` |
| AC-11: logged-out invite route preserves same token through login handoff | Mobile regression | Existing `apps/mobile/lib/trips/invite-login-handoff.test.mts` and invite tests | `pnpm --filter @i-um/mobile test` |
| AC-12: existing invite accept result/error view models unchanged | Mobile regression | Existing `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-14: OpenAPI/DB/generated artifacts untouched | Contract/API/DB drift | Targeted diff gate | `pnpm verify:generated`; `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |
| AC-05, AC-07, AC-08, AC-11, AC-13: real Universal Link/fallback/Kakao behavior | Manual device smoke | Staging API + iOS internal build | Manual checklist in Verification Record |

## Regression Gaps

- iOS Universal Link and Android App Link OS dispatch cannot be fully automated by repo unit tests.
  - Risk: Correct server JSON and mobile config may still fail because of domain redirects, CDN/cache, Apple Team ID, Android signing fingerprint, or OS app-link cache.
  - Follow-up: Mandatory staging/internal-build device smoke before release.
- KakaoTalk/Safari/in-app browser behavior cannot be proven in Node/Go tests.
  - Risk: An in-app browser may block custom scheme or clipboard actions, making fallback guidance less effective.
  - Follow-up: Record iPhone Safari and KakaoTalk smoke results; adjust copy if one browser blocks a primary action.
- Android actual-device verification may require an Android internal build and the exact EAS/Play signing certificate fingerprint.
  - Risk: Android app link support may remain unverified even though assetlinks is implemented.
  - Follow-up: If fingerprint/device is unavailable for this slice, record explicit Android follow-up from #130 before marking release-ready.

## TDD Implementation Plan

1. Red: Add API tests for app association endpoints
   - Add failing tests for `GET /.well-known/apple-app-site-association` with configured `INVITE_IOS_APP_IDS` equivalent config.
   - Add failing tests for missing iOS config returning safe disabled behavior.
   - Add failing tests for `GET /.well-known/assetlinks.json` with configured Android package/fingerprints and missing fingerprint behavior.
   - Verify: `pnpm --filter @i-um/api test` fails.
2. Green: Implement app association endpoints
   - Add config fields/env parsing for iOS app IDs, Android package name, and Android SHA-256 fingerprints.
   - Add handler(s) under `apps/api/internal/server` and register both `/.well-known/*` routes before the OpenAPI handler.
   - Return JSON with no auth and fail closed when required config is missing.
   - Do not modify `packages/api-contract/openapi.yaml`.
   - Verify: `pnpm --filter @i-um/api test`.
3. Red: Expand fallback page tests
   - Add failing tests for iOS/Android/unknown User-Agent install-button selection.
   - Add tests that the body includes canonical full invite URL, custom scheme app-open link, copy/reopen guidance, visible token, and no web acceptance action/copy.
   - Add escaping/encoding test with a token containing characters that would be unsafe if not escaped.
   - Verify: `pnpm --filter @i-um/api test` fails.
4. Green: Improve fallback page
   - Pass canonical invite URL and app scheme URL into the template.
   - Add `앱에서 열기`, `초대 링크 복사`, visible canonical URL, and install/reopen copy.
   - Keep existing platform-specific store button behavior.
   - Use template escaping and URL/path escaping for token-derived links.
   - Verify: `pnpm --filter @i-um/api test`.
5. Red/Review: Mobile app-link config regression
   - If practical, add a focused test around app config output for `EXPO_PUBLIC_INVITE_LINK_HOST=invite.i-um.test` asserting `applinks:invite.i-um.test` and Android `https` `/invite` intent filter.
   - If importing `app.config.ts` in the current test harness is too invasive, keep this as a typecheck/review gate and record the automation gap.
   - Verify: `pnpm --filter @i-um/mobile test` or `pnpm --filter @i-um/mobile typecheck`.
6. Green: Keep mobile route behavior unchanged unless a config regression test requires a small refactor
   - Do not change F-042 accept API behavior or F-043 handoff semantics.
   - Ensure any app-config refactor preserves current defaults: host `invite.i-um.app`, scheme `ium`, iOS associated domain, Android intent filter.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck`.
7. Drift gates
   - Verify no OpenAPI/DB/generated changes were introduced.
   - Commands:
     - `pnpm verify:generated`
     - `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`
8. Staging deploy/smoke preparation
   - Configure staging API env:
     - `INVITE_BASE_URL=https://<invite-host>`
     - `INVITE_IOS_APP_IDS=<TEAM_ID>.com.twotwobread.ium.staging`
     - `INVITE_ANDROID_PACKAGE_NAME=com.twotwobread.ium`
     - `INVITE_ANDROID_SHA256_CERT_FINGERPRINTS=<fingerprint>` if Android is in scope for the environment
     - existing `INVITE_APP_STORE_URL` / `INVITE_PLAY_STORE_URL` as needed
   - Build/install an internal app with `EXPO_PUBLIC_INVITE_LINK_HOST=<invite-host>`.
9. Manual smoke gate
   - iPhone Safari: app installed + logged in opens `/invite/{token}`.
   - iPhone Safari: app installed + logged out opens `/invite/{token}`, login returns to same token.
   - iPhone KakaoTalk/in-app browser: link opens app or fallback page; fallback actions preserve token.
   - iPhone app not installed/unclaimed case: fallback page shows install and copy/reopen guidance.
   - Android: repeat installed/fallback smoke if device/build/fingerprint are available; otherwise record explicit follow-up.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass after `pnpm install --frozen-lockfile` restored worktree dependencies.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass.
- `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: pass.

### Manual Smoke

- iPhone Safari installed-app Universal Link: not run — implementation/staging required.
- iPhone KakaoTalk/in-app browser fallback: not run — implementation/staging required.
- iPhone app-not-installed fallback: not run — implementation/staging required.
- Android App Link/fallback: not run — implementation/staging and signing fingerprint required.

## Release Notes

- 초대 링크가 앱으로 바로 열리지 않거나 앱이 설치되어 있지 않은 경우에도 설치/앱 열기/초대 링크 복사 안내를 제공해 초대 수락으로 돌아갈 수 있게 한다.
- iOS/Android 앱 링크 association 파일을 invite host에서 제공해 실제 Universal Link/App Link 연결을 완성한다.

## Open Questions

- None for MVP spec. Android actual-device verification can be recorded as a follow-up only if the required Android build/signing fingerprint/device is unavailable during implementation.

## Follow-up Issues

- Deferred deep linking / 설치 후 자동 invite resume: follow-up issue needed if product later wants automatic post-install continuation.
- Android actual-device verification follow-up: create only if #130 implementation cannot access the Android signing fingerprint or device/build needed for smoke.
