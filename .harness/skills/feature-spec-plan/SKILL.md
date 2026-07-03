---
name: i-um-feature-spec-plan
description: Draft or revise i-um feature specs/plans through the .harness feature-start workflow spec phases.
---

# i-um Feature Spec / Plan

Use this skill when the user explicitly asks to write, draft, update, or plan a feature spec. This is the spec-focused entry point for `.harness/workflows/feature-start.yml`.

This skill does not mandate one tool for every spec. `.harness/policies/default.yml` decides whether the request needs a lightweight clarification, normal spec/plan, or strict clarification/review path.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear feature name/scope from the user

If missing, ask before reading unrelated context.

## Minimal reads

1. `.harness/workflows/feature-start.yml`.
2. `.harness/policies/default.yml`.
3. `.harness/contracts/change-classify.contract.md`.
4. `.harness/contracts/spec-authoring.contract.md`.
5. `.harness/contracts/spec-review.contract.md` when policy/tier requires review.
6. Provider doc selected by policy.
7. Target issue/spec/template and narrow current-code facts needed to avoid stale assumptions.

## Procedure

1. Inspect state and select/create the proper feature worktree when spec work will be committed.
2. Create or select a run envelope with `route: pending` and `tier: pending`.
3. Run `change.classify` as intake triage; ask focused questions or block if scope cannot be made safe.
4. Select the route, tier, and `spec.author` provider through `.harness/policies/default.yml` after enough evidence exists.
5. Run the provider and write `.harness/runs/<run-id>/artifacts/feature.spec.md` when a spec is required.
6. Run `spec.review` when required by policy/tier.
7. If a repository feature document under `docs/features/*` is needed, translate the canonical spec into that document without adding unapproved scope.
8. Stop before implementation unless the user separately asks to continue.
9. Report run id, route/tier, provider choice, artifacts, open questions, and verification.
