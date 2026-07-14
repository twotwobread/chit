package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/twotwobread/i-um/apps/api/internal/place"
)

const defaultEnvPath = "../../.env.stage"

func main() {
	apply := flag.Bool("apply", false, "apply updates; default is dry-run")
	envPath := flag.String("env", defaultEnvPath, "dotenv file path")
	limit := flag.Int("limit", 0, "maximum number of Google-backed places to refresh; 0 means all")
	useDirectURL := flag.Bool("direct", true, "derive direct Neon URL by removing -pooler. from DATABASE_URL")
	flag.Parse()

	if err := run(context.Background(), *envPath, *apply, *limit, *useDirectURL); err != nil {
		fmt.Fprintf(os.Stderr, "localize google places failed: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, envPath string, apply bool, limit int, useDirectURL bool) error {
	values, err := loadDotenvFile(envPath)
	if err != nil {
		return err
	}
	databaseURL := envValue(values, "DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if useDirectURL {
		databaseURL = directDatabaseURL(databaseURL)
	}
	apiKey := envValue(values, "GOOGLE_PLACES_API_KEY")
	if apiKey == "" {
		return errors.New("GOOGLE_PLACES_API_KEY is required")
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return errors.New("open database")
	}
	defer pool.Close()

	store := postgresGooglePlaceSnapshotStore{pool: pool}
	provider := place.NewGoogleProvider(apiKey)
	refreshCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	summary, err := place.RefreshGooglePlaceSnapshots(refreshCtx, store, provider, place.GooglePlaceSnapshotRefreshOptions{Apply: apply, Limit: limit})
	if err != nil {
		return err
	}
	mode := "dry-run"
	if apply {
		mode = "apply"
	}
	fmt.Printf("mode=%s targets=%d refreshed=%d updated=%d failed=%d\n", mode, summary.Targets, summary.Refreshed, summary.Updated, summary.Failed)
	if summary.Failed > 0 {
		return errors.New("one or more places failed to refresh")
	}
	return nil
}

func envValue(values map[string]string, key string) string {
	return strings.TrimSpace(values[key])
}

func loadDotenvFile(path string) (map[string]string, error) {
	values := map[string]string{}
	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return values, nil
	}
	resolvedPath := resolveEnvPath(trimmedPath)
	file, err := os.Open(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("load env file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 {
			if (value[0] == '\'' && value[len(value)-1] == '\'') || (value[0] == '"' && value[len(value)-1] == '"') {
				value = value[1 : len(value)-1]
			}
		}
		values[key] = value
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read env file: %w", err)
	}
	return values, nil
}

func resolveEnvPath(path string) string {
	if _, err := os.Stat(path); err == nil {
		return path
	}
	fileName := filepath.Base(path)
	if fileName == "." || fileName == string(filepath.Separator) {
		return path
	}
	cwd, err := os.Getwd()
	if err != nil {
		return path
	}
	for {
		candidate := filepath.Join(cwd, fileName)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(cwd)
		if parent == cwd {
			break
		}
		cwd = parent
	}
	return path
}

func directDatabaseURL(value string) string {
	return strings.Replace(value, "-pooler.", ".", 1)
}

type postgresGooglePlaceSnapshotStore struct {
	pool *pgxpool.Pool
}

func (s postgresGooglePlaceSnapshotStore) ListGooglePlaceSnapshotRefreshTargets(ctx context.Context, limit int) ([]place.GooglePlaceSnapshotRefreshTarget, error) {
	query := `
SELECT id::text, google_place_id
FROM trip_places
WHERE provider = 'google'
  AND google_place_id IS NOT NULL
ORDER BY created_at, id`
	args := []interface{}{}
	if limit > 0 {
		query += "\nLIMIT $1"
		args = append(args, limit)
	}
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	targets := []place.GooglePlaceSnapshotRefreshTarget{}
	for rows.Next() {
		var target place.GooglePlaceSnapshotRefreshTarget
		if err := rows.Scan(&target.ID, &target.GooglePlaceID); err != nil {
			return nil, err
		}
		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return targets, nil
}

func (s postgresGooglePlaceSnapshotStore) UpdateGooglePlaceSnapshot(ctx context.Context, update place.GooglePlaceSnapshotUpdate) error {
	_, err := s.pool.Exec(ctx, `
UPDATE trip_places
SET name = $2,
    address = $3,
    place_type = $4,
    latitude = $5,
    longitude = $6,
    google_primary_type = $7,
    google_types = $8,
    updated_at = now()
WHERE id = $1::uuid
  AND provider = 'google'`,
		update.ID,
		update.Snapshot.DisplayName,
		update.Snapshot.FormattedAddress,
		update.PlaceType,
		update.Snapshot.Latitude,
		update.Snapshot.Longitude,
		update.Snapshot.PrimaryType,
		update.Snapshot.Types,
	)
	return err
}
