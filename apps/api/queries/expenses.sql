-- name: GetTripDefaultCurrencyForQuickExpense :one
SELECT
  id::text,
  default_currency
FROM trips
WHERE id = sqlc.arg(trip_id)::uuid;

-- name: GetQuickExpenseItineraryItem :one
SELECT
  ii.id::text AS itinerary_item_id,
  ii.scheduled_date,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address AS place_address
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
WHERE ii.trip_id = sqlc.arg(trip_id)::uuid
  AND ii.scheduled_date = sqlc.arg(scheduled_date)
  AND ii.id = sqlc.arg(itinerary_item_id)::uuid;

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
  scheduled_date,
  itinerary_item_id,
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
  sqlc.arg(scheduled_date),
  sqlc.arg(itinerary_item_id)::uuid,
  sqlc.arg(trip_place_id)::uuid,
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
  scheduled_date,
  itinerary_item_id::text,
  trip_place_id::text,
  place_name,
  place_address,
  place_type,
  amount_minor,
  currency,
  payer_participant_id::text,
  payer_display_name,
  created_at;

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
  participant_id::text,
  participant_display_name,
  amount_minor,
  split_order;
