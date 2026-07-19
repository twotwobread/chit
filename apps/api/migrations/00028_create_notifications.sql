-- +goose Up
CREATE TABLE notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_event_type_check CHECK (event_type IN ('expense.created')),
  CONSTRAINT notification_events_entity_type_check CHECK (entity_type IN ('expense')),
  CONSTRAINT notification_events_idempotency_key_length_check CHECK (char_length(btrim(idempotency_key)) BETWEEN 1 AND 160),
  CONSTRAINT notification_events_payload_object_check CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX notification_events_trip_created_idx ON notification_events (trip_id, created_at DESC, id DESC);
CREATE INDEX notification_events_entity_idx ON notification_events (entity_type, entity_id);

CREATE TABLE user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  recipient_reason text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_path text NOT NULL,
  snapshot_json jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_event_user_unique UNIQUE (event_id, user_id),
  CONSTRAINT user_notifications_recipient_reason_check CHECK (recipient_reason IN ('creator', 'payer', 'split_participant', 'payer_split_participant')),
  CONSTRAINT user_notifications_title_length_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT user_notifications_body_length_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),
  CONSTRAINT user_notifications_action_path_length_check CHECK (char_length(btrim(action_path)) BETWEEN 1 AND 500),
  CONSTRAINT user_notifications_snapshot_object_check CHECK (jsonb_typeof(snapshot_json) = 'object')
);

CREATE INDEX user_notifications_user_created_idx ON user_notifications (user_id, created_at DESC, id DESC);
CREATE INDEX user_notifications_trip_idx ON user_notifications (trip_id, created_at DESC, id DESC);

CREATE TABLE user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  expo_push_token text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_registered_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_push_tokens_user_installation_unique UNIQUE (user_id, installation_id),
  CONSTRAINT user_push_tokens_installation_length_check CHECK (char_length(btrim(installation_id)) BETWEEN 8 AND 120),
  CONSTRAINT user_push_tokens_expo_token_length_check CHECK (char_length(btrim(expo_push_token)) BETWEEN 20 AND 255),
  CONSTRAINT user_push_tokens_platform_check CHECK (platform IN ('ios', 'android')),
  CONSTRAINT user_push_tokens_status_check CHECK (status IN ('active', 'revoked', 'invalid'))
);

CREATE UNIQUE INDEX user_push_tokens_active_token_unique ON user_push_tokens (expo_push_token) WHERE status = 'active';
CREATE INDEX user_push_tokens_user_status_idx ON user_push_tokens (user_id, status, updated_at DESC);

CREATE TABLE notification_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  push_token_id uuid REFERENCES user_push_tokens(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  expo_push_token_snapshot text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  last_error text,
  provider_message_id text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_push_outbox_notification_token_unique UNIQUE (notification_id, push_token_id),
  CONSTRAINT notification_push_outbox_provider_check CHECK (provider IN ('expo')),
  CONSTRAINT notification_push_outbox_token_length_check CHECK (char_length(btrim(expo_push_token_snapshot)) BETWEEN 20 AND 255),
  CONSTRAINT notification_push_outbox_title_length_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT notification_push_outbox_body_length_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),
  CONSTRAINT notification_push_outbox_data_object_check CHECK (jsonb_typeof(data_json) = 'object'),
  CONSTRAINT notification_push_outbox_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead', 'skipped')),
  CONSTRAINT notification_push_outbox_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX notification_push_outbox_due_idx
  ON notification_push_outbox (status, next_attempt_at, id)
  WHERE status IN ('pending', 'failed');

CREATE INDEX notification_push_outbox_running_idx
  ON notification_push_outbox (status, claimed_at, id)
  WHERE status = 'running';

-- +goose Down
DROP TABLE IF EXISTS notification_push_outbox;
DROP TABLE IF EXISTS user_push_tokens;
DROP TABLE IF EXISTS user_notifications;
DROP TABLE IF EXISTS notification_events;
