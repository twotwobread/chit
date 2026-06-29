# Phase Rules: evaluation.checklist

- Evaluate against the canonical spec, git diff, and verification evidence.
- Confirm out-of-scope work was not added.
- Confirm test coverage or explicit gaps.
- Confirm generated artifacts are in sync when source contracts/schema changed.
- Confirm secret/log safety.
- A `Failed` or `Blocked` verdict stops PR creation unless the user explicitly accepts the risk.
