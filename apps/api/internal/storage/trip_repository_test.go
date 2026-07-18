package storage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func TestListScheduleItemsByTripDayFiltersSortsAndJoinsPlaces(t *testing.T) {
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
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $3::uuid, '장소 일정', 2, '0000000000000002048', 2),
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024', 5),
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-12'), $4::uuid, '장소 일정', 1, '0000000000000001024', 1)
	`, tripID, firstPlaceID, secondPlaceID, otherDatePlaceID); err != nil {
		t.Fatalf("insert schedule items: %v", err)
	}

	items, err := store.ListScheduleItemsByTripDay(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"))
	if err != nil {
		t.Fatalf("list schedule items: %v", err)
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

func TestTripSettlementInputUsesLiveAndFallbackParticipantSnapshots(t *testing.T) {
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

	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('민수') RETURNING id::text`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	var memberUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('지영') RETURNING id::text`).Scan(&memberUserID); err != nil {
		t.Fatalf("insert member user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, memberUserID})
	}()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('정산 입력 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, ownerUserID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) }()

	var ownerParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'owner', '민수', '2026-07-01T00:00:00Z')
		RETURNING id::text
	`, tripID, ownerUserID).Scan(&ownerParticipantID); err != nil {
		t.Fatalf("insert owner participant: %v", err)
	}
	var memberParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '지영', '2026-07-02T00:00:00Z')
		RETURNING id::text
	`, tripID, memberUserID).Scan(&memberParticipantID); err != nil {
		t.Fatalf("insert member participant: %v", err)
	}

	var expenseID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO expenses (trip_id, anchor_type, expense_date, amount_minor, currency, split_policy, payer_participant_id, payer_display_name, created_by)
		VALUES ($1::uuid, 'trip', '2026-07-10', 700, 'JPY', 'manual', $2::uuid, '지영', $3::uuid)
		RETURNING id::text
	`, tripID, memberParticipantID, ownerUserID).Scan(&expenseID); err != nil {
		t.Fatalf("insert expense: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO expense_splits (expense_id, participant_id, participant_display_name, amount_minor, split_order)
		VALUES ($1::uuid, $2::uuid, '민수', 700, 1)
	`, expenseID, ownerParticipantID); err != nil {
		t.Fatalf("insert split: %v", err)
	}
	var excludedExpenseID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO expenses (trip_id, anchor_type, expense_date, amount_minor, currency, split_policy, payer_participant_id, payer_display_name, include_in_settlement, created_by)
		VALUES ($1::uuid, 'trip', '2026-07-10', 300, 'JPY', 'manual', $2::uuid, '지영', false, $3::uuid)
		RETURNING id::text
	`, tripID, memberParticipantID, ownerUserID).Scan(&excludedExpenseID); err != nil {
		t.Fatalf("insert excluded expense: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO expense_splits (expense_id, participant_id, participant_display_name, amount_minor, split_order)
		VALUES ($1::uuid, $2::uuid, '민수', 300, 1)
	`, excludedExpenseID, ownerParticipantID); err != nil {
		t.Fatalf("insert excluded split: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `DELETE FROM trip_participants WHERE id = $1::uuid`, memberParticipantID); err != nil {
		t.Fatalf("delete member participant: %v", err)
	}

	input, err := store.GetTripSettlementInput(ctx, tripID)
	if err != nil {
		t.Fatalf("GetTripSettlementInput returned error: %v", err)
	}
	if len(input.Participants) != 1 || input.Participants[0].ParticipantID != ownerParticipantID || input.Participants[0].DisplayName != "민수" {
		t.Fatalf("unexpected current participants: %#v", input.Participants)
	}
	if len(input.Expenses) != 1 {
		t.Fatalf("expected one expense input, got %#v", input.Expenses)
	}
	expense := input.Expenses[0]
	if expense.ExpenseID == excludedExpenseID {
		t.Fatalf("expected excluded expense to be omitted from settlement input, got %#v", input.Expenses)
	}
	if expense.PayerParticipantID != nil || expense.PayerDisplayName != "지영" || expense.PayerParticipantLive {
		t.Fatalf("expected fallback payer snapshot, got %#v", expense)
	}
	if len(expense.Splits) != 1 || expense.Splits[0].ParticipantID == nil || *expense.Splits[0].ParticipantID != ownerParticipantID || !expense.Splits[0].ParticipantLive || expense.Splits[0].AmountMinor != 700 {
		t.Fatalf("unexpected split input: %#v", expense.Splits)
	}

	batchInputs, err := store.GetTripSettlementInputs(ctx, []string{tripID})
	if err != nil {
		t.Fatalf("GetTripSettlementInputs returned error: %v", err)
	}
	if !reflect.DeepEqual(batchInputs[tripID], input) {
		t.Fatalf("expected batch settlement input to match single input, batch=%#v single=%#v", batchInputs[tripID], input)
	}
}

func TestExpenseDisplayUsesLiveRowsThenFallback(t *testing.T) {
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

	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('민수')
		RETURNING id::text
	`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	var memberUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('지영')
		RETURNING id::text
	`).Scan(&memberUserID); err != nil {
		t.Fatalf("insert member user: %v", err)
	}

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('지출 표시 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, ownerUserID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id IN ($1::uuid, $2::uuid)`, ownerUserID, memberUserID)
	}()

	var ownerParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'owner', '민수', '2026-06-22T09:00:00Z')
		RETURNING id::text
	`, tripID, ownerUserID).Scan(&ownerParticipantID); err != nil {
		t.Fatalf("insert owner participant: %v", err)
	}
	var memberParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '지영', '2026-06-22T10:00:00Z')
		RETURNING id::text
	`, tripID, memberUserID).Scan(&memberParticipantID); err != nil {
		t.Fatalf("insert member participant: %v", err)
	}

	var placeID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '도톤보리', 'Dotonbori', 'food')
		RETURNING id::text
	`, tripID).Scan(&placeID); err != nil {
		t.Fatalf("insert trip place: %v", err)
	}
	tripDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")

	var scheduleItemID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, $2::uuid, $3::uuid, '장소 일정', 1, '0000000000000001024', 1)
		RETURNING id::text
	`, tripID, tripDayID, placeID).Scan(&scheduleItemID); err != nil {
		t.Fatalf("insert schedule item: %v", err)
	}

	created, err := store.CreateQuickExpense(ctx, trip.CreateQuickExpenseRecord{
		TripID:             tripID,
		TripDayID:          tripDayID,
		ScheduleItemID:     scheduleItemID,
		AmountMinor:        1001,
		PayerParticipantID: ownerParticipantID,
		SplitPolicy:        trip.ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{ownerParticipantID, memberParticipantID},
		CreatedBy:          ownerUserID,
	})
	if err != nil {
		t.Fatalf("create quick expense: %v", err)
	}
	if created.Expense.SplitPolicy != trip.ExpenseSplitPolicyEqual || created.Expense.Place == nil || created.Expense.Place.Source != trip.ExpenseDisplaySourceLive || created.Expense.Payer.Source != trip.ExpenseDisplaySourceLive {
		t.Fatalf("expected live canonical quick-create response, got %#v", created.Expense)
	}

	if _, err := store.pool.Exec(ctx, `UPDATE trip_places SET name = '라이브 라멘' WHERE id = $1::uuid`, placeID); err != nil {
		t.Fatalf("update place live name: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		UPDATE trip_participants
		SET display_name = CASE id
		  WHEN $1::uuid THEN '라이브 민수'
		  WHEN $2::uuid THEN '라이브 지영'
		  ELSE display_name
		END
		WHERE id IN ($1::uuid, $2::uuid)
	`, ownerParticipantID, memberParticipantID); err != nil {
		t.Fatalf("update participant live names: %v", err)
	}

	liveExpenses, err := store.ListDayExpensesByTripDay(ctx, tripID, tripDayID)
	if err != nil {
		t.Fatalf("list live expenses: %v", err)
	}
	if len(liveExpenses) != 1 {
		t.Fatalf("expected one live expense, got %#v", liveExpenses)
	}
	live := liveExpenses[0]
	if live.DisplayTitle != "라이브 라멘" || live.Place == nil || live.Place.Name != "라이브 라멘" || live.Place.Source != trip.ExpenseDisplaySourceLive || live.Payer.DisplayName != "라이브 민수" || live.Payer.Source != trip.ExpenseDisplaySourceLive || len(live.Splits) != 2 || live.Splits[1].Participant.DisplayName != "라이브 지영" || live.Splits[1].Participant.Source != trip.ExpenseDisplaySourceLive {
		t.Fatalf("expected live display values, got %#v", live)
	}

	deleted, err := store.DeleteScheduleItem(ctx, tripID, tripDayID, scheduleItemID)
	if err != nil {
		t.Fatalf("soft delete schedule item: %v", err)
	}
	if !deleted {
		t.Fatal("expected schedule item delete to succeed")
	}
	if _, err := store.pool.Exec(ctx, `DELETE FROM trip_participants WHERE id IN ($1::uuid, $2::uuid)`, ownerParticipantID, memberParticipantID); err != nil {
		t.Fatalf("delete participants: %v", err)
	}

	fallbackExpenses, err := store.ListDayExpensesByTripDay(ctx, tripID, tripDayID)
	if err != nil {
		t.Fatalf("list fallback expenses: %v", err)
	}
	if len(fallbackExpenses) != 1 {
		t.Fatalf("expected one fallback expense, got %#v", fallbackExpenses)
	}
	fallback := fallbackExpenses[0]
	if fallback.DisplayTitle != "라이브 라멘" || fallback.Place == nil || fallback.Place.Name != "라이브 라멘" || fallback.Place.Source != trip.ExpenseDisplaySourceFallback || fallback.Payer.DisplayName != "민수" || fallback.Payer.Source != trip.ExpenseDisplaySourceFallback || fallback.Payer.ParticipantID != nil || len(fallback.Splits) != 2 || fallback.Splits[1].Participant.DisplayName != "지영" || fallback.Splits[1].Participant.Source != trip.ExpenseDisplaySourceFallback || fallback.Splits[1].Participant.ParticipantID != nil {
		t.Fatalf("expected fallback display values, got %#v", fallback)
	}
}

func TestMarkScheduleItemArrivedFirstPendingIdempotentAndDuplicatePlaceIndependent(t *testing.T) {
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
		VALUES ('도착 처리 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('도착 처리 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
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
	var thirdPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '오사카성', 'Osakajo', 'sights')
		RETURNING id::text
	`, tripID).Scan(&thirdPlaceID); err != nil {
		t.Fatalf("insert third trip place: %v", err)
	}

	var firstItemID string
	var secondItemID string
	if err := store.pool.QueryRow(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024', 1)
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&firstItemID); err != nil {
		t.Fatalf("insert first schedule item: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 2, '0000000000000002048', 1)
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&secondItemID); err != nil {
		t.Fatalf("insert second schedule item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 3, '0000000000000003072', 1)
	`, tripID, thirdPlaceID); err != nil {
		t.Fatalf("insert third schedule item: %v", err)
	}

	_, err = store.MarkScheduleItemArrived(ctx, trip.MarkScheduleItemArrivedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: secondItemID})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected out-of-order conflict, got %v", err)
	}

	result, err := store.MarkScheduleItemArrived(ctx, trip.MarkScheduleItemArrivedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("mark first item arrived: %v", err)
	}
	if result.Item.ID != firstItemID || result.Item.ArrivedAt == nil {
		t.Fatalf("expected first item to be arrived, got %#v", result.Item)
	}
	if len(result.Items) != 3 || result.Items[0].ID != firstItemID || result.Items[0].ArrivedAt == nil || result.Items[1].ID != secondItemID || result.Items[1].ArrivedAt != nil {
		t.Fatalf("unexpected latest day snapshot: %#v", result.Items)
	}

	var arrivedSharedRows int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
		  AND trip_place_id = $2::uuid
		  AND arrived_at IS NOT NULL
	`, tripID, sharedPlaceID).Scan(&arrivedSharedRows); err != nil {
		t.Fatalf("count arrived shared place rows: %v", err)
	}
	if arrivedSharedRows != 1 {
		t.Fatalf("expected only one duplicate place schedule row to be arrived, got %d", arrivedSharedRows)
	}

	firstArrivedAt := *result.Item.ArrivedAt
	repeat, err := store.MarkScheduleItemArrived(ctx, trip.MarkScheduleItemArrivedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("repeat mark first item arrived: %v", err)
	}
	if repeat.Item.ArrivedAt == nil || !repeat.Item.ArrivedAt.Equal(firstArrivedAt) {
		t.Fatalf("expected repeat to preserve arrived_at, first=%v repeat=%v", firstArrivedAt, repeat.Item.ArrivedAt)
	}
}

func TestMarkScheduleItemSkippedRestoreAndDuplicatePlaceIndependent(t *testing.T) {
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
		VALUES ('스킵 처리 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('스킵 처리 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
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
	var thirdPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '오사카성', 'Osakajo', 'sights')
		RETURNING id::text
	`, tripID).Scan(&thirdPlaceID); err != nil {
		t.Fatalf("insert third trip place: %v", err)
	}

	var firstItemID string
	var secondItemID string
	if err := store.pool.QueryRow(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024', 1)
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&firstItemID); err != nil {
		t.Fatalf("insert first schedule item: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 2, '0000000000000002048', 1)
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&secondItemID); err != nil {
		t.Fatalf("insert second schedule item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 3, '0000000000000003072', 1)
	`, tripID, thirdPlaceID); err != nil {
		t.Fatalf("insert third schedule item: %v", err)
	}

	_, err = store.MarkScheduleItemSkipped(ctx, trip.MarkScheduleItemSkippedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: secondItemID})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected out-of-order skip conflict, got %v", err)
	}

	skipped, err := store.MarkScheduleItemSkipped(ctx, trip.MarkScheduleItemSkippedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("mark first item skipped: %v", err)
	}
	if skipped.Item.ID != firstItemID || skipped.Item.SkippedAt == nil || skipped.Item.ArrivedAt != nil {
		t.Fatalf("expected first item to be skipped, got %#v", skipped.Item)
	}
	if len(skipped.Items) != 3 || skipped.Items[0].ID != firstItemID || skipped.Items[0].SkippedAt == nil || skipped.Items[1].ID != secondItemID || skipped.Items[1].SkippedAt != nil {
		t.Fatalf("unexpected latest day snapshot after skip: %#v", skipped.Items)
	}

	var skippedSharedRows int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
		  AND trip_place_id = $2::uuid
		  AND skipped_at IS NOT NULL
	`, tripID, sharedPlaceID).Scan(&skippedSharedRows); err != nil {
		t.Fatalf("count skipped shared place rows: %v", err)
	}
	if skippedSharedRows != 1 {
		t.Fatalf("expected only one duplicate place schedule row to be skipped, got %d", skippedSharedRows)
	}

	firstSkippedAt := *skipped.Item.SkippedAt
	repeatSkip, err := store.MarkScheduleItemSkipped(ctx, trip.MarkScheduleItemSkippedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("repeat mark first item skipped: %v", err)
	}
	if repeatSkip.Item.SkippedAt == nil || !repeatSkip.Item.SkippedAt.Equal(firstSkippedAt) {
		t.Fatalf("expected repeat skip to preserve skipped_at, first=%v repeat=%v", firstSkippedAt, repeatSkip.Item.SkippedAt)
	}

	_, err = store.MarkScheduleItemArrived(ctx, trip.MarkScheduleItemArrivedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected skipped item arrival conflict, got %v", err)
	}

	restored, err := store.RestoreScheduleItem(ctx, trip.RestoreScheduleItemRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("restore first skipped item: %v", err)
	}
	if restored.Item.ID != firstItemID || restored.Item.SkippedAt != nil || restored.Item.ArrivedAt != nil {
		t.Fatalf("expected first item to be restored to pending, got %#v", restored.Item)
	}
	if len(restored.Items) != 3 || restored.Items[0].ID != firstItemID || restored.Items[0].SkippedAt != nil || restored.Items[1].ID != secondItemID || restored.Items[1].SkippedAt != nil {
		t.Fatalf("unexpected latest day snapshot after restore: %#v", restored.Items)
	}

	repeatRestore, err := store.RestoreScheduleItem(ctx, trip.RestoreScheduleItemRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("repeat restore pending item: %v", err)
	}
	if repeatRestore.Item.SkippedAt != nil || repeatRestore.Item.ArrivedAt != nil {
		t.Fatalf("expected repeat restore to keep pending item, got %#v", repeatRestore.Item)
	}

	arrived, err := store.MarkScheduleItemArrived(ctx, trip.MarkScheduleItemArrivedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if err != nil {
		t.Fatalf("arrive restored item: %v", err)
	}
	if arrived.Item.ArrivedAt == nil || arrived.Item.SkippedAt != nil {
		t.Fatalf("expected restored item to arrive without skipped state, got %#v", arrived.Item)
	}

	_, err = store.MarkScheduleItemSkipped(ctx, trip.MarkScheduleItemSkippedRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected arrived item skip conflict, got %v", err)
	}
	_, err = store.RestoreScheduleItem(ctx, trip.RestoreScheduleItemRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), ItemID: firstItemID})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected arrived item restore conflict, got %v", err)
	}
}

func TestDayLodgingPlacePersistenceAndScheduleMapping(t *testing.T) {
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
		VALUES ('숙소 지정 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('숙소 지정 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	var lodgingPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '호텔 니코 오사카', 'Nishi-Shinsaibashi', 'lodging')
		RETURNING id::text
	`, tripID).Scan(&lodgingPlaceID); err != nil {
		t.Fatalf("insert lodging trip place: %v", err)
	}
	var foodPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '도톤보리', 'Dotonbori', 'food')
		RETURNING id::text
	`, tripID).Scan(&foodPlaceID); err != nil {
		t.Fatalf("insert food trip place: %v", err)
	}

	if _, err := store.pool.Exec(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
		VALUES
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024', 1),
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 2, '0000000000000002048', 1),
		  ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $3::uuid, '장소 일정', 3, '0000000000000003072', 1)
	`, tripID, lodgingPlaceID, foodPlaceID); err != nil {
		t.Fatalf("insert schedule items: %v", err)
	}

	selected, err := store.SetDayLodgingPlace(ctx, trip.SetDayLodgingPlaceRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), TripPlaceID: lodgingPlaceID})
	if err != nil {
		t.Fatalf("set day lodging place: %v", err)
	}
	if selected.ID != lodgingPlaceID || selected.Name != "호텔 니코 오사카" {
		t.Fatalf("unexpected selected lodging: %#v", selected)
	}

	lodgingPlaces, err := store.ListDayLodgingPlacesByTrip(ctx, tripID)
	if err != nil {
		t.Fatalf("list day lodging places: %v", err)
	}
	if len(lodgingPlaces) != 1 || lodgingPlaces[0].Date != "2026-07-11" || lodgingPlaces[0].Place.ID != lodgingPlaceID {
		t.Fatalf("unexpected lodging place list: %#v", lodgingPlaces)
	}

	items, err := store.ListScheduleItemsByTripDay(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"))
	if err != nil {
		t.Fatalf("list lodging-mapped schedule items: %v", err)
	}
	if len(items) != 3 || !items[0].IsLodging || !items[1].IsLodging || items[2].IsLodging {
		t.Fatalf("expected all matching lodging rows to be marked, got %#v", items)
	}

	replaced, err := store.SetDayLodgingPlace(ctx, trip.SetDayLodgingPlaceRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), TripPlaceID: foodPlaceID})
	if err != nil {
		t.Fatalf("replace day lodging place: %v", err)
	}
	if replaced.ID != foodPlaceID {
		t.Fatalf("expected replacement lodging place %q, got %#v", foodPlaceID, replaced)
	}

	items, err = store.ListScheduleItemsByTripDay(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"))
	if err != nil {
		t.Fatalf("list replaced lodging-mapped schedule items: %v", err)
	}
	if len(items) != 3 || items[0].IsLodging || items[1].IsLodging || !items[2].IsLodging {
		t.Fatalf("expected replacement lodging mapping, got %#v", items)
	}

	if err := store.DeleteDayLodgingPlace(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")); err != nil {
		t.Fatalf("clear day lodging place: %v", err)
	}
	_, found, err := store.GetDayLodgingPlaceByTripAndDate(ctx, tripID, "2026-07-11")
	if err != nil {
		t.Fatalf("get cleared day lodging place: %v", err)
	}
	if found {
		t.Fatal("expected day lodging place to be cleared")
	}

	places, err := store.ListTripPlaces(ctx, tripID)
	if err != nil {
		t.Fatalf("list trip places: %v", err)
	}
	if len(places) != 2 || places[0].ID != lodgingPlaceID || places[1].ID != foodPlaceID {
		t.Fatalf("expected trip places in created order, got %#v", places)
	}

	manual, err := store.CreateManualDayLodgingPlace(ctx, trip.CreateManualDayLodgingPlaceRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-12"), Name: "호텔 몬토레", Address: "Osaka Station"})
	if err != nil {
		t.Fatalf("create manual day lodging place: %v", err)
	}
	if manual.Name != "호텔 몬토레" || manual.Address != "Osaka Station" || manual.PlaceType != "lodging" {
		t.Fatalf("unexpected manual lodging place: %#v", manual)
	}
	manualLodging, found, err := store.GetDayLodgingPlaceByTripAndDate(ctx, tripID, "2026-07-12")
	if err != nil {
		t.Fatalf("get manual day lodging place: %v", err)
	}
	if !found || manualLodging.ID != manual.ID {
		t.Fatalf("expected manual place to be selected as day lodging, found=%v place=%#v", found, manualLodging)
	}
	var manualScheduleItemCount int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND trip_place_id = $3::uuid
	`, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-12"), manual.ID).Scan(&manualScheduleItemCount); err != nil {
		t.Fatalf("count manual lodging schedule items: %v", err)
	}
	if manualScheduleItemCount != 0 {
		t.Fatalf("expected manual lodging registration not to create schedule items, got %d", manualScheduleItemCount)
	}

	google, err := store.CreateGoogleDayLodgingPlace(ctx, place.CreateGoogleDayLodgingPlaceRecord{
		TripID:            tripID,
		TripDayID:         tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-13"),
		GooglePlaceID:     "google-hotel-1",
		Name:              "호텔 니코 오사카 Google",
		Address:           "Nishi Google",
		PlaceType:         "lodging",
		Latitude:          34.6721,
		Longitude:         135.5019,
		GooglePrimaryType: "lodging",
		GoogleTypes:       []string{"lodging", "point_of_interest"},
	})
	if err != nil {
		t.Fatalf("create google day lodging place: %v", err)
	}
	if google.Name != "호텔 니코 오사카 Google" || google.RoutablePlace == nil || google.RoutablePlace.GooglePlaceID != "google-hotel-1" || google.RoutablePlace.Latitude != 34.6721 || google.RoutablePlace.Longitude != 135.5019 {
		t.Fatalf("unexpected google lodging place: %#v", google)
	}
	googleLodging, found, err := store.GetDayLodgingPlaceByTripAndDate(ctx, tripID, "2026-07-13")
	if err != nil {
		t.Fatalf("get google day lodging place: %v", err)
	}
	if !found || googleLodging.ID != google.ID || googleLodging.RoutablePlace == nil || googleLodging.RoutablePlace.GooglePlaceID != "google-hotel-1" {
		t.Fatalf("expected google place to be selected as day lodging, found=%v place=%#v", found, googleLodging)
	}
	var googleScheduleItemCount int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND trip_place_id = $3::uuid
	`, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-13"), google.ID).Scan(&googleScheduleItemCount); err != nil {
		t.Fatalf("count google lodging schedule items: %v", err)
	}
	if googleScheduleItemCount != 0 {
		t.Fatalf("expected google lodging registration not to create schedule items, got %d", googleScheduleItemCount)
	}

	reused, err := store.CreateGoogleDayLodgingPlace(ctx, place.CreateGoogleDayLodgingPlaceRecord{
		TripID:            tripID,
		TripDayID:         tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-12"),
		GooglePlaceID:     "google-hotel-1",
		Name:              "호텔 니코 오사카 Google Updated",
		Address:           "Nishi Google Updated",
		PlaceType:         "lodging",
		Latitude:          34.7,
		Longitude:         135.6,
		GooglePrimaryType: "lodging",
		GoogleTypes:       []string{"lodging"},
	})
	if err != nil {
		t.Fatalf("reuse google day lodging place: %v", err)
	}
	if reused.ID != google.ID || reused.Name != "호텔 니코 오사카 Google" || reused.RoutablePlace == nil || reused.RoutablePlace.Latitude != 34.6721 {
		t.Fatalf("expected existing google lodging place reuse without metadata refresh, got %#v initial=%#v", reused, google)
	}
}

