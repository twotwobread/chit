-- +goose Up
ALTER TABLE expenses
  ADD COLUMN expense_kind text NOT NULL DEFAULT 'regular';

ALTER TABLE expenses
  ADD CONSTRAINT expenses_expense_kind_check CHECK (expense_kind IN ('regular', 'public_fund'));

-- +goose Down
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_expense_kind_check;
ALTER TABLE expenses DROP COLUMN IF EXISTS expense_kind;
