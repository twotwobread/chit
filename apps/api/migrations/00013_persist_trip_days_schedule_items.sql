-- +goose Up
CREATE TABLE trip_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_order integer NOT NULL,
  lodging_trip_place_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_days_day_order_check CHECK (day_order >= 1),
  CONSTRAINT trip_days_trip_date_unique UNIQUE (trip_id, date),
  CONSTRAINT trip_days_id_trip_unique UNIQUE (id, trip_id),
  CONSTRAINT trip_days_lodging_trip_place_fk
    FOREIGN KEY (lodging_trip_place_id, trip_id)
    REFERENCES trip_places(id, trip_id)
    ON DELETE SET NULL (lodging_trip_place_id)
);

INSERT INTO trip_days (trip_id, date, day_order)
SELECT
  trip_id,
  day::date AS date,
  row_number() OVER (PARTITION BY trip_id ORDER BY day::date)::integer AS day_order
FROM (
  SELECT t.id AS trip_id, generate_series(t.start_date, t.end_date, interval '1 day') AS day
  FROM trips t
) days
ON CONFLICT (trip_id, date) DO NOTHING;

WITH legacy_dates AS (
  SELECT trip_id, scheduled_date AS date FROM itinerary_items
  UNION
  SELECT trip_id, scheduled_date AS date FROM expenses
  UNION
  SELECT trip_id, lodging_date AS date FROM day_lodging_places
), missing AS (
  SELECT legacy_dates.trip_id, legacy_dates.date
  FROM legacy_dates
  LEFT JOIN trip_days td
    ON td.trip_id = legacy_dates.trip_id
   AND td.date = legacy_dates.date
  WHERE td.id IS NULL
), numbered AS (
  SELECT
    trip_id,
    date,
    row_number() OVER (PARTITION BY trip_id ORDER BY date)::integer AS day_order
  FROM missing
)
INSERT INTO trip_days (trip_id, date, day_order, deleted_at)
SELECT trip_id, date, day_order, now()
FROM numbered
ON CONFLICT (trip_id, date) DO NOTHING;

UPDATE trip_days td
SET lodging_trip_place_id = dlp.trip_place_id,
    updated_at = now()
FROM day_lodging_places dlp
WHERE dlp.trip_id = td.trip_id
  AND dlp.lodging_date = td.date
  AND td.deleted_at IS NULL;

ALTER TABLE itinerary_items RENAME TO schedule_items;

DROP INDEX IF EXISTS itinerary_items_trip_date_rank_idx;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_trip_date_order_unique;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_trip_date_rank_unique;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_trip_place_fk;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_item_order_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_version_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS itinerary_items_arrived_skipped_exclusive;

ALTER TABLE schedule_items ADD COLUMN trip_day_id uuid;
ALTER TABLE schedule_items ADD COLUMN deleted_at timestamptz;

UPDATE schedule_items si
SET trip_day_id = td.id
FROM trip_days td
WHERE td.trip_id = si.trip_id
  AND td.date = si.scheduled_date;

ALTER TABLE schedule_items ALTER COLUMN trip_day_id SET NOT NULL;
ALTER TABLE schedule_items DROP COLUMN scheduled_date;

ALTER TABLE schedule_items
  ADD CONSTRAINT schedule_items_item_order_check CHECK (item_order >= 1),
  ADD CONSTRAINT schedule_items_version_check CHECK (version >= 1),
  ADD CONSTRAINT schedule_items_arrived_skipped_exclusive CHECK (arrived_at IS NULL OR skipped_at IS NULL),
  ADD CONSTRAINT schedule_items_trip_day_fk FOREIGN KEY (trip_day_id, trip_id) REFERENCES trip_days(id, trip_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE RESTRICT,
  ADD CONSTRAINT schedule_items_id_day_trip_unique UNIQUE (id, trip_day_id, trip_id);

CREATE UNIQUE INDEX schedule_items_active_day_order_unique
  ON schedule_items (trip_day_id, item_order)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX schedule_items_active_day_rank_unique
  ON schedule_items (trip_day_id, rank)
  WHERE deleted_at IS NULL;

CREATE INDEX schedule_items_trip_day_rank_idx
  ON schedule_items (trip_day_id, rank)
  WHERE deleted_at IS NULL;

CREATE INDEX schedule_items_trip_place_idx
  ON schedule_items (trip_id, trip_place_id)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS expenses_trip_date_created_idx;
DROP INDEX IF EXISTS expenses_trip_itinerary_item_idx;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_itinerary_item_id_fkey;
ALTER TABLE expenses RENAME COLUMN scheduled_date TO expense_date;
ALTER TABLE expenses RENAME COLUMN itinerary_item_id TO schedule_item_id;
ALTER TABLE expenses ADD COLUMN anchor_type text;
ALTER TABLE expenses ADD COLUMN trip_day_id uuid;

UPDATE expenses e
SET
  trip_day_id = CASE
    WHEN td.deleted_at IS NULL THEN td.id
    ELSE NULL
  END,
  anchor_type = CASE
    WHEN td.deleted_at IS NULL THEN 'trip_day'
    ELSE 'trip'
  END
FROM trip_days td
WHERE td.trip_id = e.trip_id
  AND td.date = e.expense_date;

UPDATE expenses e
SET anchor_type = 'schedule_item'
FROM schedule_items si
WHERE si.id = e.schedule_item_id
  AND si.trip_id = e.trip_id
  AND si.trip_day_id = e.trip_day_id
  AND si.deleted_at IS NULL
  AND e.trip_day_id IS NOT NULL;

UPDATE expenses
SET anchor_type = 'trip',
    trip_day_id = NULL,
    schedule_item_id = NULL
WHERE anchor_type IS NULL;

UPDATE expenses
SET schedule_item_id = NULL
WHERE anchor_type <> 'schedule_item';

ALTER TABLE expenses ALTER COLUMN anchor_type SET NOT NULL;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_anchor_type_check CHECK (anchor_type IN ('trip', 'trip_day', 'schedule_item')),
  ADD CONSTRAINT expenses_anchor_columns_check CHECK (
    (anchor_type = 'trip' AND trip_day_id IS NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'trip_day' AND trip_day_id IS NOT NULL AND schedule_item_id IS NULL)
    OR (anchor_type = 'schedule_item' AND trip_day_id IS NOT NULL AND schedule_item_id IS NOT NULL)
  ),
  ADD CONSTRAINT expenses_trip_day_fk FOREIGN KEY (trip_day_id, trip_id) REFERENCES trip_days(id, trip_id) ON DELETE RESTRICT,
  ADD CONSTRAINT expenses_schedule_item_fk FOREIGN KEY (schedule_item_id, trip_day_id, trip_id) REFERENCES schedule_items(id, trip_day_id, trip_id) ON DELETE RESTRICT;

CREATE INDEX expenses_trip_anchor_date_created_idx ON expenses (trip_id, anchor_type, expense_date DESC, created_at DESC);
CREATE INDEX expenses_trip_day_created_idx ON expenses (trip_id, trip_day_id, created_at DESC) WHERE trip_day_id IS NOT NULL;
CREATE INDEX expenses_trip_schedule_item_idx ON expenses (trip_id, schedule_item_id) WHERE schedule_item_id IS NOT NULL;

CREATE UNIQUE INDEX trip_days_active_order_unique
  ON trip_days (trip_id, day_order)
  WHERE deleted_at IS NULL;

CREATE INDEX trip_days_trip_active_date_idx
  ON trip_days (trip_id, date)
  WHERE deleted_at IS NULL;

DROP TABLE day_lodging_places;

-- +goose Down
CREATE TABLE day_lodging_places (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lodging_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, lodging_date),
  CONSTRAINT day_lodging_places_trip_place_fk
    FOREIGN KEY (trip_place_id, trip_id)
    REFERENCES trip_places(id, trip_id)
    ON DELETE CASCADE
);

