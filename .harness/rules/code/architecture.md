# Architecture Rules

- Keep behavior changes separate from unrelated refactors.
- Avoid option-heavy abstractions for future needs.
- Keep vertical-slice behavior deployable across touched layers.
- API handlers, services, and repositories should keep separate responsibilities.
- Mobile screens should orchestrate route params, state, API calls, navigation, and composition; move complex formatting/mapping/grouping into helpers.
- Generated API/client/db artifacts must be updated with the source contract/schema change that produced them.
