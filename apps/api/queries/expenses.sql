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

-- name: GetTripExpenseScheduleItem :one
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
  AND si.id = sqlc.arg(schedule_item_id)::uuid
  AND si.deleted_at IS NULL;

-- name: GetQuickExpensePayerParticipant :one
SELECT
  id::text,
  user_id::text,
  display_name,
  joined_at
FROM trip_participants
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(payer_participant_id)::uuid;

-- name: ListQuickExpenseSplitParticipants :many
SELECT
  id::text,
  user_id::text,
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
  title,
  trip_place_id,
  place_name,
  place_address,
  place_type,
  amount_minor,
  currency,
  expense_category,
  expense_kind,
  split_policy,
  payer_participant_id,
  payer_display_name,
  memo,
  include_in_settlement,
  created_by
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(anchor_type),
  sqlc.narg(trip_day_id)::uuid,
  sqlc.narg(schedule_item_id)::uuid,
  sqlc.arg(expense_date),
  sqlc.narg(title),
  sqlc.narg(trip_place_id)::uuid,
  sqlc.narg(place_name),
  sqlc.narg(place_address),
  sqlc.narg(place_type),
  sqlc.arg(amount_minor),
  sqlc.arg(currency),
  sqlc.arg(expense_category),
  sqlc.arg(expense_kind),
  sqlc.arg(split_policy),
  sqlc.arg(payer_participant_id)::uuid,
  sqlc.arg(payer_display_name),
  sqlc.narg(memo),
  sqlc.arg(include_in_settlement),
  sqlc.arg(created_by)::uuid
)
RETURNING
  id::text,
  trip_id::text,
  anchor_type,
  COALESCE(trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(schedule_item_id::text, '')::text AS schedule_item_id,
  expense_date,
  title,
  COALESCE(trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(place_name, '')::text AS place_name,
  COALESCE(place_address, '')::text AS place_address,
  COALESCE(place_type, '')::text AS place_type,
  amount_minor,
  currency,
  expense_category,
  expense_kind,
  split_policy,
  COALESCE(payer_participant_id::text, '')::text AS payer_participant_id,
  payer_display_name,
  memo,
  include_in_settlement,
  false::boolean AS receipt_exists,
  ''::text AS receipt_content_type,
  0::integer AS receipt_byte_size,
  NULL::timestamptz AS receipt_uploaded_at,
  created_at;

-- name: ListDayExpensesByTripDay :many
SELECT
  e.id::text AS id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  COALESCE(e.title, live_place.name, e.place_name, '지출')::text AS display_title,
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
  e.expense_category,
  e.expense_kind,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.split_policy,
  e.include_in_settlement,
  (er.expense_id IS NOT NULL)::boolean AS receipt_exists,
  COALESCE(er.content_type, '')::text AS receipt_content_type,
  COALESCE(er.byte_size, 0)::integer AS receipt_byte_size,
  er.uploaded_at AS receipt_uploaded_at,
  e.created_at
FROM expenses e
LEFT JOIN expense_receipts er
  ON er.expense_id = e.id
 AND er.trip_id = e.trip_id
LEFT JOIN schedule_items si
  ON e.anchor_type = 'schedule_item'
 AND si.id = e.schedule_item_id
 AND si.trip_day_id = e.trip_day_id
 AND si.trip_id = e.trip_id
 AND si.deleted_at IS NULL
LEFT JOIN trip_places live_place
  ON live_place.id = CASE
    WHEN e.anchor_type = 'schedule_item' THEN si.trip_place_id
    ELSE e.trip_place_id
  END
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND e.anchor_type IN ('trip_day', 'schedule_item')
ORDER BY e.created_at DESC, e.id DESC;

-- name: ListTripExpensesByTrip :many
SELECT
  e.id::text AS id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  COALESCE(e.title, live_place.name, e.place_name, '지출')::text AS display_title,
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
  e.expense_category,
  e.expense_kind,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.split_policy,
  e.include_in_settlement,
  (er.expense_id IS NOT NULL)::boolean AS receipt_exists,
  COALESCE(er.content_type, '')::text AS receipt_content_type,
  COALESCE(er.byte_size, 0)::integer AS receipt_byte_size,
  er.uploaded_at AS receipt_uploaded_at,
  e.created_at
FROM expenses e
CROSS JOIN LATERAL (
  SELECT NULLIF(btrim(sqlc.arg(search_query)::text), '') AS query
) search
LEFT JOIN expense_receipts er
  ON er.expense_id = e.id
 AND er.trip_id = e.trip_id
LEFT JOIN schedule_items si
  ON e.anchor_type = 'schedule_item'
 AND si.id = e.schedule_item_id
 AND si.trip_day_id = e.trip_day_id
 AND si.trip_id = e.trip_id
 AND si.deleted_at IS NULL
LEFT JOIN trip_places live_place
  ON live_place.id = CASE
    WHEN e.anchor_type = 'schedule_item' THEN si.trip_place_id
    ELSE e.trip_place_id
  END
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.anchor_type IN ('trip', 'trip_day', 'schedule_item')
  AND (
    search.query IS NULL
    OR position(lower(search.query) in lower(COALESCE(e.title, ''))) > 0
    OR position(lower(search.query) in lower(COALESCE(e.memo, ''))) > 0
    OR position(lower(search.query) in lower(COALESCE(live_place.name, e.place_name, ''))) > 0
    OR position(lower(search.query) in lower(COALESCE(live_place.address, e.place_address, ''))) > 0
    OR position(lower(search.query) in lower(COALESCE(payer.display_name, e.payer_display_name, ''))) > 0
    OR position(lower(search.query) in lower(e.expense_category)) > 0
    OR position(lower(search.query) in lower(CASE e.expense_category
      WHEN 'cafe' THEN '카페 cafe'
      WHEN 'etc' THEN '기타 etc'
      WHEN 'food' THEN '식당 food 음식'
      WHEN 'lodging' THEN '숙소 lodging'
      WHEN 'shopping' THEN '쇼핑 shopping'
      WHEN 'sights' THEN '관광지 sights'
      WHEN 'transport' THEN '교통 transport 택시'
      ELSE e.expense_category
    END)) > 0
    OR (
      er.expense_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM expense_receipt_drafts erd
        WHERE erd.trip_id = e.trip_id
          AND erd.used_expense_id = e.id
          AND erd.status = 'used'
          AND (
            position(lower(search.query) in lower(COALESCE(erd.extraction_json->>'merchantName', ''))) > 0
            OR position(lower(search.query) in lower(COALESCE(erd.extraction_json->>'merchantAddress', ''))) > 0
            OR position(lower(search.query) in lower(COALESCE(erd.extraction_json->>'expenseTitle', ''))) > 0
            OR position(lower(search.query) in lower(COALESCE(erd.extraction_json->>'placeCandidateName', ''))) > 0
            OR position(lower(search.query) in lower(COALESCE(erd.extraction_json->>'placeCandidateAddress', ''))) > 0
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(erd.extraction_json->'lineItems', '[]'::jsonb)) AS receipt_line_item(value)
              WHERE position(lower(search.query) in lower(COALESCE(receipt_line_item.value->>'name', ''))) > 0
            )
          )
      )
    )
  )
