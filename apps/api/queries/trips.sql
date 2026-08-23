-- name: CreateTrip :one
INSERT INTO trips (
  name,
  start_date,
  end_date,
  default_currency,
  default_travel_mode,
  created_by
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6::uuid
)
RETURNING
  id::text,
  name,
  start_date,
  end_date,
  default_currency,
  default_travel_mode,
  created_by::text,
  created_at,
  updated_at;

-- name: CreateTripParticipant :one
INSERT INTO trip_participants (
  trip_id,
  user_id,
  role,
  display_name
) VALUES (
  $1::uuid,
  $2::uuid,
  $3,
  $4
)
RETURNING
  id::text,
  trip_id::text,
  user_id::text,
  role,
  display_name,
  joined_at;

-- name: CreateTripDestination :one
INSERT INTO trip_destinations (
  trip_id,
  city_name,
  country_name,
  country_code,
  display_name,
  latitude,
  longitude,
  radius_meters,
  provider,
  provider_place_id,
  sort_order
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(city_name),
  sqlc.arg(country_name),
  sqlc.arg(country_code),
  sqlc.arg(display_name),
  sqlc.arg(latitude),
  sqlc.arg(longitude),
  sqlc.arg(radius_meters),
  sqlc.arg(provider),
  sqlc.arg(provider_place_id),
  sqlc.arg(sort_order)
)
RETURNING
  id::text,
  trip_id::text,
  city_name,
  country_name,
  country_code,
  display_name,
  latitude,
  longitude,
  radius_meters,
  provider,
  provider_place_id,
  sort_order;

-- name: ListTripDestinationsByTrip :many
SELECT
  id::text,
  trip_id::text,
  city_name,
  country_name,
  country_code,
  display_name,
  latitude,
  longitude,
  radius_meters,
  provider,
  provider_place_id,
  sort_order
FROM trip_destinations
WHERE trip_id = $1::uuid
ORDER BY sort_order ASC;

-- name: GetTripByID :one
SELECT
  t.id::text,
  t.name,
  t.start_date,
  t.end_date,
  t.default_currency,
  t.default_travel_mode,
  t.created_by::text,
  t.created_at,
  t.updated_at,
  COALESCE(e.id::text, ''::text)::text AS event_id,
  COALESCE(m.id::text, ''::text)::text AS meeting_id,
  COALESCE(m.name, ''::text)::text AS meeting_name,
  COALESCE(m.visibility, ''::text)::text AS meeting_visibility
FROM trips t
LEFT JOIN events e ON e.trip_id = t.id
LEFT JOIN meetings m ON m.id = e.meeting_id
WHERE t.id = $1::uuid;

-- name: GetTripEventContextByTripID :one
SELECT
  e.id::text AS event_id,
  m.id::text AS meeting_id,
  m.name AS meeting_name,
  m.visibility AS meeting_visibility
FROM events e
JOIN meetings m ON m.id = e.meeting_id
WHERE e.trip_id = $1::uuid;

-- name: GetTripParticipantMembership :one
SELECT id::text
FROM trip_participants
WHERE trip_id = $1::uuid
  AND user_id = $2::uuid;

-- name: GetTripParticipantRole :one
SELECT role
FROM trip_participants
WHERE trip_id = $1::uuid
  AND user_id = $2::uuid;

-- name: CountTripParticipantsByTripID :one
SELECT count(*)::int AS total_count
FROM trip_participants
WHERE trip_id = $1::uuid;

-- name: ListTripParticipantPreviewByTripID :many
SELECT display_name
FROM trip_participants
WHERE trip_id = $1::uuid
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC
LIMIT 3;

-- name: GetTripParticipantSummaryByTripID :one
WITH ordered_participants AS (
  SELECT
    display_name,
    row_number() OVER (
      ORDER BY
        CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
        joined_at ASC,
        id ASC
    ) AS preview_order
  FROM trip_participants
  WHERE trip_id = sqlc.arg(trip_id)::uuid
)
SELECT
  count(*)::int AS total_count,
  COALESCE(
    array_agg(display_name ORDER BY preview_order) FILTER (WHERE preview_order <= 3),
    ARRAY[]::text[]
  )::text[] AS preview_names
