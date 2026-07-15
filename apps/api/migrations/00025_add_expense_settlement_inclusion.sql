-- +goose Up
ALTER TABLE expenses
  ADD COLUMN include_in_settlement boolean NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE expenses
  DROP COLUMN IF EXISTS include_in_settlement;
