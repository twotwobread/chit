-- +goose Up
CREATE TABLE day_lodging_places (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lodging_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, lodging_date),
  CONSTRAINT day_lodging_places_trip_place_fk
    FOREIGN KEY (trip_place_id, trip_id)
    REFERENCES trip_places(id, trip_id)
    ON DELETE CASCADE
);

CREATE INDEX day_lodging_places_trip_place_id_idx
  ON day_lodging_places (trip_place_id);

-- +goose Down
DROP TABLE IF EXISTS day_lodging_places;
