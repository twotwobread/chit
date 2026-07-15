-- name: CreateFlight :one
INSERT INTO flights (
  trip_id,
  flight_number,
  display_title,
  departure_airport_text,
  departure_airport_code,
  departure_local_date,
  departure_local_time,
  departure_time_zone,
  departure_at,
  arrival_airport_text,
  arrival_airport_code,
  arrival_local_date,
  arrival_local_time,
  arrival_time_zone,
  arrival_at,
  created_by_user_id
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.narg(flight_number),
  sqlc.arg(display_title),
  sqlc.arg(departure_airport_text),
  sqlc.narg(departure_airport_code),
  sqlc.arg(departure_local_date),
  sqlc.arg(departure_local_time),
  sqlc.arg(departure_time_zone),
  sqlc.arg(departure_at),
  sqlc.arg(arrival_airport_text),
  sqlc.narg(arrival_airport_code),
  sqlc.arg(arrival_local_date),
  sqlc.arg(arrival_local_time),
  sqlc.arg(arrival_time_zone),
  sqlc.arg(arrival_at),
  sqlc.arg(created_by_user_id)::uuid
)
RETURNING
  id::text,
  trip_id::text,
  flight_number,
  display_title,
  departure_airport_text,
  departure_airport_code,
  departure_local_date,
  departure_local_time,
  departure_time_zone,
  departure_at,
  arrival_airport_text,
  arrival_airport_code,
  arrival_local_date,
  arrival_local_time,
  arrival_time_zone,
  arrival_at,
  created_by_user_id::text,
  created_at,
  updated_at;

-- name: UpdateFlight :one
UPDATE flights
SET
  flight_number = sqlc.narg(flight_number),
  display_title = sqlc.arg(display_title),
  departure_airport_text = sqlc.arg(departure_airport_text),
  departure_airport_code = sqlc.narg(departure_airport_code),
  departure_local_date = sqlc.arg(departure_local_date),
  departure_local_time = sqlc.arg(departure_local_time),
  departure_time_zone = sqlc.arg(departure_time_zone),
  departure_at = sqlc.arg(departure_at),
  arrival_airport_text = sqlc.arg(arrival_airport_text),
  arrival_airport_code = sqlc.narg(arrival_airport_code),
  arrival_local_date = sqlc.arg(arrival_local_date),
  arrival_local_time = sqlc.arg(arrival_local_time),
  arrival_time_zone = sqlc.arg(arrival_time_zone),
  arrival_at = sqlc.arg(arrival_at),
  updated_at = now()
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(flight_id)::uuid
RETURNING
  id::text,
  trip_id::text,
  flight_number,
  display_title,
  departure_airport_text,
  departure_airport_code,
  departure_local_date,
  departure_local_time,
  departure_time_zone,
  departure_at,
  arrival_airport_text,
  arrival_airport_code,
  arrival_local_date,
  arrival_local_time,
  arrival_time_zone,
  arrival_at,
  created_by_user_id::text,
  created_at,
  updated_at;

-- name: CreateFlightPassenger :one
INSERT INTO flight_passengers (
  flight_id,
  trip_id,
  participant_id,
  added_by_user_id
) VALUES (
  sqlc.arg(flight_id)::uuid,
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(participant_id)::uuid,
  sqlc.arg(added_by_user_id)::uuid
)
RETURNING
  id::text,
  flight_id::text,
  trip_id::text,
  participant_id::text,
  added_by_user_id::text,
  created_at;

-- name: ListFlightsByTrip :many
SELECT
  id::text,
  trip_id::text,
  flight_number,
  display_title,
  departure_airport_text,
  departure_airport_code,
  departure_local_date,
  departure_local_time,
  departure_time_zone,
  departure_at,
  arrival_airport_text,
  arrival_airport_code,
  arrival_local_date,
  arrival_local_time,
  arrival_time_zone,
  arrival_at,
  created_by_user_id::text,
  created_at,
  updated_at
FROM flights
WHERE trip_id = sqlc.arg(trip_id)::uuid
ORDER BY departure_at ASC, id ASC;

-- name: GetFlightByTrip :one
SELECT
  id::text,
  trip_id::text,
  flight_number,
  display_title,
  departure_airport_text,
  departure_airport_code,
  departure_local_date,
  departure_local_time,
  departure_time_zone,
  departure_at,
  arrival_airport_text,
  arrival_airport_code,
  arrival_local_date,
  arrival_local_time,
  arrival_time_zone,
  arrival_at,
  created_by_user_id::text,
  created_at,
  updated_at
FROM flights
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(flight_id)::uuid;

-- name: ListFlightPassengersByTrip :many
SELECT
  fp.flight_id::text AS flight_id,
  fp.participant_id::text AS participant_id,
  tp.display_name
