-- name: GetMeetingCreator :one
SELECT
  id::text,
  display_name
FROM users
WHERE id = $1::uuid
  AND deleted_at IS NULL;

-- name: CreateMeeting :one
INSERT INTO meetings (
  name,
  visibility,
  created_by
) VALUES (
  sqlc.arg(name),
  sqlc.arg(visibility),
  sqlc.arg(created_by)::uuid
)
RETURNING
  id::text,
  name,
  visibility,
  created_by::text,
  created_at,
  updated_at;

-- name: CreateMeetingMember :one
INSERT INTO meeting_members (
  meeting_id,
  user_id,
  role,
  display_name
) VALUES (
  sqlc.arg(meeting_id)::uuid,
  sqlc.arg(user_id)::uuid,
  sqlc.arg(role),
  sqlc.arg(display_name)
)
RETURNING
  id::text,
  meeting_id::text,
  user_id::text,
  role,
  display_name,
  joined_at;

-- name: ListSavedMeetingsByMemberUser :many
SELECT
  m.id::text AS id,
  m.name,
  m.visibility,
  (
    SELECT count(*)::int
    FROM meeting_members members
    WHERE members.meeting_id = m.id
  ) AS member_count,
  mm.role AS my_role,
  m.created_at,
  m.updated_at
FROM meetings m
JOIN meeting_members mm ON mm.meeting_id = m.id
WHERE mm.user_id = $1::uuid
  AND m.visibility = 'saved'
ORDER BY m.created_at DESC, m.id DESC;

-- name: GetSavedMeetingForMember :one
SELECT
  m.id::text,
  m.name,
  m.visibility,
  m.created_by::text,
  m.created_at,
  m.updated_at
FROM meetings m
JOIN meeting_members mm ON mm.meeting_id = m.id
WHERE m.id = sqlc.arg(meeting_id)::uuid
  AND mm.user_id = sqlc.arg(user_id)::uuid
  AND m.visibility = 'saved';

-- name: GetMeetingMemberForUser :one
SELECT
  id::text,
  meeting_id::text,
  user_id::text,
  role,
  display_name,
  joined_at
FROM meeting_members
WHERE meeting_id = sqlc.arg(meeting_id)::uuid
  AND user_id = sqlc.arg(user_id)::uuid;

-- name: ListMeetingMembersForSavedMeetingByMemberUser :many
SELECT
  mm.id::text,
  mm.meeting_id::text,
  mm.user_id::text,
  mm.role,
  mm.display_name,
  mm.joined_at
FROM meetings m
JOIN meeting_members requester ON requester.meeting_id = m.id
JOIN meeting_members mm ON mm.meeting_id = m.id
WHERE m.id = sqlc.arg(meeting_id)::uuid
  AND requester.user_id = sqlc.arg(user_id)::uuid
  AND m.visibility = 'saved'
ORDER BY
  CASE WHEN mm.user_id = sqlc.arg(user_id)::uuid THEN 0 ELSE 1 END,
  mm.joined_at ASC,
  mm.id ASC;

-- name: GetMeetingMemberByMeetingAndUser :one
SELECT
  id::text,
  meeting_id::text,
  user_id::text,
  role,
  display_name,
  joined_at
FROM meeting_members
WHERE meeting_id = $1::uuid
  AND user_id = $2::uuid;

-- name: LockSavedMeetingForInviteByOwner :one
SELECT
  m.id::text,
  m.name
FROM meetings m
JOIN meeting_members mm ON mm.meeting_id = m.id
WHERE m.id = sqlc.arg(meeting_id)::uuid
  AND m.visibility = 'saved'
  AND mm.user_id = sqlc.arg(user_id)::uuid
  AND mm.role = 'owner'
FOR UPDATE OF m;

-- name: InviteTokenExists :one
SELECT (
  EXISTS (SELECT 1 FROM meeting_invites mi WHERE mi.token = sqlc.arg(invite_token))
  OR EXISTS (SELECT 1 FROM trip_invites ti WHERE ti.token = sqlc.arg(invite_token))
)::bool AS exists;

-- name: GetCurrentMeetingInviteForUpdate :one
SELECT
  id::text,
  meeting_id::text,
  token,
  expires_at,
  deactivated_at,
  created_at,
  created_by::text
FROM meeting_invites
WHERE meeting_id = sqlc.arg(meeting_id)::uuid
  AND deactivated_at IS NULL
FOR UPDATE;

-- name: DeactivateMeetingInvite :exec
UPDATE meeting_invites
SET deactivated_at = sqlc.arg(deactivated_at)
WHERE id = sqlc.arg(invite_id)::uuid;

-- name: CreateMeetingInvite :one
INSERT INTO meeting_invites (
  meeting_id,
  token,
  created_by,
  expires_at,
  created_at
) VALUES (
  sqlc.arg(meeting_id)::uuid,
  sqlc.arg(token),
  sqlc.arg(created_by)::uuid,
  sqlc.arg(expires_at),
  sqlc.arg(created_at)
)
RETURNING
  id::text,
  meeting_id::text,
  token,
  expires_at,
  deactivated_at,
  created_at,
  created_by::text;

