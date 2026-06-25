-- name: CreateTrip :one
INSERT INTO trips (
  name,
  start_date,
  end_date,
  default_currency,
  created_by
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5::uuid
)
RETURNING
  id::text,
  name,
  start_date,
  end_date,
  default_currency,
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

-- name: GetTripByID :one
SELECT
  id::text,
  name,
  start_date,
  end_date,
  default_currency,
  created_by::text,
  created_at,
  updated_at
FROM trips
WHERE id = $1::uuid;

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

-- name: ListTripParticipantsByTripID :many
SELECT
  id::text,
  display_name,
  role,
  joined_at
FROM trip_participants
WHERE trip_id = $1::uuid
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC;

-- name: DeleteTripMemberParticipant :one
DELETE FROM trip_participants
WHERE trip_id = $1::uuid
  AND id = $2::uuid
  AND role = 'member'
RETURNING
  id::text,
  user_id::text;

-- name: ListTripsByParticipantUser :many
SELECT
  t.id::text AS id,
  t.name,
  t.start_date,
  t.end_date,
  t.default_currency,
  tp.joined_at,
  t.created_at,
  tp.role AS my_role,
  (
    SELECT count(*)::int
    FROM trip_participants participants
    WHERE participants.trip_id = t.id
  ) AS participant_count
FROM trips t
JOIN trip_participants tp ON tp.trip_id = t.id
WHERE tp.user_id = $1::uuid
ORDER BY tp.joined_at DESC, t.created_at DESC, t.id DESC;

-- name: UpdateTripBasicInfo :one
UPDATE trips
SET
  name = $2,
  start_date = $3,
  end_date = $4,
  default_currency = $5,
  updated_at = now()
WHERE id = $1::uuid
RETURNING
  id::text,
  name,
  start_date,
  end_date,
  default_currency,
  created_by::text,
  created_at,
  updated_at;

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

-- name: ListItineraryItemsByTripAndDate :many
SELECT
  ii.id::text AS id,
  ii.version,
  ii.arrived_at,
  ii.skipped_at,
  (dlp.trip_place_id IS NOT NULL) AS is_lodging,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
LEFT JOIN day_lodging_places dlp
  ON dlp.trip_id = ii.trip_id
 AND dlp.lodging_date = ii.scheduled_date
 AND dlp.trip_place_id = ii.trip_place_id
WHERE ii.trip_id = $1::uuid
  AND ii.scheduled_date = $2
ORDER BY ii.rank ASC, ii.id ASC;

-- name: ListDayLodgingPlacesByTrip :many
SELECT
  dlp.lodging_date,
  tp.id::text AS id,
  tp.name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM day_lodging_places dlp
JOIN trip_places tp
  ON tp.id = dlp.trip_place_id
 AND tp.trip_id = dlp.trip_id
WHERE dlp.trip_id = $1::uuid
ORDER BY dlp.lodging_date ASC;

-- name: GetDayLodgingPlaceByTripAndDate :one
SELECT
  tp.id::text AS id,
  tp.name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM day_lodging_places dlp
JOIN trip_places tp
  ON tp.id = dlp.trip_place_id
 AND tp.trip_id = dlp.trip_id
WHERE dlp.trip_id = sqlc.arg(trip_id)::uuid
  AND dlp.lodging_date = sqlc.arg(lodging_date);

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

