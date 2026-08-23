-- +goose Up
ALTER TABLE events
  ADD COLUMN start_time text NULL,
  ADD COLUMN place_name text NULL,
  ADD COLUMN place_address text NULL,
  ADD COLUMN category text NULL;

ALTER TABLE events
  ADD CONSTRAINT events_start_time_check CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT events_place_name_length_check CHECK (place_name IS NULL OR char_length(place_name) BETWEEN 1 AND 120),
  ADD CONSTRAINT events_place_address_length_check CHECK (place_address IS NULL OR char_length(place_address) BETWEEN 1 AND 240),
  ADD CONSTRAINT events_category_check CHECK (category IS NULL OR category IN ('date', 'friends', 'meal', 'cafe', 'activity', 'custom'));

-- +goose Down
ALTER TABLE events
  DROP CONSTRAINT events_category_check,
  DROP CONSTRAINT events_place_address_length_check,
  DROP CONSTRAINT events_place_name_length_check,
  DROP CONSTRAINT events_start_time_check;

ALTER TABLE events
  DROP COLUMN category,
  DROP COLUMN place_address,
  DROP COLUMN place_name,
  DROP COLUMN start_time;
