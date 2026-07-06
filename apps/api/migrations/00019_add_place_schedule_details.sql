-- +goose Up
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;

ALTER TABLE schedule_items
  ADD COLUMN place_title text,
  ADD COLUMN place_memo text;

UPDATE schedule_items si
SET place_title = COALESCE(NULLIF(btrim(tp.name), ''), '장소 일정')
FROM trip_places tp
WHERE si.item_kind = 'place'
  AND si.trip_place_id = tp.id
  AND si.trip_id = tp.trip_id
  AND si.place_title IS NULL;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_place_title_check CHECK (
    item_kind <> 'place'
    OR (
      place_title IS NOT NULL
      AND char_length(btrim(place_title)) BETWEEN 1 AND 120
    )
  ),
  ADD CONSTRAINT schedule_items_place_memo_check CHECK (
    place_memo IS NULL OR char_length(place_memo) <= 1000
  ),
  ADD CONSTRAINT schedule_items_backing_check CHECK (
    (
      item_kind = 'place'
      AND trip_place_id IS NOT NULL
      AND place_title IS NOT NULL
      AND non_place_category IS NULL
      AND non_place_title IS NULL
      AND non_place_memo IS NULL
      AND non_place_link IS NULL
      AND transport_mode IS NULL
      AND transport_reference_number IS NULL
      AND transport_booking_reference IS NULL
      AND transport_origin_text IS NULL
      AND transport_destination_text IS NULL
      AND transport_terminal_text IS NULL
      AND transport_gate_text IS NULL
    )
    OR
    (
      item_kind = 'non_place'
      AND trip_place_id IS NULL
      AND place_title IS NULL
      AND place_memo IS NULL
      AND non_place_category IS NOT NULL
      AND non_place_title IS NOT NULL
    )
  );

-- +goose Down
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_place_memo_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_place_title_check;

ALTER TABLE schedule_items
  DROP COLUMN IF EXISTS place_memo,
  DROP COLUMN IF EXISTS place_title;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_backing_check CHECK (
    (
      item_kind = 'place'
      AND trip_place_id IS NOT NULL
      AND non_place_category IS NULL
      AND non_place_title IS NULL
      AND non_place_memo IS NULL
      AND non_place_link IS NULL
      AND transport_mode IS NULL
      AND transport_reference_number IS NULL
      AND transport_booking_reference IS NULL
      AND transport_origin_text IS NULL
      AND transport_destination_text IS NULL
      AND transport_terminal_text IS NULL
      AND transport_gate_text IS NULL
    )
    OR
    (
      item_kind = 'non_place'
      AND trip_place_id IS NULL
      AND non_place_category IS NOT NULL
      AND non_place_title IS NOT NULL
    )
  );
