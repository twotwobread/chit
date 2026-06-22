-- +goose Up
CREATE TABLE trip_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  place_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_places_name_length_check CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc')),
  CONSTRAINT trip_places_id_trip_unique UNIQUE (id, trip_id)
);

CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  item_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_items_item_order_check CHECK (item_order >= 1),
  CONSTRAINT itinerary_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT itinerary_items_trip_date_order_unique UNIQUE (trip_id, scheduled_date, item_order)
);

-- +goose Down
DROP TABLE IF EXISTS itinerary_items;
DROP TABLE IF EXISTS trip_places;