FROM ordered_participants;

-- name: ListTripParticipantsByTripID :many
SELECT
  id::text,
  user_id::text,
  display_name,
  role,
  joined_at
FROM trip_participants
WHERE trip_id = $1::uuid
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC;

-- name: GetSavedMeetingTripParticipantContextForUpdate :one
SELECT
  t.id::text AS trip_id,
  e.id::text AS event_id,
  m.id::text AS meeting_id
FROM trips t
JOIN events e ON e.trip_id = t.id
JOIN meetings m ON m.id = e.meeting_id
WHERE t.id = sqlc.arg(trip_id)::uuid
  AND m.visibility = 'saved'
FOR UPDATE OF t, e, m;

-- name: PromoteOneOffTripMeeting :one
UPDATE meetings m
SET
  name = sqlc.arg(meeting_name),
  visibility = 'saved',
  updated_at = now()
FROM events e
WHERE e.meeting_id = m.id
  AND e.trip_id = sqlc.arg(trip_id)::uuid
  AND m.visibility = 'one_off'
RETURNING
  m.id::text,
  m.name,
  m.visibility,
  m.created_by::text,
  m.created_at,
  m.updated_at;

-- name: DeleteTripLinkedEventParticipantByTripParticipant :exec
WITH linked AS (
  SELECT
    ep.id AS event_participant_id,
    ep.meeting_member_id,
    m.visibility AS meeting_visibility
  FROM trip_participants tp
  JOIN events e ON e.trip_id = tp.trip_id
  JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = tp.user_id
  JOIN meetings m ON m.id = e.meeting_id
  WHERE tp.trip_id = sqlc.arg(trip_id)::uuid
    AND tp.id = sqlc.arg(participant_id)::uuid
    AND tp.role = 'member'
), deleted_event_participant AS (
  DELETE FROM event_participants
  WHERE id IN (SELECT event_participant_id FROM linked)
  RETURNING 1
)
DELETE FROM meeting_members
WHERE id IN (
  SELECT meeting_member_id
  FROM linked
  WHERE meeting_visibility = 'one_off'
)
  AND EXISTS (SELECT 1 FROM deleted_event_participant);

-- name: DeleteTripMemberParticipant :one
WITH target AS (
  SELECT
    id,
    user_id,
    display_name
  FROM trip_participants
  WHERE trip_id = sqlc.arg(trip_id)::uuid
    AND id = sqlc.arg(participant_id)::uuid
    AND role = 'member'
), refreshed_expense_payers AS (
  UPDATE expenses e
  SET payer_display_name = target.display_name,
      updated_at = now()
  FROM target
  WHERE e.trip_id = sqlc.arg(trip_id)::uuid
    AND e.payer_participant_id = target.id
  RETURNING e.id
), refreshed_expense_splits AS (
  UPDATE expense_splits es
  SET participant_display_name = target.display_name
  FROM target, expenses e
  WHERE e.id = es.expense_id
    AND e.trip_id = sqlc.arg(trip_id)::uuid
    AND es.participant_id = target.id
  RETURNING es.id
), deleted_participant AS (
  DELETE FROM trip_participants tp
  USING target
  WHERE tp.id = target.id
  RETURNING tp.id::text AS id,
            tp.user_id::text AS user_id
)
SELECT id, user_id
FROM deleted_participant;

-- name: ListTripsByParticipantUser :many
SELECT
  t.id::text AS id,
  tp.id::text AS participant_id,
  t.name,
  t.start_date,
  t.end_date,
  t.default_currency,
  t.default_travel_mode,
  tp.joined_at,
  t.created_at,
  tp.role AS my_role,
  (
    SELECT count(*)::int
    FROM trip_participants participants
    WHERE participants.trip_id = t.id
  ) AS participant_count,
  COALESCE(e.id::text, ''::text)::text AS event_id,
  COALESCE(m.id::text, ''::text)::text AS meeting_id,
  COALESCE(m.name, ''::text)::text AS meeting_name,
  COALESCE(m.visibility, ''::text)::text AS meeting_visibility
