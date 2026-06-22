package storage

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestDeleteTripByIDCascadesParticipants(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for storage integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('삭제 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('삭제 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name)
		VALUES ($1::uuid, $2::uuid, 'owner', '삭제 테스트')
	`, tripID, userID); err != nil {
		t.Fatalf("insert trip participant: %v", err)
	}

	deleted, err := store.DeleteTripByID(ctx, tripID)
	if err != nil {
		t.Fatalf("delete trip: %v", err)
	}
	if !deleted {
		t.Fatal("expected trip delete to report true")
	}

	var tripCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trips WHERE id = $1::uuid`, tripID).Scan(&tripCount); err != nil {
		t.Fatalf("count trips: %v", err)
	}
	if tripCount != 0 {
		t.Fatalf("expected trip row to be deleted, got count %d", tripCount)
	}

	var participantCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_participants WHERE trip_id = $1::uuid`, tripID).Scan(&participantCount); err != nil {
		t.Fatalf("count trip participants: %v", err)
	}
	if participantCount != 0 {
		t.Fatalf("expected participant rows to cascade delete, got count %d", participantCount)
	}

	var userCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM users WHERE id = $1::uuid`, userID).Scan(&userCount); err != nil {
		t.Fatalf("count users: %v", err)
	}
	if userCount != 1 {
		t.Fatalf("expected global user row to remain, got count %d", userCount)
	}
}
