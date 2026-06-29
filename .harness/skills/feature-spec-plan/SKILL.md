---
name: i-um-feature-spec-plan
description: Draft or revise i-um feature specs/plans through the .harness feature-start workflow spec phases.
---

# i-um Feature Spec / Plan

Use this skill when the user explicitly asks to write, draft, update, or plan a feature spec. This is the spec-focused entry point for `.harness/workflows/feature-start.yml`.

This skill does not mandate one tool for every spec. Provider policy decides:

- Small, clear, local, testable work: `micro-spec-author`, often followed by `superpowers-tdd` during implementation.
- Large, ambiguous, high-risk work: `ouroboros-spec-author` and the full clarification/review loop.
- Product-direction uncertainty: `product-direction-review` when broader PM/design/QA framing is needed.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear feature name/scope from the user

If missing, ask before reading unrelated context.

## Minimal reads

1. `.harness/workflows/feature-start.yml`.
2. `.harness/contracts/change-classify.contract.md`.
3. `.harness/contracts/spec-authoring.contract.md`.
4. `.harness/contracts/spec-review.contract.md`.
5. Provider doc selected by the spec-authoring policy.
6. Target issue/spec/template and narrow current-code facts needed to avoid stale assumptions.

## Procedure

1. Inspect state and select/create the proper feature worktree when spec work will be committed.
2. Run `change.classify` to decide spec depth.
3. Select `spec.author` provider through workflow policy.
4. Run the provider and write `.harness/runs/<run-id>/feature.spec.yaml`.
5. Run `spec.review` when required by workflow tier.
6. If a repository feature document under `docs/features/*` is needed, translate the canonical spec into that document without adding unapproved scope.
7. Stop before implementation unless the user separately asks to continue.
8. Report run id, provider choice, artifacts, open questions, and verification.