FROM trips t
JOIN trip_participants tp ON tp.trip_id = t.id
LEFT JOIN events e ON e.trip_id = t.id
LEFT JOIN meetings m ON m.id = e.meeting_id
WHERE tp.user_id = $1::uuid
ORDER BY tp.joined_at DESC, t.created_at DESC, t.id DESC;

-- name: UpdateTripBasicInfo :one
UPDATE trips
SET
  name = $2,
  start_date = $3,
  end_date = $4,
  default_currency = $5,
  default_travel_mode = $6,
  updated_at = now()
WHERE id = $1::uuid
RETURNING
  id::text,
  name,
  start_date,
  end_date,
  default_currency,
  default_travel_mode,
  created_by::text,
  created_at,
  updated_at;

-- name: UpdateTripEventFromTripBasicInfo :exec
WITH updated_event AS (
  UPDATE events
  SET
    title = sqlc.arg(name),
    start_date = sqlc.arg(start_date),
    end_date = sqlc.arg(end_date),
    default_currency = sqlc.arg(default_currency),
    updated_at = now()
  WHERE trip_id = sqlc.arg(trip_id)::uuid
  RETURNING meeting_id
)
UPDATE meetings m
SET
  name = sqlc.arg(name),
  updated_at = now()
FROM updated_event e
WHERE m.id = e.meeting_id
  AND m.visibility = 'one_off';

-- name: DeleteTripEventByTripID :exec
WITH linked AS (
  SELECT
    e.id AS event_id,
    m.id AS meeting_id,
    m.visibility AS meeting_visibility
  FROM events e
  JOIN meetings m ON m.id = e.meeting_id
  WHERE e.trip_id = sqlc.arg(trip_id)::uuid
), deleted_event AS (
  DELETE FROM events
  WHERE id IN (SELECT event_id FROM linked)
  RETURNING 1
)
DELETE FROM meetings
WHERE id IN (
  SELECT meeting_id
  FROM linked
  WHERE meeting_visibility = 'one_off'
)
  AND EXISTS (SELECT 1 FROM deleted_event);

-- name: DeleteTripByID :one
DELETE FROM trips
WHERE id = $1::uuid
RETURNING id::text;

-- name: LockTripForInvite :one
SELECT id::text
FROM trips
WHERE id = sqlc.arg(trip_id)::uuid
FOR UPDATE;

-- name: GetCurrentTripInviteForUpdate :one
SELECT
  id::text,
  trip_id::text,
  token,
  expires_at,
  deactivated_at,
  created_at,
  created_by::text
FROM trip_invites
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND deactivated_at IS NULL
FOR UPDATE;

-- name: DeactivateTripInvite :exec
UPDATE trip_invites
SET deactivated_at = sqlc.arg(deactivated_at)
WHERE id = sqlc.arg(invite_id)::uuid;

-- name: CreateTripInvite :one
INSERT INTO trip_invites (
  trip_id,
  token,
  created_by,
  expires_at,
  created_at
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(token),
  sqlc.arg(created_by)::uuid,
  sqlc.arg(expires_at),
  sqlc.arg(created_at)
)
RETURNING
  id::text,
  trip_id::text,
  token,
  expires_at,
  deactivated_at,
  created_at,
  created_by::text;

-- name: GetTripInviteForAccept :one
SELECT
  ti.id::text,
  ti.trip_id::text,
  t.name AS trip_name,
  ti.expires_at,
  ti.deactivated_at
FROM trip_invites ti
JOIN trips t ON t.id = ti.trip_id
WHERE ti.token = sqlc.arg(token)
FOR UPDATE OF ti;

-- name: ListActiveTripDaysByTrip :many
SELECT
  td.id::text AS id,
  td.date,
  td.day_order,
  COALESCE(tp.id::text, ''::text)::text AS lodging_trip_place_id,
  tp.name AS lodging_place_name,
  tp.place_type AS lodging_place_type,
  tp.address AS lodging_place_address,
  tp.provider AS lodging_place_provider,
  tp.google_place_id AS lodging_google_place_id,
  tp.latitude AS lodging_latitude,
  tp.longitude AS lodging_longitude
