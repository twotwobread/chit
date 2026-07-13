-- +goose Up
ALTER TABLE trip_participants
  ADD CONSTRAINT trip_participants_id_trip_unique UNIQUE (id, trip_id);

CREATE TABLE flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  flight_number text,
  display_title text NOT NULL,
  departure_airport_text text NOT NULL,
  departure_airport_code text,
  departure_local_date date NOT NULL,
  departure_local_time time NOT NULL,
  departure_time_zone text NOT NULL,
  departure_at timestamptz NOT NULL,
  arrival_airport_text text NOT NULL,
  arrival_airport_code text,
  arrival_local_date date NOT NULL,
  arrival_local_time time NOT NULL,
  arrival_time_zone text NOT NULL,
  arrival_at timestamptz NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flights_id_trip_unique UNIQUE (id, trip_id),
  CONSTRAINT flights_display_title_length_check CHECK (char_length(btrim(display_title)) BETWEEN 1 AND 80),
  CONSTRAINT flights_flight_number_length_check CHECK (flight_number IS NULL OR char_length(btrim(flight_number)) BETWEEN 1 AND 20),
  CONSTRAINT flights_departure_airport_text_length_check CHECK (char_length(btrim(departure_airport_text)) BETWEEN 1 AND 120),
  CONSTRAINT flights_arrival_airport_text_length_check CHECK (char_length(btrim(arrival_airport_text)) BETWEEN 1 AND 120),
  CONSTRAINT flights_departure_airport_code_length_check CHECK (departure_airport_code IS NULL OR char_length(btrim(departure_airport_code)) BETWEEN 1 AND 8),
  CONSTRAINT flights_arrival_airport_code_length_check CHECK (arrival_airport_code IS NULL OR char_length(btrim(arrival_airport_code)) BETWEEN 1 AND 8),
  CONSTRAINT flights_departure_time_zone_length_check CHECK (char_length(btrim(departure_time_zone)) BETWEEN 1 AND 80),
  CONSTRAINT flights_arrival_time_zone_length_check CHECK (char_length(btrim(arrival_time_zone)) BETWEEN 1 AND 80),
  CONSTRAINT flights_time_order_check CHECK (arrival_at > departure_at)
);

CREATE INDEX flights_trip_departure_idx ON flights (trip_id, departure_at, id);
CREATE INDEX flights_trip_arrival_idx ON flights (trip_id, arrival_at, id);

CREATE TABLE flight_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  added_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flight_passengers_flight_participant_unique UNIQUE (flight_id, participant_id),
  CONSTRAINT flight_passengers_flight_trip_fk FOREIGN KEY (flight_id, trip_id) REFERENCES flights(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT flight_passengers_participant_trip_fk FOREIGN KEY (participant_id, trip_id) REFERENCES trip_participants(id, trip_id) ON DELETE CASCADE
);

CREATE INDEX flight_passengers_trip_participant_idx ON flight_passengers (trip_id, participant_id, flight_id);

CREATE TABLE flight_personal_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  passenger_participant_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reservation_number text,
  seat text,
  check_in_url text,
  boarding_pass_bucket text,
  boarding_pass_object_key text,
  boarding_pass_generation text,
  boarding_pass_content_type text,
  boarding_pass_byte_size integer,
  boarding_pass_uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flight_personal_details_flight_passenger_unique UNIQUE (flight_id, passenger_participant_id),
  CONSTRAINT flight_personal_details_flight_passenger_fk FOREIGN KEY (flight_id, passenger_participant_id) REFERENCES flight_passengers(flight_id, participant_id) ON DELETE CASCADE,
  CONSTRAINT flight_personal_details_reservation_number_length_check CHECK (reservation_number IS NULL OR char_length(btrim(reservation_number)) BETWEEN 1 AND 80),
  CONSTRAINT flight_personal_details_seat_length_check CHECK (seat IS NULL OR char_length(btrim(seat)) BETWEEN 1 AND 20),
  CONSTRAINT flight_personal_details_check_in_url_length_check CHECK (check_in_url IS NULL OR char_length(btrim(check_in_url)) BETWEEN 1 AND 500),
  CONSTRAINT flight_personal_details_boarding_pass_content_type_check CHECK (boarding_pass_content_type IS NULL OR boarding_pass_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT flight_personal_details_boarding_pass_byte_size_check CHECK (boarding_pass_byte_size IS NULL OR boarding_pass_byte_size BETWEEN 1 AND 10485760),
  CONSTRAINT flight_personal_details_attachment_metadata_check CHECK (
    (
      boarding_pass_bucket IS NULL
      AND boarding_pass_object_key IS NULL
      AND boarding_pass_generation IS NULL
      AND boarding_pass_content_type IS NULL
      AND boarding_pass_byte_size IS NULL
      AND boarding_pass_uploaded_at IS NULL
    )
    OR
    (
      boarding_pass_bucket IS NOT NULL
      AND char_length(btrim(boarding_pass_bucket)) BETWEEN 1 AND 255
      AND boarding_pass_object_key IS NOT NULL
      AND char_length(btrim(boarding_pass_object_key)) BETWEEN 1 AND 512
      AND boarding_pass_generation IS NOT NULL
      AND char_length(btrim(boarding_pass_generation)) BETWEEN 1 AND 80
      AND boarding_pass_content_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND boarding_pass_byte_size BETWEEN 1 AND 10485760
      AND boarding_pass_uploaded_at IS NOT NULL
    )
  )
);

CREATE INDEX flight_personal_details_trip_passenger_idx ON flight_personal_details (trip_id, passenger_participant_id, flight_id);

CREATE TABLE storage_object_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  object_key text NOT NULL,
  object_generation text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT storage_object_deletion_jobs_bucket_length_check CHECK (char_length(btrim(bucket)) BETWEEN 1 AND 255),
  CONSTRAINT storage_object_deletion_jobs_object_key_length_check CHECK (char_length(btrim(object_key)) BETWEEN 1 AND 512),
  CONSTRAINT storage_object_deletion_jobs_generation_length_check CHECK (object_generation IS NULL OR char_length(btrim(object_generation)) BETWEEN 1 AND 80),
  CONSTRAINT storage_object_deletion_jobs_reason_check CHECK (reason IN ('replace', 'delete', 'participant_removed', 'trip_deleted', 'orphaned_upload')),
  CONSTRAINT storage_object_deletion_jobs_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  CONSTRAINT storage_object_deletion_jobs_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX storage_object_deletion_jobs_pending_idx
  ON storage_object_deletion_jobs (status, next_attempt_at, id)
  WHERE status IN ('pending', 'failed');

CREATE UNIQUE INDEX storage_object_deletion_jobs_active_unique
  ON storage_object_deletion_jobs (bucket, object_key, COALESCE(object_generation, ''))
  WHERE status IN ('pending', 'running');

-- +goose Down
DROP INDEX IF EXISTS storage_object_deletion_jobs_active_unique;
DROP INDEX IF EXISTS storage_object_deletion_jobs_pending_idx;
DROP TABLE IF EXISTS storage_object_deletion_jobs;
DROP INDEX IF EXISTS flight_personal_details_trip_passenger_idx;
DROP TABLE IF EXISTS flight_personal_details;
DROP INDEX IF EXISTS flight_passengers_trip_participant_idx;
DROP TABLE IF EXISTS flight_passengers;
DROP INDEX IF EXISTS flights_trip_arrival_idx;
DROP INDEX IF EXISTS flights_trip_departure_idx;
DROP TABLE IF EXISTS flights;
ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_id_trip_unique;
