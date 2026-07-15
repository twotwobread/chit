package storage

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/flight"
)

func TestUpdateFlightChangesSharedMetadataWithoutChangingPersonalDetails(t *testing.T) {
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
	var editorUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('지영') RETURNING id::text`).Scan(&editorUserID); err != nil {
		t.Fatalf("insert editor user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, editorUserID})
	}()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('항공편 수정 테스트 여행', '2026-08-01', '2026-08-05', 'KRW', $1::uuid)
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
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '지영', '2026-07-02T00:00:00Z')
	`, tripID, editorUserID); err != nil {
		t.Fatalf("insert editor participant: %v", err)
	}

	created, err := store.CreateFlightWithPassengers(ctx, flight.CreateFlightRecord{
		TripID:          tripID,
		CreatedByUserID: ownerUserID,
		DisplayTitle:    "KE 017",
		FlightNumber:    stringPtrStorage("KE017"),
		Departure:       flight.FlightEndpoint{AirportText: "ICN", AirportCode: stringPtrStorage("ICN"), LocalDate: "2026-08-01", LocalTime: "14:30", TimeZone: "Asia/Seoul", At: time.Date(2026, 8, 1, 5, 30, 0, 0, time.UTC)},
		Arrival:         flight.FlightEndpoint{AirportText: "LAX", AirportCode: stringPtrStorage("LAX"), LocalDate: "2026-08-01", LocalTime: "09:50", TimeZone: "America/Los_Angeles", At: time.Date(2026, 8, 1, 16, 50, 0, 0, time.UTC)},
		PassengerIDs:    []string{ownerParticipantID},
	})
	if err != nil {
		t.Fatalf("create flight: %v", err)
	}
	reservationNumber := "OWNER-ABC"
	if _, err := store.UpsertPersonalDetail(ctx, flight.UpsertPersonalDetailRecord{TripID: tripID, FlightID: created.ID, PassengerParticipantID: ownerParticipantID, CreatedByUserID: ownerUserID, ReservationNumber: &reservationNumber}); err != nil {
		t.Fatalf("upsert owner personal detail: %v", err)
	}

	updated, err := store.UpdateFlight(ctx, flight.UpdateFlightRecord{
		TripID:          tripID,
		FlightID:        created.ID,
		UpdatedByUserID: editorUserID,
		DisplayTitle:    "KE 018",
		FlightNumber:    stringPtrStorage("KE018"),
		Departure:       flight.FlightEndpoint{AirportText: "인천", AirportCode: stringPtrStorage("ICN"), LocalDate: "2026-08-02", LocalTime: "14:30", TimeZone: "Asia/Seoul", At: time.Date(2026, 8, 2, 5, 30, 0, 0, time.UTC)},
		Arrival:         flight.FlightEndpoint{AirportText: "로스앤젤레스", AirportCode: stringPtrStorage("LAX"), LocalDate: "2026-08-02", LocalTime: "09:50", TimeZone: "America/Los_Angeles", At: time.Date(2026, 8, 2, 16, 50, 0, 0, time.UTC)},
	})
	if err != nil {
		t.Fatalf("update flight: %v", err)
	}
	if updated.DisplayTitle != "KE 018" || updated.FlightNumber == nil || *updated.FlightNumber != "KE018" || updated.Departure.AirportText != "인천" {
		t.Fatalf("unexpected updated flight: %#v", updated.Flight)
	}
	if updated.MyPersonalDetail != nil {
		t.Fatalf("expected non-passenger editor not to receive owner private detail, got %#v", updated.MyPersonalDetail)
	}

	ownerView, err := store.GetFlight(ctx, tripID, created.ID, ownerUserID)
	if err != nil {
		t.Fatalf("get flight as owner: %v", err)
	}
	if ownerView.MyPersonalDetail == nil || ownerView.MyPersonalDetail.ReservationNumber == nil || *ownerView.MyPersonalDetail.ReservationNumber != "OWNER-ABC" {
		t.Fatalf("expected owner private detail to remain, got %#v", ownerView.MyPersonalDetail)
	}
}