INSERT INTO day_lodging_places (trip_id, lodging_date, trip_place_id)
SELECT trip_id, date, lodging_trip_place_id
FROM trip_days
WHERE lodging_trip_place_id IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (trip_id, lodging_date) DO NOTHING;

CREATE INDEX day_lodging_places_trip_place_id_idx
  ON day_lodging_places (trip_place_id);

DROP INDEX IF EXISTS expenses_trip_schedule_item_idx;
DROP INDEX IF EXISTS expenses_trip_day_created_idx;
DROP INDEX IF EXISTS expenses_trip_anchor_date_created_idx;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_schedule_item_fk;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_trip_day_fk;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_anchor_columns_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_anchor_type_check;
ALTER TABLE expenses RENAME COLUMN expense_date TO scheduled_date;
ALTER TABLE expenses RENAME COLUMN schedule_item_id TO itinerary_item_id;
ALTER TABLE expenses DROP COLUMN IF EXISTS trip_day_id;
ALTER TABLE expenses DROP COLUMN IF EXISTS anchor_type;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_itinerary_item_id_fkey FOREIGN KEY (itinerary_item_id) REFERENCES schedule_items(id) ON DELETE SET NULL;
CREATE INDEX expenses_trip_date_created_idx ON expenses (trip_id, scheduled_date, created_at DESC);
CREATE INDEX expenses_trip_itinerary_item_idx ON expenses (trip_id, itinerary_item_id) WHERE itinerary_item_id IS NOT NULL;

DROP INDEX IF EXISTS trip_days_trip_active_date_idx;
DROP INDEX IF EXISTS trip_days_active_order_unique;
DROP INDEX IF EXISTS schedule_items_trip_place_idx;
DROP INDEX IF EXISTS schedule_items_trip_day_rank_idx;
DROP INDEX IF EXISTS schedule_items_active_day_rank_unique;
DROP INDEX IF EXISTS schedule_items_active_day_order_unique;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_id_day_trip_unique;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_trip_place_fk;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_trip_day_fk;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_arrived_skipped_exclusive;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_version_check;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_item_order_check;
ALTER TABLE schedule_items ADD COLUMN scheduled_date date;
UPDATE schedule_items si
SET scheduled_date = td.date
FROM trip_days td
WHERE td.id = si.trip_day_id;
ALTER TABLE schedule_items ALTER COLUMN scheduled_date SET NOT NULL;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS trip_day_id;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE schedule_items
  ADD CONSTRAINT itinerary_items_item_order_check CHECK (item_order >= 1),
  ADD CONSTRAINT itinerary_items_version_check CHECK (version >= 1),
  ADD CONSTRAINT itinerary_items_arrived_skipped_exclusive CHECK (arrived_at IS NULL OR skipped_at IS NULL),
  ADD CONSTRAINT itinerary_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE CASCADE,
  ADD CONSTRAINT itinerary_items_trip_date_order_unique UNIQUE (trip_id, scheduled_date, item_order),
  ADD CONSTRAINT itinerary_items_trip_date_rank_unique UNIQUE (trip_id, scheduled_date, rank);
CREATE INDEX itinerary_items_trip_date_rank_idx ON schedule_items (trip_id, scheduled_date, rank);
ALTER TABLE schedule_items RENAME TO itinerary_items;

DROP TABLE trip_days;
