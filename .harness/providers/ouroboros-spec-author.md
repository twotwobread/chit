# Provider: ouroboros-spec-author

## Phase

`spec.author`

## Tool

Ouroboros clarification/interview/seed generation.

## Use when

- Ambiguity is medium or high.
- Risk is high or critical.
- Size is large or epic.
- Multiple layers/clients must coordinate.
- Acceptance criteria, rollout, compatibility, or product/domain behavior is unclear.

## Behavior

Run the Ouroboros clarification loop until ambiguity is low enough to produce an implementation-ready Seed/spec, or stop and ask for human product decisions.

Provider-private outputs such as transcripts, sessions, and seeds may be referenced in the canonical spec, but downstream phases must consume `.harness/runs/<run-id>/feature.spec.yaml`.

## Output requirements

- Write `feature.spec.yaml`.
- Record interview/session/seed identifiers in `provider.evidence`.
- Record unresolved ambiguity in `open_questions` instead of guessing.
