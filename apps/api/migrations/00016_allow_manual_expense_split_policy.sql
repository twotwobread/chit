-- +goose Up
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_split_policy_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_split_policy_check CHECK (split_policy IN ('equal', 'manual'));

-- +goose Down
DELETE FROM expense_splits
WHERE expense_id IN (
  SELECT id FROM expenses WHERE split_policy = 'manual'
);

UPDATE expenses
SET split_policy = 'equal'
WHERE split_policy = 'manual';

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_split_policy_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_split_policy_check CHECK (split_policy IN ('equal'));
