# Bugfix: F-146 경로 미리보기를 불러올 수 없음

## Metadata

- GitHub Issue: #146
- Status: Implemented
- Created: 2026-06-30
- Updated: 2026-06-30

## Source

- Issue: #146 — [경로 미리보기를 불러올 수 없음](https://github.com/twotwobread/i-um/issues/146)
- Canonical spec: `.harness/runs/20260630-1208-f146-route-preview-unavailable/feature.spec.yaml`

## Goal

경로 미리보기는 Google Routes API가 활성화된 route-capable key로 정상 요청되어야 하며, 설정/API 권한/제공자 실패 때문에 불러올 수 없을 때는 사용자가 이해할 수 있는 대체 상태를 보여줘야 한다.

## Key Decision

현재 구현은 Google Routes API `directions/v2:computeRoutes`를 사용한다. Google Places API만 활성화된 key는 경로 미리보기에 충분하지 않다. 같은 key를 쓰더라도 Routes API가 활성화되어 있고 key restriction이 해당 API/앱/서버 요청을 허용해야 한다.

## Scope

### In

- Route preview provider/config behavior clarification.
- API provider error mapping tests for no-route/rate-limit/unavailable cases.
- Mobile Today fallback copy when route preview loading fails.
- Documentation of the Google Routes API requirement.

### Out

- New map/navigation capabilities.
- Directions API/Maps SDK integration.
- OpenAPI or DB changes.
- Google Places search/add-place behavior changes.

## Acceptance Criteria

- [x] AC-01: Places-only key is not treated as sufficient route preview configuration.
- [x] AC-02: Missing/invalid route provider config returns a stable provider-unavailable route preview error.
- [x] AC-03: Google no-route/rate-limit/API-disabled responses map to understandable existing error categories.
- [x] AC-04: Mobile Today does not leave users with indefinite route preview loading/preparing copy after request failure.
- [x] AC-05: Unsupported/non-routable places still avoid route preview calls.
- [x] AC-06: Successful route preview chip formatting remains unchanged.
- [x] AC-07: Focused API and mobile regression tests cover the bugfix.

## Verification Plan

- `pnpm --filter @i-um/api test`
- `pnpm --filter @i-um/mobile test`
- `pnpm --filter @i-um/mobile typecheck`
- `pnpm lint`
- `pnpm format:check`
- `git diff --check`

## Manual Smoke

- On a build with a valid `GOOGLE_ROUTES_API_KEY`, open Today with a Google-backed next place and confirm the route chip shows distance/duration.
- On a build without route-capable key/API enablement, confirm Today shows understandable fallback copy and Google Maps navigation still works.
