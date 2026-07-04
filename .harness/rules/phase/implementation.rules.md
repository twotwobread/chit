# Phase Rules: implementation

- Implement only the approved canonical spec or explicitly triaged small scope.
- Continue in the same feature/issue worktree/branch where spec/plan work started when unmerged.
- API changes start from OpenAPI.
- DB changes use migrations and regeneration.
- Mobile uses generated API types/client when available.
- Use `superpowers-tdd` when the spec is clear and behavior is testable.
- If implementation reveals product/domain ambiguity, stop and re-run classification/provider policy instead of guessing.
- Add tests for changed behavior or record a regression gap.
- For bugfixes, the first regression test should represent the reported Given/When/Then reproduction path, not only an adjacent implementation hypothesis.
