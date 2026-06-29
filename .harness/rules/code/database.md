# Database/API Rules

- OpenAPI is the source of truth for API changes.
- Update OpenAPI before server/mobile implementation when the contract changes.
- Use goose migrations for DB schema changes.
- Add needed foreign keys, unique constraints, checks, and indexes with the migration.
- Update sqlc queries/generated DB code when needed.
- Do not store money as floating point.
- Adding or changing a core domain model requires explicit feature spec scope.