func TestDayLodgingPlaceEnforcesSameTripAndCascadesOnPlaceDelete(t *testing.T) {
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

	var firstUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('숙소 FK 테스트 1') RETURNING id::text`).Scan(&firstUserID); err != nil {
		t.Fatalf("insert first user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, firstUserID)
	}()
	var secondUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('숙소 FK 테스트 2') RETURNING id::text`).Scan(&secondUserID); err != nil {
		t.Fatalf("insert second user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, secondUserID)
	}()

	var firstTripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('숙소 FK 테스트 여행 1', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, firstUserID).Scan(&firstTripID); err != nil {
		t.Fatalf("insert first trip: %v", err)
	}
	var secondTripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('숙소 FK 테스트 여행 2', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, secondUserID).Scan(&secondTripID); err != nil {
		t.Fatalf("insert second trip: %v", err)
	}

	var firstPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '첫 여행 호텔', 'First', 'lodging')
		RETURNING id::text
	`, firstTripID).Scan(&firstPlaceID); err != nil {
		t.Fatalf("insert first trip place: %v", err)
	}
	var secondPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '다른 여행 호텔', 'Second', 'lodging')
		RETURNING id::text
	`, secondTripID).Scan(&secondPlaceID); err != nil {
		t.Fatalf("insert second trip place: %v", err)
	}

	_, err = store.SetDayLodgingPlace(ctx, trip.SetDayLodgingPlaceRecord{TripID: firstTripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, firstTripID, "2026-07-11"), TripPlaceID: secondPlaceID})
	if !errors.Is(err, trip.ErrNotFound) {
		t.Fatalf("expected cross-trip place to map to ErrNotFound, got %v", err)
	}

	if _, err := store.SetDayLodgingPlace(ctx, trip.SetDayLodgingPlaceRecord{TripID: firstTripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, firstTripID, "2026-07-11"), TripPlaceID: firstPlaceID}); err != nil {
		t.Fatalf("set first trip lodging: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `DELETE FROM trip_places WHERE id = $1::uuid`, firstPlaceID); err != nil {
		t.Fatalf("delete selected trip place: %v", err)
	}
	_, found, err := store.GetDayLodgingPlaceByTripAndDate(ctx, firstTripID, "2026-07-11")
	if err != nil {
		t.Fatalf("get day lodging after place delete: %v", err)
	}
	if found {
		t.Fatal("expected selected place delete to cascade-clear day lodging")
	}
}

