-- +goose Up
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

-- +goose Down
DROP TABLE trip_invites;
