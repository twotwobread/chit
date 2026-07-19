CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text NULL,
  email_normalized text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  avatar_url text NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_email_normalized_idx
  ON users (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX users_deleted_at_idx
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email text NULL,
  email_normalized text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  display_name text NULL,
  avatar_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_identities_provider_check CHECK (provider IN ('apple', 'kakao')),
  CONSTRAINT auth_identities_provider_subject_unique UNIQUE (provider, provider_subject),
  CONSTRAINT auth_identities_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX auth_identities_verified_email_idx
  ON auth_identities (email_normalized)
  WHERE email_verified = true AND email_normalized IS NOT NULL;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  refresh_token_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  last_used_at timestamptz NULL,
  rotated_at timestamptz NULL,
  device_name text NULL,
  platform text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_refresh_token_expires_at_idx ON auth_sessions (refresh_token_expires_at);

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
  CONSTRAINT trip_participants_trip_user_unique UNIQUE (trip_id, user_id),
  CONSTRAINT trip_participants_id_trip_unique UNIQUE (id, trip_id)
);

CREATE INDEX trip_participants_user_id_idx ON trip_participants (user_id);
CREATE INDEX trip_participants_trip_id_idx ON trip_participants (trip_id);

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

CREATE TABLE trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_invites_token_length_check CHECK (char_length(token) BETWEEN 32 AND 128),
  CONSTRAINT trip_invites_expiry_after_create_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX trip_invites_token_unique ON trip_invites (token);
CREATE UNIQUE INDEX trip_invites_one_current_per_trip ON trip_invites (trip_id) WHERE deactivated_at IS NULL;
CREATE INDEX trip_invites_trip_id_idx ON trip_invites (trip_id);
CREATE INDEX trip_invites_expires_at_idx ON trip_invites (expires_at);

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
  CONSTRAINT storage_object_deletion_jobs_reason_check CHECK (reason IN ('replace', 'delete', 'participant_removed', 'trip_deleted', 'orphaned_upload', 'receipt_draft_cancelled', 'receipt_draft_expired', 'receipt_replaced', 'receipt_deleted', 'expense_deleted')),
  CONSTRAINT storage_object_deletion_jobs_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  CONSTRAINT storage_object_deletion_jobs_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX storage_object_deletion_jobs_pending_idx
  ON storage_object_deletion_jobs (status, next_attempt_at, id)
  WHERE status IN ('pending', 'failed');

CREATE UNIQUE INDEX storage_object_deletion_jobs_active_unique
  ON storage_object_deletion_jobs (bucket, object_key, COALESCE(object_generation, ''))
  WHERE status IN ('pending', 'running');

CREATE TABLE trip_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  place_type text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  google_place_id text,
  latitude double precision,
  longitude double precision,
  google_primary_type text,
  google_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_places_name_length_check CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc')),
  CONSTRAINT trip_places_provider_check CHECK (provider IN ('manual', 'google')),
  CONSTRAINT trip_places_google_metadata_check CHECK (
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
  ),
  CONSTRAINT trip_places_id_trip_unique UNIQUE (id, trip_id)
);

CREATE UNIQUE INDEX trip_places_trip_google_place_unique
  ON trip_places (trip_id, google_place_id)
  WHERE provider = 'google';

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

CREATE TABLE trip_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_order integer NOT NULL,
  lodging_trip_place_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_days_day_order_check CHECK (day_order >= 1),
  CONSTRAINT trip_days_trip_date_unique UNIQUE (trip_id, date),
  CONSTRAINT trip_days_id_trip_unique UNIQUE (id, trip_id),
  CONSTRAINT trip_days_lodging_trip_place_fk
    FOREIGN KEY (lodging_trip_place_id, trip_id)
    REFERENCES trip_places(id, trip_id)
    ON DELETE SET NULL (lodging_trip_place_id)
);

CREATE UNIQUE INDEX trip_days_active_order_unique
  ON trip_days (trip_id, day_order)
  WHERE deleted_at IS NULL;

CREATE INDEX trip_days_trip_active_date_idx
  ON trip_days (trip_id, date)
  WHERE deleted_at IS NULL;

