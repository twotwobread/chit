-- +goose Up
WITH trips_to_link AS (
  SELECT
    t.id AS trip_id,
    t.name,
    t.start_date,
    t.end_date,
    t.default_currency,
    t.created_by,
    t.created_at,
    t.updated_at,
    gen_random_uuid() AS meeting_id,
    gen_random_uuid() AS event_id
  FROM trips t
  WHERE NOT EXISTS (
    SELECT 1
    FROM events existing_event
    WHERE existing_event.trip_id = t.id
  )
), inserted_meetings AS (
  INSERT INTO meetings (id, name, visibility, created_by, created_at, updated_at)
  SELECT
    meeting_id,
    name,
    'one_off',
    created_by,
    created_at,
    updated_at
  FROM trips_to_link
  RETURNING id
), inserted_meeting_members AS (
  INSERT INTO meeting_members (meeting_id, user_id, role, display_name, joined_at)
  SELECT
    ttl.meeting_id,
    tp.user_id,
    tp.role,
    tp.display_name,
    tp.joined_at
  FROM trips_to_link ttl
  JOIN inserted_meetings im ON im.id = ttl.meeting_id
  JOIN trip_participants tp ON tp.trip_id = ttl.trip_id
  RETURNING id, meeting_id, user_id
), inserted_events AS (
  INSERT INTO events (id, meeting_id, event_type, title, start_date, end_date, default_currency, status, trip_id, created_by, created_at, updated_at)
  SELECT
    ttl.event_id,
    ttl.meeting_id,
    'trip',
    ttl.name,
    ttl.start_date,
    ttl.end_date,
    ttl.default_currency,
    'planned',
    ttl.trip_id,
    ttl.created_by,
    ttl.created_at,
    ttl.updated_at
  FROM trips_to_link ttl
  JOIN inserted_meetings im ON im.id = ttl.meeting_id
  RETURNING id, trip_id
)
INSERT INTO event_participants (event_id, meeting_member_id, user_id, role, display_name, joined_at)
SELECT
  ie.id,
  imm.id,
  tp.user_id,
  tp.role,
  tp.display_name,
  tp.joined_at
FROM inserted_events ie
JOIN trip_participants tp ON tp.trip_id = ie.trip_id
JOIN inserted_meeting_members imm
  ON imm.user_id = tp.user_id
JOIN trips_to_link ttl
  ON ttl.trip_id = ie.trip_id
 AND ttl.meeting_id = imm.meeting_id;

-- +goose Down
WITH linked_trip_events AS (
  SELECT
    e.id AS event_id,
    m.id AS meeting_id
  FROM events e
  JOIN meetings m ON m.id = e.meeting_id
  WHERE e.trip_id IS NOT NULL
    AND e.event_type = 'trip'
    AND m.visibility = 'one_off'
), deleted_events AS (
  DELETE FROM events
  WHERE id IN (SELECT event_id FROM linked_trip_events)
  RETURNING 1
)
DELETE FROM meetings
WHERE id IN (SELECT meeting_id FROM linked_trip_events)
  AND EXISTS (SELECT 1 FROM deleted_events);
