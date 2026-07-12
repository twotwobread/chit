-- +goose Up
ALTER TABLE trip_places
  DROP CONSTRAINT trip_places_place_type_check,
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'));

CREATE TABLE trip_place_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_place_id uuid NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_place_bookmarks_category_check CHECK (category IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc')),
  CONSTRAINT trip_place_bookmarks_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT trip_place_bookmarks_trip_place_unique UNIQUE (trip_id, trip_place_id)
);

CREATE INDEX trip_place_bookmarks_trip_id_idx
  ON trip_place_bookmarks (trip_id, created_at, id);

-- +goose Down
DROP INDEX IF EXISTS trip_place_bookmarks_trip_id_idx;
DROP TABLE IF EXISTS trip_place_bookmarks;

UPDATE trip_places
SET place_type = 'etc'
WHERE place_type = 'transport';

ALTER TABLE trip_places
  DROP CONSTRAINT trip_places_place_type_check,
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'));