-- name: SetDayLodgingPlace :one
WITH upserted AS (
  INSERT INTO day_lodging_places (trip_id, lodging_date, trip_place_id)
  VALUES (sqlc.arg(trip_id)::uuid, sqlc.arg(lodging_date), sqlc.arg(trip_place_id)::uuid)
  ON CONFLICT (trip_id, lodging_date) DO UPDATE
  SET
    trip_place_id = EXCLUDED.trip_place_id,
    updated_at = now()
  RETURNING trip_id, trip_place_id
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
FROM upserted
JOIN trip_places tp
  ON tp.id = upserted.trip_place_id
 AND tp.trip_id = upserted.trip_id;

-- name: DeleteDayLodgingPlace :exec
DELETE FROM day_lodging_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND lodging_date = sqlc.arg(lodging_date);

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

-- name: CountItineraryItemsByTripDateAndPlace :one
SELECT count(*)::int
FROM itinerary_items
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND scheduled_date = sqlc.arg(scheduled_date)
  AND trip_place_id = sqlc.arg(trip_place_id)::uuid;

-- name: CreateItineraryItemAtEnd :one
INSERT INTO itinerary_items (
  trip_id,
  scheduled_date,
  trip_place_id,
  item_order,
  rank
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(scheduled_date),
  sqlc.arg(trip_place_id)::uuid,
  (
    SELECT COALESCE(MAX(item_order), 0) + 1
    FROM itinerary_items
    WHERE trip_id = sqlc.arg(trip_id)::uuid
      AND scheduled_date = sqlc.arg(scheduled_date)
  ),
  lpad(
    (
      SELECT COALESCE(MAX(rank::bigint), 0) + 1024
      FROM itinerary_items
      WHERE trip_id = sqlc.arg(trip_id)::uuid
        AND scheduled_date = sqlc.arg(scheduled_date)
    )::text,
    19,
    '0'
  )
)
RETURNING
  id::text,
  item_order,
  version,
  arrived_at,
  skipped_at;

-- name: GetItineraryItemByTripDateAndID :one
SELECT
  ii.id::text AS id,
  ii.item_order,
  ii.version,
  ii.arrived_at,
  ii.skipped_at,
  (dlp.trip_place_id IS NOT NULL) AS is_lodging,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address,
  tp.provider,
  tp.google_place_id,
  tp.latitude,
  tp.longitude
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
LEFT JOIN day_lodging_places dlp
  ON dlp.trip_id = ii.trip_id
 AND dlp.lodging_date = ii.scheduled_date
 AND dlp.trip_place_id = ii.trip_place_id
WHERE ii.trip_id = sqlc.arg(trip_id)::uuid
  AND ii.scheduled_date = sqlc.arg(scheduled_date)
  AND ii.id = sqlc.arg(item_id)::uuid;

-- name: UpdateTripPlaceSnapshotByItineraryItem :one
WITH target AS (
  SELECT
    ii.id,
    ii.item_order,
    ii.version,
    ii.arrived_at,
    ii.skipped_at,
    ii.trip_place_id
  FROM itinerary_items ii
  WHERE ii.trip_id = sqlc.arg(trip_id)::uuid
    AND ii.scheduled_date = sqlc.arg(scheduled_date)
    AND ii.id = sqlc.arg(item_id)::uuid
), updated_place AS (
  UPDATE trip_places tp
  SET
    name = sqlc.arg(name),
    address = sqlc.arg(address),
    place_type = sqlc.arg(place_type),
    updated_at = now()
  FROM target
  WHERE tp.id = target.trip_place_id
    AND tp.trip_id = sqlc.arg(trip_id)::uuid
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
  target.id::text AS id,
  target.item_order,
  target.version,
  target.arrived_at,
  target.skipped_at,
  (dlp.trip_place_id IS NOT NULL) AS is_lodging,
  updated_place.id AS trip_place_id,
  updated_place.name AS place_name,
  updated_place.place_type,
  updated_place.address,
  updated_place.provider,
  updated_place.google_place_id,
  updated_place.latitude,
  updated_place.longitude
FROM target
JOIN updated_place ON true
LEFT JOIN day_lodging_places dlp
  ON dlp.trip_id = sqlc.arg(trip_id)::uuid
 AND dlp.lodging_date = sqlc.arg(scheduled_date)
 AND dlp.trip_place_id = target.trip_place_id;

-- name: DeleteItineraryItemByTripDateAndID :one
DELETE FROM itinerary_items
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND scheduled_date = sqlc.arg(scheduled_date)
  AND id = sqlc.arg(item_id)::uuid
RETURNING trip_place_id::text;

-- name: CountItineraryItemsByTripPlaceID :one
SELECT count(*)::int AS total_count
FROM itinerary_items
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_place_id = sqlc.arg(trip_place_id)::uuid;

-- name: CountDayLodgingPlacesByTripPlaceID :one
SELECT count(*)::int AS total_count
FROM day_lodging_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_place_id = sqlc.arg(trip_place_id)::uuid;

-- name: DeleteTripPlaceByID :exec
DELETE FROM trip_places
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(trip_place_id)::uuid;
