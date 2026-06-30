-- +goose Up
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_trip_place_fk;

ALTER TABLE schedule_items
  ALTER COLUMN trip_place_id DROP NOT NULL,
  ADD COLUMN item_kind text NOT NULL DEFAULT 'place',
  ADD COLUMN non_place_category text,
  ADD COLUMN non_place_title text,
  ADD COLUMN non_place_memo text,
  ADD COLUMN non_place_link text,
  ADD COLUMN transport_mode text,
  ADD COLUMN transport_reference_number text,
  ADD COLUMN transport_booking_reference text,
  ADD COLUMN transport_origin_text text,
  ADD COLUMN transport_destination_text text,
  ADD COLUMN transport_terminal_text text,
  ADD COLUMN transport_gate_text text;

UPDATE schedule_items
SET item_kind = 'place'
WHERE item_kind IS NULL OR item_kind = '';

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_items_item_kind_check CHECK (item_kind IN ('place', 'non_place')),
  ADD CONSTRAINT schedule_items_non_place_category_check CHECK (non_place_category IS NULL OR non_place_category IN ('transport', 'rest', 'memo', 'reminder')),
  ADD CONSTRAINT schedule_items_transport_mode_check CHECK (transport_mode IS NULL OR transport_mode IN ('flight', 'train', 'bus', 'ferry', 'other')),
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
  ),
  ADD CONSTRAINT schedule_items_transport_fields_check CHECK (
    item_kind = 'place'
    OR (
      non_place_category = 'transport'
      AND transport_mode IS NOT NULL
    )
    OR (
      non_place_category IN ('rest', 'memo', 'reminder')
      AND transport_mode IS NULL
      AND transport_reference_number IS NULL
      AND transport_booking_reference IS NULL
      AND transport_origin_text IS NULL
      AND transport_destination_text IS NULL
      AND transport_terminal_text IS NULL
      AND transport_gate_text IS NULL
    )
  );

-- +goose Down
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_fields_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_mode_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_non_place_category_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_item_kind_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_trip_place_fk;

DELETE FROM schedule_items
WHERE item_kind = 'non_place';

ALTER TABLE schedule_items
  ALTER COLUMN trip_place_id SET NOT NULL,
  DROP COLUMN IF EXISTS transport_gate_text,
  DROP COLUMN IF EXISTS transport_terminal_text,
  DROP COLUMN IF EXISTS transport_destination_text,
  DROP COLUMN IF EXISTS transport_origin_text,
  DROP COLUMN IF EXISTS transport_booking_reference,
  DROP COLUMN IF EXISTS transport_reference_number,
  DROP COLUMN IF EXISTS transport_mode,
  DROP COLUMN IF EXISTS non_place_link,
  DROP COLUMN IF EXISTS non_place_memo,
  DROP COLUMN IF EXISTS non_place_title,
  DROP COLUMN IF EXISTS non_place_category,
  DROP COLUMN IF EXISTS item_kind;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE RESTRICT;
