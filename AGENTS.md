# Agent Kernel

Always-loaded rules must stay small. Read task-specific `.pi/rules/*` files only when the current task needs them.

## Project map

```text
i-um/
├── apps/
│   ├── mobile/              # Expo/React Native app
│   │   ├── app/             # Expo Router screens
│   │   └── lib/             # mobile API/state/domain/design helpers
│   └── api/                 # Go API server
│       ├── internal/server/ # HTTP handlers/router/error mapping
│       ├── internal/<domain>/ # domain services
│       ├── internal/storage/ # repositories/sqlc integration
│       ├── migrations/      # goose DB migrations
│       └── queries/         # sqlc SQL queries
├── packages/api-contract/   # OpenAPI contract + generated TS client
├── docs/
│   ├── features/            # feature specs
│   └── decisions/           # decision history; not default implementation context
└── .pi/
    ├── rules/               # small task-specific agent rules
    ├── skills/              # progressive workflow skills
    └── bin/                 # agent workflow helper scripts
```

## Context discipline

- Do not read broad docs by default.
- Classify the task phase before expanding context; spec/plan, implementation, debug, PR, and deploy tasks need different depth.
- Prefer the target file, target feature spec, relevant code, and one small rule file over umbrella documents.
- If a matching skill exists, load that skill before reading additional docs.
- Expand context progressively: use `rg`/`find` first, read narrow blocks, and expand only for a named blocker.
- Prefer one source of truth over duplicate representations; avoid generated/vendor/build artifacts unless they are the target or source is unavailable.
- If scope is unclear or ambiguity is product/domain-level, stop and ask instead of reading unrelated docs to infer intent.
- Read `docs/decisions/` only when changing or revisiting product/technical/domain/API/DB/ops direction.
- For long commands, redirect full logs to a file and show only summaries or failure tails.

## Working principles

- State assumptions when they affect implementation.
- Keep changes minimal and directly tied to the user request.
- Do not implement future options or adjacent improvements.
- Do not overwrite unrelated user changes.
- Match existing style unless the task explicitly changes it.

## Source of truth

- Feature behavior: target `docs/features/<id>.md` or user request.
- API contract: `packages/api-contract/openapi.yaml`.
- DB schema changes: `apps/api/migrations/` and generated `apps/api/schema.sql`.
- SQL queries: `apps/api/queries/` and generated `apps/api/internal/db/`.
- Mobile design tokens: `apps/mobile/lib/design/theme.ts`.
- Shared mobile primitives: `apps/mobile/lib/design/components.tsx`.
- Decision records are history, not current implementation truth.

## Task rules

- Request routing: explicit spec/plan requests use `/skill:i-um-feature-spec-plan`; implementation/fix/debug requests without an approved spec use `/skill:i-um-feature-start` or read `.pi/rules/task-triage.md` before choosing no-spec fast path vs spec escalation.
- Feature spec/plan drafting: create/select the feature worktree first so spec and implementation stay one PR by default; do not draft or substantially revise `docs/features/*` without Ouroboros clarification unless the user explicitly waives it.
- Feature/issue implementation after triage or from an approved spec: use `/skill:i-um-feature-start` or read `.pi/rules/feature-implement.md`.
- PR creation/merge from an existing worktree: use `/skill:i-um-pr-lifecycle` or read `.pi/rules/pr-lifecycle.md`.
- API/DB changes: read `.pi/rules/api-db.md`.
- Mobile UI changes: read `.pi/rules/mobile-ui.md`.
- Testing changes or verification planning: read `.pi/rules/testing.md`.
- Worktree creation: read `.pi/rules/worktree.md`.
- Before committing or creating a PR: read `.pi/rules/commit.md`.
- Docs/rules cleanup: read `.pi/rules/docs-cleanup.md`.
- Staging/internal deploy: use `/skill:i-um-staging-deploy` or read `.pi/rules/deploy.md`.

## Completion

Report what changed, what was verified, manual smoke/deploy status when relevant, and remaining gaps or risks.