func TestCreateManualScheduleItemCreatesPlaceAndAppendsItem(t *testing.T) {
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

	first, err := store.CreateManualScheduleItem(ctx, trip.CreateManualScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Name:      "우메다 공중정원",
		Address:   "Umeda",
		PlaceType: "sights",
	})
	if err != nil {
		t.Fatalf("create first manual item: %v", err)
	}
	if first.ItemOrder != 1 || first.Version != 1 || first.Place.Name != "우메다 공중정원" || first.Place.PlaceType != "sights" || first.Place.Address != "Umeda" {
		t.Fatalf("unexpected first item: %#v", first)
	}

	second, err := store.CreateManualScheduleItem(ctx, trip.CreateManualScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Name:      "우메다 공중정원",
		Address:   "Umeda",
		PlaceType: "sights",
	})
	if err != nil {
		t.Fatalf("create duplicate manual item: %v", err)
	}
	if second.ItemOrder != 2 || second.Version != 1 {
		t.Fatalf("expected duplicate item to append at order 2 with version 1, got %#v", second)
	}

	items, err := store.ListScheduleItemsByTripDay(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"))
	if err != nil {
		t.Fatalf("list created schedule items: %v", err)
	}
	if len(items) != 2 || items[0].ItemOrder != 1 || items[1].ItemOrder != 2 {
		t.Fatalf("expected two appended items, got %#v", items)
	}

	var firstRank string
	var firstVersion int
	if err := store.pool.QueryRow(ctx, `
		SELECT rank, version
		FROM schedule_items
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
		FROM schedule_items
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

func TestCreateGooglePlaceScheduleItemReusesTripPlaceAndHandlesDuplicateConfirmation(t *testing.T) {
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

	var hasGooglePlaceColumns bool
	if err := store.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'trip_places'
			  AND column_name = 'provider'
		)
	`).Scan(&hasGooglePlaceColumns); err != nil {
		t.Fatalf("check google place columns: %v", err)
	}
	if !hasGooglePlaceColumns {
		t.Skip("trip_places google metadata migration is required for this storage integration test")
	}

	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('구글 장소 추가 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('구글 장소 추가 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	startTime := "09:30"
	endTime := "11:00"
	memo := "강가 산책하기"
	record := place.CreateGooglePlaceScheduleItemRecord{
		TripID:            tripID,
		TripDayID:         tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		GooglePlaceID:     "google-place-1",
		Name:              "도톤보리",
		Address:           "Osaka",
		PlaceType:         "sights",
		Latitude:          34.6687,
		Longitude:         135.5013,
		GooglePrimaryType: "tourist_attraction",
		GoogleTypes:       []string{"tourist_attraction", "point_of_interest"},
		Title:             "오전 산책",
		StartTime:         &startTime,
		EndTime:           &endTime,
		Memo:              &memo,
	}
	first, err := store.CreateGooglePlaceScheduleItem(ctx, record)
	if err != nil {
		t.Fatalf("create first google item: %v", err)
	}
	if first.ItemOrder != 1 || first.Place.Name != "도톤보리" || first.Place.PlaceType != "sights" {
		t.Fatalf("unexpected first item: %#v", first)
	}
	if first.PlaceSchedule == nil || first.PlaceSchedule.Title != "오전 산책" || first.PlaceSchedule.Memo == nil || *first.PlaceSchedule.Memo != "강가 산책하기" || first.StartTime == nil || *first.StartTime != "09:30" || first.EndTime == nil || *first.EndTime != "11:00" {
		t.Fatalf("expected first item details, got %#v", first)
	}
	if first.Place.RoutablePlace == nil || first.Place.RoutablePlace.GooglePlaceID != "google-place-1" || first.Place.RoutablePlace.Latitude != 34.6687 || first.Place.RoutablePlace.Longitude != 135.5013 {
		t.Fatalf("expected routable place metadata, got %#v", first.Place.RoutablePlace)
	}

	_, err = store.CreateGooglePlaceScheduleItem(ctx, record)
	if !errors.Is(err, place.ErrDuplicateDayPlaceConfirmationNeeded) {
		t.Fatalf("expected duplicate confirmation error, got %v", err)
	}

	record.DuplicateConfirmed = true
	record.Title = "야경 다시 보기"
	record.Memo = nil
	record.StartTime = nil
	record.EndTime = nil
	second, err := store.CreateGooglePlaceScheduleItem(ctx, record)
	if err != nil {
		t.Fatalf("create confirmed duplicate google item: %v", err)
	}
	if second.ItemOrder != 2 || second.Place.ID != first.Place.ID {
		t.Fatalf("expected duplicate to append with reused place, got first=%#v second=%#v", first, second)
	}
	if second.PlaceSchedule == nil || second.PlaceSchedule.Title != "야경 다시 보기" || second.PlaceSchedule.Memo != nil || second.StartTime != nil || second.EndTime != nil {
		t.Fatalf("expected confirmed duplicate to preserve its own untimed details, got %#v", second)
	}

	var placeCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE trip_id = $1::uuid AND provider = 'google'`, tripID).Scan(&placeCount); err != nil {
		t.Fatalf("count google trip places: %v", err)
	}
	if placeCount != 1 {
		t.Fatalf("expected one google trip place, got %d", placeCount)
	}

	var latitude float64
	var googleTypes []string
	if err := store.pool.QueryRow(ctx, `SELECT latitude, google_types FROM trip_places WHERE id = $1::uuid`, first.Place.ID).Scan(&latitude, &googleTypes); err != nil {
		t.Fatalf("load google metadata: %v", err)
	}
	if latitude != 34.6687 || len(googleTypes) != 2 {
		t.Fatalf("expected google metadata, got latitude=%v types=%#v", latitude, googleTypes)
	}
}

func TestCreateGooglePlaceScheduleItemsBatchAppendsInOrderAndAllowsSameDayDuplicates(t *testing.T) {
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
		VALUES ('구글 장소 배치 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('구글 장소 배치 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	tripDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")

	batch := place.CreateGooglePlaceScheduleItemsBatchRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Items: []place.CreateGooglePlaceScheduleItemsBatchRecordItem{
			{GooglePlaceID: "google-batch-1", Name: "도톤보리", Address: "Osaka", PlaceType: "sights", Latitude: 34.6687, Longitude: 135.5013, GooglePrimaryType: "tourist_attraction", GoogleTypes: []string{"tourist_attraction"}, Title: "도톤보리"},
			{GooglePlaceID: "google-batch-2", Name: "우메다", Address: "Umeda", PlaceType: "sights", Latitude: 34.7055, Longitude: 135.4982, GooglePrimaryType: "point_of_interest", GoogleTypes: []string{"point_of_interest"}, Title: "우메다"},
		},
	}
	created, err := store.CreateGooglePlaceScheduleItemsBatch(ctx, batch)
	if err != nil {
		t.Fatalf("create batch: %v", err)
	}
	if len(created.CreatedItems) != 2 || created.CreatedItems[0].ItemOrder != 1 || created.CreatedItems[1].ItemOrder != 2 || created.CreatedItems[0].Place.Name != "도톤보리" || created.CreatedItems[1].Place.Name != "우메다" {
		t.Fatalf("expected created items in request order, got %#v", created.CreatedItems)
	}
	if created.CreatedItems[0].PlaceSchedule == nil || created.CreatedItems[0].PlaceSchedule.Title != "도톤보리" || created.CreatedItems[0].StartTime != nil || created.CreatedItems[0].EndTime != nil {
		t.Fatalf("expected provider-title untimed item, got %#v", created.CreatedItems[0])
	}
	if len(created.ScheduleItems) != 2 || created.ScheduleItems[0].ItemOrder != 1 || created.ScheduleItems[1].ItemOrder != 2 {
		t.Fatalf("expected latest day schedule items, got %#v", created.ScheduleItems)
	}

	duplicateBatch, err := store.CreateGooglePlaceScheduleItemsBatch(ctx, place.CreateGooglePlaceScheduleItemsBatchRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Items: []place.CreateGooglePlaceScheduleItemsBatchRecordItem{
			{GooglePlaceID: "google-batch-1", Name: "도톤보리", Address: "Osaka", PlaceType: "sights", Latitude: 34.6687, Longitude: 135.5013, GooglePrimaryType: "tourist_attraction", GoogleTypes: []string{"tourist_attraction"}, Title: "도톤보리"},
			{GooglePlaceID: "google-batch-3", Name: "오사카성", Address: "Osaka Castle", PlaceType: "sights", Latitude: 34.6873, Longitude: 135.5262, GooglePrimaryType: "tourist_attraction", GoogleTypes: []string{"tourist_attraction"}, Title: "오사카성"},
		},
	})
	if err != nil {
		t.Fatalf("expected duplicate Google place batch to append, got %v", err)
	}
	if len(duplicateBatch.CreatedItems) != 2 || duplicateBatch.CreatedItems[0].ItemOrder != 3 || duplicateBatch.CreatedItems[1].ItemOrder != 4 {
		t.Fatalf("expected duplicate and new place to append after existing items, got %#v", duplicateBatch.CreatedItems)
	}
	if duplicateBatch.CreatedItems[0].Place.ID != created.CreatedItems[0].Place.ID {
		t.Fatalf("expected duplicate Google place to reuse existing trip place, got %#v", duplicateBatch.CreatedItems[0].Place)
	}
	if len(duplicateBatch.ScheduleItems) != 4 {
		t.Fatalf("expected latest schedule to include duplicate and new place, got %#v", duplicateBatch.ScheduleItems)
	}
}

func TestReorderScheduleItemsAppliesMovesSequentiallyAndReturnsLatestOrder(t *testing.T) {
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
			WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
			VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', $3, lpad($4::int::text, 19, '0'), 1)
			RETURNING id::text
		`, tripID, placeID, index+1, rank).Scan(&itemID); err != nil {
			t.Fatalf("insert schedule item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
	}

	reordered, err := store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Moves: []trip.ReorderDayScheduleMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
			{ItemID: itemIDs[1], BeforeItemID: stringPtr(itemIDs[2]), ClientVersion: 1},
		},
	})
	if err != nil {
		t.Fatalf("reorder day schedule items: %v", err)
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
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
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

func TestMoveScheduleItemToDayAppendsToTargetResetsStatusAndReanchorsExpenses(t *testing.T) {
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

	fixture := createMoveScheduleItemFixture(t, ctx, store, "F309 단일 이동 성공")

	result, err := store.MoveScheduleItemToDay(ctx, trip.MoveScheduleItemToDayRecord{
		TripID:          fixture.tripID,
		SourceTripDayID: fixture.sourceDayID,
		TargetTripDayID: fixture.targetDayID,
		ScheduleItemID:  fixture.movedItemID,
		ClientVersion:   7,
	})
	if err != nil {
		t.Fatalf("MoveScheduleItemToDay returned error: %v", err)
	}

	if result.MovedItem.ID != fixture.movedItemID || result.MovedItem.Version != 8 {
		t.Fatalf("unexpected moved item result: %#v", result.MovedItem)
	}
	if result.MovedItem.ArrivedAt != nil || result.MovedItem.SkippedAt != nil {
		t.Fatalf("expected moved item status reset, got arrived=%v skipped=%v", result.MovedItem.ArrivedAt, result.MovedItem.SkippedAt)
	}
	if result.MovedItem.Place.ID != fixture.movedPlaceID || result.MovedItem.PlaceSchedule == nil || result.MovedItem.PlaceSchedule.Title != "수영" || result.MovedItem.PlaceSchedule.Memo == nil || *result.MovedItem.PlaceSchedule.Memo != "수건 챙기기" {
		t.Fatalf("expected moved item place/title/memo preserved, got %#v", result.MovedItem)
	}
	if result.MovedItem.StartTime == nil || *result.MovedItem.StartTime != "09:30" || result.MovedItem.EndTime == nil || *result.MovedItem.EndTime != "11:00" {
		t.Fatalf("expected moved item time preserved, got start=%v end=%v", result.MovedItem.StartTime, result.MovedItem.EndTime)
	}

	if len(result.SourceItems) != 1 || result.SourceItems[0].ID != fixture.sourceRemainingItemID || result.SourceItems[0].ItemOrder != 1 {
		t.Fatalf("unexpected source snapshot after move: %#v", result.SourceItems)
	}
	if len(result.TargetItems) != 2 || result.TargetItems[0].ID != fixture.targetExistingItemID || result.TargetItems[1].ID != fixture.movedItemID || result.TargetItems[1].ItemOrder != 2 {
		t.Fatalf("unexpected target snapshot after move: %#v", result.TargetItems)
	}

	assertScheduleItemAnchor(t, ctx, store, fixture.movedItemID, fixture.targetDayID, 8, true)
	assertExpenseAnchor(t, ctx, store, fixture.scheduleExpenseID, fixture.targetDayID, fixture.movedItemID, "2026-07-01")
	assertExpenseAnchor(t, ctx, store, fixture.dayExpenseID, fixture.sourceDayID, "", "2026-07-11")
	assertExpenseAnchor(t, ctx, store, fixture.tripExpenseID, "", "", "2026-07-09")
}

func TestMoveScheduleItemToDayRejectsStaleVersionWithoutChangingData(t *testing.T) {
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

	fixture := createMoveScheduleItemFixture(t, ctx, store, "F309 단일 이동 stale")

	_, err = store.MoveScheduleItemToDay(ctx, trip.MoveScheduleItemToDayRecord{
		TripID:          fixture.tripID,
		SourceTripDayID: fixture.sourceDayID,
		TargetTripDayID: fixture.targetDayID,
		ScheduleItemID:  fixture.movedItemID,
		ClientVersion:   6,
	})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected stale version conflict, got %v", err)
	}

	assertScheduleItemAnchor(t, ctx, store, fixture.movedItemID, fixture.sourceDayID, 7, false)
	assertExpenseAnchor(t, ctx, store, fixture.scheduleExpenseID, fixture.sourceDayID, fixture.movedItemID, "2026-07-01")
}

