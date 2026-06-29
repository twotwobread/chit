# Gates

Gates are executable checks that enforce critical rules. Rules describe expected behavior; gates block progress when important invariants fail.

Initial gate candidates:

- `check-spec`: validate canonical spec required fields.
- `check-layers`: detect architecture layer/import violations.
- `check-secrets`: detect secret/API key/JWT/DB URL leaks.
- `check-boundaries`: detect module boundary violations.
- `check-pr-readiness`: ensure spec, verification, evaluation, and risk notes exist before PR creation.

Add gates only when the rule is important enough to block progress automatically.
