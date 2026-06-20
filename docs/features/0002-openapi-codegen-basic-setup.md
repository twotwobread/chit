# Feature Slice: F-002 OpenAPI/codegen 기본 구성

## Metadata

- GitHub Issue: #2
- Status: Done
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-20
- Updated: 2026-06-20

## Ouroboros Source

- Interview Session: `interview_20260620_134555`
- Seed: `seed_ab0b624be170`
- PM Document: N/A
- Notes: Ambiguity score `0.07`. Scope was clarified as a local, reproducible OpenAPI-first codegen workflow. CI/staging enforcement is deferred to #4, and no product-domain endpoint is added in F-002.

## Goal

개발자가 `packages/api-contract/openapi.yaml`을 API 계약의 단일 출처로 수정한 뒤, repo-local `pnpm generate`와 `pnpm verify`만으로 Go server interface와 TypeScript client를 재현 가능하게 갱신하고 downstream 소비자가 깨지지 않았음을 확인할 수 있게 한다.

F-002는 F-001의 최소 walking skeleton을 고도화해 이후 모든 API feature slice가 같은 OpenAPI/codegen 절차를 따르도록 만드는 foundation 작업이다.

## Problem

- F-001에서 OpenAPI → Go generated artifact → TypeScript generated client → `/health` smoke path는 만들어졌지만, generated artifact ownership과 변경 절차가 feature 단위로 명문화되어 있지 않다.
- generator 버전/설정, 전역 CLI 의존 여부, generated drift 실패 기준이 불명확하면 개발자별 생성 결과가 달라질 수 있다.
- OpenAPI를 수정해도 서버와 모바일 소비자가 함께 검증되지 않으면 contract와 실제 구현이 어긋날 수 있다.
- 이후 trip/itinerary/expense API를 구현하기 전에, OpenAPI-first 변경 절차와 검증 기준을 고정해야 한다.

## User Flow

1. 개발자가 API 변경이 필요한 feature spec을 확인한다.
2. 개발자가 `packages/api-contract/openapi.yaml`을 먼저 수정한다.
3. 개발자가 root에서 `pnpm generate`를 실행한다.
4. repository-pinned tooling이 Go server artifact와 TypeScript client/type artifact를 재생성한다.
5. 개발자가 OpenAPI 변경과 generated diff를 함께 리뷰 가능한 변경으로 확인한다.
6. 개발자가 custom server/mobile behavior를 generated 파일이 아닌 non-generated 구현 파일에 작성한다.
7. 개발자가 `pnpm verify`를 실행한다.
8. `pnpm verify`가 generated drift, Go API test/build, mobile TypeScript typecheck를 확인한다.
9. F-002 smoke 기준으로 기존 `/health` path가 계속 생성물과 downstream 소비자를 통해 동작 가능한 상태임을 확인한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 새 화면은 만들지 않는다. 기존 health 화면은 generated TypeScript client downstream 소비자 smoke target으로 유지한다.
- [ ] API Contract: `packages/api-contract/openapi.yaml`을 API 계약의 단일 출처로 고정하고, `/health`를 codegen smoke contract로 유지한다.
- [ ] API Server: 새 product handler는 만들지 않는다. 기존 Go API가 regenerated `apps/api/internal/openapi/server.gen.go`와 계속 compile/test되는지 확인한다.
- [ ] Generated Code: `apps/api/internal/openapi/server.gen.go`와 `packages/api-contract/gen/ts`를 committed, read-only, reviewable generated artifact로 명문화한다.
- [ ] Codegen Workflow: root `pnpm generate`를 단일 재생성 entrypoint로 고정하고, global generator CLI 설치 없이 fresh checkout에서 실행 가능해야 한다.
- [ ] Tooling Reproducibility: `oapi-codegen`과 `openapi-typescript-codegen`의 version/options/config가 repository에 pin되어야 한다.
- [ ] Verification: root `pnpm verify`가 regeneration, generated drift check, Go API tests/build, mobile TypeScript typecheck를 포함해야 한다.
- [ ] Documentation: contract-change playbook과 generated file ownership policy를 feature 문서와 필요한 repo 문서에 기록한다.
- [ ] Deployment: local developer workflow 검증까지만 포함한다. CI/staging/internal build enforcement는 #4로 넘긴다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 새 product-domain endpoint 추가
- trips, itinerary, places, expenses, settlements API 구현
- DB schema, migration, sqlc 구성
  - DB/migration 기본 구성은 #3에서 다룬다.
- 인증/권한 모델 구현
- Expo 앱의 새 사용자 화면 또는 navigation 변경
- CI에서 PR마다 `pnpm verify`를 강제하는 workflow 구현
  - CI/staging/internal deployment 기본 구성은 #4에서 다룬다.