func TestReorderScheduleItemsRejectsStaleMovedItemVersionWithoutChangingData(t *testing.T) {
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
			WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
			VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', $3, $4, $5)
			RETURNING id::text
		`, tripID, placeID, index+1, ranks[index], versions[index]).Scan(&itemID); err != nil {
			t.Fatalf("insert schedule item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = ranks[index]
		initialVersions[itemID] = versions[index]
	}

	_, err = store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Moves: []trip.ReorderDayScheduleMoveRecord{{
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
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
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

func TestReorderScheduleItemsRollsBackEarlierMovesWhenLaterMoveFails(t *testing.T) {
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
			WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
			VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', $3, $4, 1)
			RETURNING id::text
		`, tripID, placeID, index+1, rank).Scan(&itemID); err != nil {
			t.Fatalf("insert schedule item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = rank
	}

	_, err = store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Moves: []trip.ReorderDayScheduleMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[2]), ClientVersion: 1},
		},
	})
	if err != trip.ErrConflict {
		t.Fatalf("expected conflict from stale second move, got %v", err)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
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

func TestReorderScheduleItemsRetriesOnceAfterRankUniqueCollision(t *testing.T) {
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

	tripID, itemIDs, _ := createReorderDayScheduleFixture(t, ctx, store, "순서 변경 충돌 재시도 테스트")
	installForcedReorderRankCollision(t, ctx, store, itemIDs[3], 1)

	reordered, err := store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Moves: []trip.ReorderDayScheduleMoveRecord{
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
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
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

func TestReorderScheduleItemsReturnsConflictWhenRankUniqueRetryStillCollides(t *testing.T) {
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

	tripID, itemIDs, initialRanks := createReorderDayScheduleFixture(t, ctx, store, "순서 변경 충돌 실패 테스트")
	installForcedReorderRankCollision(t, ctx, store, itemIDs[3], 2)

	_, err = store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		Moves: []trip.ReorderDayScheduleMoveRecord{
			{ItemID: itemIDs[3], BeforeItemID: stringPtr(itemIDs[0]), AfterItemID: stringPtr(itemIDs[1]), ClientVersion: 1},
		},
	})
	if err != trip.ErrConflict {
		t.Fatalf("expected conflict after retry failure, got %v", err)
	}

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = (SELECT id FROM trip_days WHERE trip_id = $1::uuid AND date = '2026-07-11')
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

func TestReorderScheduleItemsRebalancesDenseRanksAndPreservesVersionPolicy(t *testing.T) {
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

	tripID, tripDayID, itemIDs := createRankedDayScheduleFixture(t, ctx, store, "순서 변경 rank rebalance 테스트", []string{
		"0000000000000000001",
		"0000000000000000002",
		"0000000000000000003",
	}, []int{4, 7, 1})

	reordered, err := store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Moves: []trip.ReorderDayScheduleMoveRecord{{
			ItemID:        itemIDs[2],
			BeforeItemID:  stringPtr(itemIDs[0]),
			AfterItemID:   stringPtr(itemIDs[1]),
			ClientVersion: 1,
		}},
	})
	if err != nil {
		t.Fatalf("reorder with dense ranks: %v", err)
	}

	wantOrder := []string{itemIDs[0], itemIDs[2], itemIDs[1]}
	wantVersions := map[string]int{itemIDs[0]: 4, itemIDs[1]: 7, itemIDs[2]: 2}
	for index, wantID := range wantOrder {
		if reordered[index].ID != wantID {
			t.Fatalf("expected response item %d to be %q, got %#v", index, wantID, reordered)
		}
		if reordered[index].Version != wantVersions[wantID] {
			t.Fatalf("expected response version for %q to be %d, got %#v", wantID, wantVersions[wantID], reordered[index])
		}
	}

	persisted := loadPersistedOrderedScheduleRows(t, ctx, store, tripID, tripDayID)
	wantRanks := []string{"0000000000000001024", "0000000000000002048", "0000000000000003072"}
	for index, wantID := range wantOrder {
		if persisted[index].ID != wantID {
			t.Fatalf("expected persisted item %d to be %q, got %#v", index, wantID, persisted)
		}
		if persisted[index].Rank != wantRanks[index] {
			t.Fatalf("expected persisted rank %d to be %q, got %#v", index, wantRanks[index], persisted)
		}
		if persisted[index].Version != wantVersions[wantID] {
			t.Fatalf("expected persisted version for %q to be %d, got %#v", wantID, wantVersions[wantID], persisted[index])
		}
	}
}

