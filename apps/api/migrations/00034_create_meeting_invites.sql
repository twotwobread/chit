-- +goose Up
CREATE TABLE meeting_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  deactivated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT meeting_invites_token_length_check CHECK (char_length(token) BETWEEN 32 AND 128),
  CONSTRAINT meeting_invites_expiry_after_create_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX meeting_invites_token_unique ON meeting_invites (token);
CREATE UNIQUE INDEX meeting_invites_one_current_per_meeting ON meeting_invites (meeting_id) WHERE deactivated_at IS NULL;
CREATE INDEX meeting_invites_meeting_id_idx ON meeting_invites (meeting_id);
CREATE INDEX meeting_invites_expires_at_idx ON meeting_invites (expires_at);

-- +goose Down
DROP TABLE meeting_invites;