FROM flight_passengers fp
JOIN trip_participants tp ON tp.id = fp.participant_id
WHERE fp.trip_id = sqlc.arg(trip_id)::uuid
ORDER BY fp.flight_id ASC, tp.joined_at ASC, fp.participant_id ASC;

-- name: ListFlightPassengersByFlight :many
SELECT
  fp.flight_id::text AS flight_id,
  fp.participant_id::text AS participant_id,
  tp.display_name
FROM flight_passengers fp
JOIN trip_participants tp ON tp.id = fp.participant_id
WHERE fp.trip_id = sqlc.arg(trip_id)::uuid
  AND fp.flight_id = sqlc.arg(flight_id)::uuid
ORDER BY tp.joined_at ASC, fp.participant_id ASC;

-- name: GetFlightPassengerParticipantForUser :one
SELECT fp.participant_id::text
FROM flight_passengers fp
JOIN trip_participants tp ON tp.id = fp.participant_id
WHERE fp.trip_id = sqlc.arg(trip_id)::uuid
  AND fp.flight_id = sqlc.arg(flight_id)::uuid
  AND tp.user_id = sqlc.arg(user_id)::uuid;

-- name: ListMyFlightPersonalDetailsByTrip :many
SELECT
  fpd.id::text AS id,
  fpd.flight_id::text AS flight_id,
  fpd.trip_id::text AS trip_id,
  fpd.passenger_participant_id::text AS passenger_participant_id,
  fpd.created_by_user_id::text AS created_by_user_id,
  fpd.reservation_number,
  fpd.seat,
  fpd.check_in_url,
  fpd.boarding_pass_bucket,
  fpd.boarding_pass_object_key,
  fpd.boarding_pass_generation,
  fpd.boarding_pass_content_type,
  fpd.boarding_pass_byte_size,
  fpd.boarding_pass_uploaded_at,
  fpd.created_at,
  fpd.updated_at
FROM flight_personal_details fpd
JOIN trip_participants tp ON tp.id = fpd.passenger_participant_id
WHERE fpd.trip_id = sqlc.arg(trip_id)::uuid
  AND tp.user_id = sqlc.arg(user_id)::uuid
ORDER BY fpd.flight_id ASC;

-- name: GetFlightPersonalDetail :one
SELECT
  id::text,
  flight_id::text,
  trip_id::text,
  passenger_participant_id::text,
  created_by_user_id::text,
  reservation_number,
  seat,
  check_in_url,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at,
  created_at,
  updated_at
FROM flight_personal_details
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND flight_id = sqlc.arg(flight_id)::uuid
  AND passenger_participant_id = sqlc.arg(passenger_participant_id)::uuid;

-- name: UpsertFlightPersonalDetail :one
INSERT INTO flight_personal_details (
  flight_id,
  trip_id,
  passenger_participant_id,
  created_by_user_id,
  reservation_number,
  seat,
  check_in_url
) VALUES (
  sqlc.arg(flight_id)::uuid,
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(passenger_participant_id)::uuid,
  sqlc.arg(created_by_user_id)::uuid,
  sqlc.narg(reservation_number),
  sqlc.narg(seat),
  sqlc.narg(check_in_url)
)
ON CONFLICT (flight_id, passenger_participant_id) DO UPDATE
SET reservation_number = EXCLUDED.reservation_number,
    seat = EXCLUDED.seat,
    check_in_url = EXCLUDED.check_in_url,
    updated_at = now()
RETURNING
  id::text,
  flight_id::text,
  trip_id::text,
  passenger_participant_id::text,
  created_by_user_id::text,
  reservation_number,
  seat,
  check_in_url,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at,
  created_at,
  updated_at;

-- name: LockFlightPersonalDetailForUpdate :one
SELECT
  id::text,
  flight_id::text,
  trip_id::text,
  passenger_participant_id::text,
  created_by_user_id::text,
  reservation_number,
  seat,
  check_in_url,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at,
  created_at,
  updated_at
FROM flight_personal_details
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND flight_id = sqlc.arg(flight_id)::uuid
  AND passenger_participant_id = sqlc.arg(passenger_participant_id)::uuid
FOR UPDATE;

-- name: LockFlightPassengerForUpdate :one
SELECT participant_id::text
FROM flight_passengers
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND flight_id = sqlc.arg(flight_id)::uuid
  AND participant_id = sqlc.arg(participant_id)::uuid
FOR UPDATE;

