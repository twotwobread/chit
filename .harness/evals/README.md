# Harness Evals

`.harness/evals/` stores manually curated regression cases for harness policy and workflow quality. These cases are derived from run history, but not every run should become an eval.

## Directory layout

```text
.harness/evals/
├── README.md
└── cases/
    └── <case-id>.yaml
```

## When to create a case

Promote a run summary into an eval case when it captures a reusable judgment, for example:

- A request was routed to the wrong phase.
- A tier was too heavy or too light.
- Provider selection changed in a way that should or should not repeat.
- A human override corrected classification or policy behavior.
- A regression, revert, or review finding revealed a harness weakness.

## Rules

- Eval cases are curated and reviewed by humans.
- Keep cases small and sanitized; include summaries, not raw transcripts or private provider state.
- Include policy/workflow provenance so future harness changes can distinguish intended behavior changes from regressions.
- Use `eval-case.v1` from `.harness/artifacts/schemas/eval-case.v1.yaml`.
