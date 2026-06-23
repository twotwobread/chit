-- +goose Up
ALTER TABLE itinerary_items ADD COLUMN rank text COLLATE "C";
ALTER TABLE itinerary_items ADD COLUMN version integer NOT NULL DEFAULT 1;

WITH ranked_items AS (
  SELECT
    id,
    lpad(
      (row_number() OVER (
        PARTITION BY trip_id, scheduled_date
        ORDER BY item_order ASC, id ASC
      ) * 1024)::text,
      19,
      '0'
    ) AS backfilled_rank
  FROM itinerary_items
)
UPDATE itinerary_items ii
SET rank = ranked_items.backfilled_rank
FROM ranked_items
WHERE ii.id = ranked_items.id;

ALTER TABLE itinerary_items ALTER COLUMN rank SET NOT NULL;
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_version_check CHECK (version >= 1);
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_trip_date_rank_unique UNIQUE (trip_id, scheduled_date, rank);
CREATE INDEX itinerary_items_trip_date_rank_idx ON itinerary_items (trip_id, scheduled_date, rank);

-- +goose Down
WITH reordered_items AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY trip_id, scheduled_date
      ORDER BY rank ASC, id ASC
    ) AS next_item_order,
    max(item_order) OVER (PARTITION BY trip_id, scheduled_date) AS max_item_order
  FROM itinerary_items
)
UPDATE itinerary_items ii
SET item_order = reordered_items.max_item_order + reordered_items.next_item_order
FROM reordered_items
WHERE ii.id = reordered_items.id;

WITH reordered_items AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY trip_id, scheduled_date
      ORDER BY rank ASC, id ASC
    ) AS next_item_order
  FROM itinerary_items
)
UPDATE itinerary_items ii
SET item_order = reordered_items.next_item_order
FROM reordered_items
WHERE ii.id = reordered_items.id;

DROP INDEX IF EXISTS itinerary_items_trip_date_rank_idx;
ALTER TABLE itinerary_items DROP CONSTRAINT IF EXISTS itinerary_items_trip_date_rank_unique;
ALTER TABLE itinerary_items DROP CONSTRAINT IF EXISTS itinerary_items_version_check;
ALTER TABLE itinerary_items DROP COLUMN IF EXISTS version;
ALTER TABLE itinerary_items DROP COLUMN IF EXISTS rank;
