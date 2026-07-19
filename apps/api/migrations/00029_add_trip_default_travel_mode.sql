-- +goose Up
ALTER TABLE trips
  ADD COLUMN default_travel_mode text NOT NULL DEFAULT 'transit';

ALTER TABLE trips
  ADD CONSTRAINT trips_default_travel_mode_check
  CHECK (default_travel_mode IN ('transit', 'driving'));

-- +goose Down
ALTER TABLE trips
  DROP CONSTRAINT IF EXISTS trips_default_travel_mode_check;

ALTER TABLE trips
  DROP COLUMN IF EXISTS default_travel_mode;
