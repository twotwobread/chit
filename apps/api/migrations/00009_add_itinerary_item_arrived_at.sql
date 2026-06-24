-- +goose Up
ALTER TABLE itinerary_items
  ADD COLUMN arrived_at timestamptz;

-- +goose Down
ALTER TABLE itinerary_items
  DROP COLUMN IF EXISTS arrived_at;
