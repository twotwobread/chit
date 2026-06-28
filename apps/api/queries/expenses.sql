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
  sqlc.arg(place_name),
  sqlc.arg(place_address),
  sqlc.arg(place_type),
  sqlc.arg(amount_minor),
  sqlc.arg(currency),
  sqlc.arg(payer_participant_id)::uuid,
  sqlc.arg(payer_display_name),
  sqlc.arg(created_by)::uuid
)
RETURNING
  id::text,
  trip_id::text,
  anchor_type,
  trip_day_id::text,
  schedule_item_id::text,
  expense_date,
  trip_place_id::text,
  place_name,
  place_address,
  place_type,
  amount_minor,
  currency,
  payer_participant_id::text,
  payer_display_name,
  created_at;

-- name: ListDayExpensesByTripDay :many
SELECT
  id::text,
  place_name,
  place_address,
  place_type,
  amount_minor,
  currency,
  payer_display_name,
  created_at
FROM expenses
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND anchor_type IN ('trip_day', 'schedule_item')
ORDER BY created_at DESC, id DESC;

-- name: ListDayExpenseSplitsByExpenseIDs :many
SELECT
  expense_id::text,
  split_order,
  participant_display_name,
  amount_minor
FROM expense_splits
WHERE expense_id = ANY(sqlc.arg(expense_ids)::uuid[])
ORDER BY expense_id ASC, split_order ASC;

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
  participant_id::text,
  participant_display_name,
  amount_minor,
  split_order;
