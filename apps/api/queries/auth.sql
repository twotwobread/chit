-- name: CreateUser :one
INSERT INTO users (
  display_name,
  email,
  email_normalized,
  email_verified,
  avatar_url
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5
)
RETURNING
  id::text,
  display_name,
  email,
  email_normalized,
  email_verified,
  avatar_url,
  created_at,
  updated_at;

-- name: GetUserByID :one
SELECT
  id::text,
  display_name,
  email,
  email_normalized,
  email_verified,
  avatar_url,
  created_at,
  updated_at
FROM users
WHERE id = $1::uuid
  AND deleted_at IS NULL;

-- name: UpdateUserDisplayName :one
UPDATE users
SET
  display_name = $2,
  updated_at = now()
WHERE id = $1::uuid
  AND deleted_at IS NULL
RETURNING
  id::text,
  display_name,
  email,
  email_normalized,
  email_verified,
  avatar_url,
  created_at,
  updated_at;

-- name: FindIdentityByProviderSubject :one
SELECT
  u.id::text AS user_id,
  u.display_name,
  u.email,
  u.email_normalized,
  u.email_verified,
  u.avatar_url,
  i.provider,
  i.provider_subject
FROM auth_identities i
JOIN users u ON u.id = i.user_id AND u.deleted_at IS NULL
WHERE i.provider = $1 AND i.provider_subject = $2;

-- name: FindUserByVerifiedIdentityEmail :one
SELECT DISTINCT
  u.id::text,
  u.display_name,
  u.email,
  u.email_normalized,
  u.email_verified,
  u.avatar_url,
  u.created_at,
  u.updated_at
FROM auth_identities i
JOIN users u ON u.id = i.user_id AND u.deleted_at IS NULL
WHERE i.email_verified = true
  AND i.email_normalized = $1
LIMIT 1;

-- name: CreateIdentity :one
INSERT INTO auth_identities (
  user_id,
  provider,
  provider_subject,
  email,
  email_normalized,
  email_verified,
  display_name,
  avatar_url
) VALUES (
  $1::uuid,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8
)
RETURNING
  id::text,
  user_id::text,
  provider,
  provider_subject,
  email,
  email_normalized,
  email_verified,
  display_name,
  avatar_url,
  created_at,
  updated_at;

-- name: ListProvidersByUserID :many
SELECT provider
FROM auth_identities
WHERE user_id = $1::uuid
ORDER BY provider;

-- name: CreateSession :one
INSERT INTO auth_sessions (
  user_id,
  refresh_token_hash,
  refresh_token_expires_at,
  last_used_at,
  device_name,
  platform,
  user_agent
) VALUES (
  $1::uuid,
  $2,
  $3,
  now(),
  $4,
  $5,
  $6
)
RETURNING
  id::text,
  user_id::text,
  refresh_token_hash,
  refresh_token_expires_at,
  revoked_at,
  last_used_at,
  rotated_at,
  device_name,
  platform,
  user_agent,
  created_at,
  updated_at;

-- name: FindSessionByRefreshTokenHash :one
SELECT
  s.id::text AS id,
  s.user_id::text AS user_id,
  s.refresh_token_hash,
  s.refresh_token_expires_at,
  s.revoked_at,
  s.last_used_at,
  s.rotated_at,
  s.device_name,
  s.platform,
  s.user_agent,
  s.created_at,
  s.updated_at
FROM auth_sessions s
JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
WHERE s.refresh_token_hash = $1;

-- name: GetSessionByID :one
SELECT
  s.id::text AS id,
  s.user_id::text AS user_id,
  s.refresh_token_hash,
  s.refresh_token_expires_at,
  s.revoked_at,
  s.last_used_at,
  s.rotated_at,
  s.device_name,
  s.platform,
  s.user_agent,
  s.created_at,
  s.updated_at
FROM auth_sessions s
JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
WHERE s.id = $1::uuid;

-- name: RotateSessionRefreshToken :one
UPDATE auth_sessions
SET
  refresh_token_hash = $2,
  refresh_token_expires_at = $3,
  last_used_at = now(),
  rotated_at = now(),
  updated_at = now()
WHERE id = $1::uuid
  AND revoked_at IS NULL
RETURNING
  id::text,
  user_id::text,
  refresh_token_hash,
  refresh_token_expires_at,
  revoked_at,
  last_used_at,
  rotated_at,
  device_name,
  platform,
  user_agent,
  created_at,
  updated_at;