-- name: UpsertFlightBoardingPassMetadata :one
INSERT INTO flight_personal_details (
  flight_id,
  trip_id,
  passenger_participant_id,
  created_by_user_id,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at
) VALUES (
  sqlc.arg(flight_id)::uuid,
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(passenger_participant_id)::uuid,
  sqlc.arg(created_by_user_id)::uuid,
  sqlc.arg(boarding_pass_bucket),
  sqlc.arg(boarding_pass_object_key),
  sqlc.arg(boarding_pass_generation),
  sqlc.arg(boarding_pass_content_type),
  sqlc.arg(boarding_pass_byte_size),
  sqlc.arg(boarding_pass_uploaded_at)
)
ON CONFLICT (flight_id, passenger_participant_id) DO UPDATE
SET boarding_pass_bucket = EXCLUDED.boarding_pass_bucket,
    boarding_pass_object_key = EXCLUDED.boarding_pass_object_key,
    boarding_pass_generation = EXCLUDED.boarding_pass_generation,
    boarding_pass_content_type = EXCLUDED.boarding_pass_content_type,
    boarding_pass_byte_size = EXCLUDED.boarding_pass_byte_size,
    boarding_pass_uploaded_at = EXCLUDED.boarding_pass_uploaded_at,
    updated_at = now()
RETURNING
  id::text,
  flight_id::text,
  trip_id::text,
  passenger_participant_id::text,
  created_by_user_id::text,
  reservation_number,
  seat,
  check_in_url,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at,
  created_at,
  updated_at;

-- name: ClearFlightBoardingPassMetadata :one
UPDATE flight_personal_details
SET boarding_pass_bucket = NULL,
    boarding_pass_object_key = NULL,
    boarding_pass_generation = NULL,
    boarding_pass_content_type = NULL,
    boarding_pass_byte_size = NULL,
    boarding_pass_uploaded_at = NULL,
    updated_at = now()
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND flight_id = sqlc.arg(flight_id)::uuid
  AND passenger_participant_id = sqlc.arg(passenger_participant_id)::uuid
RETURNING
  id::text,
  flight_id::text,
  trip_id::text,
  passenger_participant_id::text,
  created_by_user_id::text,
  reservation_number,
  seat,
  check_in_url,
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  boarding_pass_content_type,
  boarding_pass_byte_size,
  boarding_pass_uploaded_at,
  created_at,
  updated_at;

-- name: CreateStorageObjectDeletionJob :one
INSERT INTO storage_object_deletion_jobs (
  bucket,
  object_key,
  object_generation,
  reason
) VALUES (
  sqlc.arg(bucket),
  sqlc.arg(object_key),
  sqlc.narg(object_generation),
  sqlc.arg(reason)
)
ON CONFLICT DO NOTHING
RETURNING
  id::text,
  bucket,
  object_key,
  object_generation,
  reason,
  status,
  attempts,
  next_attempt_at,
  last_error,
  created_at,
  updated_at,
  processed_at;

-- name: EnqueueFlightBoardingPassDeletionJobsForParticipant :exec
INSERT INTO storage_object_deletion_jobs (
  bucket,
  object_key,
  object_generation,
  reason
)
SELECT
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  sqlc.arg(reason)
FROM flight_personal_details
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND passenger_participant_id = sqlc.arg(participant_id)::uuid
  AND boarding_pass_object_key IS NOT NULL
ON CONFLICT DO NOTHING;

-- name: EnqueueFlightBoardingPassDeletionJobsForTrip :exec
INSERT INTO storage_object_deletion_jobs (
  bucket,
  object_key,
  object_generation,
  reason
)
SELECT
  boarding_pass_bucket,
  boarding_pass_object_key,
  boarding_pass_generation,
  sqlc.arg(reason)
FROM flight_personal_details
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND boarding_pass_object_key IS NOT NULL
ON CONFLICT DO NOTHING;

-- name: ClaimStorageObjectDeletionJobs :many
UPDATE storage_object_deletion_jobs
SET status = 'running',
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM storage_object_deletion_jobs
  WHERE status IN ('pending', 'failed')
    AND attempts < 5
    AND next_attempt_at <= now()
  ORDER BY next_attempt_at ASC, id ASC
  LIMIT sqlc.arg(limit_count)
  FOR UPDATE SKIP LOCKED
)
RETURNING
  id::text,
  bucket,
  object_key,
  object_generation,
  reason,
  status,
  attempts,
  next_attempt_at,
  last_error,
  created_at,
  updated_at,
  processed_at;

-- name: MarkStorageObjectDeletionJobSucceeded :exec
UPDATE storage_object_deletion_jobs
SET status = 'succeeded',
    processed_at = now(),
    updated_at = now(),
    last_error = NULL
WHERE id = sqlc.arg(job_id)::uuid;

-- name: MarkStorageObjectDeletionJobFailed :exec
UPDATE storage_object_deletion_jobs
SET status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
    attempts = attempts + 1,
    next_attempt_at = now() + (interval '1 minute' * LEAST(60, (attempts + 1) * (attempts + 1))),
    last_error = sqlc.arg(last_error),
    updated_at = now()
WHERE id = sqlc.arg(job_id)::uuid;
