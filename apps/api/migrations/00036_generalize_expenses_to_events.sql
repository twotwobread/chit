-- +goose Up
ALTER TABLE expenses
  ADD COLUMN event_id uuid NULL REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN payer_event_participant_id uuid NULL REFERENCES event_participants(id) ON DELETE SET NULL;

ALTER TABLE expense_splits
  ADD COLUMN event_participant_id uuid NULL REFERENCES event_participants(id) ON DELETE SET NULL;

UPDATE expenses e
SET event_id = ev.id
FROM events ev
WHERE e.trip_id = ev.trip_id
  AND e.event_id IS NULL;

ALTER TABLE expenses
  ALTER COLUMN trip_id DROP NOT NULL;

ALTER TABLE expenses
  DROP CONSTRAINT expenses_anchor_type_check,
  DROP CONSTRAINT expenses_anchor_columns_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_scope_check CHECK (trip_id IS NOT NULL OR event_id IS NOT NULL),
  ADD CONSTRAINT expenses_anchor_type_check CHECK (anchor_type IN ('trip', 'trip_day', 'schedule_item', 'event')),
  ADD CONSTRAINT expenses_anchor_columns_check CHECK (
    (anchor_type = 'trip' AND trip_id IS NOT NULL AND trip_day_id IS NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'trip_day' AND trip_id IS NOT NULL AND trip_day_id IS NOT NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'schedule_item' AND trip_id IS NOT NULL AND trip_day_id IS NOT NULL AND schedule_item_id IS NOT NULL)
    OR (anchor_type = 'event' AND event_id IS NOT NULL AND trip_day_id IS NULL AND schedule_item_id IS NULL AND trip_place_id IS NULL)
  ),
  ADD CONSTRAINT expenses_payer_scope_check CHECK (NOT (payer_participant_id IS NOT NULL AND payer_event_participant_id IS NOT NULL));

ALTER TABLE expense_splits
  ADD CONSTRAINT expense_splits_participant_scope_check CHECK (NOT (participant_id IS NOT NULL AND event_participant_id IS NOT NULL));

CREATE INDEX expenses_event_created_idx ON expenses (event_id, created_at DESC, id DESC) WHERE event_id IS NOT NULL;
CREATE INDEX expenses_event_settlement_idx ON expenses (event_id, include_in_settlement, created_at, id) WHERE event_id IS NOT NULL;
CREATE INDEX expenses_payer_event_participant_idx ON expenses (payer_event_participant_id) WHERE payer_event_participant_id IS NOT NULL;
CREATE INDEX expense_splits_event_participant_idx ON expense_splits (event_participant_id) WHERE event_participant_id IS NOT NULL;
CREATE UNIQUE INDEX expenses_event_client_mutation_unique_idx ON expenses (event_id, created_by, client_mutation_id) WHERE event_id IS NOT NULL AND client_mutation_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS expenses_event_client_mutation_unique_idx;
DROP INDEX IF EXISTS expense_splits_event_participant_idx;
DROP INDEX IF EXISTS expenses_payer_event_participant_idx;
DROP INDEX IF EXISTS expenses_event_settlement_idx;
DROP INDEX IF EXISTS expenses_event_created_idx;

ALTER TABLE expense_splits
  DROP CONSTRAINT IF EXISTS expense_splits_participant_scope_check;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_payer_scope_check,
  DROP CONSTRAINT IF EXISTS expenses_anchor_columns_check,
  DROP CONSTRAINT IF EXISTS expenses_anchor_type_check,
  DROP CONSTRAINT IF EXISTS expenses_scope_check;

DELETE FROM expenses WHERE trip_id IS NULL;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_anchor_type_check CHECK (anchor_type IN ('trip', 'trip_day', 'schedule_item')),
  ADD CONSTRAINT expenses_anchor_columns_check CHECK (
    (anchor_type = 'trip' AND trip_day_id IS NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'trip_day' AND trip_day_id IS NOT NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'schedule_item' AND trip_day_id IS NOT NULL AND schedule_item_id IS NOT NULL)
  );

ALTER TABLE expenses
  ALTER COLUMN trip_id SET NOT NULL;

ALTER TABLE expense_splits
  DROP COLUMN event_participant_id;

ALTER TABLE expenses
  DROP COLUMN payer_event_participant_id,
  DROP COLUMN event_id;
