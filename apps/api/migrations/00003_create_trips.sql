-- +goose Up
CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  default_currency text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_name_length_check CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT trips_date_range_check CHECK (start_date <= end_date),
  CONSTRAINT trips_default_currency_check CHECK (default_currency IN ('KRW', 'JPY', 'USD', 'EUR'))
);

CREATE INDEX trips_created_by_idx ON trips (created_by);

CREATE TABLE trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_participants_role_check CHECK (role IN ('owner', 'member')),
  CONSTRAINT trip_participants_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT trip_participants_trip_user_unique UNIQUE (trip_id, user_id)
);

CREATE INDEX trip_participants_user_id_idx ON trip_participants (user_id);
CREATE INDEX trip_participants_trip_id_idx ON trip_participants (trip_id);

-- +goose Down
DROP TABLE trip_participants;
DROP TABLE trips;
