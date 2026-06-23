package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func TestListItineraryItemsByTripAndDateFiltersSortsAndJoinsPlaces(t *testing.T) {
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
		VALUES ('일정 조회 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('일정 조회 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	var firstPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '우메다 공중정원', 'Umeda', 'sights')
		RETURNING id::text
	`, tripID).Scan(&firstPlaceID); err != nil {
		t.Fatalf("insert first trip place: %v", err)
	}
	var secondPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '도톤보리', 'Dotonbori', 'food')
		RETURNING id::text
	`, tripID).Scan(&secondPlaceID); err != nil {
		t.Fatalf("insert second trip place: %v", err)
	}
	var otherDatePlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '오사카성', 'Osaka Castle', 'sights')
		RETURNING id::text
	`, tripID).Scan(&otherDatePlaceID); err != nil {
		t.Fatalf("insert other date place: %v", err)
	}

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES
		  ($1::uuid, '2026-07-11', $3::uuid, 2),
		  ($1::uuid, '2026-07-11', $2::uuid, 1),
		  ($1::uuid, '2026-07-12', $4::uuid, 1)
	`, tripID, firstPlaceID, secondPlaceID, otherDatePlaceID); err != nil {
		t.Fatalf("insert itinerary items: %v", err)
	}

	items, err := store.ListItineraryItemsByTripAndDate(ctx, tripID, "2026-07-11")
	if err != nil {
		t.Fatalf("list itinerary items: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected two filtered items, got %#v", items)
	}
	if items[0].ItemOrder != 1 || items[0].Place.Name != "우메다 공중정원" || items[0].Place.PlaceType != "sights" || items[0].Place.Address != "Umeda" {
		t.Fatalf("unexpected first item mapping: %#v", items[0])
	}
	if items[1].ItemOrder != 2 || items[1].Place.Name != "도톤보리" || items[1].Place.PlaceType != "food" || items[1].Place.Address != "Dotonbori" {
		t.Fatalf("unexpected second item mapping: %#v", items[1])
	}
}

func TestCreateManualDayItineraryItemCreatesPlaceAndAppendsItem(t *testing.T) {
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
		VALUES ('장소 추가 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('장소 추가 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	first, err := store.CreateManualDayItineraryItem(ctx, trip.CreateManualDayItineraryItemRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Name:          "우메다 공중정원",
		Address:       "Umeda",
		PlaceType:     "sights",
	})
	if err != nil {
		t.Fatalf("create first manual item: %v", err)
	}
	if first.ItemOrder != 1 || first.Place.Name != "우메다 공중정원" || first.Place.PlaceType != "sights" || first.Place.Address != "Umeda" {
		t.Fatalf("unexpected first item: %#v", first)
	}

	second, err := store.CreateManualDayItineraryItem(ctx, trip.CreateManualDayItineraryItemRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Name:          "우메다 공중정원",
		Address:       "Umeda",
		PlaceType:     "sights",
	})
	if err != nil {
		t.Fatalf("create duplicate manual item: %v", err)
	}
	if second.ItemOrder != 2 {
		t.Fatalf("expected duplicate item to append at order 2, got %#v", second)
	}

	items, err := store.ListItineraryItemsByTripAndDate(ctx, tripID, "2026-07-11")
	if err != nil {
		t.Fatalf("list created itinerary items: %v", err)
	}
	if len(items) != 2 || items[0].ItemOrder != 1 || items[1].ItemOrder != 2 {
		t.Fatalf("expected two appended items, got %#v", items)
	}

	var placeCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE trip_id = $1::uuid`, tripID).Scan(&placeCount); err != nil {
		t.Fatalf("count trip places: %v", err)
	}
	if placeCount != 2 {
		t.Fatalf("expected duplicate manual additions to create separate places, got %d", placeCount)
	}
}

func TestUpdateDayItineraryItemPlaceUpdatesSharedPlaceSnapshot(t *testing.T) {
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
		VALUES ('장소 수정 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('장소 수정 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	var placeID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '우메다 공중정원', 'Umeda', 'sights')
		RETURNING id::text
	`, tripID).Scan(&placeID); err != nil {
		t.Fatalf("insert trip place: %v", err)
	}

	var firstItemID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 1)
		RETURNING id::text
	`, tripID, placeID).Scan(&firstItemID); err != nil {
		t.Fatalf("insert first itinerary item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES ($1::uuid, '2026-07-12', $2::uuid, 1)
	`, tripID, placeID); err != nil {
		t.Fatalf("insert second itinerary item: %v", err)
	}

	updated, err := store.UpdateDayItineraryItemPlace(ctx, trip.UpdateDayItineraryItemRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		ItemID:        firstItemID,
		Name:          "우메다 스카이빌딩",
		Address:       "Umeda Sky Building",
		PlaceType:     "food",
	})
	if err != nil {
		t.Fatalf("update day itinerary item place: %v", err)
	}
	if updated.ID != firstItemID || updated.ItemOrder != 1 || updated.Place.ID != placeID || updated.Place.Name != "우메다 스카이빌딩" || updated.Place.Address != "Umeda Sky Building" || updated.Place.PlaceType != "food" {
		t.Fatalf("unexpected updated item: %#v", updated)
	}

	otherDayItems, err := store.ListItineraryItemsByTripAndDate(ctx, tripID, "2026-07-12")
	if err != nil {
		t.Fatalf("list other day items: %v", err)
	}
	if len(otherDayItems) != 1 || otherDayItems[0].Place.Name != "우메다 스카이빌딩" || otherDayItems[0].Place.PlaceType != "food" {
		t.Fatalf("expected shared place snapshot to be updated, got %#v", otherDayItems)
	}
}

