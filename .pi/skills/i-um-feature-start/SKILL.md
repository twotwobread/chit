---
name: i-um-feature-start
description: Start implementation/fix/debug work for an i-um issue or approved feature spec after light triage. Use for implementation only, not explicit spec/plan drafting or PR-only lifecycle tasks.
---

# i-um Feature / Issue Start

Use when the user asks to implement, start coding, fix, debug, or resolve a specific GitHub Issue, approved feature spec, or clear small request. If the spec/plan was drafted in a feature worktree, continue implementation in that same worktree/branch.

Do not use this for explicit feature spec/plan drafting; use `i-um-feature-spec-plan` instead.
Do not use this for “create/merge PR from an existing worktree”; use `i-um-pr-lifecycle` instead.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear user-described bug, fix, or small implementation request

If missing, ask before implementation.

## Minimal reads

1. `.pi/rules/task-triage.md` unless the request explicitly targets an approved spec and no routing decision is needed.
2. Target feature spec when present or linked.
3. `.pi/rules/feature-implement.md`.
4. `.pi/rules/worktree.md` if creating/selecting a worktree.
5. Conditional rules only when needed:
   - API/DB/domain schema: `.pi/rules/api-db.md`
   - Mobile UI: `.pi/rules/mobile-ui.md`
   - Testing/verification: `.pi/rules/testing.md`
   - Code size/duplication: `.pi/rules/code-quality.md`
   - Commit preparation: `.pi/rules/commit.md`

Do not read delivery/DoD/testing umbrella docs. Read `docs/decisions/` only when the feature changes or revisits product/technical/domain/API/DB/ops direction.

## Procedure

1. Inspect state
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse --show-toplevel`
   - Do not overwrite unrelated user changes.

2. Request routing guard
   - If the current request explicitly asks to create or substantially revise a feature spec/implementation plan, stop this implementation flow and use `i-um-feature-spec-plan`.
   - Do not trust the words “bug”, “feature”, or “simple” as the final classification; use `.pi/rules/task-triage.md` when no approved spec already defines the work.
   - Do not run Ouroboros or start spec drafting unless the user asked for it or approves a spec escalation.

3. Resolve issue/spec
   - If an issue number is provided, inspect with `gh issue view <number> --comments` when useful.
   - Prefer the spec linked from the issue.
   - Otherwise resolve `docs/features/NNNN-*.md` when the request clearly points to one.
   - If no spec exists, do not automatically stop; apply task triage to choose no-spec fast path, technical investigation, or spec escalation.

4. Triage decision
   - Approved spec: implement the spec only.
   - No-spec fast path: state the expected behavior and focused verification target, then make the minimal fix.
   - Technical investigation path: share a short investigation plan or hypothesis, then keep debugging narrowly.
   - Spec escalation: pause, summarize why no-spec is risky, recommend `i-um-feature-spec-plan`, and ask before switching.

5. Readiness gate
   - Stop if scope/API/DB/UI/acceptance criteria are ambiguous in a way that blocks safe implementation.
   - Stop if open questions require product/domain decisions.
   - Stop if the request conflicts with an existing spec, contract, or decision.
   - Re-triage if implementation reveals any spec escalation trigger.

6. Worktree
   - Prefer the existing feature/issue worktree/branch that contains or is meant to contain the target spec or fix.
   - Do not create a second implementation branch/worktree when the spec was drafted on an unmerged feature branch.
   - If no matching worktree exists and the change is PR-sized, use `.pi/bin/worktree-create` from the repository root while the root remains on `develop`.
   - Continue all implementation inside the selected `.worktrees/*` path.

7. Implement
   - Follow the target spec when one exists; otherwise stay within the triaged scope.
   - API changes start from OpenAPI.
   - DB changes use migrations.
   - Mobile uses generated API client/types when available.
   - Add tests for changed behavior or record a gap.

8. Complete
   - Read `.pi/rules/completion-report.md` before the final report.
   - Report changed behavior, triage route, verification commands/results, manual smoke/deploy status, and gaps.
