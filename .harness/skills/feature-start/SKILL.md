---
name: i-um-feature-start
description: Start i-um feature, bugfix, debug, or implementation work through the .harness feature-start workflow.
---

# i-um Feature Start

Use this skill when the user asks to implement, fix, debug, resolve an issue, or start feature work. Use `.harness/workflows/feature-start.yml` as the workflow source of truth and `.harness/policies/default.yml` for route, tier, provider, rulepack, check, and approval decisions.

Do not hard-code Ouroboros, Superpowers, product review, or checklist behavior in this skill. Policies select providers; runs record the decision.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear user-described bug, fix, or implementation request

If missing, ask before implementation.

## Minimal reads

1. `.harness/workflows/feature-start.yml`.
2. `.harness/policies/default.yml`.
3. `.harness/policies/rulepacks/feature-start.yml`.
4. Relevant phase contract before running each phase.
5. Provider doc selected by policy.
6. Target issue/spec or narrow source files needed by the current phase.

Do not read broad docs by default. Read only rules selected by the rulepack for the current phase/risk.

## Procedure

1. Inspect state
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse --show-toplevel`
   - Do not overwrite unrelated user changes.

2. Prepare isolated workspace
   - Feature, issue, bugfix, and feature-spec work must run in a `.worktrees/*` workspace before writing run artifacts, specs, plans, implementation files, or PR changes.
   - If already in a linked worktree under `.worktrees/*`, continue there.
   - If at the repository root on `develop`, create or select the worktree with `.pi/bin/worktree-create`; do not call `git worktree add` directly.
   - If the repository root has working-tree changes, stop and ask before moving or overwriting anything.
   - After entering the selected worktree, re-run `git status --short`, `git branch --show-current`, and `git rev-parse --show-toplevel`.
   - Keep the repository root on `develop` for sync/management only.

3. Create or select a run envelope
   - Choose a stable `<run-id>`.
   - Start with `tier: pending` and `route: pending`; do not choose `lightweight`, `normal`, or `strict` before triage.
   - Minimum run shape:
     - `.harness/runs/<run-id>/run.yaml`
     - `.harness/runs/<run-id>/artifacts/user-request.md`
     - `.harness/runs/<run-id>/artifacts/ledger.md`

4. Run intake triage through `change.classify`
   - Follow `.harness/contracts/change-classify.contract.md`.
   - Inspect only the request, linked issue/spec, relevant error/log, and narrow code/contract snippets needed to route the work.
   - Decide the next route: `ready_for_lightweight_investigation`, `ready_for_implementation`, `needs_clarification`, `needs_investigation`, `needs_product_direction`, or `blocked`.
   - If scope cannot be judged safely, ask focused clarification questions or block; do not invent scope.
   - Write `.harness/runs/<run-id>/artifacts/classification.yaml`.

5. Select tier and providers only after enough evidence exists
   - Use `.harness/policies/default.yml`.
   - `lightweight`: clear, local, low-risk work; keep artifacts minimal.
   - `normal`: ordinary feature/bugfix work needing micro spec, plan, and evaluation.
   - `strict`: broad, risky, ambiguous, product-direction-sensitive, or high-coordination work.
   - If the route is still `needs_clarification` or `blocked`, keep `tier: pending`.
   - Record selected tier/provider reasons in `run.yaml`, `provider-selection.yaml` when materialized, and/or `artifacts/ledger.md`.

6. Materialize only tier-required artifacts
   - Lightweight runs usually need `classification.yaml`, `ledger.md`, and `verification.md`.
   - Normal runs add `feature.spec.md`, `implementation-plan.md`, and `evaluation-report.md`.
   - Strict runs add `spec-review.md`, `events.ndjson`, `artifacts/checks/*`, and `private/*` when provider-private state is needed.

7. Run phases in order for the selected route/tier
   - `spec.author`: require `artifacts/feature.spec.md` when the policy/tier requires a spec.
   - `spec.review`: require explicit verdict for strict/high-risk work or when policy approval requires it.
   - `implementation.plan`: require `artifacts/implementation-plan.md` for normal/strict work.
   - `implementation.execute`: implement only from canonical artifacts.
   - `evaluation.checklist`: require `artifacts/evaluation-report.md` for normal/strict work; lightweight may use `artifacts/verification.md`.
   - `pr.create` and `review.request`: only after blocking checks pass or accepted risk is explicit.

8. Re-triage when new facts appear
   - If investigation reveals API/DB/auth/privacy/product-direction impact, pause and update classification/tier before implementation continues.
   - Do not silently upgrade scope; explain the evidence and ask when product/domain decisions are needed.

9. Complete
   - Report route, tier, selected providers/checks, changed behavior, verification commands/results, manual smoke/deploy status, and gaps/risks.
