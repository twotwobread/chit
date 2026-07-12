-- +goose Up
ALTER TABLE trip_places DROP CONSTRAINT IF EXISTS trip_places_place_type_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_place_type_check;

DELETE FROM schedule_items WHERE item_kind = 'non_place';

ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_fields_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_non_place_category_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_transport_mode_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_item_kind_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_place_title_check;

ALTER TABLE schedule_items
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
  ALTER COLUMN trip_place_id SET NOT NULL;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_place_title_check CHECK (place_title IS NOT NULL AND char_length(btrim(place_title)) BETWEEN 1 AND 120),
  ADD CONSTRAINT schedule_items_backing_check CHECK (trip_place_id IS NOT NULL AND place_title IS NOT NULL);

ALTER TABLE trip_places
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'));

ALTER TABLE expenses
  ADD CONSTRAINT expenses_place_type_check CHECK (place_type IS NULL OR place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'transport', 'etc'));

-- +goose Down
ALTER TABLE trip_places DROP CONSTRAINT IF EXISTS trip_places_place_type_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_place_type_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_backing_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_place_title_check;

ALTER TABLE schedule_items
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

ALTER TABLE schedule_items
  ALTER COLUMN trip_place_id DROP NOT NULL;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_place_title_check CHECK ((item_kind <> 'place' OR (place_title IS NOT NULL AND char_length(btrim(place_title)) BETWEEN 1 AND 120))),
  ADD CONSTRAINT schedule_items_item_kind_check CHECK (item_kind IN ('place', 'non_place')),
  ADD CONSTRAINT schedule_items_non_place_category_check CHECK (non_place_category IS NULL OR non_place_category IN ('transport', 'rest', 'memo', 'reminder')),
  ADD CONSTRAINT schedule_items_transport_mode_check CHECK (transport_mode IS NULL OR transport_mode IN ('flight', 'train', 'bus', 'ferry', 'other')),
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
    ) OR (
      item_kind = 'non_place'
      AND trip_place_id IS NULL
      AND place_title IS NULL
      AND place_memo IS NULL
      AND non_place_category IS NOT NULL
      AND non_place_title IS NOT NULL
    )
  ),
  ADD CONSTRAINT schedule_items_transport_fields_check CHECK (
    item_kind = 'place'
    OR (non_place_category = 'transport' AND transport_mode IS NOT NULL)
    OR (non_place_category IN ('rest', 'memo', 'reminder') AND transport_mode IS NULL AND transport_reference_number IS NULL AND transport_booking_reference IS NULL AND transport_origin_text IS NULL AND transport_destination_text IS NULL AND transport_terminal_text IS NULL AND transport_gate_text IS NULL)
  );

ALTER TABLE trip_places
  ADD CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'));

ALTER TABLE expenses
  ADD CONSTRAINT expenses_place_type_check CHECK (place_type IS NULL OR place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'));
