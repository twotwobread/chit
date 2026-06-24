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
- Prefer the target file, target feature spec, relevant code, and one small rule file over umbrella documents.
- If a matching skill exists, load that skill before reading additional docs.
- If scope is unclear, stop and ask instead of reading unrelated docs to infer intent.
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

- Feature implementation: use `/skill:i-um-feature-start` or read `.pi/rules/feature-implement.md`.
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