CREATE TABLE schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_day_id uuid NOT NULL,
  trip_place_id uuid NOT NULL,
  item_order integer NOT NULL,
  rank text COLLATE "C" NOT NULL,
  version integer NOT NULL DEFAULT 1,
  start_time time,
  end_time time,
  place_title text,
  place_memo text,
  arrived_at timestamptz,
  skipped_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_items_item_order_check CHECK (item_order >= 1),
  CONSTRAINT schedule_items_version_check CHECK (version >= 1),
  CONSTRAINT schedule_items_arrived_skipped_exclusive CHECK (arrived_at IS NULL OR skipped_at IS NULL),
  CONSTRAINT schedule_items_time_range_check CHECK (end_time IS NULL OR (start_time IS NOT NULL AND end_time > start_time)),
  CONSTRAINT schedule_items_place_title_check CHECK (place_title IS NOT NULL AND char_length(btrim(place_title)) BETWEEN 1 AND 120),
  CONSTRAINT schedule_items_place_memo_check CHECK ((place_memo IS NULL OR char_length(place_memo) <= 1000)),
  CONSTRAINT schedule_items_backing_check CHECK (trip_place_id IS NOT NULL AND place_title IS NOT NULL),
  CONSTRAINT schedule_items_trip_day_fk FOREIGN KEY (trip_day_id, trip_id) REFERENCES trip_days(id, trip_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE RESTRICT,
  CONSTRAINT schedule_items_id_day_trip_unique UNIQUE (id, trip_day_id, trip_id)
);

CREATE UNIQUE INDEX schedule_items_active_day_order_unique
  ON schedule_items (trip_day_id, item_order)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX schedule_items_active_day_rank_unique
  ON schedule_items (trip_day_id, rank)
  WHERE deleted_at IS NULL;

CREATE INDEX schedule_items_trip_day_rank_idx
  ON schedule_items (trip_day_id, rank)
  WHERE deleted_at IS NULL;

CREATE INDEX schedule_items_trip_place_idx
  ON schedule_items (trip_id, trip_place_id)
  WHERE deleted_at IS NULL;

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  anchor_type text NOT NULL,
  trip_day_id uuid,
  schedule_item_id uuid,
  expense_date date NOT NULL,
  title text,
  trip_place_id uuid REFERENCES trip_places(id) ON DELETE SET NULL,
  place_name text,
  place_address text,
  place_type text,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  split_policy text NOT NULL DEFAULT 'equal',
  payer_participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL,
  payer_display_name text NOT NULL,
  memo text,
  include_in_settlement boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_id_trip_unique UNIQUE (id, trip_id),
  CONSTRAINT expenses_anchor_type_check CHECK (anchor_type IN ('trip', 'trip_day', 'schedule_item')),
  CONSTRAINT expenses_anchor_columns_check CHECK (
    (anchor_type = 'trip' AND trip_day_id IS NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'trip_day' AND trip_day_id IS NOT NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'schedule_item' AND trip_day_id IS NOT NULL AND schedule_item_id IS NOT NULL)
  ),
  CONSTRAINT expenses_trip_day_fk FOREIGN KEY (trip_day_id, trip_id) REFERENCES trip_days(id, trip_id) ON DELETE RESTRICT,
  CONSTRAINT expenses_schedule_item_fk FOREIGN KEY (schedule_item_id, trip_day_id, trip_id) REFERENCES schedule_items(id, trip_day_id, trip_id) ON DELETE RESTRICT,
  CONSTRAINT expenses_title_length_check CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT expenses_place_name_length_check CHECK (char_length(place_name) BETWEEN 1 AND 120),
  CONSTRAINT expenses_place_address_length_check CHECK (char_length(place_address) BETWEEN 1 AND 240),
  CONSTRAINT expenses_place_type_check CHECK (place_type IS NULL OR place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc')),
  CONSTRAINT expenses_amount_minor_check CHECK (amount_minor > 0),
  CONSTRAINT expenses_currency_check CHECK (currency IN ('KRW', 'JPY', 'USD', 'EUR')),
  CONSTRAINT expenses_split_policy_check CHECK (split_policy IN ('equal', 'manual')),
  CONSTRAINT expenses_payer_display_name_length_check CHECK (char_length(payer_display_name) BETWEEN 1 AND 80),
  CONSTRAINT expenses_memo_length_check CHECK (memo IS NULL OR char_length(memo) <= 240)
);