func TestReorderScheduleItemsRebalancesExistingOverWidthRank(t *testing.T) {
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

	tripID, tripDayID, itemIDs := createRankedDayScheduleFixture(t, ctx, store, "순서 변경 rank 길이 rebalance 테스트", []string{
		"0000000000000001024",
		"0000000000000002048",
		"10000000000000000000",
	}, []int{1, 1, 3})

	reordered, err := store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Moves: []trip.ReorderDayScheduleMoveRecord{{
			ItemID:        itemIDs[2],
			BeforeItemID:  stringPtr(itemIDs[0]),
			AfterItemID:   stringPtr(itemIDs[1]),
			ClientVersion: 3,
		}},
	})
	if err != nil {
		t.Fatalf("reorder with over-width rank: %v", err)
	}

	wantOrder := []string{itemIDs[0], itemIDs[2], itemIDs[1]}
	if reordered[0].ID != wantOrder[0] || reordered[1].ID != wantOrder[1] || reordered[2].ID != wantOrder[2] {
		t.Fatalf("unexpected reordered response: %#v", reordered)
	}
	if reordered[1].Version != 4 || reordered[0].Version != 1 || reordered[2].Version != 1 {
		t.Fatalf("expected only moved item version to increment, got %#v", reordered)
	}

	persisted := loadPersistedOrderedScheduleRows(t, ctx, store, tripID, tripDayID)
	wantRanks := []string{"0000000000000001024", "0000000000000002048", "0000000000000003072"}
	for index, wantID := range wantOrder {
		if persisted[index].ID != wantID || persisted[index].Rank != wantRanks[index] {
			t.Fatalf("unexpected persisted row %d: got %#v want id=%q rank=%q", index, persisted[index], wantID, wantRanks[index])
		}
	}
}

func TestReorderScheduleItemsRollsBackWhenRebalanceRewriteFails(t *testing.T) {
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

	tripID, tripDayID, itemIDs := createRankedDayScheduleFixture(t, ctx, store, "순서 변경 rebalance 롤백 테스트", []string{
		"0000000000000000001",
		"0000000000000000002",
		"0000000000000000003",
	}, []int{1, 1, 1})
	initial := loadPersistedOrderedScheduleRows(t, ctx, store, tripID, tripDayID)
	installForcedReorderRankCollision(t, ctx, store, itemIDs[2], 1)

	_, err = store.ReorderScheduleItems(ctx, trip.ReorderScheduleItemsRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Moves: []trip.ReorderDayScheduleMoveRecord{{
			ItemID:        itemIDs[2],
			BeforeItemID:  stringPtr(itemIDs[0]),
			AfterItemID:   stringPtr(itemIDs[1]),
			ClientVersion: 1,
		}},
	})
	if !errors.Is(err, trip.ErrConflict) {
		t.Fatalf("expected rebalance rewrite conflict, got %v", err)
	}

	persisted := loadPersistedOrderedScheduleRows(t, ctx, store, tripID, tripDayID)
	for index := range initial {
		if persisted[index] != initial[index] {
			t.Fatalf("expected rollback to preserve row %d, got %#v want %#v", index, persisted[index], initial[index])
		}
	}
}

func TestCreateManualScheduleItemRebalancesBeforeAppendWhenRankWouldExceedWidth(t *testing.T) {
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

	tripID, tripDayID, itemIDs := createRankedDayScheduleFixture(t, ctx, store, "장소 추가 rank rebalance 테스트", []string{
		"9999999999999999999",
	}, []int{5})

	created, err := store.CreateManualScheduleItem(ctx, trip.CreateManualScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		Name:      "난바 야사카 신사",
		Address:   "Namba",
		PlaceType: "sights",
	})
	if err != nil {
		t.Fatalf("create manual item after over-width append candidate: %v", err)
	}
	if created.ItemOrder != 2 || created.Version != 1 {
		t.Fatalf("expected appended item order 2 version 1, got %#v", created)
	}

	persisted := loadPersistedOrderedScheduleRows(t, ctx, store, tripID, tripDayID)
	if len(persisted) != 2 {
		t.Fatalf("expected two persisted rows, got %#v", persisted)
	}
	if persisted[0].ID != itemIDs[0] || persisted[0].Rank != "0000000000000001024" || persisted[0].Version != 5 {
		t.Fatalf("expected existing row to be rebalanced without version change, got %#v", persisted[0])
	}
	if persisted[1].ID != created.ID || persisted[1].Rank != "0000000000000002048" || persisted[1].Version != 1 {
		t.Fatalf("expected created row to append after rebalanced rank, got %#v", persisted[1])
	}
}

func TestUpdateScheduleItemPlaceUpdatesSharedPlaceSnapshot(t *testing.T) {
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
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024')
		RETURNING id::text
	`, tripID, placeID).Scan(&firstItemID); err != nil {
		t.Fatalf("insert first schedule item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-12'), $2::uuid, '장소 일정', 1, '0000000000000001024')
	`, tripID, placeID); err != nil {
		t.Fatalf("insert second schedule item: %v", err)
	}

	updated, err := store.UpdateScheduleItemPlace(ctx, trip.UpdateScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		ItemID:    firstItemID,
		Name:      "우메다 스카이빌딩",
		Address:   "Umeda Sky Building",
		PlaceType: "food",
		StartTime: stringPtr("09:30"),
		EndTime:   stringPtr("11:00"),
	})
	if err != nil {
		t.Fatalf("update day schedule item place: %v", err)
	}
	if updated.ID != firstItemID || updated.ItemOrder != 1 || updated.Version != 1 || updated.Place.ID != placeID || updated.Place.Name != "우메다 스카이빌딩" || updated.Place.Address != "Umeda Sky Building" || updated.Place.PlaceType != "food" {
		t.Fatalf("unexpected updated item: %#v", updated)
	}
	if updated.StartTime == nil || *updated.StartTime != "09:30" || updated.EndTime == nil || *updated.EndTime != "11:00" {
		t.Fatalf("expected persisted schedule item times, got start=%v end=%v", updated.StartTime, updated.EndTime)
	}

	updated, err = store.UpdateScheduleItemPlace(ctx, trip.UpdateScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"),
		ItemID:    firstItemID,
		Name:      "우메다 스카이빌딩",
		Address:   "Umeda Sky Building",
		PlaceType: "food",
	})
	if err != nil {
		t.Fatalf("clear schedule item time: %v", err)
	}
	if updated.StartTime != nil || updated.EndTime != nil {
		t.Fatalf("expected cleared schedule item times, got start=%v end=%v", updated.StartTime, updated.EndTime)
	}

	otherDayItems, err := store.ListScheduleItemsByTripDay(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-12"))
	if err != nil {
		t.Fatalf("list other day items: %v", err)
	}
	if len(otherDayItems) != 1 || otherDayItems[0].Place.Name != "우메다 스카이빌딩" || otherDayItems[0].Place.PlaceType != "food" {
		t.Fatalf("expected shared place snapshot to be updated, got %#v", otherDayItems)
	}
}

