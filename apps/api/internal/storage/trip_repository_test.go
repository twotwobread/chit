package storage

import (
	"context"
	"fmt"
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
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank, version)
		VALUES
		  ($1::uuid, '2026-07-11', $3::uuid, 2, '0000000000000002048', 2),
		  ($1::uuid, '2026-07-11', $2::uuid, 1, '0000000000000001024', 5),
		  ($1::uuid, '2026-07-12', $4::uuid, 1, '0000000000000001024', 1)
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
	if items[0].ItemOrder != 1 || items[0].Version != 5 || items[0].Place.Name != "우메다 공중정원" || items[0].Place.PlaceType != "sights" || items[0].Place.Address != "Umeda" {
		t.Fatalf("unexpected first item mapping: %#v", items[0])
	}
	if items[1].ItemOrder != 2 || items[1].Version != 2 || items[1].Place.Name != "도톤보리" || items[1].Place.PlaceType != "food" || items[1].Place.Address != "Dotonbori" {
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
	if first.ItemOrder != 1 || first.Version != 1 || first.Place.Name != "우메다 공중정원" || first.Place.PlaceType != "sights" || first.Place.Address != "Umeda" {
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
	if second.ItemOrder != 2 || second.Version != 1 {
		t.Fatalf("expected duplicate item to append at order 2 with version 1, got %#v", second)
	}

	items, err := store.ListItineraryItemsByTripAndDate(ctx, tripID, "2026-07-11")
	if err != nil {
		t.Fatalf("list created itinerary items: %v", err)
	}
	if len(items) != 2 || items[0].ItemOrder != 1 || items[1].ItemOrder != 2 {
		t.Fatalf("expected two appended items, got %#v", items)
	}

	var firstRank string
	var firstVersion int
	if err := store.pool.QueryRow(ctx, `
		SELECT rank, version
		FROM itinerary_items
		WHERE id = $1::uuid
	`, first.ID).Scan(&firstRank, &firstVersion); err != nil {
		t.Fatalf("load first item rank/version: %v", err)
	}
	if firstVersion != 1 {
		t.Fatalf("expected first item version 1, got %d", firstVersion)
	}

	var secondRank string
	var secondVersion int
	if err := store.pool.QueryRow(ctx, `
		SELECT rank, version
		FROM itinerary_items
		WHERE id = $1::uuid
	`, second.ID).Scan(&secondRank, &secondVersion); err != nil {
		t.Fatalf("load second item rank/version: %v", err)
	}
	if secondVersion != 1 {
		t.Fatalf("expected second item version 1, got %d", secondVersion)
	}
	if secondRank <= firstRank {
		t.Fatalf("expected appended item rank after previous rank, got first=%q second=%q", firstRank, secondRank)
	}

	var placeCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE trip_id = $1::uuid`, tripID).Scan(&placeCount); err != nil {
		t.Fatalf("count trip places: %v", err)
	}
	if placeCount != 2 {
		t.Fatalf("expected duplicate manual additions to create separate places, got %d", placeCount)
	}
}

func TestReorderDayItineraryItemsAppliesMovesSequentiallyAndReturnsLatestOrder(t *testing.T) {
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
		VALUES ('순서 변경 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('순서 변경 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	placeNames := []string{"우메다 공중정원", "도톤보리", "오사카성", "츠텐카쿠"}
	itemIDs := make([]string, 0, len(placeNames))
	for index, placeName := range placeNames {
		var placeID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO trip_places (trip_id, name, address, place_type)
			VALUES ($1::uuid, $2, $3, 'sights')
			RETURNING id::text
		`, tripID, placeName, placeName+" 주소").Scan(&placeID); err != nil {
			t.Fatalf("insert trip place %d: %v", index, err)
		}

		var itemID string
		rank := 1024 * (index + 1)
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank, version)
			VALUES ($1::uuid, '2026-07-11', $2::uuid, $3, lpad($4::int::text, 19, '0'), 1)
			RETURNING id::text
		`, tripID, placeID, index+1, rank).Scan(&itemID); err != nil {
			t.Fatalf("insert itinerary item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
	}

	reordered, err := store.ReorderDayItineraryItems(ctx, trip.ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Moves: []trip.ReorderDayItineraryMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
			{ItemID: itemIDs[1], BeforeItemID: stringPtr(itemIDs[2]), ClientVersion: 1},
		},
	})
	if err != nil {
		t.Fatalf("reorder day itinerary items: %v", err)
	}

	if len(reordered) != 4 {
		t.Fatalf("expected four reordered items, got %#v", reordered)
	}

	wantOrder := []string{itemIDs[0], itemIDs[3], itemIDs[2], itemIDs[1]}
	for index, wantID := range wantOrder {
		if reordered[index].ID != wantID {
			t.Fatalf("expected reordered item %d to be %q, got %#v", index, wantID, reordered)
		}
		if reordered[index].ItemOrder != index+1 {
			t.Fatalf("expected display order %d, got %#v", index+1, reordered[index])
		}
	}
	if reordered[1].Version != 2 || reordered[3].Version != 2 {
		t.Fatalf("expected moved items to increment version, got %#v", reordered)
	}
	if reordered[0].Version != 1 || reordered[2].Version != 1 {
		t.Fatalf("expected unmoved items to keep version, got %#v", reordered)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = '2026-07-11'
		ORDER BY rank ASC, id ASC
	`, tripID)
	if err != nil {
		t.Fatalf("query persisted order: %v", err)
	}
	defer rows.Close()

	persistedOrder := make([]string, 0, 4)
	persistedVersions := map[string]int{}
	for rows.Next() {
		var itemID string
		var version int
		if err := rows.Scan(&itemID, &version); err != nil {
			t.Fatalf("scan persisted row: %v", err)
		}
		persistedOrder = append(persistedOrder, itemID)
		persistedVersions[itemID] = version
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted rows: %v", err)
	}

	for index, wantID := range wantOrder {
		if persistedOrder[index] != wantID {
			t.Fatalf("expected persisted item %d to be %q, got %#v", index, wantID, persistedOrder)
		}
	}
	if persistedVersions[itemIDs[3]] != 2 || persistedVersions[itemIDs[1]] != 2 {
		t.Fatalf("expected persisted moved versions to increment, got %#v", persistedVersions)
	}
}

