-- +goose Up
ALTER TABLE trip_places
  ADD COLUMN provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN google_place_id text,
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN google_primary_type text,
  ADD COLUMN google_types text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE trip_places
  ADD CONSTRAINT trip_places_provider_check CHECK (provider IN ('manual', 'google')),
  ADD CONSTRAINT trip_places_google_metadata_check CHECK (
    (
      provider = 'manual'
      AND google_place_id IS NULL
      AND latitude IS NULL
      AND longitude IS NULL
      AND google_primary_type IS NULL
      AND cardinality(google_types) = 0
    )
    OR
    (
      provider = 'google'
      AND google_place_id IS NOT NULL
      AND char_length(btrim(google_place_id)) BETWEEN 1 AND 255
      AND latitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude IS NOT NULL
      AND longitude BETWEEN -180 AND 180
      AND google_primary_type IS NOT NULL
      AND char_length(btrim(google_primary_type)) > 0
      AND cardinality(google_types) > 0
    )
  );

CREATE UNIQUE INDEX trip_places_trip_google_place_unique
  ON trip_places (trip_id, google_place_id)
  WHERE provider = 'google';

-- +goose Down
DROP INDEX IF EXISTS trip_places_trip_google_place_unique;

ALTER TABLE trip_places
  DROP CONSTRAINT IF EXISTS trip_places_google_metadata_check,
  DROP CONSTRAINT IF EXISTS trip_places_provider_check,
  DROP COLUMN IF EXISTS google_types,
  DROP COLUMN IF EXISTS google_primary_type,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS google_place_id,
  DROP COLUMN IF EXISTS provider;
