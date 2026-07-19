-- +goose Up
ALTER TABLE expenses
  ADD CONSTRAINT expenses_id_trip_unique UNIQUE (id, trip_id);

ALTER TABLE storage_object_deletion_jobs
  DROP CONSTRAINT IF EXISTS storage_object_deletion_jobs_reason_check;

ALTER TABLE storage_object_deletion_jobs
  ADD CONSTRAINT storage_object_deletion_jobs_reason_check CHECK (
    reason IN (
      'replace',
      'delete',
      'participant_removed',
      'trip_deleted',
      'orphaned_upload',
      'receipt_draft_cancelled',
      'receipt_draft_expired',
      'receipt_replaced',
      'receipt_deleted',
      'expense_deleted'
    )
  );

CREATE TABLE expense_receipt_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  capture_mode text NOT NULL,
  objects_json jsonb NOT NULL,
  image_count integer NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  uploaded_at timestamptz NOT NULL,
  extraction_json jsonb NOT NULL,
  confidence text NOT NULL,
  warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'draft',
  expires_at timestamptz NOT NULL,
  used_expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_receipt_drafts_capture_mode_check CHECK (capture_mode IN ('single', 'split')),
  CONSTRAINT expense_receipt_drafts_content_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT expense_receipt_drafts_image_count_check CHECK (image_count BETWEEN 1 AND 2),
  CONSTRAINT expense_receipt_drafts_byte_size_check CHECK (byte_size BETWEEN 1 AND 20971520),
  CONSTRAINT expense_receipt_drafts_objects_array_check CHECK (jsonb_typeof(objects_json) = 'array' AND jsonb_array_length(objects_json) = image_count),
  CONSTRAINT expense_receipt_drafts_confidence_check CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT expense_receipt_drafts_status_check CHECK (status IN ('draft', 'used', 'cancelled', 'expired')),
  CONSTRAINT expense_receipt_drafts_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT expense_receipt_drafts_extraction_object_check CHECK (jsonb_typeof(extraction_json) = 'object'),
  CONSTRAINT expense_receipt_drafts_used_status_check CHECK ((status = 'used') = (used_expense_id IS NOT NULL))
);

CREATE INDEX expense_receipt_drafts_trip_user_status_idx
  ON expense_receipt_drafts (trip_id, created_by_user_id, status, expires_at, id);

CREATE INDEX expense_receipt_drafts_expired_idx
  ON expense_receipt_drafts (expires_at, id)
  WHERE status = 'draft';

CREATE TABLE expense_receipts (
  expense_id uuid PRIMARY KEY,
  trip_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  objects_json jsonb NOT NULL,
  image_count integer NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  uploaded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_receipts_expense_trip_fk FOREIGN KEY (expense_id, trip_id) REFERENCES expenses(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT expense_receipts_content_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT expense_receipts_image_count_check CHECK (image_count BETWEEN 1 AND 2),
  CONSTRAINT expense_receipts_byte_size_check CHECK (byte_size BETWEEN 1 AND 20971520),
  CONSTRAINT expense_receipts_objects_array_check CHECK (jsonb_typeof(objects_json) = 'array' AND jsonb_array_length(objects_json) = image_count)
);

CREATE INDEX expense_receipts_trip_expense_idx ON expense_receipts (trip_id, expense_id);

-- +goose Down
DROP INDEX IF EXISTS expense_receipts_trip_expense_idx;
DROP TABLE IF EXISTS expense_receipts;
DROP INDEX IF EXISTS expense_receipt_drafts_expired_idx;
DROP INDEX IF EXISTS expense_receipt_drafts_trip_user_status_idx;
DROP TABLE IF EXISTS expense_receipt_drafts;

DELETE FROM storage_object_deletion_jobs
WHERE reason IN ('receipt_draft_cancelled', 'receipt_draft_expired', 'receipt_replaced', 'receipt_deleted', 'expense_deleted');

ALTER TABLE storage_object_deletion_jobs
  DROP CONSTRAINT IF EXISTS storage_object_deletion_jobs_reason_check;

ALTER TABLE storage_object_deletion_jobs
  ADD CONSTRAINT storage_object_deletion_jobs_reason_check CHECK (reason IN ('replace', 'delete', 'participant_removed', 'trip_deleted', 'orphaned_upload'));

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_id_trip_unique;