- public API documentation portal 또는 SDK 배포
- generator 교체 또는 대규모 codegen framework 변경
- generated 파일 수동 편집

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`: 기존 health screen을 유지한다. F-002에서는 새 UI를 추가하지 않는다.

### States

- Loading: 기존 `API 상태 확인 중...` 상태를 유지한다.
- Empty: 별도 empty state는 필요 없다.
- Error: 기존 `API 연결 실패`와 retry 동작을 유지한다.
- Success: 기존 `API 연결 성공`과 `status: ok` 표시를 유지한다.

### Copy / Labels

F-002에서 새 사용자 노출 문구를 추가하지 않는다.

기존 smoke 화면 문구는 유지한다.

- Loading: `API 상태 확인 중...`
- Success title: `API 연결 성공`
- Success detail: `status: ok`
- Error title: `API 연결 실패`
- Retry: `다시 시도`

## API Contract

F-002는 새 product API를 추가하지 않는다.

### Source of Truth

- Canonical contract: `packages/api-contract/openapi.yaml`
- 모든 API 계약 변경은 OpenAPI 수정에서 시작한다.
- generated server/client 파일을 직접 수정해 contract 변경을 표현하지 않는다.

### Smoke Endpoint

```text
GET /health
```

`/health`는 OpenAPI/codegen/downstream integration smoke contract로 유지한다.

### Request

No request body.

### Response

HTTP status: `200`

Content-Type: `application/json`

```json
{
  "status": "ok"
}
```

### Errors

예상치 못한 서버 오류는 공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

### Code Generation Policy

- Single generation entrypoint: `pnpm generate`
- Go generated artifact: `apps/api/internal/openapi/server.gen.go`
- TypeScript generated artifact: `packages/api-contract/gen/ts`
- Generated artifacts are committed to git and reviewed with the OpenAPI/tooling change that produced them.
- Generated artifacts are read-only; do not hand-edit them.
- `apps/api/internal/openapi/server.gen.go` and `packages/api-contract/gen/ts` may change only through generation.
- Custom Go server behavior must live in non-generated files such as `apps/api/internal/server` or future domain packages.
- Custom mobile behavior must live in non-generated app/lib files that consume generated client/types.
- `pnpm generate` must not require separately installed global `oapi-codegen` or `openapi-typescript-codegen` binaries.
- Generator versions/options/config must be pinned or reproducible through committed repository files.

## DB Changes

No DB changes.

### Tables

N/A

### Constraints / Indexes

N/A

### Migration Notes

- F-002 does not introduce DB schema or migration changes.
- DB/migration 기본 구성은 #3에서 별도 feature slice로 처리한다.

## Business Rules

- OpenAPI is the single source of truth for API contract changes.
- `pnpm generate` is the only allowed way to update generated Go/TypeScript artifacts.
- Generated artifacts are committed, owned, reviewable, and read-only.
- No generated file is hand-edited to fix server or mobile behavior.
- Codegen must be reproducible from a fresh checkout using committed repository tooling/config plus standard Go/Node package managers.
- Local verification must catch both generated drift and downstream consumer breakage.
- A contract change is not complete until server and mobile consumers compile/typecheck against regenerated artifacts.
- F-002 strengthens the workflow only; it does not introduce new product behavior.
- CI may later run the same commands, but CI enforcement is not part of F-002.

## Acceptance Criteria

- [x] `docs/features/0002-openapi-codegen-basic-setup.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] Spec is reviewed and approved before implementation starts.
- [x] Spec defines the contract-change process: edit OpenAPI first, regenerate Go server interface and TypeScript client, wire consumers against generated artifacts, and verify no drift remains.
- [x] `pnpm generate` is the single repo-local regeneration entrypoint.
- [x] `pnpm generate` works from a fresh checkout without required global generator installs.
- [x] `oapi-codegen` and `openapi-typescript-codegen` versions/options/config are pinned or reproducible through committed repository files.
- [x] `apps/api/internal/openapi/server.gen.go` is committed, read-only, and reviewable as generated Go artifact.
- [x] `packages/api-contract/gen/ts` is committed, read-only, and reviewable as generated TypeScript client/type artifact.
- [x] `pnpm verify` runs regeneration and fails on generated drift via `git diff --exit-code` over generated paths.
- [x] `pnpm verify` runs Go API tests and build against regenerated `server.gen.go`.
- [x] `pnpm verify` runs mobile TypeScript typecheck against regenerated `packages/api-contract/gen/ts`.
- [x] A local `/health` smoke proof documents that OpenAPI-based regeneration propagates through Go and TypeScript artifacts without manual edits to generated files.
- [x] No new product-domain endpoint, DB schema, or App UI behavior is introduced by F-002.
- [x] CI/staging/internal deployment enforcement is explicitly deferred to #4.

## Implementation Plan

1. Confirm current codegen inventory
   - 작업: `packages/api-contract/openapi.yaml`, `packages/api-contract/package.json`, `pnpm-lock.yaml`, root `package.json`, generated output paths, Go/mobile consumers를 확인한다.
   - Verify: source contract, generator commands, generated output paths, downstream consumers가 feature 문서의 정책과 일치한다.

2. Pin and document generator reproducibility
   - 작업: `oapi-codegen`과 `openapi-typescript-codegen`이 committed scripts/config/lockfile로 재현 가능한지 확인하고, 부족하면 최소 변경으로 pinning을 보강한다.
   - Verify: fresh checkout 기준으로 별도 global generator install 없이 `pnpm generate`가 실행 가능한 절차가 문서화되어 있다.