ORDER BY
  CASE WHEN e.anchor_type = 'trip' THEN 0 ELSE 1 END ASC,
  e.trip_day_id ASC NULLS FIRST,
  e.created_at DESC,
  e.id DESC;

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

-- name: ListSettlementParticipantsByTrips :many
SELECT
  trip_id::text,
  id::text,
  display_name,
  joined_at
FROM trip_participants
WHERE trip_id = ANY(sqlc.arg(trip_ids)::uuid[])
ORDER BY trip_id ASC, joined_at ASC, id ASC;

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
  AND e.include_in_settlement = true
ORDER BY e.currency ASC, e.created_at ASC, e.id ASC, es.split_order ASC;

-- name: ListSettlementRowsByTrips :many
SELECT
  e.trip_id::text AS trip_id,
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
WHERE e.trip_id = ANY(sqlc.arg(trip_ids)::uuid[])
  AND e.anchor_type IN ('trip', 'trip_day', 'schedule_item')
  AND e.include_in_settlement = true
ORDER BY e.trip_id ASC, e.currency ASC, e.created_at ASC, e.id ASC, es.split_order ASC;

-- name: GetExpenseByTripDayAndID :one
SELECT
  e.id::text AS id,
  e.trip_id::text AS trip_id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  e.title,
  COALESCE(e.title, live_place.name, e.place_name, '지출')::text AS display_title,
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
  e.expense_category,
  e.expense_kind,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.memo,
  e.split_policy,
  e.include_in_settlement,
  (er.expense_id IS NOT NULL)::boolean AS receipt_exists,
  COALESCE(er.content_type, '')::text AS receipt_content_type,
  COALESCE(er.byte_size, 0)::integer AS receipt_byte_size,
  er.uploaded_at AS receipt_uploaded_at,
  e.created_at
