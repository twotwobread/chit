# Agent Working Principles

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Feature Delivery Workflow

**Build vertical slices. Keep the project deployable.**

For feature work:
- Follow `docs/delivery/feature_delivery_workflow.md`.
- Use `docs/delivery/definition_of_done.md` as the completion checklist.
- Create or update a feature spec + plan under `docs/features/` before implementation.
- Use `docs/features/_template.md` for new feature documents.
- Manage feature work through GitHub Issues; link the feature spec from the issue.
- Use Ouroboros to clarify ambiguous feature requirements before implementation.
- If a feature appears complex or long-running, pause before implementation and ask whether to execute implementation through Ouroboros. Only use Ouroboros execution after explicit user approval; otherwise implement directly from the feature spec with Pi.
- Do not start implementation while required product/API/DB/UI decisions remain unresolved.

Worktree rule:
- Create new worktrees through `scripts/worktree-create`; do not call `git worktree add` directly for feature/doc PR work.
- `scripts/worktree-create` must clean stale merged/closed PR/MR worktrees before creating the new one.
- Never remove a worktree with uncommitted changes, an open PR/MR, or unknown PR/MR status.
- Create one `git worktree` per PR/MR.
- All feature worktrees must live under the repository root `.worktrees/` directory.
- Use `.worktrees/<feature-id>-<short-name>` as the local worktree path, e.g. `.worktrees/F001-monorepo-walking-skeleton`.
- Do not create sibling-directory worktrees such as `../i-um-F001-*`.
- Check `docs/delivery/feature_delivery_workflow.md` before creating a feature worktree.

Vertical slice rule:
- A feature is not done until App UI, API contract, API server, DB changes, tests, and deployability are handled as needed.
- Avoid API-only or UI-only completion unless the user explicitly requested such a narrow task.
- API changes must start from OpenAPI before server/mobile implementation.
- Mobile UI should use the generated API client rather than hand-written duplicate types.
- Spec changes discovered during implementation must be reflected in the feature document.

PR/MR rule:
- When creating a PR/MR, use `.github/pull_request_template.md` for the description.
- Use title prefixes from `docs/delivery/feature_delivery_workflow.md`: `Feature-0000: <title>`, `Fix: <title>`, or `Docs: <title>`.

Completion report:
- Summarize what changed.
- List verification commands and results.
- Mention staging/internal build verification when applicable.
- Call out follow-up issues or unresolved risks.

## 6. Design Guardrails

**Keep UI consistent with the i-um design baseline.**

For UI/design work:
- Use `docs/design/README.md` as the canonical brand and UI direction.
- Use `apps/mobile/lib/design/theme.ts` for mobile color, spacing, radius, shadow, typography, and domain color tokens.
- Do not add raw hex colors or arbitrary spacing/radius values in screen code. If a value is needed, add or reuse a named token first.
- External provider brand colors must also be represented as tokens before use.
- Promote repeated UI patterns into reusable primitives instead of copying one-off styles across screens.
- Money UI must preserve semantic meaning: credit/받을 돈 = green `+`, debit/보낼 돈 = red `−`, with tabular numerals where supported.
- Do not use emoji or arbitrary unicode as product icons. When iconography is introduced, keep one consistent line-icon source.
- Reference screen patterns from `docs/design/mobile-ui-reference.md` instead of re-inventing visuals during feature work.