func TestReorderDayItineraryItemsRejectsStaleMovedItemVersionWithoutChangingData(t *testing.T) {
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
		VALUES ('순서 변경 stale moved version 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('순서 변경 stale moved version 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	placeNames := []string{"우메다 공중정원", "도톤보리", "오사카성"}
	ranks := []string{
		"0000000000000001024",
		"0000000000000002048",
		"0000000000000003072",
	}
	versions := []int{2, 1, 1}
	itemIDs := make([]string, 0, len(placeNames))
	initialRanks := map[string]string{}
	initialVersions := map[string]int{}
	for index, placeName := range placeNames {
		var placeID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO trip_places (trip_id, name, address, place_type)
			VALUES ($1::uuid, $2, $3, 'sights')
			RETURNING id::text
		`, tripID, placeName, placeName+" 주소").Scan(&placeID); err != nil {
			t.Fatalf("insert trip place %d: %v", index, err)
		}

		var itemID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank, version)
			VALUES ($1::uuid, '2026-07-11', $2::uuid, $3, $4, $5)
			RETURNING id::text
		`, tripID, placeID, index+1, ranks[index], versions[index]).Scan(&itemID); err != nil {
			t.Fatalf("insert itinerary item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = ranks[index]
		initialVersions[itemID] = versions[index]
	}

	_, err = store.ReorderDayItineraryItems(ctx, trip.ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Moves: []trip.ReorderDayItineraryMoveRecord{{
			ItemID:        itemIDs[0],
			AfterItemID:   stringPtr(itemIDs[1]),
			ClientVersion: 1,
		}},
	})
	if err != trip.ErrConflict {
		t.Fatalf("expected conflict from stale moved item version, got %v", err)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = '2026-07-11'
		ORDER BY rank ASC, id ASC
	`, tripID)
	if err != nil {
		t.Fatalf("query persisted rows after stale version conflict: %v", err)
	}
	defer rows.Close()

	persistedOrder := make([]string, 0, len(itemIDs))
	persistedRanks := map[string]string{}
	persistedVersions := map[string]int{}
	for rows.Next() {
		var itemID string
		var rank string
		var version int
		if err := rows.Scan(&itemID, &rank, &version); err != nil {
			t.Fatalf("scan persisted row after stale version conflict: %v", err)
		}
		persistedOrder = append(persistedOrder, itemID)
		persistedRanks[itemID] = rank
		persistedVersions[itemID] = version
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted rows after stale version conflict: %v", err)
	}

	for index, wantID := range itemIDs {
		if persistedOrder[index] != wantID {
			t.Fatalf("expected stale version conflict to preserve original order at %d, got %#v", index, persistedOrder)
		}
		if persistedRanks[wantID] != initialRanks[wantID] {
			t.Fatalf("expected stale version conflict to preserve original rank for %q, got %q want %q", wantID, persistedRanks[wantID], initialRanks[wantID])
		}
		if persistedVersions[wantID] != initialVersions[wantID] {
			t.Fatalf("expected stale version conflict to preserve original version for %q, got %d want %d", wantID, persistedVersions[wantID], initialVersions[wantID])
		}
	}
}

func TestReorderDayItineraryItemsRollsBackEarlierMovesWhenLaterMoveFails(t *testing.T) {
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
		VALUES ('순서 변경 롤백 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('순서 변경 롤백 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	placeNames := []string{"우메다 공중정원", "도톤보리", "오사카성", "츠텐카쿠"}
	ranks := []string{
		"0000000000000001024",
		"0000000000000002048",
		"0000000000000003072",
		"0000000000000004096",
	}
	itemIDs := make([]string, 0, len(placeNames))
	initialRanks := map[string]string{}
	for index, placeName := range placeNames {
		var placeID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO trip_places (trip_id, name, address, place_type)
			VALUES ($1::uuid, $2, $3, 'sights')
			RETURNING id::text
		`, tripID, placeName, placeName+" 주소").Scan(&placeID); err != nil {
			t.Fatalf("insert trip place %d: %v", index, err)
		}

		var itemID string
		rank := ranks[index]
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank, version)
			VALUES ($1::uuid, '2026-07-11', $2::uuid, $3, $4, 1)
			RETURNING id::text
		`, tripID, placeID, index+1, rank).Scan(&itemID); err != nil {
			t.Fatalf("insert itinerary item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = rank
	}

	_, err = store.ReorderDayItineraryItems(ctx, trip.ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Moves: []trip.ReorderDayItineraryMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[2]), ClientVersion: 1},
		},
	})
	if err != trip.ErrConflict {
		t.Fatalf("expected conflict from stale second move, got %v", err)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = '2026-07-11'
		ORDER BY rank ASC, id ASC
	`, tripID)
	if err != nil {
		t.Fatalf("query persisted order after rollback: %v", err)
	}
	defer rows.Close()

	persistedOrder := make([]string, 0, 4)
	persistedRanks := map[string]string{}
	persistedVersions := map[string]int{}
	for rows.Next() {
		var itemID string
		var rank string
		var version int
		if err := rows.Scan(&itemID, &rank, &version); err != nil {
			t.Fatalf("scan persisted row after rollback: %v", err)
		}
		persistedOrder = append(persistedOrder, itemID)
		persistedRanks[itemID] = rank
		persistedVersions[itemID] = version
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted rows after rollback: %v", err)
	}

	for index, wantID := range itemIDs {
		if persistedOrder[index] != wantID {
			t.Fatalf("expected rollback to preserve original order at %d, got %#v", index, persistedOrder)
		}
		if persistedRanks[wantID] != initialRanks[wantID] {
			t.Fatalf("expected rollback to preserve original rank for %q, got %q want %q", wantID, persistedRanks[wantID], initialRanks[wantID])
		}
		if persistedVersions[wantID] != 1 {
			t.Fatalf("expected rollback to preserve original version for %q, got %d", wantID, persistedVersions[wantID])
		}
	}
}

