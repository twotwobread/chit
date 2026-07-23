-- +goose Up
ALTER TABLE expenses
  ADD COLUMN client_mutation_id text;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_client_mutation_id_length_check
  CHECK (
    client_mutation_id IS NULL
    OR char_length(btrim(client_mutation_id)) BETWEEN 1 AND 80
  );

CREATE UNIQUE INDEX expenses_client_mutation_unique_idx
  ON expenses (trip_id, created_by, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS expenses_client_mutation_unique_idx;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_client_mutation_id_length_check;

ALTER TABLE expenses
  DROP COLUMN IF EXISTS client_mutation_id;
