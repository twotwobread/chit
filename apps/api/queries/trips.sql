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
