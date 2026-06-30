-- +goose Up
ALTER TABLE schedule_items
  ADD COLUMN start_time time,
  ADD COLUMN end_time time;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_time_range_check
  CHECK (end_time IS NULL OR (start_time IS NOT NULL AND end_time > start_time));

-- +goose Down
ALTER TABLE schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_time_range_check;

ALTER TABLE schedule_items
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS start_time;