func TestDeleteDayItineraryItemRemovesSelectedItemAndCleansOrphanPlace(t *testing.T) {
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
		VALUES ('장소 삭제 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('장소 삭제 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	var sharedPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '도톤보리', 'Dotonbori', 'food')
		RETURNING id::text
	`, tripID).Scan(&sharedPlaceID); err != nil {
		t.Fatalf("insert shared trip place: %v", err)
	}
	var firstSharedItemID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 1)
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&firstSharedItemID); err != nil {
		t.Fatalf("insert first shared item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES ($1::uuid, '2026-07-12', $2::uuid, 1)
	`, tripID, sharedPlaceID); err != nil {
		t.Fatalf("insert second shared item: %v", err)
	}

	deleted, err := store.DeleteDayItineraryItem(ctx, tripID, "2026-07-11", firstSharedItemID)
	if err != nil {
		t.Fatalf("delete shared itinerary item: %v", err)
	}
	if !deleted {
		t.Fatal("expected delete to report true")
	}
	var sharedPlaceCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE id = $1::uuid`, sharedPlaceID).Scan(&sharedPlaceCount); err != nil {
		t.Fatalf("count shared place: %v", err)
	}
	if sharedPlaceCount != 1 {
		t.Fatalf("expected shared place to remain, got count %d", sharedPlaceCount)
	}

	var orphanPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '오사카성', 'Osaka Castle', 'sights')
		RETURNING id::text
	`, tripID).Scan(&orphanPlaceID); err != nil {
		t.Fatalf("insert orphan trip place: %v", err)
	}
	var orphanItemID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 2)
		RETURNING id::text
	`, tripID, orphanPlaceID).Scan(&orphanItemID); err != nil {
		t.Fatalf("insert orphan item: %v", err)
	}

	deleted, err = store.DeleteDayItineraryItem(ctx, tripID, "2026-07-11", orphanItemID)
	if err != nil {
		t.Fatalf("delete orphan itinerary item: %v", err)
	}
	if !deleted {
		t.Fatal("expected orphan delete to report true")
	}
	var orphanPlaceCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE id = $1::uuid`, orphanPlaceID).Scan(&orphanPlaceCount); err != nil {
		t.Fatalf("count orphan place: %v", err)
	}
	if orphanPlaceCount != 0 {
		t.Fatalf("expected orphan place to be cleaned up, got count %d", orphanPlaceCount)
	}
}

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