3. Lock single generation entrypoint
   - 작업: root `pnpm generate`가 모든 OpenAPI-generated artifact를 갱신하는 유일한 entrypoint인지 확인하고, package-level scripts는 root entrypoint 아래에서만 사용되도록 문서화한다.
   - Verify: root에서 `pnpm generate` 실행 시 Go generated artifact와 TypeScript generated artifact가 모두 재생성된다.

4. Define generated artifact ownership policy
   - 작업: generated files are read-only, committed, reviewable artifact라는 정책과 custom behavior 위치를 문서화한다.
   - Verify: feature 문서와 필요한 repo 문서에 직접 편집 금지, generated path, non-generated implementation path가 명시되어 있다.

5. Harden local drift check
   - 작업: root `pnpm verify`가 `pnpm generate` 후 `git diff --exit-code -- apps/api/internal/openapi/server.gen.go packages/api-contract/gen/ts`를 실행하는지 확인하고, 부족하면 보강한다.
   - Verify: generated output이 OpenAPI/tooling과 어긋나면 `pnpm verify`가 실패한다.

6. Keep downstream integration checks in verification
   - 작업: root `pnpm verify`가 Go API tests/build와 mobile TypeScript typecheck를 포함하는지 확인하고, 부족하면 보강한다.
   - Verify: `pnpm verify`가 regenerated artifacts against server/mobile consumers를 검증한다.

7. Smoke-test existing `/health` path
   - 작업: F-001의 `/health` contract, Go handler, mobile generated-client consumer가 regeneration 후에도 유지되는지 확인한다.
   - Verify: `pnpm generate`, `pnpm verify`, 필요 시 `pnpm dev:api` + `curl http://localhost:8080/health`, mobile typecheck 또는 앱 수동 확인이 통과한다.

8. Record implementation evidence and scope boundaries
   - 작업: verification results, deferred CI note, no product endpoint/no DB/no new UI scope guard를 feature 문서 또는 완료 보고에 기록한다.
   - Verify: open questions가 없고 #4 defer note가 남아 있으며, issue #2가 spec review/implementation 준비 상태로 이동 가능하다.

## Verification Plan

### Automated

```text
pnpm install --frozen-lockfile
pnpm generate
git diff --exit-code -- apps/api/internal/openapi/server.gen.go packages/api-contract/gen/ts
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

`pnpm verify`는 최소한 다음을 포함해야 한다.

```text
pnpm generate
git diff --exit-code -- apps/api/internal/openapi/server.gen.go packages/api-contract/gen/ts
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile typecheck
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass
- `pnpm generate`: pass
- `git diff --exit-code -- apps/api/internal/openapi/server.gen.go packages/api-contract/gen/ts`: pass, no generated drift
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- `pnpm dev:api` + `curl http://localhost:8080/health`: pass, returned `{ "status": "ok" }`
- Expo live screen manual check: not run in this environment; F-002 does not change App UI behavior and generated TypeScript consumer integration is covered by `pnpm --filter @i-um/mobile typecheck`.
- CI/staging/internal build verification: not run; explicitly deferred to #4.

### Manual

- [x] OpenAPI 변경은 `packages/api-contract/openapi.yaml`에서 시작한다는 playbook을 확인한다.
- [x] generated file을 직접 수정하지 않았는지 review한다.
- [x] generated diff가 OpenAPI/tooling 변경과 같은 PR/MR에 포함되어야 한다는 정책을 문서화했다.
- [x] `pnpm generate`가 global generator CLI 설치를 요구하지 않는지 확인한다.
- [x] `pnpm dev:api` 실행 후 `curl http://localhost:8080/health`가 `{ "status": "ok" }`를 반환하는지 확인한다.
- [x] Expo health 화면은 F-002에서 변경하지 않았고, generated TypeScript client 소비자는 mobile typecheck로 검증했다.
- [x] CI/staging/internal build 검증은 #4로 defer되어 있음을 확인한다.

## Release Notes

```text
- OpenAPI-first contract change and codegen workflow를 repository 표준 절차로 명문화한다.
- Go server interface와 TypeScript client generated artifact의 ownership, read-only policy, drift check 기준을 정의한다.
- Local `pnpm generate`/`pnpm verify`로 generated drift와 server/mobile downstream integration을 함께 확인할 수 있게 한다.
```

## Open Questions

None.

Resolved by Ouroboros interview:

- F-002 is local workflow hardening only; CI enforcement is deferred to #4.
- Generated outputs are committed and reviewed artifacts, not build-only artifacts.
- Generated files are read-only and must not be hand-edited.
- Codegen requires zero global generator dependencies.
- `pnpm verify` must include downstream Go/mobile integration checks, not only drift detection.

## Follow-up Issues

- #4: CI/staging/internal deployment workflow may later run the same `pnpm generate`/`pnpm verify` checks on every PR/MR.
