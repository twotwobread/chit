-- +goose Up
ALTER TABLE itinerary_items
  ADD COLUMN skipped_at timestamptz;

ALTER TABLE itinerary_items
  ADD CONSTRAINT itinerary_items_arrived_skipped_exclusive
  CHECK (arrived_at IS NULL OR skipped_at IS NULL);

-- +goose Down
ALTER TABLE itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_arrived_skipped_exclusive;

ALTER TABLE itinerary_items
  DROP COLUMN IF EXISTS skipped_at;