func TestDeleteScheduleItemRemovesSelectedItemAndCleansOrphanPlace(t *testing.T) {
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
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 1, '0000000000000001024')
		RETURNING id::text
	`, tripID, sharedPlaceID).Scan(&firstSharedItemID); err != nil {
		t.Fatalf("insert first shared item: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-12'), $2::uuid, '장소 일정', 1, '0000000000000001024')
	`, tripID, sharedPlaceID); err != nil {
		t.Fatalf("insert second shared item: %v", err)
	}

	deleted, err := store.DeleteScheduleItem(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), firstSharedItemID)
	if err != nil {
		t.Fatalf("delete shared schedule item: %v", err)
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

	var lodgingOnlyPlaceID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, '호텔 니코 오사카', 'Nishi-Shinsaibashi', 'lodging')
		RETURNING id::text
	`, tripID).Scan(&lodgingOnlyPlaceID); err != nil {
		t.Fatalf("insert lodging-only trip place: %v", err)
	}
	var lodgingOnlyItemID string
	if err := store.pool.QueryRow(ctx, `
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 2, '0000000000000002048')
		RETURNING id::text
	`, tripID, lodgingOnlyPlaceID).Scan(&lodgingOnlyItemID); err != nil {
		t.Fatalf("insert lodging-only item: %v", err)
	}
	if _, err := store.SetDayLodgingPlace(ctx, trip.SetDayLodgingPlaceRecord{TripID: tripID, TripDayID: tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), TripPlaceID: lodgingOnlyPlaceID}); err != nil {
		t.Fatalf("set lodging-only place as day lodging: %v", err)
	}
	deleted, err = store.DeleteScheduleItem(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), lodgingOnlyItemID)
	if err != nil {
		t.Fatalf("delete lodging-only schedule item: %v", err)
	}
	if !deleted {
		t.Fatal("expected lodging-only item delete to report true")
	}
	var lodgingOnlyPlaceCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE id = $1::uuid`, lodgingOnlyPlaceID).Scan(&lodgingOnlyPlaceCount); err != nil {
		t.Fatalf("count lodging-only place: %v", err)
	}
	if lodgingOnlyPlaceCount != 1 {
		t.Fatalf("expected day lodging reference to keep trip place, got count %d", lodgingOnlyPlaceCount)
	}
	lodgingPlace, found, err := store.GetDayLodgingPlaceByTripAndDate(ctx, tripID, "2026-07-11")
	if err != nil {
		t.Fatalf("get lodging after schedule item delete: %v", err)
	}
	if !found || lodgingPlace.ID != lodgingOnlyPlaceID {
		t.Fatalf("expected day lodging to remain after item delete, found=%v place=%#v", found, lodgingPlace)
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
		WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank)
		VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', 3, '0000000000000003072')
		RETURNING id::text
	`, tripID, orphanPlaceID).Scan(&orphanItemID); err != nil {
		t.Fatalf("insert orphan item: %v", err)
	}

	deleted, err = store.DeleteScheduleItem(ctx, tripID, tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11"), orphanItemID)
	if err != nil {
		t.Fatalf("delete orphan schedule item: %v", err)
	}
	if !deleted {
		t.Fatal("expected orphan delete to report true")
	}
	var orphanPlaceCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_places WHERE id = $1::uuid`, orphanPlaceID).Scan(&orphanPlaceCount); err != nil {
		t.Fatalf("count orphan place: %v", err)
	}
	if orphanPlaceCount != 1 {
		t.Fatalf("expected soft-deleted item history to keep orphan place, got count %d", orphanPlaceCount)
	}
	var orphanDeletedAt *time.Time
	if err := store.pool.QueryRow(ctx, `SELECT deleted_at FROM schedule_items WHERE id = $1::uuid`, orphanItemID).Scan(&orphanDeletedAt); err != nil {
		t.Fatalf("load soft-deleted orphan item: %v", err)
	}
	if orphanDeletedAt == nil {
		t.Fatal("expected orphan schedule item to be soft-deleted")
	}
}

func TestCreateOrReturnTripInviteReusesCurrentAndReplacesExpired(t *testing.T) {
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

	var hasTripInvites bool
	if err := store.pool.QueryRow(ctx, `SELECT to_regclass('public.trip_invites') IS NOT NULL`).Scan(&hasTripInvites); err != nil {
		t.Fatalf("check trip_invites table: %v", err)
	}
	if !hasTripInvites {
		t.Skip("trip_invites migration is required for invite storage integration test")
	}

	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('초대 링크 저장소 테스트')
		RETURNING id::text
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) }()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('초대 링크 저장소 테스트 여행', '2026-07-10', '2026-07-13', 'KRW', $1::uuid)
		RETURNING id::text
	`, userID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) }()

	tokenSuffix := fmt.Sprintf("%d", time.Now().UnixNano())
	firstToken := "first-token-" + tokenSuffix + "-abcdefghijklmnopqrstuvwxyz"
	secondToken := "second-token-" + tokenSuffix + "-abcdefghijklmnopqrstuvwxyz"
	replacementToken := "replacement-token-" + tokenSuffix + "-abcdefghijklmnopqrstuvwxyz"
	now := time.Date(2026, 6, 23, 15, 0, 0, 0, time.UTC)
	created, err := store.CreateOrReturnTripInvite(ctx, trip.CreateTripInviteRecord{
		TripID:    tripID,
		Token:     firstToken,
		ExpiresAt: now.Add(7 * 24 * time.Hour),
		CreatedBy: userID,
		Now:       now,
	})
	if err != nil {
		t.Fatalf("create invite: %v", err)
	}
	if !created.Created || created.Invite.Token != firstToken {
		t.Fatalf("expected first invite creation, got %#v", created)
	}

	reused, err := store.CreateOrReturnTripInvite(ctx, trip.CreateTripInviteRecord{
		TripID:    tripID,
		Token:     secondToken,
		ExpiresAt: now.Add(8 * 24 * time.Hour),
		CreatedBy: userID,
		Now:       now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("reuse invite: %v", err)
	}
	if reused.Created || reused.Invite.Token != firstToken {
		t.Fatalf("expected active invite reuse, got %#v", reused)
	}

	if _, err := store.pool.Exec(ctx, `UPDATE trip_invites SET expires_at = $2, deactivated_at = NULL WHERE id = $1::uuid`, created.Invite.ID, now.Add(30*time.Minute)); err != nil {
		t.Fatalf("expire invite: %v", err)
	}
	replacedNow := now.Add(time.Hour)
	replaced, err := store.CreateOrReturnTripInvite(ctx, trip.CreateTripInviteRecord{
		TripID:    tripID,
		Token:     replacementToken,
		ExpiresAt: replacedNow.Add(7 * 24 * time.Hour),
		CreatedBy: userID,
		Now:       replacedNow,
	})
	if err != nil {
		t.Fatalf("replace expired invite: %v", err)
	}
	if !replaced.Created || replaced.Invite.Token != replacementToken || replaced.Invite.ID == created.Invite.ID {
		t.Fatalf("expected replacement invite, got %#v", replaced)
	}

	var oldDeactivatedAt *time.Time
	if err := store.pool.QueryRow(ctx, `SELECT deactivated_at FROM trip_invites WHERE id = $1::uuid`, created.Invite.ID).Scan(&oldDeactivatedAt); err != nil {
		t.Fatalf("select old invite: %v", err)
	}
	if oldDeactivatedAt == nil {
		t.Fatal("expected expired current invite to be deactivated before replacement")
	}
}

func TestAcceptTripInviteCreatesAndReusesParticipant(t *testing.T) {
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

	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('초대 Owner')
		RETURNING id::text
	`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, ownerUserID)
	}()

	var memberUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES (' 초대 Member ')
		RETURNING id::text
	`).Scan(&memberUserID); err != nil {
		t.Fatalf("insert member user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, memberUserID)
	}()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('초대 수락 테스트 여행', '2026-07-10', '2026-07-13', 'KRW', $1::uuid)
		RETURNING id::text
	`, ownerUserID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) }()

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name)
		VALUES ($1::uuid, $2::uuid, 'owner', '초대 Owner')
	`, tripID, ownerUserID); err != nil {
		t.Fatalf("insert owner participant: %v", err)
	}

	now := time.Date(2026, 6, 24, 9, 0, 0, 0, time.UTC)
	token := "accept-token-" + fmt.Sprintf("%d", time.Now().UnixNano()) + "-abcdefghijklmnopqrstuvwxyz"
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_invites (trip_id, token, created_by, expires_at, created_at)
		VALUES ($1::uuid, $2, $3::uuid, $4, $5)
	`, tripID, token, ownerUserID, now.Add(7*24*time.Hour), now); err != nil {
		t.Fatalf("insert invite: %v", err)
	}

	accepted, err := store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: token, UserID: memberUserID, Now: now})
	if err != nil {
		t.Fatalf("accept invite: %v", err)
	}
	if accepted.TripID != tripID || accepted.TripName != "초대 수락 테스트 여행" || accepted.Role != trip.RoleMember || accepted.AlreadyAccepted {
		t.Fatalf("unexpected accepted result: %#v", accepted)
	}

	var displayName string
	if err := store.pool.QueryRow(ctx, `
		SELECT display_name FROM trip_participants WHERE trip_id = $1::uuid AND user_id = $2::uuid
	`, tripID, memberUserID).Scan(&displayName); err != nil {
		t.Fatalf("select member participant: %v", err)
	}
	if displayName != "초대 Member" {
		t.Fatalf("expected trimmed display name snapshot, got %q", displayName)
	}

	reused, err := store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: token, UserID: memberUserID, Now: now})
	if err != nil {
		t.Fatalf("reuse accepted invite: %v", err)
	}
	if reused.Role != trip.RoleMember || !reused.AlreadyAccepted {
		t.Fatalf("expected member idempotent success, got %#v", reused)
	}

	ownerResult, err := store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: token, UserID: ownerUserID, Now: now})
	if err != nil {
		t.Fatalf("owner accept invite: %v", err)
	}
	if ownerResult.Role != trip.RoleOwner || !ownerResult.AlreadyAccepted {
		t.Fatalf("expected owner already accepted success, got %#v", ownerResult)
	}

	var participantCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_participants WHERE trip_id = $1::uuid`, tripID).Scan(&participantCount); err != nil {
		t.Fatalf("count participants: %v", err)
	}
	if participantCount != 2 {
		t.Fatalf("expected owner plus one member, got %d", participantCount)
	}

	memberTrips, err := store.ListTripsByParticipantUser(ctx, memberUserID)
	if err != nil {
		t.Fatalf("list member trips after accept: %v", err)
	}
	if len(memberTrips) != 1 {
		t.Fatalf("expected accepted trip in member trip list, got %#v", memberTrips)
	}
	if memberTrips[0].ID != tripID || memberTrips[0].Name != "초대 수락 테스트 여행" || memberTrips[0].MyRole != trip.RoleMember || memberTrips[0].ParticipantCount != 2 {
		t.Fatalf("expected accepted trip to be listed as member, got %#v", memberTrips[0])
	}

	_, err = store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: token, UserID: memberUserID, Now: now.Add(8 * 24 * time.Hour)})
	if !errors.Is(err, trip.ErrInviteExpired) {
		t.Fatalf("expected ErrInviteExpired, got %v", err)
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

func TestDeleteTripMemberParticipantDeletesOnlyTargetMember(t *testing.T) {
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

	ownerUserID := insertTripRepositoryTestUser(t, ctx, store, "참여자 제거 Owner")
	targetUserID := insertTripRepositoryTestUser(t, ctx, store, "참여자 제거 Target")
	otherUserID := insertTripRepositoryTestUser(t, ctx, store, "참여자 제거 Other")
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, ownerUserID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, targetUserID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, otherUserID)
	}()

	tripID := insertTripRepositoryTestTrip(t, ctx, store, "참여자 제거 테스트 여행", ownerUserID)
	otherTripID := insertTripRepositoryTestTrip(t, ctx, store, "참여자 제거 다른 여행", ownerUserID)
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, otherTripID)
	}()

	ownerParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, ownerUserID, trip.RoleOwner, "주최자")
	targetParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, targetUserID, trip.RoleMember, "제거 대상")
	otherParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, otherUserID, trip.RoleMember, "유지 대상")
	wrongTripParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, otherTripID, targetUserID, trip.RoleMember, "다른 여행")

	deleted, err := store.DeleteTripMemberParticipant(ctx, tripID, targetParticipantID)
	if err != nil {
		t.Fatalf("delete trip member participant: %v", err)
	}
	if !deleted {
		t.Fatal("expected target member participant to be deleted")
	}

	assertTripRepositoryParticipantCount(t, ctx, store, tripID, targetParticipantID, 0)
	assertTripRepositoryParticipantCount(t, ctx, store, tripID, ownerParticipantID, 1)
	assertTripRepositoryParticipantCount(t, ctx, store, tripID, otherParticipantID, 1)
	assertTripRepositoryParticipantCount(t, ctx, store, otherTripID, wrongTripParticipantID, 1)

	deletedAgain, err := store.DeleteTripMemberParticipant(ctx, tripID, targetParticipantID)
	if err != nil {
		t.Fatalf("delete already removed participant: %v", err)
	}
	if deletedAgain {
		t.Fatal("expected already removed participant to report false")
	}

	deletedOwner, err := store.DeleteTripMemberParticipant(ctx, tripID, ownerParticipantID)
	if err != nil {
		t.Fatalf("delete owner participant: %v", err)
	}
	if deletedOwner {
		t.Fatal("expected owner participant not to be removable")
	}

	deletedWrongTrip, err := store.DeleteTripMemberParticipant(ctx, tripID, wrongTripParticipantID)
	if err != nil {
		t.Fatalf("delete wrong-trip participant: %v", err)
	}
	if deletedWrongTrip {
		t.Fatal("expected wrong-trip participant not to be removable")
	}
}

func TestDeleteTripMemberParticipantRefreshesExpenseParticipantFallbacks(t *testing.T) {
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

	ownerUserID := insertTripRepositoryTestUser(t, ctx, store, "F168 Owner")
	targetUserID := insertTripRepositoryTestUser(t, ctx, store, "F168 Target")
	otherUserID := insertTripRepositoryTestUser(t, ctx, store, "F168 Other")
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, targetUserID, otherUserID})
	})

	tripID := insertTripRepositoryTestTrip(t, ctx, store, "F168 참여자 fallback 여행", ownerUserID)
	t.Cleanup(func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) })

	ownerParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, ownerUserID, trip.RoleOwner, "주최자")
	targetParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, targetUserID, trip.RoleMember, "민수")
	otherParticipantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, otherUserID, trip.RoleMember, "지영")
	tripDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")

	var expenseID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO expenses (trip_id, trip_day_id, anchor_type, expense_date, amount_minor, currency, split_policy, payer_participant_id, payer_display_name, created_by)
		VALUES ($1::uuid, $2::uuid, 'trip_day', '2026-07-11', 1200, 'JPY', 'manual', $3::uuid, '민수', $4::uuid)
		RETURNING id::text
	`, tripID, tripDayID, targetParticipantID, ownerUserID).Scan(&expenseID); err != nil {
		t.Fatalf("insert expense: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO expense_splits (expense_id, participant_id, participant_display_name, amount_minor, split_order)
		VALUES
		  ($1::uuid, $2::uuid, '민수', 700, 1),
		  ($1::uuid, $3::uuid, '지영', 500, 2)
	`, expenseID, targetParticipantID, otherParticipantID); err != nil {
		t.Fatalf("insert expense splits: %v", err)
	}

	if _, err := store.pool.Exec(ctx, `UPDATE trip_participants SET display_name = '김민수' WHERE id = $1::uuid`, targetParticipantID); err != nil {
		t.Fatalf("rename target participant: %v", err)
	}

	deleted, err := store.DeleteTripMemberParticipant(ctx, tripID, targetParticipantID)
	if err != nil {
		t.Fatalf("delete trip member participant: %v", err)
	}
	if !deleted {
		t.Fatal("expected target member participant to be deleted")
	}

	expenses, err := store.ListDayExpensesByTripDay(ctx, tripID, tripDayID)
	if err != nil {
		t.Fatalf("list day expenses: %v", err)
	}
	if len(expenses) != 1 {
		t.Fatalf("expected one expense, got %#v", expenses)
	}
	listed := expenses[0]
	if listed.Payer.ParticipantID != nil || listed.Payer.DisplayName != "김민수" || listed.Payer.Source != trip.ExpenseDisplaySourceFallback {
		t.Fatalf("expected removed payer to use latest fallback display, got %#v", listed.Payer)
	}
	if len(listed.Splits) != 2 {
		t.Fatalf("expected two splits, got %#v", listed.Splits)
	}
	if listed.Splits[0].Participant.ParticipantID != nil || listed.Splits[0].Participant.DisplayName != "김민수" || listed.Splits[0].Participant.Source != trip.ExpenseDisplaySourceFallback {
		t.Fatalf("expected removed split participant to use latest fallback display, got %#v", listed.Splits[0].Participant)
	}
	if listed.Splits[1].Participant.ParticipantID == nil || *listed.Splits[1].Participant.ParticipantID != otherParticipantID || listed.Splits[1].Participant.DisplayName != "지영" || listed.Splits[1].Participant.Source != trip.ExpenseDisplaySourceLive {
		t.Fatalf("expected unaffected split participant to stay live, got %#v", listed.Splits[1].Participant)
	}

	assertTripRepositoryParticipantCount(t, ctx, store, tripID, ownerParticipantID, 1)
	assertTripRepositoryParticipantCount(t, ctx, store, tripID, otherParticipantID, 1)
	assertTripRepositoryParticipantCount(t, ctx, store, tripID, targetParticipantID, 0)
}

func TestListTripParticipantsOrdersOwnerFirstThenJoinedAt(t *testing.T) {
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

	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('참여자 목록 Owner')
		RETURNING id::text
	`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, ownerUserID)
	}()

	var memberEarlyUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('참여자 목록 Early')
		RETURNING id::text
	`).Scan(&memberEarlyUserID); err != nil {
		t.Fatalf("insert early member user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, memberEarlyUserID)
	}()

	var memberLateUserID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ('참여자 목록 Late')
		RETURNING id::text
	`).Scan(&memberLateUserID); err != nil {
		t.Fatalf("insert late member user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, memberLateUserID)
	}()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('참여자 목록 테스트 여행', '2026-07-10', '2026-07-13', 'JPY', $1::uuid)
		RETURNING id::text
	`, ownerUserID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}

	var ownerParticipantID string
	var earlyParticipantID string
	var lateParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '늦게 합류', '2026-06-23T09:00:00Z')
		RETURNING id::text
	`, tripID, memberLateUserID).Scan(&lateParticipantID); err != nil {
		t.Fatalf("insert late member participant: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'owner', '주최자', '2026-06-24T09:00:00Z')
		RETURNING id::text
	`, tripID, ownerUserID).Scan(&ownerParticipantID); err != nil {
		t.Fatalf("insert owner participant: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '먼저 합류', '2026-06-22T09:00:00Z')
		RETURNING id::text
	`, tripID, memberEarlyUserID).Scan(&earlyParticipantID); err != nil {
		t.Fatalf("insert early member participant: %v", err)
	}

	participants, err := store.ListTripParticipants(ctx, tripID)
	if err != nil {
		t.Fatalf("list trip participants: %v", err)
	}
	if len(participants) != 3 {
		t.Fatalf("expected three participants, got %#v", participants)
	}
	gotIDs := []string{participants[0].ParticipantID, participants[1].ParticipantID, participants[2].ParticipantID}
	expectedIDs := []string{ownerParticipantID, earlyParticipantID, lateParticipantID}
	for index, expectedID := range expectedIDs {
		if gotIDs[index] != expectedID {
			t.Fatalf("unexpected participant order: got %#v expected %#v", gotIDs, expectedIDs)
		}
	}
	if participants[0].DisplayName != "주최자" || participants[0].Role != trip.RoleOwner {
		t.Fatalf("unexpected owner mapping: %#v", participants[0])
	}
}

