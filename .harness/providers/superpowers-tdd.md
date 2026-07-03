# Provider: superpowers-tdd

## Phase

`implementation.execute`

## Tool

Superpowers by `obra/superpowers`, specifically its test-driven-development and verification skills when available in the active agent runtime.

## Use when

- The canonical spec is clear.
- Testability is medium or high.
- Risk is low or medium.
- The expected behavior can be expressed as failing tests before implementation.

## Availability / bootstrap

Superpowers is a concrete provider for this project. If the active runtime cannot discover Superpowers, install or enable it before using this provider.

### Codex / common `.agents` skill discovery

Official install pattern:

```bash
git clone https://github.com/obra/superpowers.git ~/.codex/superpowers
mkdir -p ~/.agents/skills
ln -s ~/.codex/superpowers/skills ~/.agents/skills/superpowers
```

Then restart the agent runtime so skills are rediscovered.

Verify:

```bash
ls -la ~/.agents/skills/superpowers
```

### Claude Code

Use the Claude plugin marketplace, for example:

```text
/plugin install superpowers@claude-plugins-official
```

or register the marketplace and install from there if needed:

```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

### Safety

- Do not install the unrelated/unknown npm package named `superpowers` without explicit approval.
- If install/activation is unavailable in the current runtime, fall back to a contract-compatible test-first implementation loop and record the Superpowers availability gap in the ledger.

## Behavior

Use the Superpowers TDD loop:

1. Load/activate the Superpowers TDD skill when the runtime supports it.
2. Map acceptance criteria to one or more tests.
3. Write or update the failing test first when practical.
4. Verify the test fails for the expected reason.
5. Implement the smallest behavior to pass.
6. Refactor only when needed for the current change.
7. Record command results and remaining gaps.

Superpowers may structure the implementation loop, but the source of truth remains `feature.spec.md` and `implementation-plan.md`.

## Do not use when

- Product behavior remains ambiguous.
- The implementation requires broad exploration before a test target is known.
- Critical risk requires a custom rollout/gate plan first.
