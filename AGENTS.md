# Agent Kernel

This repository uses `.harness` as the source of truth for agent workflows, contracts, providers, rules, gates, and canonical skills.

`.pi`, `.claude`, and `.agents` are runtime adapters/install surfaces. If an adapter conflicts with `.harness`, follow `.harness`.

## Project map

```text
i-um/
├── apps/
│   ├── mobile/              # Expo/React Native app
│   └── api/                 # Go API server
├── packages/api-contract/   # OpenAPI contract + generated TS client
├── docs/
│   ├── features/            # feature specs
│   └── decisions/           # decision history; not default implementation context
├── .harness/                # agent-agnostic workflows/rules/providers/contracts
├── .pi/                     # Pi adapter
├── .claude/                 # Claude adapter
└── .agents/                 # common agent adapter
```

## Always follow

- Keep default context small; read task-specific rules only when needed.
- Use `.harness/workflows` for workflow definitions and provider policy.
- Use `.harness/contracts` for phase input/output/done conditions.
- Use `.harness/providers` for tool-specific behavior.
- Use `.harness/rules` and `.harness/rulepacks` for agent rules.
- Do not edit generated adapter skill/rule copies directly; edit `.harness/skills` or `.harness/rules` and run `pnpm harness:sync`.
- Blocking gates must pass before PR creation unless the user explicitly accepts the risk.

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

## Provider policy summary

- Small, clear, local, testable work: micro spec plus Superpowers-style TDD implementation when appropriate.
- Large, ambiguous, high-risk work: Ouroboros-backed clarification/seed loop and stricter spec review before implementation.
- Product-direction uncertainty: product-direction-review provider may be selected before finalizing the canonical spec.

## Completion

Report what changed, what was verified, manual smoke/deploy status when relevant, and remaining gaps or risks.
