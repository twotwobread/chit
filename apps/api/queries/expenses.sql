-- name: GetTripDefaultCurrencyForQuickExpense :one
SELECT
  id::text,
  default_currency
FROM trips
WHERE id = sqlc.arg(trip_id)::uuid;

-- name: GetQuickExpenseScheduleItem :one
SELECT
  si.id::text AS schedule_item_id,
  si.trip_day_id::text AS trip_day_id,
  td.date AS trip_day_date,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address AS place_address
FROM schedule_items si
JOIN trip_days td
  ON td.id = si.trip_day_id
 AND td.trip_id = si.trip_id
 AND td.deleted_at IS NULL
JOIN trip_places tp
  ON tp.id = si.trip_place_id
 AND tp.trip_id = si.trip_id
WHERE si.trip_id = sqlc.arg(trip_id)::uuid
  AND si.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND si.id = sqlc.arg(schedule_item_id)::uuid
  AND si.deleted_at IS NULL;

-- name: GetQuickExpensePayerParticipant :one
SELECT
  id::text,
  display_name,
  joined_at
FROM trip_participants
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(payer_participant_id)::uuid;

-- name: ListQuickExpenseSplitParticipants :many
SELECT
  id::text,
  display_name,
  joined_at
FROM trip_participants
WHERE trip_id = sqlc.arg(trip_id)::uuid
ORDER BY joined_at ASC, id ASC;

