-- +goose Up
ALTER TABLE expenses ADD COLUMN expense_category text;

UPDATE expenses
SET expense_category = CASE
  WHEN place_type IN ('cafe', 'etc', 'food', 'lodging', 'shopping', 'sights', 'transport') THEN place_type
  ELSE 'etc'
END;

ALTER TABLE expenses ALTER COLUMN expense_category SET DEFAULT 'etc';
ALTER TABLE expenses ALTER COLUMN expense_category SET NOT NULL;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_expense_category_check CHECK (expense_category IN ('cafe', 'etc', 'food', 'lodging', 'shopping', 'sights', 'transport'));

-- +goose Down
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_expense_category_check;
ALTER TABLE expenses DROP COLUMN IF EXISTS expense_category;
