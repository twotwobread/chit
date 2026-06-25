-- +goose Up
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL,
  trip_place_id uuid REFERENCES trip_places(id) ON DELETE SET NULL,
  place_name text NOT NULL,
  place_address text NOT NULL,
  place_type text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  payer_participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL,
  payer_display_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_place_name_length_check CHECK (char_length(place_name) BETWEEN 1 AND 120),
  CONSTRAINT expenses_place_address_length_check CHECK (char_length(place_address) BETWEEN 1 AND 240),
  CONSTRAINT expenses_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc')),
  CONSTRAINT expenses_amount_minor_check CHECK (amount_minor > 0),
  CONSTRAINT expenses_currency_check CHECK (currency IN ('KRW', 'JPY', 'USD', 'EUR')),
  CONSTRAINT expenses_payer_display_name_length_check CHECK (char_length(payer_display_name) BETWEEN 1 AND 80)
);

CREATE INDEX expenses_trip_date_created_idx ON expenses (trip_id, scheduled_date, created_at DESC);
CREATE INDEX expenses_trip_itinerary_item_idx ON expenses (trip_id, itinerary_item_id) WHERE itinerary_item_id IS NOT NULL;
CREATE INDEX expenses_trip_place_idx ON expenses (trip_id, trip_place_id) WHERE trip_place_id IS NOT NULL;
CREATE INDEX expenses_payer_participant_idx ON expenses (payer_participant_id) WHERE payer_participant_id IS NOT NULL;

CREATE TABLE expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL,
  participant_display_name text NOT NULL,
  amount_minor bigint NOT NULL,
  split_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_splits_display_name_length_check CHECK (char_length(participant_display_name) BETWEEN 1 AND 80),
  CONSTRAINT expense_splits_amount_minor_check CHECK (amount_minor >= 0),
  CONSTRAINT expense_splits_order_check CHECK (split_order >= 1),
  CONSTRAINT expense_splits_expense_order_unique UNIQUE (expense_id, split_order)
);

CREATE INDEX expense_splits_participant_idx ON expense_splits (participant_id) WHERE participant_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS expense_splits;
DROP TABLE IF EXISTS expenses;
