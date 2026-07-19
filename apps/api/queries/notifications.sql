-- name: DeactivateActivePushTokenDuplicates :exec
UPDATE user_push_tokens
SET
  status = 'revoked',
  revoked_at = now(),
  updated_at = now()
WHERE expo_push_token = sqlc.arg(expo_push_token)
  AND status = 'active'
  AND NOT (user_id = sqlc.arg(user_id)::uuid AND installation_id = sqlc.arg(installation_id));

-- name: UpsertPushToken :one
INSERT INTO user_push_tokens (
  user_id,
  installation_id,
  expo_push_token,
  platform,
  status,
  last_registered_at,
  revoked_at,
  invalidated_at,
  updated_at
) VALUES (
  sqlc.arg(user_id)::uuid,
  sqlc.arg(installation_id),
  sqlc.arg(expo_push_token),
  sqlc.arg(platform),
  'active',
  now(),
  NULL,
  NULL,
  now()
)
ON CONFLICT (user_id, installation_id) DO UPDATE
SET
  expo_push_token = EXCLUDED.expo_push_token,
  platform = EXCLUDED.platform,
  status = 'active',
  last_registered_at = now(),
  revoked_at = NULL,
  invalidated_at = NULL,
  updated_at = now()
RETURNING
  id::text,
  user_id::text,
  installation_id,
  expo_push_token,
  platform,
  status,
  last_registered_at;

-- name: RevokePushToken :exec
UPDATE user_push_tokens
SET
  status = 'revoked',
  revoked_at = COALESCE(revoked_at, now()),
  updated_at = now()
WHERE user_id = sqlc.arg(user_id)::uuid
  AND installation_id = sqlc.arg(installation_id)
  AND status = 'active';

-- name: MarkPushTokenInvalid :exec
UPDATE user_push_tokens
SET
  status = 'invalid',
  invalidated_at = COALESCE(invalidated_at, now()),
  updated_at = now()
WHERE id = sqlc.arg(push_token_id)::uuid;

-- name: CreateNotificationEvent :one
INSERT INTO notification_events (
  event_type,
  trip_id,
  actor_user_id,
  entity_type,
  entity_id,
  idempotency_key,
  payload_json
) VALUES (
  sqlc.arg(event_type),
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(actor_user_id)::uuid,
  sqlc.arg(entity_type),
  sqlc.arg(entity_id)::uuid,
  sqlc.arg(idempotency_key),
  sqlc.arg(payload_json)::jsonb
)
RETURNING
  id::text,
  created_at;

-- name: CreateUserNotification :one
INSERT INTO user_notifications (
  event_id,
  user_id,
  trip_id,
  recipient_reason,
  title,
  body,
  action_path,
  snapshot_json
) VALUES (
  sqlc.arg(event_id)::uuid,
  sqlc.arg(user_id)::uuid,
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(recipient_reason),
  sqlc.arg(title),
  sqlc.arg(body),
  sqlc.arg(action_path),
  sqlc.arg(snapshot_json)::jsonb
)
RETURNING
  id::text,
  user_id::text,
  created_at;

-- name: ListActivePushTokensForUsers :many
SELECT
  id::text,
  user_id::text,
  installation_id,
  expo_push_token,
  platform
FROM user_push_tokens
WHERE user_id = ANY(sqlc.arg(user_ids)::uuid[])
  AND status = 'active'
ORDER BY user_id ASC, updated_at DESC, id ASC;

-- name: CreateNotificationPushOutbox :one
INSERT INTO notification_push_outbox (
  notification_id,
  push_token_id,
  user_id,
  provider,
  expo_push_token_snapshot,
  title,
  body,
  data_json
) VALUES (
  sqlc.arg(notification_id)::uuid,
  sqlc.arg(push_token_id)::uuid,
  sqlc.arg(user_id)::uuid,
  'expo',
  sqlc.arg(expo_push_token_snapshot),
  sqlc.arg(title),
  sqlc.arg(body),
  sqlc.arg(data_json)::jsonb
)
RETURNING id::text;