FROM trip_days td
LEFT JOIN trip_places tp
  ON tp.id = td.lodging_trip_place_id
 AND tp.trip_id = td.trip_id
WHERE td.trip_id = $1::uuid
  AND td.deleted_at IS NULL
ORDER BY td.day_order ASC, td.date ASC;

-- name: GetActiveTripDayByTripAndID :one
SELECT
  td.id::text AS id,
  td.date,
  td.day_order,
  COALESCE(tp.id::text, ''::text)::text AS lodging_trip_place_id,
  tp.name AS lodging_place_name,
  tp.place_type AS lodging_place_type,
  tp.address AS lodging_place_address,
  tp.provider AS lodging_place_provider,
  tp.google_place_id AS lodging_google_place_id,
  tp.latitude AS lodging_latitude,
  tp.longitude AS lodging_longitude
FROM trip_days td
LEFT JOIN trip_places tp
  ON tp.id = td.lodging_trip_place_id
 AND tp.trip_id = td.trip_id
WHERE td.trip_id = sqlc.arg(trip_id)::uuid
  AND td.id = sqlc.arg(trip_day_id)::uuid
  AND td.deleted_at IS NULL;

-- name: GetActiveTripDayByTripAndDate :one
SELECT
  td.id::text AS id,
  td.date,
  td.day_order,
  COALESCE(tp.id::text, ''::text)::text AS lodging_trip_place_id,
  tp.name AS lodging_place_name,
  tp.place_type AS lodging_place_type,
  tp.address AS lodging_place_address,
  tp.provider AS lodging_place_provider,
  tp.google_place_id AS lodging_google_place_id,
  tp.latitude AS lodging_latitude,
  tp.longitude AS lodging_longitude
FROM trip_days td
LEFT JOIN trip_places tp
  ON tp.id = td.lodging_trip_place_id
 AND tp.trip_id = td.trip_id
WHERE td.trip_id = sqlc.arg(trip_id)::uuid
  AND td.date = sqlc.arg(date)::date
  AND td.deleted_at IS NULL;

-- name: GetTripPlaceSummaryByTripAndPlace :one
SELECT
  id::text AS id,
  name,
  place_type,
  address,
  provider,
  google_place_id,
  latitude,
  longitude
FROM trip_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(trip_place_id)::uuid;

-- name: ListTripPlacesByTrip :many
SELECT
  id::text AS id,
  name,
  place_type,
  address,
  provider,
  google_place_id,
  latitude,
  longitude
FROM trip_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
ORDER BY created_at ASC, id ASC;

-- name: GetGoogleTripPlaceByGooglePlaceID :one
SELECT
  id::text AS id,
  name,
  place_type,
  address,
  provider,
  google_place_id,
  latitude,
  longitude
FROM trip_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND provider = 'google'
  AND google_place_id = sqlc.arg(google_place_id);

-- name: ListTripPlaceBookmarks :many
SELECT
  b.id::text AS id,
  b.trip_id::text AS trip_id,
  b.category,
  b.created_at,
  b.updated_at,
  tp.id::text AS place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM trip_place_bookmarks b
JOIN trip_places tp
  ON tp.trip_id = b.trip_id
 AND tp.id = b.trip_place_id
WHERE b.trip_id = sqlc.arg(trip_id)::uuid
ORDER BY b.created_at ASC, b.id ASC;

