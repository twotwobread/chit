-- +goose Up
ALTER TABLE expenses
  ADD COLUMN split_policy text NOT NULL DEFAULT 'equal';

ALTER TABLE expenses
  ADD CONSTRAINT expenses_split_policy_check CHECK (split_policy IN ('equal'));

ALTER TABLE expenses
  ALTER COLUMN place_name DROP NOT NULL,
  ALTER COLUMN place_address DROP NOT NULL,
  ALTER COLUMN place_type DROP NOT NULL;

-- +goose Down
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_split_policy_check;
ALTER TABLE expenses DROP COLUMN IF EXISTS split_policy;

UPDATE expenses
SET place_name = COALESCE(place_name, '지출'),
    place_address = COALESCE(place_address, '주소 없음'),
    place_type = COALESCE(place_type, 'etc');

ALTER TABLE expenses
  ALTER COLUMN place_name SET NOT NULL,
  ALTER COLUMN place_address SET NOT NULL,
  ALTER COLUMN place_type SET NOT NULL;