-- name: InsertExpense :one
INSERT INTO expenses (
  trip_id,
  anchor_type,
  trip_day_id,
  schedule_item_id,
  expense_date,
  trip_place_id,
  place_name,
  place_address,
  place_type,
  amount_minor,
  currency,
  split_policy,
  payer_participant_id,
  payer_display_name,
  created_by
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(anchor_type),
  sqlc.narg(trip_day_id)::uuid,
  sqlc.narg(schedule_item_id)::uuid,
  sqlc.arg(expense_date),
  sqlc.narg(trip_place_id)::uuid,
  sqlc.narg(place_name),
  sqlc.narg(place_address),
  sqlc.narg(place_type),
  sqlc.arg(amount_minor),
  sqlc.arg(currency),
  sqlc.arg(split_policy),
  sqlc.arg(payer_participant_id)::uuid,
  sqlc.arg(payer_display_name),
  sqlc.arg(created_by)::uuid
)
RETURNING
  id::text,
  trip_id::text,
  anchor_type,
  COALESCE(trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(schedule_item_id::text, '')::text AS schedule_item_id,
  expense_date,
  COALESCE(trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(place_name, '')::text AS place_name,
  COALESCE(place_address, '')::text AS place_address,
  COALESCE(place_type, '')::text AS place_type,
  amount_minor,
  currency,
  split_policy,
  COALESCE(payer_participant_id::text, '')::text AS payer_participant_id,
  payer_display_name,
  created_at;

-- name: ListDayExpensesByTripDay :many
SELECT
  e.id::text AS id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  COALESCE(live_place.name, e.place_name, '지출')::text AS display_title,
  COALESCE(live_place.id::text, e.trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(live_place.name, e.place_name, '')::text AS place_name,
  COALESCE(live_place.address, e.place_address, '')::text AS place_address,
  COALESCE(live_place.place_type, e.place_type, '')::text AS place_type,
  CASE
    WHEN live_place.id IS NOT NULL THEN 'live'
    WHEN e.place_name IS NOT NULL THEN 'fallback'
    ELSE ''
  END::text AS place_source,
  e.amount_minor,
  e.currency,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.split_policy,
  e.created_at
FROM expenses e
LEFT JOIN schedule_items si
  ON e.anchor_type = 'schedule_item'
 AND si.id = e.schedule_item_id
 AND si.trip_day_id = e.trip_day_id
 AND si.trip_id = e.trip_id
 AND si.deleted_at IS NULL
LEFT JOIN trip_places live_place
  ON live_place.id = si.trip_place_id
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND e.anchor_type IN ('trip_day', 'schedule_item')
ORDER BY e.created_at DESC, e.id DESC;

-- name: ListDayExpenseSplitsByExpenseIDs :many
SELECT
  es.expense_id::text AS expense_id,
  es.split_order,
  COALESCE(participant.id::text, es.participant_id::text, '')::text AS participant_id,
  COALESCE(participant.display_name, es.participant_display_name, '여행자')::text AS participant_display_name,
  CASE
    WHEN participant.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS participant_source,
  es.amount_minor
FROM expense_splits es
JOIN expenses e
  ON e.id = es.expense_id
LEFT JOIN trip_participants participant
  ON participant.id = es.participant_id
 AND participant.trip_id = e.trip_id
WHERE es.expense_id = ANY(sqlc.arg(expense_ids)::uuid[])
ORDER BY es.expense_id ASC, es.split_order ASC;

-- name: ListSettlementParticipantsByTrip :many
SELECT
  id::text,
  display_name,
  joined_at
FROM trip_participants
WHERE trip_id = sqlc.arg(trip_id)::uuid
ORDER BY joined_at ASC, id ASC;

-- name: ListSettlementRowsByTrip :many
SELECT
  e.id::text AS expense_id,
  e.currency,
  e.amount_minor AS expense_amount_minor,
  COALESCE(payer.id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  (payer.id IS NOT NULL)::boolean AS payer_participant_live,
  COALESCE(es.split_order, 0)::integer AS split_order,
  COALESCE(split_participant.id::text, '')::text AS split_participant_id,
  COALESCE(split_participant.display_name, es.participant_display_name, '여행자')::text AS split_participant_display_name,
  (split_participant.id IS NOT NULL)::boolean AS split_participant_live,
  COALESCE(es.amount_minor, 0)::bigint AS split_amount_minor
FROM expenses e
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
LEFT JOIN expense_splits es
  ON es.expense_id = e.id
LEFT JOIN trip_participants split_participant
  ON split_participant.id = es.participant_id
 AND split_participant.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.anchor_type IN ('trip', 'trip_day', 'schedule_item')
ORDER BY e.currency ASC, e.created_at ASC, e.id ASC, es.split_order ASC;

-- name: GetExpenseByTripDayAndID :one
SELECT
  e.id::text AS id,
  e.trip_id::text AS trip_id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  COALESCE(live_place.name, e.place_name, '지출')::text AS display_title,
  COALESCE(live_place.id::text, e.trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(live_place.name, e.place_name, '')::text AS place_name,
  COALESCE(live_place.address, e.place_address, '')::text AS place_address,
  COALESCE(live_place.place_type, e.place_type, '')::text AS place_type,
  CASE
    WHEN live_place.id IS NOT NULL THEN 'live'
    WHEN e.place_name IS NOT NULL THEN 'fallback'
    ELSE ''
  END::text AS place_source,
  e.amount_minor,
  e.currency,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.memo,
  e.split_policy,
  e.created_at
FROM expenses e
LEFT JOIN schedule_items si
  ON e.anchor_type = 'schedule_item'
 AND si.id = e.schedule_item_id
 AND si.trip_day_id = e.trip_day_id
 AND si.trip_id = e.trip_id
 AND si.deleted_at IS NULL
LEFT JOIN trip_places live_place
  ON live_place.id = si.trip_place_id
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND e.id = sqlc.arg(expense_id)::uuid
  AND e.anchor_type IN ('trip_day', 'schedule_item');

-- name: ListExpenseSplitsByExpenseID :many
SELECT
  COALESCE(participant.id::text, es.participant_id::text, '')::text AS participant_id,
  COALESCE(participant.display_name, es.participant_display_name, '여행자')::text AS participant_display_name,
  CASE
    WHEN participant.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS participant_source,
  es.amount_minor,
  es.split_order
FROM expense_splits es
JOIN expenses e
  ON e.id = es.expense_id
LEFT JOIN trip_participants participant
  ON participant.id = es.participant_id
 AND participant.trip_id = e.trip_id
WHERE es.expense_id = sqlc.arg(expense_id)::uuid
ORDER BY es.split_order ASC;

-- name: UpdateExpense :one
UPDATE expenses
SET
  anchor_type = sqlc.arg(anchor_type),
  schedule_item_id = sqlc.narg(schedule_item_id)::uuid,
  trip_place_id = sqlc.narg(trip_place_id)::uuid,
  place_name = sqlc.narg(place_name),
  place_address = sqlc.narg(place_address),
  place_type = sqlc.narg(place_type),
  amount_minor = sqlc.arg(amount_minor),
  split_policy = sqlc.arg(split_policy),
  payer_participant_id = sqlc.arg(payer_participant_id)::uuid,
  payer_display_name = sqlc.arg(payer_display_name),
  memo = sqlc.narg(memo),
  updated_at = now()
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND id = sqlc.arg(expense_id)::uuid
  AND anchor_type IN ('trip_day', 'schedule_item')
RETURNING
  id::text,
  trip_id::text,
  anchor_type,
  COALESCE(trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(schedule_item_id::text, '')::text AS schedule_item_id,
  expense_date,
  COALESCE(trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(place_name, '')::text AS place_name,
  COALESCE(place_address, '')::text AS place_address,
  COALESCE(place_type, '')::text AS place_type,
  amount_minor,
  currency,
  split_policy,
  COALESCE(payer_participant_id::text, '')::text AS payer_participant_id,
  payer_display_name,
  memo,
  created_at;

-- name: DeleteExpenseSplitsByExpenseID :exec
DELETE FROM expense_splits
WHERE expense_id = sqlc.arg(expense_id)::uuid;

-- name: DeleteExpenseByTripDayAndID :one
DELETE FROM expenses
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND id = sqlc.arg(expense_id)::uuid
  AND anchor_type IN ('trip_day', 'schedule_item')
RETURNING id::text;

-- name: InsertExpenseSplit :one
INSERT INTO expense_splits (
  expense_id,
  participant_id,
  participant_display_name,
  amount_minor,
  split_order
) VALUES (
  sqlc.arg(expense_id)::uuid,
  sqlc.arg(participant_id)::uuid,
  sqlc.arg(participant_display_name),
  sqlc.arg(amount_minor),
  sqlc.arg(split_order)
)
RETURNING
  id::text,
  expense_id::text,
  COALESCE(participant_id::text, '')::text AS participant_id,
  participant_display_name,
  amount_minor,
  split_order;
