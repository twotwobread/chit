-- +goose Up
ALTER TABLE expenses
  ADD COLUMN memo text;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_memo_length_check CHECK (memo IS NULL OR char_length(memo) <= 240);

-- +goose Down
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_memo_length_check;

ALTER TABLE expenses
  DROP COLUMN IF EXISTS memo;
