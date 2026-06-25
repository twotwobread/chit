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
  CONSTRAINT trip_participants_trip_user_unique UNIQUE (trip_id, user_id)
);

CREATE INDEX trip_participants_user_id_idx ON trip_participants (user_id);
CREATE INDEX trip_participants_trip_id_idx ON trip_participants (trip_id);

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
  CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc')),
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

CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  item_order integer NOT NULL,
  rank text COLLATE "C" NOT NULL,
  version integer NOT NULL DEFAULT 1,
  arrived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_items_item_order_check CHECK (item_order >= 1),
  CONSTRAINT itinerary_items_version_check CHECK (version >= 1),
  CONSTRAINT itinerary_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT itinerary_items_trip_date_order_unique UNIQUE (trip_id, scheduled_date, item_order),
  CONSTRAINT itinerary_items_trip_date_rank_unique UNIQUE (trip_id, scheduled_date, rank)
);

CREATE INDEX itinerary_items_trip_date_rank_idx ON itinerary_items (trip_id, scheduled_date, rank);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL,
  trip_place_id uuid REFERENCES trip_places(id) ON DELETE SET NULL,
  place_name text NOT NULL,
  place_address text NOT NULL,
  place_type text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  payer_participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL,
  payer_display_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_place_name_length_check CHECK (char_length(place_name) BETWEEN 1 AND 120),
  CONSTRAINT expenses_place_address_length_check CHECK (char_length(place_address) BETWEEN 1 AND 240),
  CONSTRAINT expenses_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc')),
  CONSTRAINT expenses_amount_minor_check CHECK (amount_minor > 0),
  CONSTRAINT expenses_currency_check CHECK (currency IN ('KRW', 'JPY', 'USD', 'EUR')),
  CONSTRAINT expenses_payer_display_name_length_check CHECK (char_length(payer_display_name) BETWEEN 1 AND 80)
);

CREATE INDEX expenses_trip_date_created_idx ON expenses (trip_id, scheduled_date, created_at DESC);
CREATE INDEX expenses_trip_itinerary_item_idx ON expenses (trip_id, itinerary_item_id) WHERE itinerary_item_id IS NOT NULL;
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
