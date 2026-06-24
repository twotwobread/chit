-- +goose Up
ALTER TABLE users ADD COLUMN deleted_at timestamptz NULL;

CREATE INDEX users_deleted_at_idx
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP INDEX users_deleted_at_idx;
ALTER TABLE users DROP COLUMN deleted_at;
