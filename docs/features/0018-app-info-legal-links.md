# Feature Slice: F-018 앱 정보/약관/개인정보 링크

## Metadata

- GitHub Issue: #18
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Readiness / Status Gate

- Canonical MVP URLs are now selected as GitHub Pages URLs served from this repository's `legal-site/` directory.
- Terms URL: `https://twotwobread.github.io/i-um/terms/`
- Privacy Policy URL: `https://twotwobread.github.io/i-um/privacy/`
- This feature may proceed to implementation using those URLs.
- `Done` cannot be claimed until the URLs are centralized in mobile config/helper code, covered by automated helper/state tests, and verified after GitHub Pages deployment or equivalent manual smoke.

## Ouroboros Source

- Interview Session: `interview_20260622_132646`
- Seed: `seed_df8d51a0c4d7`
- PM Document: N/A
- Notes: Ambiguity score `0.0665`. Ouroboros clarified that F-018 is a mobile-only My Page settings slice. It locks the settings order, row labels, external-link behavior, failure copy, regression test expectations, and the readiness gate that canonical production Terms/Privacy URLs must be supplied before implementation can start.

Context clarified before drafting:

- F-013 owns the authenticated `마이페이지` shell, `설정` section, `계정 관리`, and `로그아웃` actions.
- F-018 extends the existing My Page settings section instead of creating a separate screen.
- `앱 버전` is displayed as non-tappable information sourced from the committed Expo app config. The current app version is `0.1.0` in `apps/mobile/app.json`.
- `서비스 이용약관` and `개인정보처리방침` are tappable rows that open canonical MVP GitHub Pages URLs in an external browser.
- The canonical MVP URLs are `https://twotwobread.github.io/i-um/terms/` and `https://twotwobread.github.io/i-um/privacy/`.

## Goal

로그인한 사용자가 마이페이지의 `설정` 섹션에서 현재 앱 버전을 확인하고, 서비스 이용약관과 개인정보처리방침을 외부 브라우저로 열 수 있다.

F-018은 앱 심사와 사용자 신뢰에 필요한 최소 앱 정보/법적 링크 surface를 마이페이지에 추가하는 mobile-only slice다. Issue #18 범위는 앱 버전과 약관/개인정보처리방침 링크를 노출하는 데 한정되며, 인접 settings 기능 고도화나 법적 동의 모델은 포함하지 않는다.

## Problem

- 현재 마이페이지에는 계정 관리와 로그아웃 진입점은 있지만 앱 버전, 약관, 개인정보처리방침을 확인할 방법이 없다.
- 사용자는 계정/설정 맥락에서 앱 정보와 법적 문서를 쉽게 찾을 수 있어야 한다.
- 앱 배포 및 심사 과정에서는 앱 안에서 약관/개인정보처리방침에 접근 가능한 경로가 필요하다.

## User Flow

1. 사용자가 로그인한 상태로 하단 메뉴의 `마이`를 눌러 마이페이지를 연다.
2. 앱은 기존 프로필, 내 여행, 설정 섹션을 표시한다.
3. 사용자는 `설정` 섹션에서 `계정 관리` 아래, `로그아웃` 위에 있는 앱 정보/법적 링크 그룹을 확인한다.
4. 사용자는 `앱 버전` row에서 현재 앱 버전을 확인한다.
5. 사용자가 `서비스 이용약관` row의 `열기` action을 누르면 앱은 외부 브라우저로 서비스 이용약관 URL을 연다.
6. 사용자가 `개인정보처리방침` row의 `열기` action을 누르면 앱은 외부 브라우저로 개인정보처리방침 URL을 연다.
7. 외부 링크 열기에 실패하면 앱은 설정 그룹 안에 `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`를 표시하고 마이페이지의 다른 기능은 계속 사용할 수 있게 한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 기존 `마이페이지`의 `설정` 섹션에 앱 정보/법적 링크 그룹 추가
- [ ] App UI: `계정 관리`는 settings 내 첫 action으로 유지하고, `로그아웃`은 마지막 action으로 유지
- [ ] App UI: `앱 버전` non-tappable row 표시
- [ ] App UI: `서비스 이용약관`, `개인정보처리방침` tappable rows 표시
- [ ] App UI: 링크 열기 중 중복 tap 방지 또는 in-flight tap 무시
- [ ] App UI: 링크 열기 실패 시 group-level inline error 표시 및 성공 시 error clearing
- [ ] Mobile Config/Helper: 앱 버전과 legal link 정의를 중앙화하고 screen JSX에 URL을 흩뿌리지 않는다
- [ ] Legal Site: `legal-site/`에 MVP 서비스 이용약관/개인정보처리방침 정적 페이지를 추가한다
- [ ] GitHub Pages: `legal-site/`만 GitHub Pages artifact로 배포하는 workflow를 추가한다
- [ ] Tests: 앱 정보/legal row view-model, version mapping, link-opening success/failure state를 mobile unit test로 검증
- [ ] Verification: mobile typecheck, `pnpm verify`, Expo device/simulator manual smoke
- [ ] API Contract: 변경 없음
- [ ] API Server: 변경 없음
- [ ] DB: 변경 없음

