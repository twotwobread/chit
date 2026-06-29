# Phase Rules: spec.author

- Select the provider via `.harness/workflows/feature-start.yml`; do not hard-code a tool in the workflow skill.
- Small, clear, local, testable work may use `micro-spec-author`.
- Large, ambiguous, high-risk, or cross-layer work should use `ouroboros-spec-author`.
- Product-direction uncertainty may use `product-direction-review` before finalizing a canonical spec.
- The only downstream spec artifact is `.harness/runs/<run-id>/feature.spec.yaml`.
- Provider-private transcripts, seeds, or notes may be referenced as evidence but must not become downstream dependencies.
- Keep unresolved product/domain ambiguity in `open_questions`.