-- name: RevokeSession :exec
UPDATE auth_sessions
SET
  revoked_at = COALESCE(revoked_at, now()),
  updated_at = now()
WHERE id = $1::uuid;

-- name: GetActiveUserForUpdate :one
SELECT id::text
FROM users
WHERE id = $1::uuid
  AND deleted_at IS NULL
FOR UPDATE;

-- name: TransferOwnedSharedTripsForAccountDeletion :exec
WITH retained_owned_trips AS (
  SELECT t.id AS trip_id
  FROM trips t
  JOIN trip_participants deleting_participant
    ON deleting_participant.trip_id = t.id
   AND deleting_participant.user_id = $1::uuid
   AND deleting_participant.role = 'owner'
  WHERE EXISTS (
    SELECT 1
    FROM trip_participants other_participant
    JOIN users other_user
      ON other_user.id = other_participant.user_id
     AND other_user.deleted_at IS NULL
    WHERE other_participant.trip_id = t.id
      AND other_participant.user_id <> $1::uuid
  )
), successor_participants AS (
  SELECT DISTINCT ON (participant.trip_id)
    participant.trip_id,
    participant.user_id
  FROM trip_participants participant
  JOIN retained_owned_trips retained
    ON retained.trip_id = participant.trip_id
  JOIN users successor_user
    ON successor_user.id = participant.user_id
   AND successor_user.deleted_at IS NULL
  WHERE participant.user_id <> $1::uuid
  ORDER BY participant.trip_id, participant.joined_at ASC, participant.id ASC
), updated_participants AS (
  UPDATE trip_participants participant
  SET role = 'owner'
  FROM successor_participants successor
  WHERE participant.trip_id = successor.trip_id
    AND participant.user_id = successor.user_id
  RETURNING participant.trip_id, participant.user_id
)
UPDATE trips trip
SET
  created_by = updated_participant.user_id,
  updated_at = $2
FROM updated_participants updated_participant
WHERE trip.id = updated_participant.trip_id;

-- name: AnonymizeTripParticipantsByUserID :exec
UPDATE trip_participants participant
SET
  display_name = '탈퇴한 사용자',
  role = CASE WHEN participant.role = 'owner' THEN 'member' ELSE participant.role END
WHERE participant.user_id = $1::uuid
  AND EXISTS (
    SELECT 1
    FROM trip_participants other_participant
    JOIN users other_user
      ON other_user.id = other_participant.user_id
     AND other_user.deleted_at IS NULL
    WHERE other_participant.trip_id = participant.trip_id
      AND other_participant.user_id <> $1::uuid
  );

-- name: DeactivateActiveInvitesCreatedByUserID :exec
UPDATE trip_invites invite
SET deactivated_at = $2
WHERE invite.created_by = $1::uuid
  AND invite.deactivated_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM trip_participants deleting_participant
    WHERE deleting_participant.trip_id = invite.trip_id
      AND deleting_participant.user_id = $1::uuid
  )
  AND EXISTS (
    SELECT 1
    FROM trip_participants other_participant
    JOIN users other_user
      ON other_user.id = other_participant.user_id
     AND other_user.deleted_at IS NULL
    WHERE other_participant.trip_id = invite.trip_id
      AND other_participant.user_id <> $1::uuid
  );

-- name: DeleteSoloTripsByUserID :exec
DELETE FROM trips trip
WHERE trip.id IN (
  SELECT deleting_participant.trip_id
  FROM trip_participants deleting_participant
  WHERE deleting_participant.user_id = $1::uuid
    AND NOT EXISTS (
      SELECT 1
      FROM trip_participants other_participant
      JOIN users other_user
        ON other_user.id = other_participant.user_id
       AND other_user.deleted_at IS NULL
      WHERE other_participant.trip_id = deleting_participant.trip_id
        AND other_participant.user_id <> $1::uuid
    )
);

-- name: DeleteAuthIdentitiesByUserID :exec
DELETE FROM auth_identities
WHERE user_id = $1::uuid;

-- name: DeleteAuthSessionsByUserID :exec
DELETE FROM auth_sessions
WHERE user_id = $1::uuid;

-- name: MarkUserDeleted :exec
UPDATE users
SET
  display_name = '탈퇴한 사용자',
  email = NULL,
  email_normalized = NULL,
  email_verified = false,
  avatar_url = NULL,
  deleted_at = $2,
  updated_at = $2
WHERE id = $1::uuid
  AND deleted_at IS NULL;