CREATE INDEX expenses_trip_anchor_date_created_idx ON expenses (trip_id, anchor_type, expense_date DESC, created_at DESC);
CREATE INDEX expenses_trip_day_created_idx ON expenses (trip_id, trip_day_id, created_at DESC) WHERE trip_day_id IS NOT NULL;
CREATE INDEX expenses_trip_schedule_item_idx ON expenses (trip_id, schedule_item_id) WHERE schedule_item_id IS NOT NULL;
CREATE INDEX expenses_trip_place_idx ON expenses (trip_id, trip_place_id) WHERE trip_place_id IS NOT NULL;
CREATE INDEX expenses_payer_participant_idx ON expenses (payer_participant_id) WHERE payer_participant_id IS NOT NULL;

CREATE TABLE expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL,
  participant_display_name text NOT NULL,
  amount_minor bigint NOT NULL,
  split_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_splits_display_name_length_check CHECK (char_length(participant_display_name) BETWEEN 1 AND 80),
  CONSTRAINT expense_splits_amount_minor_check CHECK (amount_minor >= 0),
  CONSTRAINT expense_splits_order_check CHECK (split_order >= 1),
  CONSTRAINT expense_splits_expense_order_unique UNIQUE (expense_id, split_order)
);

CREATE INDEX expense_splits_participant_idx ON expense_splits (participant_id) WHERE participant_id IS NOT NULL;

CREATE TABLE expense_receipt_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  capture_mode text NOT NULL,
  objects_json jsonb NOT NULL,
  image_count integer NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  uploaded_at timestamptz NOT NULL,
  extraction_json jsonb NOT NULL,
  confidence text NOT NULL,
  warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft',
  expires_at timestamptz NOT NULL,
  used_expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_receipt_drafts_capture_mode_check CHECK (capture_mode IN ('single', 'split')),
  CONSTRAINT expense_receipt_drafts_content_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT expense_receipt_drafts_image_count_check CHECK (image_count BETWEEN 1 AND 2),
  CONSTRAINT expense_receipt_drafts_byte_size_check CHECK (byte_size BETWEEN 1 AND 20971520),
  CONSTRAINT expense_receipt_drafts_objects_array_check CHECK (jsonb_typeof(objects_json) = 'array' AND jsonb_array_length(objects_json) = image_count),
  CONSTRAINT expense_receipt_drafts_confidence_check CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT expense_receipt_drafts_status_check CHECK (status IN ('draft', 'used', 'cancelled', 'expired')),
  CONSTRAINT expense_receipt_drafts_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT expense_receipt_drafts_extraction_object_check CHECK (jsonb_typeof(extraction_json) = 'object'),
  CONSTRAINT expense_receipt_drafts_used_status_check CHECK ((status = 'used') = (used_expense_id IS NOT NULL))
);

CREATE INDEX expense_receipt_drafts_trip_user_status_idx
  ON expense_receipt_drafts (trip_id, created_by_user_id, status, expires_at, id);

CREATE INDEX expense_receipt_drafts_expired_idx
  ON expense_receipt_drafts (expires_at, id)
  WHERE status = 'draft';

CREATE TABLE expense_receipts (
  expense_id uuid PRIMARY KEY,
  trip_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  objects_json jsonb NOT NULL,
  image_count integer NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  uploaded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_receipts_expense_trip_fk FOREIGN KEY (expense_id, trip_id) REFERENCES expenses(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT expense_receipts_content_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT expense_receipts_image_count_check CHECK (image_count BETWEEN 1 AND 2),
  CONSTRAINT expense_receipts_byte_size_check CHECK (byte_size BETWEEN 1 AND 20971520),
  CONSTRAINT expense_receipts_objects_array_check CHECK (jsonb_typeof(objects_json) = 'array' AND jsonb_array_length(objects_json) = image_count)
);

CREATE INDEX expense_receipts_trip_expense_idx ON expense_receipts (trip_id, expense_id);