-- name: UpsertGoogleTripPlaceBookmark :one
WITH upserted_place AS (
  INSERT INTO trip_places (
    trip_id,
    name,
    address,
    place_type,
    provider,
    google_place_id,
    latitude,
    longitude,
    google_primary_type,
    google_types
  ) VALUES (
    sqlc.arg(trip_id)::uuid,
    sqlc.arg(name),
    sqlc.arg(address),
    sqlc.arg(place_type),
    'google',
    sqlc.arg(google_place_id),
    sqlc.arg(latitude),
    sqlc.arg(longitude),
    sqlc.arg(google_primary_type),
    sqlc.arg(google_types)::text[]
  )
  ON CONFLICT (trip_id, google_place_id) WHERE provider = 'google' DO UPDATE
  SET google_place_id = EXCLUDED.google_place_id
  RETURNING
    id,
    id::text AS place_id,
    name AS place_name,
    place_type,
    address,
    provider,
    google_place_id,
    latitude,
    longitude
), upserted_bookmark AS (
  INSERT INTO trip_place_bookmarks (
    trip_id,
    trip_place_id,
    category
  )
  SELECT
    sqlc.arg(trip_id)::uuid,
    id,
    sqlc.arg(category)
  FROM upserted_place
  ON CONFLICT (trip_id, trip_place_id) DO UPDATE
  SET category = EXCLUDED.category,
      updated_at = now()
  RETURNING
    id::text AS id,
    trip_id::text AS trip_id,
    category,
    created_at,
    updated_at,
    trip_place_id
)
SELECT
  b.id,
  b.trip_id,
  b.category,
  b.created_at,
  b.updated_at,
  p.place_id,
  p.place_name,
  p.place_type,
  p.address,
  p.provider,
  p.google_place_id,
  p.latitude,
  p.longitude
FROM upserted_bookmark b
JOIN upserted_place p
  ON p.id = b.trip_place_id;

-- name: DeleteTripPlaceBookmark :one
DELETE FROM trip_place_bookmarks
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(bookmark_id)::uuid
RETURNING id::text;

-- name: CreateTripPlace :one
INSERT INTO trip_places (
  trip_id,
  name,
  address,
  place_type
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(name),
  sqlc.arg(address),
  sqlc.arg(place_type)
)
RETURNING
  id::text,
  name,
  place_type,
  address,
  provider,
  google_place_id,
  latitude,
  longitude;

-- name: UpsertGoogleTripPlace :one
INSERT INTO trip_places (
  trip_id,
  name,
  address,
  place_type,
  provider,
  google_place_id,
  latitude,
  longitude,
  google_primary_type,
  google_types
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(name),
  sqlc.arg(address),
  sqlc.arg(place_type),
  'google',
  sqlc.arg(google_place_id),
  sqlc.arg(latitude),
  sqlc.arg(longitude),
  sqlc.arg(google_primary_type),
  sqlc.arg(google_types)::text[]
)
ON CONFLICT (trip_id, google_place_id) WHERE provider = 'google' DO UPDATE
SET google_place_id = EXCLUDED.google_place_id
RETURNING
  id::text,
  name,
  place_type,
  address,
  provider,
  google_place_id,
  latitude,
  longitude;

-- name: SetDayLodgingPlace :one
WITH updated AS (
  UPDATE trip_days
  SET lodging_trip_place_id = sqlc.arg(trip_place_id)::uuid,
      updated_at = now()
  WHERE trip_id = sqlc.arg(trip_id)::uuid
    AND id = sqlc.arg(trip_day_id)::uuid
    AND deleted_at IS NULL
  RETURNING trip_id, lodging_trip_place_id
)
SELECT
  tp.id::text AS id,
  tp.name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM updated
JOIN trip_places tp
  ON tp.id = updated.lodging_trip_place_id
 AND tp.trip_id = updated.trip_id;

-- name: DeleteDayLodgingPlace :exec
UPDATE trip_days
SET lodging_trip_place_id = NULL,
    updated_at = now()
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(trip_day_id)::uuid
  AND deleted_at IS NULL;

-- name: CountScheduleItemsByTripDayAndPlace :one
SELECT count(*)::int
FROM schedule_items
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND trip_place_id = sqlc.arg(trip_place_id)::uuid
  AND deleted_at IS NULL;

-- name: CreateScheduleItemAtEnd :one
INSERT INTO schedule_items (
  trip_id,
  trip_day_id,
  trip_place_id,
  place_title,
  place_memo,
  start_time,
  end_time,
  item_order,
  rank
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(trip_day_id)::uuid,
  sqlc.arg(trip_place_id)::uuid,
  sqlc.arg(place_title),
  sqlc.narg(place_memo),
  sqlc.narg(start_time)::time,
  sqlc.narg(end_time)::time,
  (
    SELECT COALESCE(MAX(item_order), 0) + 1
    FROM schedule_items
    WHERE trip_day_id = sqlc.arg(trip_day_id)::uuid
      AND deleted_at IS NULL
  ),
  lpad(
    (
      SELECT COALESCE(MAX(rank::bigint), 0) + 1024
      FROM schedule_items
      WHERE trip_day_id = sqlc.arg(trip_day_id)::uuid
        AND deleted_at IS NULL
    )::text,
    19,
    '0'
  )
)
RETURNING
  id::text,
  item_order,
  version,
  start_time,
  end_time,
  place_title,
  place_memo,
  arrived_at,
  skipped_at;

