# Harness History

`.harness/history/` stores tracked, sanitized summaries of harness workflow runs. It is intended for trend analysis and policy regression review, not for replaying raw agent sessions.

## Files

- `runs.ndjson`: append-only newline-delimited JSON records using `run-summary.v1`.

## Rules

- Keep raw operational state in `.harness/runs/`; that directory remains gitignored.
- Record only whitelisted fields from canonical run files such as `run.yaml`, `artifacts/classification.yaml`, and `provider-selection.yaml`.
- Do not copy provider-private state, full user transcripts, long logs, check output bodies, secrets, or `private/` files into tracked history.
- Prefer appending one compact JSON line per run. If branch conflicts occur, keep both valid lines unless one is a true duplicate.
- Use `pnpm harness:record-run -- --run-id <run-id>` after meaningful run milestones, especially before deleting a feature worktree.

## Relationship to evals

History is operational evidence. Curated eval cases live under `.harness/evals/` and should be selected manually from history when a run teaches something about routing, tiering, provider selection, or policy quality.
