-- name: GetAppMetadataValue :one
SELECT value
FROM app_metadata
WHERE key = $1;