Scope control: this spec is limited to GitHub Issue #18 only. It does not include hidden follow-on implementation, platform expansion, or adjacent settings refactors beyond the app version and legal-link rows described here.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 앱 안에서 약관/개인정보처리방침 HTML/Markdown을 렌더링하는 WebView 또는 native screen
- 법무 검토가 완료된 최종 약관/개인정보처리방침 작성
- custom domain 연결 또는 기존 GitHub Pages URL의 리다이렉트 설계
- 약관 동의, 재동의, 동의 이력 저장
- 개인정보 처리 목적/수집 항목/보관 기간 문구 작성
- 마케팅 수신 동의, 위치정보 이용약관, 오픈소스 라이선스 화면
- 고객센터, 문의하기, 사업자 정보, 법적 고지 전체 settings 고도화
- App Store/Play Store build number, OTA update id, git commit hash 표시
- `계정 관리`, `로그아웃`, 프로필, 내 여행 동작 변경
- 하단 navigation 구조 변경
- API endpoint, DB schema, OpenAPI 변경
- placeholder URL로 기능을 완료 처리하는 것

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx` 또는 현재 마이페이지 route
  - 기존 header, profile summary, my trips, bottom menu는 유지한다.
  - `설정` section 내부 순서를 다음처럼 유지한다.
    1. `계정 관리`
    2. 앱 정보/법적 링크 group
    3. `로그아웃`
  - 앱 정보/법적 링크 group은 같은 settings card 안에서 작은 row group으로 표시한다.
  - 정확한 파일/컴포넌트 구조는 구현 시 기존 Expo Router와 My Page 코드 구조에 맞춰 조정할 수 있지만 사용자 흐름과 순서는 유지한다.

### Settings Rows

- `앱 버전`
  - non-tappable row다.
  - 오른쪽 또는 보조 text로 현재 앱 버전을 표시한다.
  - version source는 committed Expo app config다. 현재 값은 `apps/mobile/app.json`의 `expo.version = 0.1.0`이다.
- `서비스 이용약관`
  - tappable row다.
  - 오른쪽 affordance text는 `열기`다.
  - `https://twotwobread.github.io/i-um/terms/`를 외부 브라우저로 연다.
- `개인정보처리방침`
  - tappable row다.
  - 오른쪽 affordance text는 `열기`다.
  - `https://twotwobread.github.io/i-um/privacy/`를 외부 브라우저로 연다.

### Interaction

- 제품 UI에 icon처럼 보이는 emoji나 임의 unicode chevron을 추가하지 않는다.
- 별도 icon set을 도입하지 않는다.
- 링크 row는 label과 `열기` text affordance만으로 tappable함을 표현한다.
- 링크 열기 promise가 settle되기 전에는 해당 row만 비활성화하거나 같은 row의 중복 tap을 무시한다.
- 한 링크를 여는 동안 다른 링크 row까지 전역으로 막는 동작은 필요하지 않다.
- 링크 열기 성공 시 기존 group-level error를 지운다.
- 링크 열기 실패 시 legal group 아래에 하나의 inline error를 표시한다.
- screen reload 또는 마이페이지 재진입 시 link error state는 초기화된다.

### States

- Loading: F-018 자체 추가 loading state는 없다. 기존 마이페이지 loading state는 F-013 동작을 유지한다.
- Empty: 앱 정보/법적 링크 group에는 empty state가 없다. MVP canonical URLs are fixed in the centralized helper.
- Error: 외부 링크 열기에 실패하면 `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`를 group-level inline error로 표시한다.
- Success: 앱 버전이 보이고, 약관/개인정보처리방침 row를 눌러 외부 브라우저를 열 수 있다.

### Copy / Labels

- Settings section title: `설정`
- Account management CTA: `계정 관리`
- App version label: `앱 버전`
- Terms label: `서비스 이용약관`
- Privacy label: `개인정보처리방침`
- Link affordance: `열기`
- Link open failure: `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`
- Logout CTA: `로그아웃`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 법적 링크 row는 기존 settings card/list row 패턴과 맞춘다.
- `열기` affordance는 `theme.color.textLink` 또는 existing primary text style을 사용한다.
- 같은 row/view-model formatting이 screen JSX에 흩어지지 않도록 작은 helper로 분리한다.

