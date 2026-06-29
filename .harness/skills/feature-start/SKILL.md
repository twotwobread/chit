---
name: i-um-feature-start
description: Start i-um feature, bugfix, debug, or implementation work through the .harness feature-start workflow.
---

# i-um Feature Start

Use this skill when the user asks to implement, fix, debug, resolve an issue, or start feature work. Use `.harness/workflows/feature-start.yml` as the workflow source of truth.

Do not hard-code Ouroboros, Superpowers, product review, or checklist behavior in this skill. Select providers through the workflow provider policies and record the decision in the run ledger.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`
- Clear user-described bug, fix, or implementation request

If missing, ask before implementation.

## Minimal reads

1. `.harness/workflows/feature-start.yml`.
2. `.harness/rulepacks/feature-start.yml`.
3. Relevant phase contract before running each phase.
4. Provider doc selected by workflow policy.
5. Target issue/spec or narrow source files needed by the current phase.

Do not read broad docs by default. Read only the rules selected by the rulepack for the current phase/risk.

## Procedure

1. Inspect state
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse --show-toplevel`
   - Do not overwrite unrelated user changes.

2. Create or select run context
   - Choose a stable `<run-id>`.
   - Create `.harness/runs/<run-id>/` when artifacts will be written.
   - Start `.harness/runs/<run-id>/ledger.md` with the request and initial assumptions.

3. Run `change.classify`
   - Follow `.harness/contracts/change-classify.contract.md`.
   - Classify size, ambiguity, risk, testability, architecture impact, domain sensitivity, product uncertainty, and exploration need.
   - Write `classification.yaml`.

4. Select workflow tier and providers
   - Use `.harness/workflows/feature-start.yml` provider policies.
   - Small/clear/local/testable work: expect `micro-spec-author` for spec and often `superpowers-tdd` for implementation.
   - Large/ambiguous/high-risk work: expect `ouroboros-spec-author` and the full review loop before implementation.
   - Product-direction uncertainty: consider `product-direction-review` before finalizing the canonical spec.
   - Record selected providers and reasons in `ledger.md`.

5. Run phases in order
   - `spec.author`: require `feature.spec.yaml`.
   - `spec.review`: require explicit verdict unless the workflow tier and user approval allow a small-path skip.
   - `implementation.plan`: require `implementation-plan.md`.
   - `implementation.execute`: implement only from canonical artifacts.
   - `evaluation.checklist`: require `evaluation-report.md`.
   - `pr.create` and `review.request`: only after required gates pass or accepted risk is explicit.

6. Respect contract boundaries
   - Downstream phases read canonical artifacts, not provider-private transcripts, seeds, prompts, or notes.
   - If implementation reveals new product/domain ambiguity, pause and re-run classification/provider selection.

7. Complete
   - Report changed behavior, workflow tier, selected providers, verification commands/results, manual smoke/deploy status, and gaps/risks.