func TestReorderDayItineraryItemsRetriesOnceAfterRankUniqueCollision(t *testing.T) {
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

	tripID, itemIDs, _ := createReorderDayItineraryFixture(t, ctx, store, "순서 변경 충돌 재시도 테스트")
	installForcedReorderRankCollision(t, ctx, store, itemIDs[3], 1)

	reordered, err := store.ReorderDayItineraryItems(ctx, trip.ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Moves: []trip.ReorderDayItineraryMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
		},
	})
	if err != nil {
		t.Fatalf("expected retry to succeed after rank collision, got %v", err)
	}

	wantOrder := []string{itemIDs[0], itemIDs[3], itemIDs[1], itemIDs[2]}
	for index, wantID := range wantOrder {
		if reordered[index].ID != wantID {
			t.Fatalf("expected reordered item %d to be %q, got %#v", index, wantID, reordered)
		}
	}
	if reordered[1].Version != 2 {
		t.Fatalf("expected moved item version to increment once after retry, got %#v", reordered[1])
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = '2026-07-11'
		ORDER BY rank ASC, id ASC
	`, tripID)
	if err != nil {
		t.Fatalf("query persisted order after retry: %v", err)
	}
	defer rows.Close()

	persistedOrder := make([]string, 0, 4)
	persistedVersions := map[string]int{}
	for rows.Next() {
		var itemID string
		var version int
		if err := rows.Scan(&itemID, &version); err != nil {
			t.Fatalf("scan persisted row after retry: %v", err)
		}
		persistedOrder = append(persistedOrder, itemID)
		persistedVersions[itemID] = version
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted rows after retry: %v", err)
	}

	for index, wantID := range wantOrder {
		if persistedOrder[index] != wantID {
			t.Fatalf("expected persisted item %d to be %q, got %#v", index, wantID, persistedOrder)
		}
	}
	if persistedVersions[itemIDs[3]] != 2 {
		t.Fatalf("expected moved item persisted version 2 after retry, got %#v", persistedVersions)
	}
}

func TestReorderDayItineraryItemsReturnsConflictWhenRankUniqueRetryStillCollides(t *testing.T) {
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

	tripID, itemIDs, initialRanks := createReorderDayItineraryFixture(t, ctx, store, "순서 변경 충돌 실패 테스트")
	installForcedReorderRankCollision(t, ctx, store, itemIDs[3], 2)

	_, err = store.ReorderDayItineraryItems(ctx, trip.ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: "2026-07-11",
		Moves: []trip.ReorderDayItineraryMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
		},
	})
	if err != trip.ErrConflict {
		t.Fatalf("expected conflict after retry failure, got %v", err)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = '2026-07-11'
		ORDER BY rank ASC, id ASC
	`, tripID)
	if err != nil {
		t.Fatalf("query persisted order after retry failure: %v", err)
	}
	defer rows.Close()

	persistedOrder := make([]string, 0, 4)
	persistedRanks := map[string]string{}
	persistedVersions := map[string]int{}
	for rows.Next() {
		var itemID string
		var rank string
		var version int
		if err := rows.Scan(&itemID, &rank, &version); err != nil {
			t.Fatalf("scan persisted row after retry failure: %v", err)
		}
		persistedOrder = append(persistedOrder, itemID)
		persistedRanks[itemID] = rank
		persistedVersions[itemID] = version
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted rows after retry failure: %v", err)
	}

	for index, wantID := range itemIDs {
		if persistedOrder[index] != wantID {
			t.Fatalf("expected persisted order to remain unchanged at %d, got %#v", index, persistedOrder)
		}
		if persistedRanks[wantID] != initialRanks[wantID] {
			t.Fatalf("expected original rank for %q, got %q want %q", wantID, persistedRanks[wantID], initialRanks[wantID])
		}
		if persistedVersions[wantID] != 1 {
			t.Fatalf("expected original version for %q, got %d", wantID, persistedVersions[wantID])
		}
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
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 1, '0000000000000001024')
		RETURNING id::text
	`, tripID, placeID).Scan(&firstItemID); err != nil {
		t.Fatalf("insert first itinerary item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank)
		VALUES ($1::uuid, '2026-07-12', $2::uuid, 1, '0000000000000001024')
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
	if updated.ID != firstItemID || updated.ItemOrder != 1 || updated.Version != 1 || updated.Place.ID != placeID || updated.Place.Name != "우메다 스카이빌딩" || updated.Place.Address != "Umeda Sky Building" || updated.Place.PlaceType != "food" {
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
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 1, '0000000000000001024')
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&firstSharedItemID); err != nil {
		t.Fatalf("insert first shared item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank)
		VALUES ($1::uuid, '2026-07-12', $2::uuid, 1, '0000000000000001024')
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
		INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank)
		VALUES ($1::uuid, '2026-07-11', $2::uuid, 2, '0000000000000002048')
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

func stringPtr(value string) *string {
	return &value
}

func createReorderDayItineraryFixture(t *testing.T, ctx context.Context, store *Store, label string) (string, []string, map[string]string) {
	t.Helper()

	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ($1)
		RETURNING id::text
	`, label).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	t.Cleanup(func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) })

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ($1, '2026-07-10', '2026-07-13', 'JPY', $2::uuid)
		RETURNING id::text
	`, label+" 여행", userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	placeNames := []string{"우메다 공중정원", "도톤보리", "오사카성", "츠텐카쿠"}
	ranks := []string{
		"0000000000000001024",
		"0000000000000002048",
		"0000000000000003072",
		"0000000000000004096",
	}
	itemIDs := make([]string, 0, len(placeNames))
	initialRanks := map[string]string{}
	for index, placeName := range placeNames {
		var placeID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO trip_places (trip_id, name, address, place_type)
			VALUES ($1::uuid, $2, $3, 'sights')
			RETURNING id::text
		`, tripID, placeName, placeName+" 주소").Scan(&placeID); err != nil {
			t.Fatalf("insert trip place %d: %v", index, err)
		}

		var itemID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order, rank, version)
			VALUES ($1::uuid, '2026-07-11', $2::uuid, $3, $4, 1)
			RETURNING id::text
		`, tripID, placeID, index+1, ranks[index]).Scan(&itemID); err != nil {
			t.Fatalf("insert itinerary item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = ranks[index]
	}

	return tripID, itemIDs, initialRanks
}

func installForcedReorderRankCollision(t *testing.T, ctx context.Context, store *Store, itemID string, collisionCount int) {
	t.Helper()

	cleanup := `
		DROP TRIGGER IF EXISTS reorder_rank_collision_trigger ON itinerary_items;
		DROP FUNCTION IF EXISTS reorder_rank_collision();
		DROP SEQUENCE IF EXISTS reorder_rank_collision_seq;
	`
	if _, err := store.pool.Exec(ctx, cleanup); err != nil {
		t.Fatalf("cleanup reorder collision trigger: %v", err)
	}

	setup := fmt.Sprintf(`
		CREATE SEQUENCE reorder_rank_collision_seq START 1;

		CREATE FUNCTION reorder_rank_collision()
		RETURNS trigger
		LANGUAGE plpgsql
		AS $$
		BEGIN
			IF NEW.id = '%s'::uuid
				AND NEW.rank IS DISTINCT FROM OLD.rank
				AND nextval('reorder_rank_collision_seq') <= %d THEN
				RAISE EXCEPTION 'forced rank collision'
					USING ERRCODE = '23505', CONSTRAINT = 'itinerary_items_trip_date_rank_unique';
			END IF;
			RETURN NEW;
		END;
		$$;

		CREATE TRIGGER reorder_rank_collision_trigger
		BEFORE UPDATE ON itinerary_items
		FOR EACH ROW
		EXECUTE FUNCTION reorder_rank_collision();
	`, itemID, collisionCount)
	if _, err := store.pool.Exec(ctx, setup); err != nil {
		t.Fatalf("install reorder collision trigger: %v", err)
	}

	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), cleanup)
	})
}