FROM expenses e
LEFT JOIN expense_receipts er
  ON er.expense_id = e.id
 AND er.trip_id = e.trip_id
LEFT JOIN schedule_items si
  ON e.anchor_type = 'schedule_item'
 AND si.id = e.schedule_item_id
 AND si.trip_day_id = e.trip_day_id
 AND si.trip_id = e.trip_id
 AND si.deleted_at IS NULL
LEFT JOIN trip_places live_place
  ON live_place.id = CASE
    WHEN e.anchor_type = 'schedule_item' THEN si.trip_place_id
    ELSE e.trip_place_id
  END
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.trip_day_id = sqlc.arg(trip_day_id)::uuid
  AND e.id = sqlc.arg(expense_id)::uuid
  AND e.anchor_type IN ('trip_day', 'schedule_item');

-- name: GetTripExpenseByID :one
SELECT
  e.id::text AS id,
  e.trip_id::text AS trip_id,
  e.anchor_type,
  COALESCE(e.trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(e.schedule_item_id::text, '')::text AS schedule_item_id,
  e.expense_date,
  e.title,
  COALESCE(e.title, live_place.name, e.place_name, '지출')::text AS display_title,
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
  e.expense_category,
  e.expense_kind,
  COALESCE(payer.id::text, e.payer_participant_id::text, '')::text AS payer_participant_id,
  COALESCE(payer.display_name, e.payer_display_name, '여행자')::text AS payer_display_name,
  CASE
    WHEN payer.id IS NOT NULL THEN 'live'
    ELSE 'fallback'
  END::text AS payer_source,
  e.memo,
  e.split_policy,
  e.include_in_settlement,
  (er.expense_id IS NOT NULL)::boolean AS receipt_exists,
  COALESCE(er.content_type, '')::text AS receipt_content_type,
  COALESCE(er.byte_size, 0)::integer AS receipt_byte_size,
  er.uploaded_at AS receipt_uploaded_at,
  e.created_at
FROM expenses e
LEFT JOIN expense_receipts er
  ON er.expense_id = e.id
 AND er.trip_id = e.trip_id
LEFT JOIN trip_places live_place
  ON live_place.id = e.trip_place_id
 AND live_place.trip_id = e.trip_id
LEFT JOIN trip_participants payer
  ON payer.id = e.payer_participant_id
 AND payer.trip_id = e.trip_id
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.id = sqlc.arg(expense_id)::uuid
  AND e.anchor_type = 'trip'
  AND e.trip_day_id IS NULL
  AND e.schedule_item_id IS NULL;

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
  title = COALESCE(sqlc.narg(title), title),
  amount_minor = sqlc.arg(amount_minor),
  currency = COALESCE(sqlc.narg(currency), currency),
  expense_category = COALESCE(sqlc.narg(expense_category), expense_category),
  expense_kind = COALESCE(sqlc.narg(expense_kind), expense_kind),
  split_policy = sqlc.arg(split_policy),
  payer_participant_id = sqlc.arg(payer_participant_id)::uuid,
  payer_display_name = sqlc.arg(payer_display_name),
  memo = sqlc.narg(memo),
  include_in_settlement = COALESCE(sqlc.narg(include_in_settlement), include_in_settlement),
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
  title,
  COALESCE(trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(place_name, '')::text AS place_name,
  COALESCE(place_address, '')::text AS place_address,
  COALESCE(place_type, '')::text AS place_type,
  amount_minor,
  currency,
  expense_category,
  expense_kind,
  split_policy,
  COALESCE(payer_participant_id::text, '')::text AS payer_participant_id,
  payer_display_name,
  memo,
  include_in_settlement,
  EXISTS(SELECT 1 FROM expense_receipts er WHERE er.expense_id = expenses.id)::boolean AS receipt_exists,
  COALESCE((SELECT er.content_type FROM expense_receipts er WHERE er.expense_id = expenses.id), '')::text AS receipt_content_type,
  COALESCE((SELECT er.byte_size FROM expense_receipts er WHERE er.expense_id = expenses.id), 0)::integer AS receipt_byte_size,
  (SELECT er.uploaded_at FROM expense_receipts er WHERE er.expense_id = expenses.id) AS receipt_uploaded_at,
  created_at;

-- name: UpdateTripExpense :one
UPDATE expenses
SET
  title = sqlc.narg(title),
  trip_place_id = COALESCE(sqlc.narg(trip_place_id)::uuid, trip_place_id),
  place_name = COALESCE(sqlc.narg(place_name), place_name),
  place_address = COALESCE(sqlc.narg(place_address), place_address),
  place_type = COALESCE(sqlc.narg(place_type), place_type),
  amount_minor = sqlc.arg(amount_minor),
  currency = COALESCE(sqlc.narg(currency), currency),
  expense_category = COALESCE(sqlc.narg(expense_category), expense_category),
  expense_kind = COALESCE(sqlc.narg(expense_kind), expense_kind),
  split_policy = sqlc.arg(split_policy),
  payer_participant_id = sqlc.arg(payer_participant_id)::uuid,
  payer_display_name = sqlc.arg(payer_display_name),
  memo = sqlc.narg(memo),
  include_in_settlement = COALESCE(sqlc.narg(include_in_settlement), include_in_settlement),
  updated_at = now()
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(expense_id)::uuid
  AND anchor_type = 'trip'
  AND trip_day_id IS NULL
  AND schedule_item_id IS NULL
RETURNING
  id::text,
  trip_id::text,
  anchor_type,
  COALESCE(trip_day_id::text, '')::text AS trip_day_id,
  COALESCE(schedule_item_id::text, '')::text AS schedule_item_id,
  expense_date,
  title,
  COALESCE(trip_place_id::text, '')::text AS trip_place_id,
  COALESCE(place_name, '')::text AS place_name,
  COALESCE(place_address, '')::text AS place_address,
  COALESCE(place_type, '')::text AS place_type,
  amount_minor,
  currency,
  expense_category,
  expense_kind,
  split_policy,
  COALESCE(payer_participant_id::text, '')::text AS payer_participant_id,
  payer_display_name,
  memo,
  include_in_settlement,
  EXISTS(SELECT 1 FROM expense_receipts er WHERE er.expense_id = expenses.id)::boolean AS receipt_exists,
  COALESCE((SELECT er.content_type FROM expense_receipts er WHERE er.expense_id = expenses.id), '')::text AS receipt_content_type,
  COALESCE((SELECT er.byte_size FROM expense_receipts er WHERE er.expense_id = expenses.id), 0)::integer AS receipt_byte_size,
  (SELECT er.uploaded_at FROM expense_receipts er WHERE er.expense_id = expenses.id) AS receipt_uploaded_at,
  created_at;

-- name: DeleteExpenseSplitsByExpenseID :exec
DELETE FROM expense_splits
WHERE expense_id = sqlc.arg(expense_id)::uuid;

-- name: DeleteTripExpenseByID :one
DELETE FROM expenses
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND id = sqlc.arg(expense_id)::uuid
  AND anchor_type = 'trip'
  AND trip_day_id IS NULL
  AND schedule_item_id IS NULL
RETURNING id::text;

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

-- name: InsertExpenseReceiptDraft :one
INSERT INTO expense_receipt_drafts (
  trip_id,
  created_by_user_id,
  capture_mode,
  objects_json,
  image_count,
  content_type,
  byte_size,
  uploaded_at,
  extraction_json,
  confidence,
  warnings,
  expires_at
) VALUES (
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(created_by_user_id)::uuid,
  sqlc.arg(capture_mode),
  sqlc.arg(objects_json)::jsonb,
  sqlc.arg(image_count),
  sqlc.arg(content_type),
  sqlc.arg(byte_size),
  sqlc.arg(uploaded_at),
  sqlc.arg(extraction_json)::jsonb,
  sqlc.arg(confidence),
  sqlc.arg(warnings),
  sqlc.arg(expires_at)
)
RETURNING
  id::text,
  trip_id::text,
  created_by_user_id::text,
  capture_mode,
  objects_json,
  image_count,
  content_type,
  byte_size,
  uploaded_at,
  extraction_json,
  confidence,
  warnings,
  status,
  expires_at,
  COALESCE(used_expense_id::text, '')::text AS used_expense_id,
  created_at,
  updated_at;

-- name: GetExpenseReceiptDraftForUpdate :one
SELECT
  id::text,
  trip_id::text,
  created_by_user_id::text,
  capture_mode,
  objects_json,
  image_count,
  content_type,
  byte_size,
  uploaded_at,
  extraction_json,
  confidence,
  warnings,
  status,
  expires_at,
  COALESCE(used_expense_id::text, '')::text AS used_expense_id,
  created_at,
  updated_at
FROM expense_receipt_drafts
WHERE id = sqlc.arg(receipt_draft_id)::uuid
  AND trip_id = sqlc.arg(trip_id)::uuid
  AND created_by_user_id = sqlc.arg(created_by_user_id)::uuid
FOR UPDATE;

-- name: MarkExpenseReceiptDraftUsed :exec
UPDATE expense_receipt_drafts
SET status = 'used',
    used_expense_id = sqlc.arg(expense_id)::uuid,
    updated_at = now()
WHERE id = sqlc.arg(receipt_draft_id)::uuid
  AND trip_id = sqlc.arg(trip_id)::uuid
  AND created_by_user_id = sqlc.arg(created_by_user_id)::uuid
  AND status = 'draft'
  AND expires_at > now();

-- name: CancelExpenseReceiptDraft :many
UPDATE expense_receipt_drafts
SET status = 'cancelled',
    updated_at = now()
WHERE id = sqlc.arg(receipt_draft_id)::uuid
  AND trip_id = sqlc.arg(trip_id)::uuid
  AND created_by_user_id = sqlc.arg(created_by_user_id)::uuid
  AND status = 'draft'
RETURNING
  objects_json;

-- name: ExpireExpenseReceiptDrafts :many
UPDATE expense_receipt_drafts
SET status = 'expired',
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM expense_receipt_drafts
  WHERE status = 'draft'
    AND expires_at <= now()
  ORDER BY expires_at ASC, id ASC
  LIMIT sqlc.arg(limit_count)
  FOR UPDATE SKIP LOCKED
)
RETURNING
  id::text,
  objects_json;

-- name: LockExpenseReceiptForUpdate :one
SELECT
  objects_json,
  image_count,
  content_type,
  byte_size,
  uploaded_at
FROM expense_receipts
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND expense_id = sqlc.arg(expense_id)::uuid
FOR UPDATE;

-- name: UpsertExpenseReceipt :one
INSERT INTO expense_receipts (
  expense_id,
  trip_id,
  uploaded_by_user_id,
  objects_json,
  image_count,
  content_type,
  byte_size,
  uploaded_at
) VALUES (
  sqlc.arg(expense_id)::uuid,
  sqlc.arg(trip_id)::uuid,
  sqlc.arg(uploaded_by_user_id)::uuid,
  sqlc.arg(objects_json)::jsonb,
  sqlc.arg(image_count),
  sqlc.arg(content_type),
  sqlc.arg(byte_size),
  sqlc.arg(uploaded_at)
)
ON CONFLICT (expense_id) DO UPDATE
SET uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
    objects_json = EXCLUDED.objects_json,
    image_count = EXCLUDED.image_count,
    content_type = EXCLUDED.content_type,
    byte_size = EXCLUDED.byte_size,
    uploaded_at = EXCLUDED.uploaded_at,
    updated_at = now()
RETURNING
  true::boolean AS exists,
  content_type,
  byte_size,
  uploaded_at;

-- name: ClearExpenseReceipt :many
DELETE FROM expense_receipts
WHERE trip_id = sqlc.arg(trip_id)::uuid
  AND expense_id = sqlc.arg(expense_id)::uuid
RETURNING
  objects_json;

-- name: GetExpenseReceiptObject :one
SELECT
  er.objects_json,
  er.content_type,
  er.byte_size,
  er.uploaded_at
FROM expense_receipts er
JOIN expenses e
  ON e.id = er.expense_id
 AND e.trip_id = er.trip_id
WHERE er.trip_id = sqlc.arg(trip_id)::uuid
  AND er.expense_id = sqlc.arg(expense_id)::uuid;

-- name: EnqueueExpenseReceiptDeletionJobForExpense :exec
INSERT INTO storage_object_deletion_jobs (
  bucket,
  object_key,
  object_generation,
  reason
)
SELECT
  receipt_object->>'bucket',
  receipt_object->>'objectKey',
  receipt_object->>'generation',
  sqlc.arg(reason)
FROM expense_receipts er
CROSS JOIN LATERAL jsonb_array_elements(er.objects_json) AS receipt_object
WHERE er.trip_id = sqlc.arg(trip_id)::uuid
  AND er.expense_id = sqlc.arg(expense_id)::uuid
ON CONFLICT DO NOTHING;

-- name: EnqueueExpenseReceiptDeletionJobsForTrip :exec
INSERT INTO storage_object_deletion_jobs (
  bucket,
  object_key,
  object_generation,
  reason
)
SELECT
  receipt_object->>'bucket',
  receipt_object->>'objectKey',
  receipt_object->>'generation',
  sqlc.arg(reason)
FROM expense_receipts er
CROSS JOIN LATERAL jsonb_array_elements(er.objects_json) AS receipt_object
WHERE er.trip_id = sqlc.arg(trip_id)::uuid
ON CONFLICT DO NOTHING;
