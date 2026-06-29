# Harness

`.harness` is the source of truth for agent-agnostic workflows, contracts, providers, rules, gates, skills, and run artifacts.

Agent-specific directories such as `.pi`, `.claude`, and `.agents` are adapter/install surfaces. Generated adapter skill/rule copies must not be edited directly. If an adapter conflicts with `.harness`, follow `.harness`.

## Model

```text
Workflow -> Phase -> Contract -> Provider -> Tool
```

- **Workflow**: the end-to-end process, for example `feature-start`.
- **Phase**: a stable step inside a workflow, for example `spec.author` or `implementation.execute`.
- **Contract**: phase inputs, outputs, and completion conditions.
- **Provider**: a replaceable implementation of a phase contract.
- **Tool**: the concrete tool used by a provider, such as Ouroboros, Superpowers, or GitHub CLI.

## Directories

```text
.harness/workflows   workflow phase order and provider policy
.harness/contracts   phase inputs, outputs, and done conditions
.harness/providers   provider adapters and tool-specific behavior
.harness/schemas     canonical artifact schema drafts
.harness/rules       canonical project/agent rules
.harness/rulepacks   which rules to load for each workflow/risk/phase
.harness/gates       executable checks for blocking rules
.harness/skills      canonical skill sources
.harness/scripts     adapter sync, harness validation, and provider policy evaluation helpers
.harness/runs        workflow run artifacts; ignored except .gitkeep
```

## Canonical artifacts

Providers may keep private notes, transcripts, or tool state, but downstream phases must consume only canonical artifacts:

```text
.harness/runs/<run-id>/classification.yaml
.harness/runs/<run-id>/feature.spec.yaml
.harness/runs/<run-id>/spec-review.md
.harness/runs/<run-id>/implementation-plan.md
.harness/runs/<run-id>/evaluation-report.md
.harness/runs/<run-id>/ledger.md
```

## Provider policy principle

Small, clear, low-risk, testable changes should use a lightweight path: micro spec plus Superpowers-style TDD implementation when appropriate.

Large, ambiguous, high-risk, or product-direction-unclear changes should use a heavier loop: Ouroboros/product-review-backed clarification, stricter spec review, and explicit ledger entries before implementation.

Provider `when` expressions use a small, safe DSL: `==`, `!=`, `in`, `not in`, `and`, `or`, booleans, string literals, arrays, and parentheses. Use `pnpm harness:validate` to parse/type-check expressions and `pnpm harness:evaluate-provider -- --workflow <workflow.yml> --policy <policy> --classification <classification.yaml>` to evaluate a provider policy for a run.
