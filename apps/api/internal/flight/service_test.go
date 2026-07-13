package flight

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

const (
	testTripID        = "11111111-1111-1111-1111-111111111111"
	testUserID        = "22222222-2222-2222-2222-222222222222"
	testParticipantID = "33333333-3333-3333-3333-333333333333"
	testFlightID      = "44444444-4444-4444-4444-444444444444"
)

func TestServiceCreateFlightDerivesAirportLocalInstants(t *testing.T) {
	repo := &fakeRepository{
		membershipParticipantID: testParticipantID,
		createdFlight: Flight{
			ID:              testFlightID,
			TripID:          testTripID,
			DisplayTitle:    "KE 017",
			FlightNumber:    stringPtr("KE017"),
			CreatedByUserID: testUserID,
		},
	}
	service := NewService(repo)

	_, err := service.CreateFlight(context.Background(), testUserID, testTripID, CreateFlightInput{
		DisplayTitle: "  KE 017  ",
		FlightNumber: stringPtr(" ke017 "),
		PassengerIDs: []string{testParticipantID},
		Departure:    FlightEndpointInput{AirportText: " ICN ", AirportCode: stringPtr(" icn "), LocalDate: "2026-08-01", LocalTime: "14:30", TimeZone: "Asia/Seoul"},
		Arrival:      FlightEndpointInput{AirportText: " LAX ", AirportCode: stringPtr(" lax "), LocalDate: "2026-08-01", LocalTime: "09:50", TimeZone: "America/Los_Angeles"},
	})
	if err != nil {
		t.Fatalf("CreateFlight returned error: %v", err)
	}

	record := repo.createRecord
	if record.DisplayTitle != "KE 017" || record.FlightNumber == nil || *record.FlightNumber != "KE017" {
		t.Fatalf("expected trimmed title and upper flight number, got %#v", record)
	}
	if record.Departure.AirportText != "ICN" || record.Departure.AirportCode == nil || *record.Departure.AirportCode != "ICN" {
		t.Fatalf("expected normalized departure airport, got %#v", record.Departure)
	}
	if record.Arrival.AirportText != "LAX" || record.Arrival.AirportCode == nil || *record.Arrival.AirportCode != "LAX" {
		t.Fatalf("expected normalized arrival airport, got %#v", record.Arrival)
	}
	if got, want := record.Departure.At.Format(time.RFC3339), "2026-08-01T05:30:00Z"; got != want {
		t.Fatalf("departure instant = %s, want %s", got, want)
	}
	if got, want := record.Arrival.At.Format(time.RFC3339), "2026-08-01T16:50:00Z"; got != want {
		t.Fatalf("arrival instant = %s, want %s", got, want)
	}
	if !reflect.DeepEqual(record.PassengerIDs, []string{testParticipantID}) {
		t.Fatalf("unexpected passengers %#v", record.PassengerIDs)
	}
}

func TestServiceCreateFlightValidatesTimeZonesAndDSTGaps(t *testing.T) {
	service := NewService(&fakeRepository{membershipParticipantID: testParticipantID})
	base := CreateFlightInput{
		DisplayTitle: "DST flight",
		PassengerIDs: []string{testParticipantID},
		Departure:    FlightEndpointInput{AirportText: "LAX", LocalDate: "2026-03-08", LocalTime: "01:30", TimeZone: "America/Los_Angeles"},
		Arrival:      FlightEndpointInput{AirportText: "SFO", LocalDate: "2026-03-08", LocalTime: "03:30", TimeZone: "America/Los_Angeles"},
	}

	invalidZone := base
	invalidZone.Departure.TimeZone = "PST"
	if _, err := service.CreateFlight(context.Background(), testUserID, testTripID, invalidZone); !errors.Is(err, ErrValidation) {
		t.Fatalf("invalid zone error = %v, want ErrValidation", err)
	}

	dstGap := base
	dstGap.Departure.LocalTime = "02:30"
	if _, err := service.CreateFlight(context.Background(), testUserID, testTripID, dstGap); !errors.Is(err, ErrValidation) {
		t.Fatalf("DST gap error = %v, want ErrValidation", err)
	}
}