type moveScheduleItemFixture struct {
	tripID                string
	sourceDayID           string
	targetDayID           string
	movedItemID           string
	movedPlaceID          string
	sourceRemainingItemID string
	targetExistingItemID  string
	scheduleExpenseID     string
	dayExpenseID          string
	tripExpenseID         string
}

func createMoveScheduleItemFixture(t *testing.T, ctx context.Context, store *Store, label string) moveScheduleItemFixture {
	t.Helper()

	userID := insertTripRepositoryTestUser(t, ctx, store, label+" 사용자")
	t.Cleanup(func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, userID) })
	tripID := insertTripRepositoryTestTrip(t, ctx, store, label+" 여행", userID)
	t.Cleanup(func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) })
	participantID := insertTripRepositoryTestParticipant(t, ctx, store, tripID, userID, trip.RoleOwner, "주최자")
	sourceDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")
	targetDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-12")

	movedPlaceID := insertTripRepositoryTestPlace(t, ctx, store, tripID, label+" 수영장", "food")
	sourceRemainingPlaceID := insertTripRepositoryTestPlace(t, ctx, store, tripID, label+" 오사카성", "sights")
	targetExistingPlaceID := insertTripRepositoryTestPlace(t, ctx, store, tripID, label+" 도톤보리", "food")

	movedItemID := insertTripRepositoryTestScheduleItem(t, ctx, store, tripID, sourceDayID, movedPlaceID, "수영", "수건 챙기기", "09:30", "11:00", 1, "0000000000000001024", 7, true)
	sourceRemainingItemID := insertTripRepositoryTestScheduleItem(t, ctx, store, tripID, sourceDayID, sourceRemainingPlaceID, "오사카성", "", "", "", 2, "0000000000000002048", 1, false)
	targetExistingItemID := insertTripRepositoryTestScheduleItem(t, ctx, store, tripID, targetDayID, targetExistingPlaceID, "도톤보리", "", "", "", 1, "0000000000000001024", 2, false)

	scheduleExpenseID := insertTripRepositoryTestExpense(t, ctx, store, tripID, sourceDayID, movedItemID, participantID, userID, "schedule_item", "2026-07-01")
	dayExpenseID := insertTripRepositoryTestExpense(t, ctx, store, tripID, sourceDayID, "", participantID, userID, "trip_day", "2026-07-11")
	tripExpenseID := insertTripRepositoryTestExpense(t, ctx, store, tripID, "", "", participantID, userID, "trip", "2026-07-09")

	return moveScheduleItemFixture{
		tripID:                tripID,
		sourceDayID:           sourceDayID,
		targetDayID:           targetDayID,
		movedItemID:           movedItemID,
		movedPlaceID:          movedPlaceID,
		sourceRemainingItemID: sourceRemainingItemID,
		targetExistingItemID:  targetExistingItemID,
		scheduleExpenseID:     scheduleExpenseID,
		dayExpenseID:          dayExpenseID,
		tripExpenseID:         tripExpenseID,
	}
}