-- name: ListUserNotifications :many
SELECT
  un.id::text,
  un.event_id::text,
  ne.event_type,
  un.user_id::text,
  un.trip_id::text,
  un.title,
  un.body,
  un.action_path,
  un.snapshot_json,
  un.read_at,
  un.created_at
FROM user_notifications un
JOIN notification_events ne ON ne.id = un.event_id
WHERE un.user_id = sqlc.arg(user_id)::uuid
  AND (
    sqlc.narg(cursor_created_at)::timestamptz IS NULL
    OR (un.created_at, un.id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::uuid)
  )
ORDER BY un.created_at DESC, un.id DESC
LIMIT sqlc.arg(limit_count);

-- name: MarkUserNotificationRead :one
UPDATE user_notifications
SET read_at = COALESCE(read_at, now())
WHERE id = sqlc.arg(notification_id)::uuid
  AND user_id = sqlc.arg(user_id)::uuid
RETURNING
  user_notifications.id::text,
  user_notifications.event_id::text,
  (SELECT ne.event_type FROM notification_events ne WHERE ne.id = user_notifications.event_id) AS event_type,
  user_notifications.user_id::text,
  user_notifications.trip_id::text,
  user_notifications.title,
  user_notifications.body,
  user_notifications.action_path,
  user_notifications.snapshot_json,
  user_notifications.read_at,
  user_notifications.created_at;

-- name: RecoverStaleNotificationPushOutbox :exec
UPDATE notification_push_outbox
SET
  status = 'failed',
  next_attempt_at = now(),
  last_error = COALESCE(last_error, 'worker claim timed out'),
  updated_at = now()
WHERE status = 'running'
  AND claimed_at IS NOT NULL
  AND claimed_at <= sqlc.arg(stale_before)::timestamptz;

-- name: ClaimNotificationPushOutbox :many
WITH selected AS (
  SELECT id
  FROM notification_push_outbox
  WHERE status IN ('pending', 'failed')
    AND next_attempt_at <= now()
  ORDER BY next_attempt_at ASC, id ASC
  LIMIT sqlc.arg(limit_count)
  FOR UPDATE SKIP LOCKED
)
UPDATE notification_push_outbox npo
SET
  status = 'running',
  attempts = attempts + 1,
  claimed_at = now(),
  updated_at = now()
FROM selected
WHERE npo.id = selected.id
RETURNING
  npo.id::text,
  COALESCE(npo.push_token_id::text, '')::text AS push_token_id,
  npo.user_id::text,
  npo.expo_push_token_snapshot,
  npo.title,
  npo.body,
  npo.data_json,
  npo.attempts;

-- name: MarkNotificationPushOutboxSucceeded :exec
UPDATE notification_push_outbox
SET
  status = 'succeeded',
  provider_message_id = sqlc.narg(provider_message_id),
  processed_at = now(),
  claimed_at = NULL,
  updated_at = now()
WHERE id = sqlc.arg(outbox_id)::uuid;

-- name: MarkNotificationPushOutboxFailed :exec
UPDATE notification_push_outbox
SET
  status = 'failed',
  next_attempt_at = now() + (interval '1 minute' * LEAST(60, attempts * attempts)),
  last_error = sqlc.arg(last_error),
  claimed_at = NULL,
  updated_at = now()
WHERE id = sqlc.arg(outbox_id)::uuid;

-- name: MarkNotificationPushOutboxDead :exec
UPDATE notification_push_outbox
SET
  status = 'dead',
  last_error = sqlc.arg(last_error),
  processed_at = now(),
  claimed_at = NULL,
  updated_at = now()
WHERE id = sqlc.arg(outbox_id)::uuid;

-- name: MarkNotificationPushOutboxSkipped :exec
UPDATE notification_push_outbox
SET
  status = 'skipped',
  last_error = sqlc.arg(last_error),
  processed_at = now(),
  claimed_at = NULL,
  updated_at = now()
WHERE id = sqlc.arg(outbox_id)::uuid;
