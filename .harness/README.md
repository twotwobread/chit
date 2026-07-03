# Harness

`.harness` is the source of truth for provider-neutral agent workflows, contracts, policies, providers, checks, rules, skills, and run artifacts.

Agent-specific directories such as `.pi`, `.claude`, and `.agents` are adapter/install surfaces. Generated adapter skill/rule copies must not be edited directly. If an adapter conflicts with `.harness`, follow `.harness`.

## Model

```text
Workflow -> Phase -> Contract -> Provider -> Tool

Policy  -> route, tier, provider, rulepack, check, and approval selection
Check   -> executable validation with blocking/warning/advisory severity
Artifact -> canonical phase output passed between phases
Run     -> stateful workflow execution envelope
```

- **Workflow**: phase order, for example `feature-start`.
- **Phase**: a stable step inside a workflow, for example `spec.author` or `implementation.execute`.
- **Contract**: phase inputs, outputs, completion conditions, and side-effect boundaries.
- **Policy**: route/tier/provider/rulepack/check/approval selection for a run.
- **Provider**: a replaceable implementation of a phase contract.
- **Tool**: the concrete tool used by a provider.
- **Check**: an executable validation such as adapter sync, lint, generated-code sync, typecheck, or tests.
- **Artifact**: the canonical output a downstream phase may consume.
- **Run**: the persisted state for one workflow execution.

## Directories

```text
.harness/manifest.yaml       top-level harness index
.harness/workflows           workflow phase order only
.harness/contracts           phase inputs, outputs, and done conditions
.harness/policies            route/tier/provider/rulepack/check/approval selection
.harness/policies/rulepacks  which rule files to load for each workflow/risk/phase
.harness/providers           provider adapters and tool-specific behavior
.harness/checks              executable validation descriptors
.harness/artifacts/schemas   canonical artifact schema drafts
.harness/artifacts/templates reusable run/artifact templates
.harness/rules               canonical project/agent rule bodies
.harness/skills              canonical skill sources
.harness/scripts             adapter sync, validation, and provider policy helpers
.harness/runs                workflow run artifacts; ignored except .gitkeep
```

## Run lifecycle

Runs start as a minimal pending envelope. Do not choose `lightweight`, `normal`, or `strict` at creation time.

```text
.harness/runs/<run-id>/
  run.yaml                  # route: pending, tier: pending
  artifacts/
    user-request.md
    ledger.md
```

Then `change.classify` performs intake triage:

```text
request/issue + narrow repo evidence -> route decision -> enough evidence? -> tier selection
```

If scope is unclear, route to clarification or block. If expected behavior is clear but cause is unknown, route to local technical investigation. Only after enough evidence exists should policy select a tier.

## Tier depth

```text
lightweight
  run.yaml
  artifacts/user-request.md
  artifacts/classification.yaml
  artifacts/ledger.md
  artifacts/verification.md

normal
  lightweight artifacts plus:
  provider-selection.yaml
  artifacts/feature.spec.md
  artifacts/implementation-plan.md
  artifacts/evaluation-report.md

strict
  normal artifacts plus:
  events.ndjson
  artifacts/spec-review.md
  artifacts/checks/*
  private/*
```

Provider-private notes, transcripts, and scratch state belong under `private/`. Downstream phases must consume only `run.yaml`, `provider-selection.yaml`, and `artifacts/`.

## Provider policy principle

Small, clear, low-risk, testable changes use the lightweight path: concise scope, focused implementation, deterministic checks, and compact verification.

Large, ambiguous, high-risk, or product-direction-unclear changes use the strict path: structured clarification, explicit review, stronger evaluation, and human approval checks.

Provider names belong in `.harness/policies/*` and `.harness/providers/*`, not in global architecture principles.

Provider `when` expressions use a small, safe DSL: `==`, `!=`, `in`, `not in`, `and`, `or`, booleans, string literals, arrays, and parentheses. Use `pnpm harness:validate` to parse/type-check expressions and `pnpm harness:evaluate-provider -- --workflow <workflow.yml> --policy <policy> --classification <classification.yaml>` to evaluate a provider policy for a run.
