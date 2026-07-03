# Agent Kernel

This repository uses `.harness` as the source of truth for agent workflows, contracts, policies, providers, checks, rules, run artifacts, and canonical skills.

`.pi`, `.claude`, and `.agents` are runtime adapter/install surfaces. If an adapter conflicts with `.harness`, follow `.harness`.

## Project map

```text
i-um/
├── apps/
│   ├── mobile/              # Expo/React Native app
│   └── api/                 # Go API server
├── packages/api-contract/   # OpenAPI contract + generated TS client
├── docs/
│   ├── features/            # promoted feature specs/review artifacts
│   └── decisions/           # decision history; not default implementation context
├── .harness/                # provider-neutral workflow kernel
├── .pi/                     # Pi adapter
├── .claude/                 # Claude adapter
└── .agents/                 # common agent adapter
```

## Always follow

- Keep default context small; read task-specific rules only when needed.
- Read `.harness/manifest.yaml` and the relevant workflow before non-trivial process work.
- Use `.harness/workflows` for phase order.
- Use `.harness/contracts` for phase input/output/done conditions.
- Use `.harness/policies` for route, tier, provider, rulepack, check, and approval selection.
- Use `.harness/rules` for canonical agent/project rule bodies.
- Use `.harness/checks` for executable verification descriptors.
- Do not edit generated adapter skill/rule copies directly; edit `.harness/skills` or `.harness/rules` and run `pnpm harness:sync`.
- Blocking checks must pass before PR creation unless the user explicitly accepts the risk.

## Source of truth

- Agent process: `.harness/`.
- Feature behavior: target `docs/features/<id>.md` or the user request.
- API contract: `packages/api-contract/openapi.yaml`.
- DB schema changes: `apps/api/migrations/` and generated `apps/api/schema.sql`.
- SQL queries: `apps/api/queries/` and generated `apps/api/internal/db/`.
- Mobile design tokens: `apps/mobile/lib/design/theme.ts`.
- Shared mobile primitives: `apps/mobile/lib/design/components.tsx`.
- Decision records are history, not current implementation truth.

## Entry points

- Feature/bugfix/debug implementation: use the current agent's `i-um-feature-start` adapter, generated from `.harness/skills/feature-start/SKILL.md`.
- Explicit feature spec/plan drafting: use the current agent's `i-um-feature-spec-plan` adapter, generated from `.harness/skills/feature-spec-plan/SKILL.md`.
- PR lifecycle: use the current agent's `i-um-pr-lifecycle` adapter, generated from `.harness/skills/pr-lifecycle/SKILL.md`.
- Docs/rules cleanup: use the current agent's `i-um-docs-cleanup` adapter, generated from `.harness/skills/docs-cleanup/SKILL.md`.
- Staging/internal deploy: use the current agent's `i-um-staging-deploy` adapter, generated from `.harness/skills/staging-deploy/SKILL.md`.

## Run policy summary

- Runs start as a pending envelope; triage decides whether to clarify, investigate, implement, or block.
- Tier selection happens after enough scope evidence exists.
- Lightweight work keeps artifacts minimal.
- Normal work adds spec/plan/evaluation artifacts.
- Strict work adds explicit review, check evidence, and private provider state when needed.

## Completion

Report what changed, what was verified, manual smoke/deploy status when relevant, and remaining gaps or risks.