func TestAddFlightPassengersAddsMembershipWithoutCreatingPersonalDetails(t *testing.T) {
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
	var lateUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('지영') RETURNING id::text`).Scan(&lateUserID); err != nil {
		t.Fatalf("insert late user: %v", err)
	}
	var otherUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('하준') RETURNING id::text`).Scan(&otherUserID); err != nil {
		t.Fatalf("insert other user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, lateUserID, otherUserID})
	}()

	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('항공편 추가 테스트 여행', '2026-08-01', '2026-08-05', 'KRW', $1::uuid)
		RETURNING id::text
	`, ownerUserID).Scan(&tripID); err != nil {
		t.Fatalf("insert trip: %v", err)
	}
	defer func() { _, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, tripID) }()

	var otherTripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ('다른 여행', '2026-08-01', '2026-08-05', 'KRW', $1::uuid)
		RETURNING id::text
	`, otherUserID).Scan(&otherTripID); err != nil {
		t.Fatalf("insert other trip: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE id = $1::uuid`, otherTripID)
	}()

	var ownerParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'owner', '민수', '2026-07-01T00:00:00Z')
		RETURNING id::text
	`, tripID, ownerUserID).Scan(&ownerParticipantID); err != nil {
		t.Fatalf("insert owner participant: %v", err)
	}
	var lateParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'member', '지영', '2026-07-02T00:00:00Z')
		RETURNING id::text
	`, tripID, lateUserID).Scan(&lateParticipantID); err != nil {
		t.Fatalf("insert late participant: %v", err)
	}
	var otherParticipantID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, 'owner', '하준', '2026-07-03T00:00:00Z')
		RETURNING id::text
	`, otherTripID, otherUserID).Scan(&otherParticipantID); err != nil {
		t.Fatalf("insert other participant: %v", err)
	}

	created, err := store.CreateFlightWithPassengers(ctx, flight.CreateFlightRecord{
		TripID:          tripID,
		CreatedByUserID: ownerUserID,
		DisplayTitle:    "KE 017",
		Departure:       flight.FlightEndpoint{AirportText: "ICN", LocalDate: "2026-08-01", LocalTime: "14:30", TimeZone: "Asia/Seoul", At: time.Date(2026, 8, 1, 5, 30, 0, 0, time.UTC)},
		Arrival:         flight.FlightEndpoint{AirportText: "LAX", LocalDate: "2026-08-01", LocalTime: "09:50", TimeZone: "America/Los_Angeles", At: time.Date(2026, 8, 1, 16, 50, 0, 0, time.UTC)},
		PassengerIDs:    []string{ownerParticipantID},
	})
	if err != nil {
		t.Fatalf("create flight: %v", err)
	}

	reservationNumber := "OWNER-ABC"
	if _, err := store.UpsertPersonalDetail(ctx, flight.UpsertPersonalDetailRecord{TripID: tripID, FlightID: created.ID, PassengerParticipantID: ownerParticipantID, CreatedByUserID: ownerUserID, ReservationNumber: &reservationNumber}); err != nil {
		t.Fatalf("upsert owner personal detail: %v", err)
	}

	updated, err := store.AddFlightPassengers(ctx, flight.AddPassengersRecord{TripID: tripID, FlightID: created.ID, AddedByUserID: ownerUserID, PassengerIDs: []string{lateParticipantID}})
	if err != nil {
		t.Fatalf("add flight passengers: %v", err)
	}
	if len(updated.Passengers) != 2 {
		t.Fatalf("expected two passengers, got %#v", updated.Passengers)
	}

	lateView, err := store.GetFlight(ctx, tripID, created.ID, lateUserID)
	if err != nil {
		t.Fatalf("get flight as late passenger: %v", err)
	}
	if lateView.MyPersonalDetail == nil {
		t.Fatalf("expected late passenger to see flight as mine")
	}
	if lateView.MyPersonalDetail.ReservationNumber != nil {
		t.Fatalf("expected owner reservation number to remain private, got %#v", lateView.MyPersonalDetail.ReservationNumber)
	}

	returnFlight, err := store.CreateFlightWithPassengers(ctx, flight.CreateFlightRecord{
		TripID:          tripID,
		CreatedByUserID: ownerUserID,
		DisplayTitle:    "KE 018",
		Departure:       flight.FlightEndpoint{AirportText: "LAX", LocalDate: "2026-08-05", LocalTime: "12:00", TimeZone: "America/Los_Angeles", At: time.Date(2026, 8, 5, 19, 0, 0, 0, time.UTC)},
		Arrival:         flight.FlightEndpoint{AirportText: "ICN", LocalDate: "2026-08-06", LocalTime: "17:00", TimeZone: "Asia/Seoul", At: time.Date(2026, 8, 6, 8, 0, 0, 0, time.UTC)},
		PassengerIDs:    []string{ownerParticipantID},
	})
	if err != nil {
		t.Fatalf("create return flight: %v", err)
	}
	if _, err := store.AddFlightPassengers(ctx, flight.AddPassengersRecord{TripID: tripID, FlightID: returnFlight.ID, AddedByUserID: ownerUserID, PassengerIDs: []string{lateParticipantID}}); err != nil {
		t.Fatalf("same participant on another flight should be allowed, got %v", err)
	}

	if _, err := store.AddFlightPassengers(ctx, flight.AddPassengersRecord{TripID: tripID, FlightID: created.ID, AddedByUserID: ownerUserID, PassengerIDs: []string{lateParticipantID}}); !errors.Is(err, flight.ErrConflict) {
		t.Fatalf("duplicate passenger error = %v, want ErrConflict", err)
	}
	if _, err := store.AddFlightPassengers(ctx, flight.AddPassengersRecord{TripID: tripID, FlightID: created.ID, AddedByUserID: ownerUserID, PassengerIDs: []string{otherParticipantID}}); !errors.Is(err, flight.ErrConflict) {
		t.Fatalf("other trip participant error = %v, want ErrConflict", err)
	}
}

func stringPtrStorage(value string) *string { return &value }