-- name: ListScheduleItemsByTripDay :many
SELECT
  si.id::text AS id,
  si.item_order,
  si.version,
  si.start_time,
  si.end_time,
  si.place_title,
  si.place_memo,
  si.arrived_at,
  si.skipped_at,
  COALESCE(td.lodging_trip_place_id = si.trip_place_id, false) AS is_lodging,
  COALESCE(tp.id::text, '')::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM schedule_items si
JOIN trip_days td
  ON td.id = si.trip_day_id
 AND td.trip_id = si.trip_id
 AND td.deleted_at IS NULL
LEFT JOIN trip_places tp
  ON tp.id = si.trip_place_id
 AND tp.trip_id = si.trip_id
WHERE si.trip_id = sqlc.arg(trip_id)::uuid
  AND si.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND si.deleted_at IS NULL
ORDER BY si.rank ASC, si.id ASC;

-- name: ListTripScheduleItemsByTrip :many
SELECT
  si.trip_day_id::text AS trip_day_id,
  si.id::text AS id,
  si.item_order,
  si.version,
  si.start_time,
  si.end_time,
  si.place_title,
  si.place_memo,
  si.arrived_at,
  si.skipped_at,
  COALESCE(td.lodging_trip_place_id = si.trip_place_id, false) AS is_lodging,
  COALESCE(tp.id::text, '')::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM schedule_items si
JOIN trip_days td
  ON td.id = si.trip_day_id
 AND td.trip_id = si.trip_id
 AND td.deleted_at IS NULL
LEFT JOIN trip_places tp
  ON tp.id = si.trip_place_id
 AND tp.trip_id = si.trip_id
WHERE si.trip_id = sqlc.arg(trip_id)::uuid
  AND si.deleted_at IS NULL
ORDER BY si.trip_day_id ASC, si.rank ASC, si.id ASC;

-- name: GetScheduleItemByTripDayAndID :one
SELECT
  si.id::text AS id,
  si.item_order,
  si.version,
  si.start_time,
  si.end_time,
  si.place_title,
  si.place_memo,
  si.arrived_at,
  si.skipped_at,
  COALESCE(td.lodging_trip_place_id = si.trip_place_id, false) AS is_lodging,
  COALESCE(tp.id::text, '')::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM schedule_items si
JOIN trip_days td
  ON td.id = si.trip_day_id
 AND td.trip_id = si.trip_id
 AND td.deleted_at IS NULL
LEFT JOIN trip_places tp
  ON tp.id = si.trip_place_id
 AND tp.trip_id = si.trip_id
WHERE si.trip_id = sqlc.arg(trip_id)::uuid
  AND si.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND si.id = sqlc.arg(schedule_item_id)::uuid
  AND si.deleted_at IS NULL;