func TestServiceCreateFlightAllowsDateLineWhenUtcArrivalIsAfterDeparture(t *testing.T) {
	repo := &fakeRepository{membershipParticipantID: testParticipantID, createdFlight: Flight{ID: testFlightID}}
	service := NewService(repo)

	_, err := service.CreateFlight(context.Background(), testUserID, testTripID, CreateFlightInput{
		DisplayTitle: "Date line",
		PassengerIDs: []string{testParticipantID},
		Departure:    FlightEndpointInput{AirportText: "NRT", LocalDate: "2026-08-02", LocalTime: "18:00", TimeZone: "Asia/Tokyo"},
		Arrival:      FlightEndpointInput{AirportText: "HNL", LocalDate: "2026-08-02", LocalTime: "06:30", TimeZone: "Pacific/Honolulu"},
	})
	if err != nil {
		t.Fatalf("CreateFlight returned error: %v", err)
	}
	if !repo.createRecord.Arrival.At.After(repo.createRecord.Departure.At) {
		t.Fatalf("expected UTC arrival after departure, got departure=%s arrival=%s", repo.createRecord.Departure.At, repo.createRecord.Arrival.At)
	}
}

func TestServiceUpsertPersonalDetailRequiresCurrentPassengerAndNormalizesFields(t *testing.T) {
	repo := &fakeRepository{passengerParticipantID: testParticipantID, personalDetail: PersonalDetail{PassengerParticipantID: testParticipantID}}
	service := NewService(repo)

	result, err := service.UpsertMyPersonalDetail(context.Background(), testUserID, testTripID, testFlightID, UpsertPersonalDetailInput{
		ReservationNumber: stringPtr(" ABC123 "),
		Seat:              stringPtr(" 12A "),
		CheckInURL:        stringPtr(" https://airline.example/checkin "),
	})
	if err != nil {
		t.Fatalf("UpsertMyPersonalDetail returned error: %v", err)
	}
	if repo.upsertRecord.PassengerParticipantID != testParticipantID {
		t.Fatalf("expected current passenger participant id, got %#v", repo.upsertRecord)
	}
	if repo.upsertRecord.ReservationNumber == nil || *repo.upsertRecord.ReservationNumber != "ABC123" {
		t.Fatalf("expected trimmed reservation number, got %#v", repo.upsertRecord.ReservationNumber)
	}
	if result.PassengerParticipantID != testParticipantID {
		t.Fatalf("unexpected result %#v", result)
	}

	repo.passengerErr = ErrNotFound
	if _, err := service.UpsertMyPersonalDetail(context.Background(), testUserID, testTripID, testFlightID, UpsertPersonalDetailInput{}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("non-passenger error = %v, want ErrForbidden", err)
	}
}

type fakeRepository struct {
	membershipParticipantID string
	passengerParticipantID  string
	passengerErr            error
	createdFlight           Flight
	personalDetail          PersonalDetail
	createRecord            CreateFlightRecord
	upsertRecord            UpsertPersonalDetailRecord
}

func (r *fakeRepository) GetTripParticipantID(ctx context.Context, tripID string, userID string) (string, error) {
	if r.membershipParticipantID == "" {
		return "", ErrNotFound
	}
	return r.membershipParticipantID, nil
}

func (r *fakeRepository) CreateFlightWithPassengers(ctx context.Context, record CreateFlightRecord) (FlightDetail, error) {
	r.createRecord = record
	return FlightDetail{Flight: r.createdFlight}, nil
}

func (r *fakeRepository) ListFlights(ctx context.Context, tripID string, userID string) ([]FlightDetail, error) {
	return nil, nil
}

func (r *fakeRepository) GetFlight(ctx context.Context, tripID string, flightID string, userID string) (FlightDetail, error) {
	return FlightDetail{}, nil
}

func (r *fakeRepository) GetFlightPassengerParticipantID(ctx context.Context, tripID string, flightID string, userID string) (string, error) {
	if r.passengerErr != nil {
		return "", r.passengerErr
	}
	if r.passengerParticipantID == "" {
		return "", ErrNotFound
	}
	return r.passengerParticipantID, nil
}

func (r *fakeRepository) UpsertPersonalDetail(ctx context.Context, record UpsertPersonalDetailRecord) (PersonalDetail, error) {
	r.upsertRecord = record
	return r.personalDetail, nil
}

func (r *fakeRepository) UpsertBoardingPassMetadata(ctx context.Context, record UpsertBoardingPassMetadataRecord) (PersonalDetail, *BoardingPassObject, error) {
	return PersonalDetail{FlightID: record.FlightID, TripID: record.TripID, PassengerParticipantID: record.PassengerParticipantID, BoardingPass: BoardingPassSummary{Exists: true, ContentType: &record.Object.ContentType, ByteSize: &record.Object.ByteSize, UploadedAt: &record.Object.UploadedAt}}, nil, nil
}

func (r *fakeRepository) ClearBoardingPassMetadata(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (*BoardingPassObject, error) {
	return nil, nil
}

func (r *fakeRepository) GetBoardingPassObject(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (BoardingPassObject, error) {
	return BoardingPassObject{}, ErrNotFound
}

func stringPtr(value string) *string { return &value }
