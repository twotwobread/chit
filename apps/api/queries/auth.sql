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
WHERE id = $1::uuid;

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
JOIN users u ON u.id = i.user_id
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
JOIN users u ON u.id = i.user_id
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
  updated_at
FROM auth_sessions
WHERE refresh_token_hash = $1;

-- name: GetSessionByID :one
SELECT
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
  updated_at
FROM auth_sessions
WHERE id = $1::uuid;

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
