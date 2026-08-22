-- +goose Up
CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  visibility text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetings_name_length_check CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT meetings_visibility_check CHECK (visibility IN ('saved', 'one_off'))
);

CREATE INDEX meetings_created_by_idx ON meetings (created_by);
CREATE INDEX meetings_saved_created_idx ON meetings (created_at DESC, id DESC) WHERE visibility = 'saved';

CREATE TABLE meeting_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_members_role_check CHECK (role IN ('owner', 'member')),
  CONSTRAINT meeting_members_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT meeting_members_meeting_user_unique UNIQUE (meeting_id, user_id)
);

CREATE INDEX meeting_members_user_id_idx ON meeting_members (user_id);
CREATE INDEX meeting_members_meeting_id_idx ON meeting_members (meeting_id);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  default_currency text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  trip_id uuid NULL REFERENCES trips(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_event_type_check CHECK (event_type IN ('trip', 'outing')),
  CONSTRAINT events_title_length_check CHECK (char_length(title) BETWEEN 1 AND 80),
  CONSTRAINT events_date_range_check CHECK (start_date <= end_date),
  CONSTRAINT events_default_currency_check CHECK (default_currency IN ('KRW', 'JPY', 'USD', 'EUR')),
  CONSTRAINT events_status_check CHECK (status IN ('planned', 'completed', 'cancelled')),
  CONSTRAINT events_trip_id_unique UNIQUE (trip_id)
);

CREATE INDEX events_meeting_id_idx ON events (meeting_id);
CREATE INDEX events_created_by_idx ON events (created_by);
CREATE INDEX events_date_range_idx ON events (start_date, end_date, id);

CREATE TABLE event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  meeting_member_id uuid NULL REFERENCES meeting_members(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_participants_role_check CHECK (role IN ('owner', 'member')),
  CONSTRAINT event_participants_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT event_participants_event_user_unique UNIQUE (event_id, user_id)
);

CREATE INDEX event_participants_user_id_idx ON event_participants (user_id);
CREATE INDEX event_participants_event_id_idx ON event_participants (event_id);
CREATE INDEX event_participants_meeting_member_id_idx ON event_participants (meeting_member_id) WHERE meeting_member_id IS NOT NULL;

-- +goose Down
DROP TABLE event_participants;
DROP TABLE events;
DROP TABLE meeting_members;
DROP TABLE meetings;