-- name: GetMeetingInviteForAccept :one
SELECT
  mi.id::text,
  mi.meeting_id::text,
  m.name AS meeting_name,
  mi.expires_at,
  mi.deactivated_at
FROM meeting_invites mi
JOIN meetings m ON m.id = mi.meeting_id
WHERE mi.token = sqlc.arg(invite_token)
  AND m.visibility = 'saved'
FOR UPDATE OF mi;

-- name: DeleteMeetingMemberByID :one
DELETE FROM meeting_members
WHERE meeting_id = sqlc.arg(meeting_id)::uuid
  AND id = sqlc.arg(member_id)::uuid
RETURNING id::text;

-- name: CreateEvent :one
INSERT INTO events (
  meeting_id,
  event_type,
  title,
  start_date,
  end_date,
  default_currency,
  status,
  trip_id,
  created_by
) VALUES (
  sqlc.arg(meeting_id)::uuid,
  sqlc.arg(event_type),
  sqlc.arg(title),
  sqlc.arg(start_date),
  sqlc.arg(end_date),
  sqlc.arg(default_currency),
  sqlc.arg(status),
  sqlc.narg(trip_id)::uuid,
  sqlc.arg(created_by)::uuid
)
RETURNING
  id::text,
  meeting_id::text,
  event_type,
  title,
  start_date,
  end_date,
  default_currency,
  status,
  COALESCE(trip_id::text, ''::text)::text AS trip_id,
  created_by::text,
  created_at,
  updated_at;

-- name: CreateEventParticipant :one
INSERT INTO event_participants (
  event_id,
  meeting_member_id,
  user_id,
  role,
  display_name
) VALUES (
  sqlc.arg(event_id)::uuid,
  sqlc.narg(meeting_member_id)::uuid,
  sqlc.arg(user_id)::uuid,
  sqlc.arg(role),
  sqlc.arg(display_name)
)
RETURNING
  id::text,
  event_id::text,
  COALESCE(meeting_member_id::text, ''::text)::text AS meeting_member_id,
  user_id::text,
  role,
  display_name,
  joined_at;

-- name: UpsertEventParticipant :one
INSERT INTO event_participants (
  event_id,
  meeting_member_id,
  user_id,
  role,
  display_name
) VALUES (
  sqlc.arg(event_id)::uuid,
  sqlc.narg(meeting_member_id)::uuid,
  sqlc.arg(user_id)::uuid,
  sqlc.arg(role),
  sqlc.arg(display_name)
)
ON CONFLICT (event_id, user_id) DO UPDATE
SET meeting_member_id = EXCLUDED.meeting_member_id,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name
RETURNING
  id::text,
  event_id::text,
  COALESCE(meeting_member_id::text, ''::text)::text AS meeting_member_id,
  user_id::text,
  role,
  display_name,
  joined_at;

-- name: ListEventsForSavedMeetingByMemberUser :many
SELECT
  e.id::text AS id,
  e.meeting_id::text AS meeting_id,
  m.name AS meeting_name,
  m.visibility AS meeting_visibility,
  e.event_type,
  e.title,
  e.start_date,
  e.end_date,
  e.default_currency,
  e.status,
  COALESCE(e.trip_id::text, ''::text)::text AS trip_id,
  e.created_by::text AS created_by,
  e.created_at,
  e.updated_at
FROM meetings m
JOIN meeting_members requester ON requester.meeting_id = m.id
JOIN events e ON e.meeting_id = m.id
WHERE m.id = sqlc.arg(meeting_id)::uuid
  AND requester.user_id = sqlc.arg(user_id)::uuid
  AND m.visibility = 'saved'
ORDER BY
  e.start_date ASC,
  e.end_date ASC,
  e.created_at DESC,
  e.id DESC;

-- name: GetEventForParticipant :one
SELECT
  e.id::text AS id,
  e.meeting_id::text AS meeting_id,
  m.name AS meeting_name,
  m.visibility AS meeting_visibility,
  e.event_type,
  e.title,
  e.start_date,
  e.end_date,
  e.default_currency,
  e.status,
  COALESCE(e.trip_id::text, ''::text)::text AS trip_id,
  e.created_by::text AS created_by,
  e.created_at,
  e.updated_at,
  m.id::text AS result_meeting_id,
  m.name AS result_meeting_name,
  m.visibility AS result_meeting_visibility,
  m.created_by::text AS result_meeting_created_by,
  m.created_at AS result_meeting_created_at,
  m.updated_at AS result_meeting_updated_at
FROM events e
JOIN meetings m ON m.id = e.meeting_id
JOIN event_participants ep ON ep.event_id = e.id
WHERE e.id = sqlc.arg(event_id)::uuid
  AND ep.user_id = sqlc.arg(user_id)::uuid;
