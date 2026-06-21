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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_email_normalized_idx
  ON users (email_normalized)
  WHERE email_normalized IS NOT NULL;

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
