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

-- name: ListItineraryItemsByTripAndDate :many
SELECT
  ii.id::text AS id,
  ii.item_order,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
WHERE ii.trip_id = $1::uuid
  AND ii.scheduled_date = $2
ORDER BY ii.item_order ASC, ii.id ASC;

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
  address;

-- name: CreateItineraryItemAtEnd :one
INSERT INTO itinerary_items (
  trip_id,
  scheduled_date,
  trip_place_id,
  item_order
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(scheduled_date),
  sqlc.arg(trip_place_id)::uuid,
  (
    SELECT COALESCE(MAX(item_order), 0) + 1
    FROM itinerary_items
    WHERE trip_id = sqlc.arg(trip_id)::uuid
      AND scheduled_date = sqlc.arg(scheduled_date)
  )
)
RETURNING
  id::text,
  item_order;
