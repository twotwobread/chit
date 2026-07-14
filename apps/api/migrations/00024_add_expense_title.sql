-- +goose Up
ALTER TABLE expenses
  ADD COLUMN title text,
  ADD CONSTRAINT expenses_title_length_check CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 120);

-- +goose Down
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_title_length_check,
  DROP COLUMN IF EXISTS title;