## API Contract

No API changes.

F-018은 모바일 앱의 settings UI와 외부 링크 opening만 변경한다. OpenAPI, generated Go server interface, generated TypeScript client는 변경하지 않는다.

## DB Changes

No DB changes.

F-018은 사용자 데이터, 약관 동의 이력, 설정 저장값을 새로 저장하지 않는다.

## Business Rules

The following behavior is locked for F-018 implementation.

- 앱 정보/법적 링크는 로그인된 사용자의 마이페이지 settings 안에서 제공한다.
- `계정 관리`는 settings의 첫 action으로 유지한다.
- `로그아웃`은 settings의 마지막 action으로 유지한다.
- `앱 버전`은 사용자에게 표시만 하며 tap action을 제공하지 않는다.
- `앱 버전`은 committed Expo app config source와 어긋나면 안 된다.
- `서비스 이용약관`과 `개인정보처리방침`은 canonical MVP GitHub Pages URL을 사용해야 한다.
- Terms/Privacy URL은 screen JSX에 직접 하드코딩하지 않고 centralized mobile config/helper에 둔다.
- placeholder, example.com, 빈 문자열, staging 임시 URL은 Done 기준을 만족하지 않는다.
- `legal-site/`는 MVP용 법적 문서를 제공하지만, 실제 외부 production launch 전 운영자/사업자/문의 정보를 최종값으로 교체해야 한다.
- 링크 열기 실패는 마이페이지 전체 error로 승격하지 않고 legal group 안의 inline error로 처리한다.
- 링크 열기 실패 후에도 계정 관리, 로그아웃, 내 여행 등 기존 마이페이지 기능은 계속 사용할 수 있어야 한다.
- F-018은 API, DB, 인증, 약관 동의 모델을 변경하지 않는다.

## Acceptance Criteria

- [ ] `docs/features/0018-app-info-legal-links.md`에 feature spec + implementation plan이 작성되어 있다.
- [ ] canonical MVP Terms URL과 Privacy Policy URL이 spec과 centralized mobile helper에 기록되어 있다.
- [ ] 마이페이지 `설정` section은 `계정 관리`를 먼저 표시하고 `로그아웃`을 마지막에 표시한다.
- [ ] `계정 관리`와 `로그아웃` 사이에 앱 정보/법적 링크 group이 표시된다.
- [ ] 앱 정보/법적 링크 group에는 non-tappable `앱 버전` row가 있다.
- [ ] `앱 버전` row는 committed Expo app config source의 현재 version을 표시한다.
- [ ] 앱 정보/법적 링크 group에는 tappable `서비스 이용약관` row가 있다.
- [ ] 앱 정보/법적 링크 group에는 tappable `개인정보처리방침` row가 있다.
- [ ] `서비스 이용약관`과 `개인정보처리방침` row는 icon/chevron 없이 `열기` text affordance를 표시한다.
- [ ] `서비스 이용약관` row를 누르면 external browser가 `https://twotwobread.github.io/i-um/terms/`로 열린다.
- [ ] `개인정보처리방침` row를 누르면 external browser가 `https://twotwobread.github.io/i-um/privacy/`로 열린다.
- [ ] 링크 열기 중 같은 row의 반복 tap은 duplicate open을 만들지 않도록 비활성화되거나 무시된다.
- [ ] 링크 열기 실패 시 `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`가 legal group 아래에 표시된다.
- [ ] 링크 열기 성공 또는 screen reload 후 link error message가 사라진다.
- [ ] Terms/Privacy URL과 app info/legal row 정의는 centralized mobile config/helper에 있고 screen JSX에 URL이 흩어져 있지 않다.
- [ ] `legal-site/terms/`와 `legal-site/privacy/`에 MVP 법적 문서 정적 페이지가 있다.
- [ ] GitHub Pages workflow는 repository `docs/`가 아니라 `legal-site/`만 배포한다.
- [ ] F-018은 OpenAPI, API server, DB migration을 변경하지 않는다.
- [ ] 앱 정보/legal helper 또는 state reducer의 success/failure behavior가 mobile automated test로 검증된다.
- [ ] 신규 app-info/legal mobile tests가 `pnpm --filter @i-um/mobile test`에서 실행된다.
- [ ] 모바일 typecheck와 `pnpm verify`가 통과한다.
- [ ] Expo simulator/device 또는 internal build에서 version 표시, Terms 링크 열기, Privacy 링크 열기 happy path를 확인하고 결과를 기록한다.
- [ ] placeholder URL이나 missing URL 상태로 Done을 주장하지 않는다.

