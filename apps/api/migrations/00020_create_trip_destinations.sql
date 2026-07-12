-- +goose Up
CREATE TABLE trip_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  city_name text NOT NULL,
  country_name text NOT NULL,
  country_code text NOT NULL,
  display_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL,
  provider text NOT NULL,
  provider_place_id text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_destinations_city_name_length_check CHECK (char_length(city_name) BETWEEN 1 AND 120),
  CONSTRAINT trip_destinations_country_name_length_check CHECK (char_length(country_name) BETWEEN 1 AND 120),
  CONSTRAINT trip_destinations_country_code_check CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT trip_destinations_display_name_length_check CHECK (char_length(display_name) BETWEEN 1 AND 160),
  CONSTRAINT trip_destinations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_destinations_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT trip_destinations_radius_meters_check CHECK (radius_meters BETWEEN 1 AND 500000),
  CONSTRAINT trip_destinations_provider_check CHECK (provider IN ('google')),
  CONSTRAINT trip_destinations_provider_place_id_length_check CHECK (char_length(provider_place_id) BETWEEN 1 AND 255),
  CONSTRAINT trip_destinations_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT trip_destinations_trip_provider_place_unique UNIQUE (trip_id, provider, provider_place_id),
  CONSTRAINT trip_destinations_trip_sort_order_unique UNIQUE (trip_id, sort_order)
);

CREATE INDEX trip_destinations_trip_id_idx ON trip_destinations (trip_id);

-- +goose Down
DROP TABLE IF EXISTS trip_destinations;