func insertTripRepositoryTestPlace(t *testing.T, ctx context.Context, store *Store, tripID string, name string, placeType string) string {
	t.Helper()
	var placeID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_places (trip_id, name, address, place_type)
		VALUES ($1::uuid, $2, $3, $4)
		RETURNING id::text
	`, tripID, name, name+" 주소", placeType).Scan(&placeID); err != nil {
		t.Fatalf("insert trip place %q: %v", name, err)
	}
	return placeID
}

func insertTripRepositoryTestScheduleItem(t *testing.T, ctx context.Context, store *Store, tripID string, tripDayID string, placeID string, title string, memo string, startTime string, endTime string, itemOrder int, rank string, version int, arrived bool) string {
	t.Helper()
	var itemID string
	arrivedSQL := "NULL"
	if arrived {
		arrivedSQL = "'2026-07-11T09:40:00Z'"
	}
	memoValue := interface{}(nil)
	if memo != "" {
		memoValue = memo
	}
	startValue := interface{}(nil)
	if startTime != "" {
		startValue = startTime
	}
	endValue := interface{}(nil)
	if endTime != "" {
		endValue = endTime
	}
	query := fmt.Sprintf(`
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, place_memo, start_time, end_time, item_order, rank, version, arrived_at)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::time, $7::time, $8, $9, $10, %s::timestamptz)
		RETURNING id::text
	`, arrivedSQL)
	if err := store.pool.QueryRow(ctx, query, tripID, tripDayID, placeID, title, memoValue, startValue, endValue, itemOrder, rank, version).Scan(&itemID); err != nil {
		t.Fatalf("insert schedule item %q: %v", title, err)
	}
	return itemID
}

func insertTripRepositoryTestExpense(t *testing.T, ctx context.Context, store *Store, tripID string, tripDayID string, scheduleItemID string, payerParticipantID string, createdBy string, anchorType string, expenseDate string) string {
	t.Helper()
	var expenseID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO expenses (trip_id, anchor_type, trip_day_id, schedule_item_id, expense_date, amount_minor, currency, split_policy, payer_participant_id, payer_display_name, created_by)
		VALUES ($1::uuid, $2, NULLIF($3, '')::uuid, NULLIF($4, '')::uuid, $5::date, 1200, 'JPY', 'equal', $6::uuid, '주최자', $7::uuid)
		RETURNING id::text
	`, tripID, anchorType, tripDayID, scheduleItemID, expenseDate, payerParticipantID, createdBy).Scan(&expenseID); err != nil {
		t.Fatalf("insert %s expense: %v", anchorType, err)
	}
	return expenseID
}

func assertScheduleItemAnchor(t *testing.T, ctx context.Context, store *Store, itemID string, wantTripDayID string, wantVersion int, wantStatusReset bool) {
	t.Helper()
	var tripDayID string
	var version int
	var arrivedSet bool
	var skippedSet bool
	if err := store.pool.QueryRow(ctx, `
		SELECT trip_day_id::text, version, arrived_at IS NOT NULL, skipped_at IS NOT NULL
		FROM schedule_items
		WHERE id = $1::uuid
	`, itemID).Scan(&tripDayID, &version, &arrivedSet, &skippedSet); err != nil {
		t.Fatalf("query schedule item anchor: %v", err)
	}
	if tripDayID != wantTripDayID || version != wantVersion {
		t.Fatalf("unexpected schedule item anchor/version: day=%q version=%d", tripDayID, version)
	}
	if wantStatusReset && (arrivedSet || skippedSet) {
		t.Fatalf("expected schedule item status reset, arrived=%v skipped=%v", arrivedSet, skippedSet)
	}
	if !wantStatusReset && !arrivedSet {
		t.Fatalf("expected original arrived status to remain set")
	}
}

func assertExpenseAnchor(t *testing.T, ctx context.Context, store *Store, expenseID string, wantTripDayID string, wantScheduleItemID string, wantExpenseDate string) {
	t.Helper()
	var tripDayID string
	var scheduleItemID string
	var expenseDate string
	if err := store.pool.QueryRow(ctx, `
		SELECT COALESCE(trip_day_id::text, ''), COALESCE(schedule_item_id::text, ''), expense_date::text
		FROM expenses
		WHERE id = $1::uuid
	`, expenseID).Scan(&tripDayID, &scheduleItemID, &expenseDate); err != nil {
		t.Fatalf("query expense anchor: %v", err)
	}
	if tripDayID != wantTripDayID || scheduleItemID != wantScheduleItemID || expenseDate != wantExpenseDate {
		t.Fatalf("unexpected expense anchor/date: day=%q item=%q date=%q", tripDayID, scheduleItemID, expenseDate)
	}
}

func insertTripRepositoryTestUser(t *testing.T, ctx context.Context, store *Store, displayName string) string {
	t.Helper()

	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name)
		VALUES ($1)
		RETURNING id::text
	`, displayName).Scan(&userID); err != nil {
		t.Fatalf("insert user %q: %v", displayName, err)
	}
	return userID
}

func insertTripRepositoryTestTrip(t *testing.T, ctx context.Context, store *Store, name string, createdBy string) string {
	t.Helper()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ($1, '2026-07-10', '2026-07-13', 'JPY', $2::uuid)
		RETURNING id::text
	`, name, createdBy).Scan(&tripID); err != nil {
		t.Fatalf("insert trip %q: %v", name, err)
	}
	return tripID
}

func insertTripRepositoryTestParticipant(t *testing.T, ctx context.Context, store *Store, tripID string, userID string, role string, displayName string) string {
	t.Helper()

	var participantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name)
		VALUES ($1::uuid, $2::uuid, $3, $4)
		RETURNING id::text
	`, tripID, userID, role, displayName).Scan(&participantID); err != nil {
		t.Fatalf("insert participant %q: %v", displayName, err)
	}
	return participantID
}

func assertTripRepositoryParticipantCount(t *testing.T, ctx context.Context, store *Store, tripID string, participantID string, want int) {
	t.Helper()

	var count int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM trip_participants
		WHERE trip_id = $1::uuid
		  AND id = $2::uuid
	`, tripID, participantID).Scan(&count); err != nil {
		t.Fatalf("count participant %s: %v", participantID, err)
	}
	if count != want {
		t.Fatalf("expected participant %s count %d, got %d", participantID, want, count)
	}
}

func tripRepositoryTestDayID(t *testing.T, ctx context.Context, store *Store, tripID string, date string) string {
	t.Helper()

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		SELECT
		  t.id,
		  day::date,
		  row_number() OVER (ORDER BY day::date)::integer,
		  NULL,
		  now()
		FROM trips t
		CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		WHERE t.id = $1::uuid
		ON CONFLICT (trip_id, date) DO UPDATE
		SET day_order = EXCLUDED.day_order,
		    deleted_at = NULL,
		    updated_at = now()
	`, tripID); err != nil {
		t.Fatalf("sync trip days for trip %s: %v", tripID, err)
	}

	var tripDayID string
	if err := store.pool.QueryRow(ctx, `
		SELECT id::text
		FROM trip_days
		WHERE trip_id = $1::uuid
		  AND date = $2::date
		  AND deleted_at IS NULL
	`, tripID, date).Scan(&tripDayID); err != nil {
		t.Fatalf("select trip day %s for trip %s: %v", date, tripID, err)
	}
	return tripDayID
}

func stringPtr(value string) *string {
	return &value
}

func createRankedDayScheduleFixture(t *testing.T, ctx context.Context, store *Store, label string, ranks []string, versions []int) (string, string, []string) {
	t.Helper()
	if len(ranks) != len(versions) {
		t.Fatalf("ranks/versions length mismatch: %d != %d", len(ranks), len(versions))
	}

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
	tripDayID := tripRepositoryTestDayID(t, ctx, store, tripID, "2026-07-11")

	itemIDs := make([]string, 0, len(ranks))
	for index, rank := range ranks {
		var placeID string
		placeName := fmt.Sprintf("%s 장소 %d", label, index+1)
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO trip_places (trip_id, name, address, place_type)
			VALUES ($1::uuid, $2, $3, 'sights')
			RETURNING id::text
		`, tripID, placeName, placeName+" 주소").Scan(&placeID); err != nil {
			t.Fatalf("insert trip place %d: %v", index, err)
		}

		var itemID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
			VALUES ($1::uuid, $2::uuid, $3::uuid, '장소 일정', $4, $5, $6)
			RETURNING id::text
		`, tripID, tripDayID, placeID, index+1, rank, versions[index]).Scan(&itemID); err != nil {
			t.Fatalf("insert schedule item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
	}

	return tripID, tripDayID, itemIDs
}

func loadPersistedOrderedScheduleRows(t *testing.T, ctx context.Context, store *Store, tripID string, tripDayID string) []orderedScheduleRow {
	t.Helper()

	rows, err := store.pool.Query(ctx, `
		SELECT id::text, rank, version
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND deleted_at IS NULL
		ORDER BY rank ASC, id ASC
	`, tripID, tripDayID)
	if err != nil {
		t.Fatalf("query persisted schedule rows: %v", err)
	}
	defer rows.Close()

	items := make([]orderedScheduleRow, 0)
	for rows.Next() {
		var item orderedScheduleRow
		if err := rows.Scan(&item.ID, &item.Rank, &item.Version); err != nil {
			t.Fatalf("scan persisted schedule row: %v", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate persisted schedule rows: %v", err)
	}
	return items
}

func createReorderDayScheduleFixture(t *testing.T, ctx context.Context, store *Store, label string) (string, []string, map[string]string) {
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
			WITH ensured_trip_days AS (
		  INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		  SELECT
		    t.id,
		    day::date,
		    row_number() OVER (ORDER BY day::date)::integer,
		    NULL,
		    now()
		  FROM trips t
		  CROSS JOIN LATERAL generate_series(t.start_date, t.end_date, interval '1 day') AS day
		  WHERE t.id = $1::uuid
		  ON CONFLICT (trip_id, date) DO UPDATE
		  SET day_order = EXCLUDED.day_order,
		      deleted_at = NULL,
		      updated_at = now()
		  RETURNING id, date
		)
		INSERT INTO schedule_items (trip_id, trip_day_id, trip_place_id, place_title, item_order, rank, version)
			VALUES ($1::uuid, (SELECT id FROM ensured_trip_days WHERE date = '2026-07-11'), $2::uuid, '장소 일정', $3, $4, 1)
			RETURNING id::text
		`, tripID, placeID, index+1, ranks[index]).Scan(&itemID); err != nil {
			t.Fatalf("insert schedule item %d: %v", index, err)
		}
		itemIDs = append(itemIDs, itemID)
		initialRanks[itemID] = ranks[index]
	}

	return tripID, itemIDs, initialRanks
}

func installForcedReorderRankCollision(t *testing.T, ctx context.Context, store *Store, itemID string, collisionCount int) {
	t.Helper()

	cleanup := `
		DROP TRIGGER IF EXISTS reorder_rank_collision_trigger ON schedule_items;
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
					USING ERRCODE = '23505', CONSTRAINT = 'schedule_items_active_day_rank_unique';
			END IF;
			RETURN NEW;
		END;
		$$;

		CREATE TRIGGER reorder_rank_collision_trigger
		BEFORE UPDATE ON schedule_items
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