### Acceptance to Verification Mapping

- Spec/readiness criteria: verified by spec review and centralized URL constants before implementation completion.
- Settings order, row labels, tappable/non-tappable status, centralized URL config: verified by mobile helper/view-model tests and mobile typecheck.
- External browser opening, failure copy, error clearing, duplicate tap handling: verified by fake-opener mobile state tests plus device/simulator manual smoke.
- No API/OpenAPI/DB changes: verified by code review and `pnpm verify` generated/workspace gates.
- Legal site publishing scope: verified by GitHub Pages workflow review and post-merge/manual deployment smoke.
- No placeholder URL completion: verified by spec review and by manual smoke against the canonical MVP URLs before `Done`.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| App info/legal group view-model preserves row order, labels, tappable/non-tappable status, and `열기` affordance | Mobile logic | `apps/mobile/lib/app-info/legal.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Displayed app version is mapped from the committed Expo app config source | Mobile logic/config | `apps/mobile/lib/app-info/legal.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Terms/Privacy URLs are centralized and rows reference those centralized definitions | Mobile logic/config | `apps/mobile/lib/app-info/legal.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Link open success clears any previous group-level error | Mobile state/helper | `apps/mobile/lib/app-info/legal.test.mts` or equivalent with fake opener | `pnpm --filter @i-um/mobile test` |
| Link open failure sets exact group-level error copy | Mobile state/helper | `apps/mobile/lib/app-info/legal.test.mts` or equivalent with fake opener | `pnpm --filter @i-um/mobile test` |
| Duplicate tap while a row is opening does not launch duplicate opener calls | Mobile state/helper | `apps/mobile/lib/app-info/legal.test.mts` or equivalent with fake opener | `pnpm --filter @i-um/mobile test` |
| New app-info/legal tests are included in the mobile test command | Mobile test gate | `apps/mobile/package.json` test script or equivalent | `pnpm --filter @i-um/mobile test` |
| My Page screen consumes the helper/config without TypeScript errors | Mobile typecheck | TypeScript compiler | `pnpm --filter @i-um/mobile typecheck` |
| Full workspace regression gate passes with no API/DB/OpenAPI drift | Workspace | root verification | `pnpm verify` |

## Regression Gaps

- External browser launch itself cannot be fully proven by Node unit tests.
  - Risk: device/browser integration could regress even if helper tests pass.
  - Follow-up: No separate issue needed for F-018. Treat Expo simulator/device or internal build manual smoke as required completion evidence for both canonical URLs.

## TDD Implementation Plan

Red-Green-Refactor 순서로 작성한다. 구현 계획보다 실패 테스트와 회귀 테스트 게이트를 먼저 고정한다.

0. Readiness gate: canonical URLs 확보
   - 작업: MVP canonical URLs를 GitHub Pages 경로로 확정하고 이 문서와 centralized mobile helper에 기록한다.
   - Verify: Terms URL은 `https://twotwobread.github.io/i-um/terms/`, Privacy URL은 `https://twotwobread.github.io/i-um/privacy/`로 고정되어 있다.

0a. Legal site 정적 페이지 추가
   - 작업: `legal-site/terms/`, `legal-site/privacy/`와 GitHub Pages workflow를 추가한다.
   - Verify: workflow가 `legal-site/`만 upload-pages-artifact 대상으로 사용한다.

1. Red: app info/legal helper tests 작성
   - 작업: `apps/mobile/lib/app-info/legal.test.mts` 또는 동등 위치에 row order, labels, tappable flag, `열기` affordance, version mapping, centralized URL lookup을 기대하는 실패 테스트를 작성한다.
   - 작업: 현재 mobile test script가 새 test 경로를 실행하지 않으면 `pnpm --filter @i-um/mobile test`가 새 test를 포함하도록 test script를 먼저 조정한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현 또는 기존 script gap으로 실패한다.

2. Green: centralized app info/legal config/helper 구현
   - 작업: app version과 legal link definitions를 screen JSX 밖의 centralized helper/config에 둔다.
   - Include: `앱 버전`, `서비스 이용약관`, `개인정보처리방침`, `열기`, canonical Terms/Privacy URLs.
   - Verify: `pnpm --filter @i-um/mobile test`의 helper row/config tests가 통과한다.

