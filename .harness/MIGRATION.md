# Harness Migration Plan

## Inventory summary

Canonical before this migration:

- `AGENTS.md` / `CLAUDE.md` bootstrap instructions.
- `.pi/skills/*` workflow skills.
- `.pi/rules/*` task-specific rules.

Adapter/runtime surfaces:

- `.pi/skills/*` and `.pi/rules/*` for Pi.
- `CLAUDE.md` is a symlink to `AGENTS.md`.
- `.claude/skills/*` and `.agents/skills/*` are generated adapter copies after this migration.

Direct tool coupling found before this migration:

- Feature spec skill mandated Ouroboros for every substantial spec/plan.
- Feature start skill directly referenced when not to run Ouroboros.
- Task triage rule recommended an Ouroboros-backed spec escalation directly.

## Target direction

`.harness` is the source of truth. Agent-specific directories expose generated copies or compatibility adapters only.

The stable model is:

```text
Workflow -> Phase -> Contract -> Provider -> Tool
```

Provider policy, not the top-level skill, chooses tools.

## Migration phases

### Phase 1: Inventory

Status: done.

- Listed `.pi`, `.claude`, `.agents`, `.harness`, `AGENTS.md`, and `CLAUDE.md` surfaces.
- Identified `.pi/skills/i-um-feature-spec-plan` and `.pi/rules/task-triage.md` as direct tool-coupling hotspots.

### Phase 2: Create `.harness` skeleton

Status: done.

- Added workflows, contracts, providers, schemas, rules, rulepacks, gates, skills, scripts, and runs directories.

### Phase 3: Move canonical rules

Status: done.

- Moved/converted all existing `.pi/rules/*` into canonical `.harness/rules/*` paths.
- Kept `.pi/rules/*` as generated compatibility adapters only.
- Added validation to ensure adapters declare their `.harness` source.

### Phase 4: Move canonical skills

Status: done.

Canonical skill sources now live under `.harness/skills/*`:

- `.harness/skills/feature-start/SKILL.md`
- `.harness/skills/feature-spec-plan/SKILL.md`
- `.harness/skills/docs-cleanup/SKILL.md`
- `.harness/skills/pr-lifecycle/SKILL.md`
- `.harness/skills/staging-deploy/SKILL.md`

Pi, Claude, and Agents skill files are generated adapter copies via `pnpm harness:sync`.

### Phase 5: Define workflows

Status: done.

- Added `.harness/workflows/feature-start.yml`.
- Added `.harness/workflows/docs-cleanup.yml`.
- Added `.harness/workflows/pr-lifecycle.yml`.
- Added `.harness/workflows/staging-deploy.yml`.
- Encoded provider policies for micro spec, Superpowers TDD, Ouroboros full loop, and product-direction-review framing in `feature-start.yml`.

### Phase 6: Define contracts

Status: done.

- Added contracts for classification, spec authoring/review, implementation planning/execution, evaluation, PR, review request, docs cleanup, PR lifecycle, and staging deploy.

### Phase 7: Define providers

Status: done.

- Added provider docs for default providers, micro spec, Ouroboros spec author, product-direction-review provider, Superpowers TDD, checklist evaluator, GitHub PR, docs cleanup, PR lifecycle, and staging deploy.

### Phase 8: Define rulepacks

Status: done.

- Added `.harness/rulepacks/feature-start.yml`.
- Added `.harness/rulepacks/docs-cleanup.yml`.
- Added `.harness/rulepacks/pr-lifecycle.yml`.
- Added `.harness/rulepacks/staging-deploy.yml`.

### Phase 9: Adapter cleanup

Status: done.

- Generated all i-um `.pi/skills/*` from `.harness/skills/*`.
- Generated all existing `.pi/rules/*` from `.harness/rules/*`.
- Added generated `.claude/skills/*` and `.agents/skills/*` copies for all i-um skills.
- Preserved existing `CLAUDE.md -> AGENTS.md` symlink.

### Phase 10: Sync/validate scripts

Status: done.

- `pnpm harness:sync` syncs skill and rule adapters through `.harness/scripts/sync-adapters.mjs`.
- `pnpm harness:validate` parses workflow/rulepack/schema YAML, checks provider policy expressions, verifies referenced paths/provider docs, and checks generated adapter source notices/drift.
- `pnpm harness:evaluate-provider` evaluates a workflow provider policy against a classification artifact.

### Phase 11: Bootstrap docs

Status: done.

- Reworked `AGENTS.md` as `.harness` bootstrap.
- `CLAUDE.md` remains a symlink to `AGENTS.md`.

### Phase 12: Deprecated files

Status: done for this scope.

- Existing `.pi` skills/rules were not removed to avoid breaking Pi runtime discovery.
- They are generated adapter copies with `GENERATED FILE. DO NOT EDIT` notices.
- Future edits should happen in `.harness`, followed by `pnpm harness:sync`.