-- name: UpdateTripPlaceSnapshotByScheduleItem :one
WITH target AS (
  SELECT
    si.id,
    si.item_order,
    si.version,
    si.start_time,
    si.end_time,
    si.place_title,
    si.place_memo,
    si.arrived_at,
    si.skipped_at,
    si.trip_place_id,
    si.trip_day_id,
    si.trip_id
  FROM schedule_items si
  JOIN trip_days td
    ON td.id = si.trip_day_id
   AND td.trip_id = si.trip_id
   AND td.deleted_at IS NULL
  WHERE si.trip_id = sqlc.arg(trip_id)::uuid
    AND si.trip_day_id = sqlc.arg(trip_day_id)::uuid
    AND si.id = sqlc.arg(schedule_item_id)::uuid
    AND si.deleted_at IS NULL
), updated_item AS (
  UPDATE schedule_items si
  SET
    start_time = sqlc.narg(start_time)::time,
    end_time = sqlc.narg(end_time)::time,
    place_memo = sqlc.narg(place_memo),
    updated_at = now()
  FROM target
  WHERE si.id = target.id
    AND si.trip_id = target.trip_id
  RETURNING
    si.id,
    si.item_order,
    si.version,
    si.start_time,
    si.end_time,
    si.place_title,
    si.place_memo,
    si.arrived_at,
    si.skipped_at,
    si.trip_place_id,
    si.trip_day_id,
    si.trip_id
), updated_place AS (
  UPDATE trip_places tp
  SET
    name = sqlc.arg(name),
    address = sqlc.arg(address),
    place_type = sqlc.arg(place_type),
    updated_at = now()
  FROM target
  WHERE tp.id = target.trip_place_id
    AND tp.trip_id = target.trip_id
  RETURNING
    tp.id::text AS id,
    tp.name,
    tp.place_type,
    tp.address,
    tp.provider,
    tp.google_place_id,
    tp.latitude,
    tp.longitude
)
SELECT
  updated_item.id::text AS id,
  updated_item.item_order,
  updated_item.version,
  updated_item.start_time,
  updated_item.end_time,
  updated_item.place_title,
  updated_item.place_memo,
  updated_item.arrived_at,
  updated_item.skipped_at,
  COALESCE(td.lodging_trip_place_id = updated_item.trip_place_id, false) AS is_lodging,
  updated_place.id AS trip_place_id,
  updated_place.name AS place_name,
  updated_place.place_type,
  updated_place.address,
  updated_place.provider,
  updated_place.google_place_id,
  updated_place.latitude,
  updated_place.longitude
FROM updated_item
JOIN updated_place ON true
JOIN trip_days td
  ON td.id = updated_item.trip_day_id
 AND td.trip_id = updated_item.trip_id;

-- name: SoftDeleteScheduleItemByTripDayAndID :one
WITH target AS (
  SELECT
    si.id,
    si.trip_id,
    si.trip_day_id,
    tp.id AS trip_place_id,
    tp.name AS place_name,
    tp.address AS place_address,
    tp.place_type
  FROM schedule_items si
  LEFT JOIN trip_places tp
    ON tp.id = si.trip_place_id
   AND tp.trip_id = si.trip_id
  WHERE si.trip_id = sqlc.arg(trip_id)::uuid
    AND si.trip_day_id = sqlc.arg(trip_day_id)::uuid
    AND si.id = sqlc.arg(schedule_item_id)::uuid
    AND si.deleted_at IS NULL
), refreshed_expenses AS (
  UPDATE expenses e
  SET trip_place_id = target.trip_place_id,
      place_name = target.place_name,
      place_address = target.place_address,
      place_type = target.place_type,
      updated_at = now()
  FROM target
  WHERE e.trip_id = target.trip_id
    AND e.trip_day_id = target.trip_day_id
    AND e.schedule_item_id = target.id
    AND e.anchor_type = 'schedule_item'
    AND target.trip_place_id IS NOT NULL
  RETURNING e.id
), deleted_item AS (
  UPDATE schedule_items si
  SET deleted_at = now(),
      updated_at = now()
  FROM target
  WHERE si.trip_id = target.trip_id
    AND si.trip_day_id = target.trip_day_id
    AND si.id = target.id
  RETURNING COALESCE(target.trip_place_id::text, '') AS trip_place_id
)
SELECT trip_place_id
FROM deleted_item;

-- name: CountScheduleItemsByTripPlaceID :one
SELECT count(*)::int AS total_count
FROM schedule_items
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_place_id = sqlc.arg(trip_place_id)::uuid
  AND deleted_at IS NULL;

-- name: CountTripDaysByLodgingPlaceID :one
SELECT count(*)::int AS total_count
FROM trip_days
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND lodging_trip_place_id = sqlc.arg(trip_place_id)::uuid
  AND deleted_at IS NULL;

-- name: DeleteTripPlaceByID :exec
DELETE FROM trip_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(trip_place_id)::uuid;