3. Red: link opening state tests 작성
   - 작업: fake opener를 주입할 수 있는 helper 또는 state reducer tests를 추가해 success clears error, failure sets exact error copy, duplicate in-flight tap does not call opener twice를 기대한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 state helper 미구현으로 실패한다.

4. Green: link opening helper/state 구현
   - 작업: external browser opening을 호출하는 작은 wrapper와 in-flight/error state 처리를 구현한다.
   - Include: 실패 시 `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`, 성공 시 error clear.
   - Verify: `pnpm --filter @i-um/mobile test`가 통과한다.

5. Green: 마이페이지 settings UI 연결
   - 작업: `apps/mobile/app/mypage.tsx`의 settings card에 app info/legal group을 `계정 관리`와 `로그아웃` 사이에 추가한다.
   - Include: non-tappable version row, tappable Terms/Privacy rows, `열기` affordance, in-flight duplicate tap protection, group-level error rendering.
   - Verify: `pnpm --filter @i-um/mobile typecheck`가 통과한다.

6. Refactor: styling과 중복 정리
   - 작업: theme token 기반 row layout으로 정리하고 URL/label/error copy가 screen JSX에 중복되지 않게 한다.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck` 재실행.

7. Regression gate
   - Verify: `pnpm verify`.

8. Manual smoke
   - 작업: Expo simulator/device 또는 internal build에서 마이페이지 settings를 확인한다.
   - Verify: version visible, Terms opens canonical Terms URL, Privacy opens canonical Privacy URL, failure path can show group-level error if feasible.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

F-018은 API/OpenAPI/DB 변경이 없으므로 별도 migration apply/rollback은 완료 조건에 포함하지 않는다. `pnpm verify`는 기존 workspace regression과 generated drift가 깨지지 않았음을 확인하기 위해 실행한다.

### Manual Smoke

아래 항목은 실제 기기, simulator, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] GitHub Pages workflow가 merge 후 성공적으로 실행되었거나 workflow_dispatch로 배포되었다.
- [ ] `https://twotwobread.github.io/i-um/terms/`가 브라우저에서 열린다.
- [ ] `https://twotwobread.github.io/i-um/privacy/`가 브라우저에서 열린다.
- [ ] 로그인 후 마이페이지 `설정` 섹션에서 `계정 관리`가 먼저 보이고 `로그아웃`이 마지막에 보인다.
- [ ] `계정 관리`와 `로그아웃` 사이에 `앱 버전`, `서비스 이용약관`, `개인정보처리방침`이 보인다.
- [ ] `앱 버전` row에 현재 앱 버전이 표시된다.
- [ ] `서비스 이용약관`의 `열기`를 누르면 외부 브라우저에서 canonical Terms URL이 열린다.
- [ ] `개인정보처리방침`의 `열기`를 누르면 외부 브라우저에서 canonical Privacy Policy URL이 열린다.
- [ ] 가능하면 link opener 실패를 simulate해 `링크를 열 수 없어요. 잠시 후 다시 시도해주세요.`가 legal group 아래에 표시되는지 확인한다.
- [ ] 실패 후 다른 마이페이지 기능과 `로그아웃`이 계속 동작하는지 확인한다.
- [ ] staging 또는 internal build에서 동일한 happy path를 확인하고 결과를 완료 보고에 기록한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- `pnpm --filter @i-um/mobile test`: pass, including `apps/mobile/lib/app-info/legal.test.mts`.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- Static legal-site link check: pass, all local relative links resolve.
- GitHub Pages deployment smoke: not run in this environment. The `Legal Pages` workflow can deploy after merge/push to `develop` or via `workflow_dispatch`.
- Expo simulator/device smoke: not run in this environment.
- Staging/internal build verification: not run in this environment.

## Release Notes

```text
- 마이페이지 설정에서 앱 버전, 서비스 이용약관, 개인정보처리방침 링크를 확인할 수 있게 한다.
- 약관과 개인정보처리방침은 외부 브라우저로 열린다.
```

Release remains blocked until GitHub Pages deployment and app link manual smoke are verified.

## Open Questions

None for implementation.

Resolved on 2026-06-22:

- 서비스 이용약관 URL: `https://twotwobread.github.io/i-um/terms/`
- 개인정보처리방침 URL: `https://twotwobread.github.io/i-um/privacy/`

## Follow-up Issues

- Future TBD: 약관 동의/재동의 및 동의 이력 저장이 필요해지면 별도 feature issue로 분리한다.
- Future TBD: 오픈소스 라이선스, 고객센터, 사업자 정보 등 settings legal/support 고도화가 필요해지면 별도 feature issue로 분리한다.
