---
name: i-um-feature-spec-plan
description: Create or substantially revise i-um feature specs and implementation plans in docs/features. Use when the user asks to write, draft, update, or plan a feature spec/plan for an issue or docs/features file. Create/use a feature worktree so spec and implementation can ship in one PR. Always run Ouroboros clarification first unless the user explicitly waives it.
---

# i-um Feature Spec / Plan

Use when the task is to create or substantially revise a feature spec and implementation plan, especially `docs/features/<id>.md` or a GitHub Issue labeled `needs-spec`. Treat the spec/plan as the first phase of the same feature branch/PR that will later contain implementation.

Do not use this for implementation from an already approved spec; use `i-um-feature-start` in the same feature worktree/branch instead.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear feature name/scope from the user

If missing, ask before reading unrelated context.

## Mandatory Ouroboros gate

Before writing or substantially revising a feature spec/plan:

1. Run Ouroboros clarification first.
   - Prefer MCP tools when available:
     - `ouroboros_ouroboros_interview`
     - `ouroboros_ouroboros_generate_seed`
   - Include the issue/spec path, known current-code facts, and the desired output (`feature spec + TDD implementation plan`) in the initial context.
2. Do not invent product/API/DB/UI answers to satisfy the interview.
   - Use repository facts for existing implementation details.
   - Ask the user for product decisions when Ouroboros exposes blocking ambiguity.
3. Continue clarification until ambiguity is low enough for Seed generation when the tool supports it.
   - Generate a Seed from the completed interview when possible.
   - If ambiguity remains above the Seed threshold, stop and ask rather than drafting implementation-ready scope.
4. If Ouroboros is unavailable, stop and ask whether to retry, wait, or explicitly waive Ouroboros.
5. If the user explicitly waives Ouroboros, record the waiver in the feature document; otherwise do not write `Ouroboros/PM/Seed: Not used`.
6. Record the Ouroboros interview/session id, ambiguity score, and seed id/path in the feature document.

## Minimal reads

1. Inspect state:
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse --show-toplevel`
2. Worktree rule before writing any feature spec/plan:
   - `.pi/rules/worktree.md`
3. Target issue/spec:
   - If issue number is provided, inspect with `gh issue view <number> --json number,title,body,comments,labels,url`.
   - If revising an existing spec, read that spec.
   - If creating a new spec, read `docs/features/_template.md`.
4. Conditional small rules after Ouroboros clarifies touched areas:
   - API/DB/domain schema: `.pi/rules/api-db.md`
   - Mobile UI: `.pi/rules/mobile-ui.md`
   - Tests/verification: `.pi/rules/testing.md`
5. Read current code or neighboring specs only to verify concrete implementation facts needed for the plan.

Do not read delivery/DoD/testing umbrella docs. Read `docs/decisions/` only when the feature changes or revisits product/technical/domain/API/DB/ops direction.

## Spec/Plan Context Budget

For feature spec/plan tasks, keep context narrow by default.

- Treat the work as spec/plan until the user approves implementation; avoid implementation-depth reads unless needed to prevent stale assumptions.
- Source priority: user request, target issue/spec, template/rules, narrow current source files, directly linked docs, then neighboring docs only if still needed.
- Use `rg`/`find` before `read`; for large files, read only endpoint/schema/action/state/copy blocks first with `offset`/`limit`.
- Neighboring specs/docs: default maximum one, and only when directly referenced or needed to resolve a concrete blocker.
- Do not read generated/vendor/build artifacts during spec planning unless source is unavailable or generated drift is the target.
- Do not read `package.json`/lockfiles only to discover common verification commands; use `.pi/rules/*` verification sections first.
- UI files: read route/action/state/copy blocks first; skip broad `StyleSheet` tails unless concrete UI implementation detail is the blocker.
- API/DB: prefer OpenAPI endpoint/schema blocks, current migrations/schema, and relevant SQL queries; do not read generated Go/TS code just to restate the contract.
- Stop after a fact is verified in the source of truth; do not duplicate-check the same fact across docs, code, and generated files.
- If ambiguity is product/domain-level, ask the user or Ouroboros instead of inferring from unrelated code.
- If expanding beyond this budget, have a named blocker/reason.

## Procedure

1. Resolve target
   - Determine the issue number and target spec path.
   - Prefer issue-linked planned path; otherwise use `docs/features/NNNN-*.md`.
   - If the target filename is ambiguous, ask.

2. Select or create the feature worktree
   - If already inside the matching `.worktrees/*` feature branch, continue there.
   - If an open worktree/branch already exists for the same feature, use it; do not create a second spec branch.
   - Otherwise run `.pi/bin/worktree-create` from the repository root while the root remains on `develop`.
   - Use a feature branch/worktree for `docs/features/*`; do not use `docs/*` process branches for feature specs.
   - Continue all subsequent reads, edits, commits, and verification inside that feature worktree.

3. Gather factual context
   - Read only the issue, existing target spec/template, and narrow current implementation files needed to avoid stale assumptions.
   - Keep assumptions visible when they affect the draft.

4. Run Ouroboros
   - Start or resume the interview with the gathered context.
   - Ask the user any blocking questions surfaced by Ouroboros.
   - Generate and record a Seed when the interview is complete and eligible.

5. Draft or update the spec
   - Follow `docs/features/_template.md` structure unless preserving an existing spec's established structure.
   - Include: goal, user flow, scope, out of scope, UI/UX, API contract, DB changes, business rules, acceptance criteria, regression test plan, regression gaps, TDD implementation plan, verification plan, release notes, open questions, follow-ups.
   - Keep status `Draft` or `Spec Review` unless the user explicitly approves readiness.
   - Keep unresolved ambiguity in `Open Questions`; do not convert guesses into implementation-ready scope.

6. Stop before implementation
   - Do not update OpenAPI, migrations, generated code, app/server code, or tests in this skill unless the user separately asks for implementation after approval.
   - When implementation starts, use `i-um-feature-start` in the same feature worktree/branch so spec/plan and implementation remain one PR by default.

7. Complete
   - Read `.pi/rules/completion-report.md` before the final response.
   - Report the worktree path/branch, feature spec path, Ouroboros session/seed, verification commands/results, and unresolved open questions.
