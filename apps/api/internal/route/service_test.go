package route

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	testTripID = "00000000-0000-0000-0000-000000000001"
	testItemID = "00000000-0000-0000-0000-000000000101"
)

type fakeRepository struct {
	trip           trip.Trip
	tripFound      bool
	participant    bool
	items          []trip.DayItineraryItem
	listItemsErr   error
	participantErr error
}

func (r *fakeRepository) GetTripByID(context.Context, string) (trip.Trip, bool, error) {
	return r.trip, r.tripFound, nil
}

func (r *fakeRepository) IsTripParticipant(context.Context, string, string) (bool, error) {
	return r.participant, r.participantErr
}

func (r *fakeRepository) ListItineraryItemsByTripAndDate(context.Context, string, string) ([]trip.DayItineraryItem, error) {
	return r.items, r.listItemsErr
}

type fakeProvider struct {
	input  ProviderPreviewInput
	result ProviderPreviewResult
	err    error
}

func (p *fakeProvider) Preview(_ context.Context, input ProviderPreviewInput) (ProviderPreviewResult, error) {
	p.input = input
	return p.result, p.err
}

func TestServiceCreatePreviewSuccess(t *testing.T) {
	transfers := 1
	provider := &fakeProvider{result: ProviderPreviewResult{
		DurationSeconds: 1320,
		DistanceMeters:  5400,
		EncodedPolyline: "encoded",
		Bounds: &GeoBounds{
			Northeast: GeoPoint{Latitude: 37.6, Longitude: 127.1},
			Southwest: GeoPoint{Latitude: 37.5, Longitude: 127.0},
		},
		TransferCount: &transfers,
	}}
	service := NewService(&fakeRepository{
		trip:        trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-12"},
		tripFound:   true,
		participant: true,
		items: []trip.DayItineraryItem{{
			ID: testItemID,
			Place: trip.TripPlaceSummary{RoutablePlace: &trip.RoutablePlace{
				Provider:      "google",
				GooglePlaceID: "google-1",
				Latitude:      37.5665,
				Longitude:     126.978,
			}},
		}},
	}, provider, WithClock(func() time.Time { return time.Date(2026, 6, 25, 1, 2, 3, 0, time.UTC) }))

	result, err := service.CreatePreview(context.Background(), "user-1", testTripID, "2026-07-10", testItemID, PreviewInput{Origin: GeoPoint{Latitude: 37.5, Longitude: 127.0}})
	if err != nil {
		t.Fatalf("CreatePreview returned error: %v", err)
	}

	if provider.input.Mode != transitMode {
		t.Fatalf("expected fixed transit mode, got %q", provider.input.Mode)
	}
	if provider.input.Destination.Latitude != 37.5665 || provider.input.Destination.Longitude != 126.978 {
		t.Fatalf("unexpected provider destination: %#v", provider.input.Destination)
	}
	if result.Mode != transitMode || result.Summary.DurationSeconds != 1320 || result.Summary.DistanceMeters != 5400 || result.Summary.SummaryText != "환승 1회" {
		t.Fatalf("unexpected result summary: %#v", result)
	}
	if result.Map == nil || result.Map.EncodedPolyline != "encoded" {
		t.Fatalf("expected map polyline, got %#v", result.Map)
	}
}

func TestServiceCreatePreviewUnsupportedManualPlace(t *testing.T) {
	service := NewService(&fakeRepository{
		trip:        trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-12"},
		tripFound:   true,
		participant: true,
		items:       []trip.DayItineraryItem{{ID: testItemID, Place: trip.TripPlaceSummary{Name: "수동 장소"}}},
	}, &fakeProvider{})

	_, err := service.CreatePreview(context.Background(), "user-1", testTripID, "2026-07-10", testItemID, PreviewInput{Origin: GeoPoint{Latitude: 37.5, Longitude: 127.0}})
	if !errors.Is(err, ErrUnsupportedPlace) {
		t.Fatalf("expected ErrUnsupportedPlace, got %v", err)
	}
}

func TestServiceCreatePreviewRejectsStaleItem(t *testing.T) {
	arrivedAt := time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)
	service := NewService(&fakeRepository{
		trip:        trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-12"},
		tripFound:   true,
		participant: true,
		items: []trip.DayItineraryItem{
			{ID: testItemID, ArrivedAt: &arrivedAt, Place: trip.TripPlaceSummary{RoutablePlace: &trip.RoutablePlace{Provider: "google", GooglePlaceID: "google-1", Latitude: 37.5, Longitude: 127.0}}},
			{ID: "00000000-0000-0000-0000-000000000102", Place: trip.TripPlaceSummary{RoutablePlace: &trip.RoutablePlace{Provider: "google", GooglePlaceID: "google-2", Latitude: 37.6, Longitude: 127.1}}},
		},
	}, &fakeProvider{})

	_, err := service.CreatePreview(context.Background(), "user-1", testTripID, "2026-07-10", testItemID, PreviewInput{Origin: GeoPoint{Latitude: 37.5, Longitude: 127.0}})
	if !errors.Is(err, ErrStaleItem) {
		t.Fatalf("expected ErrStaleItem, got %v", err)
	}
}

func TestServiceCreatePreviewMapsProviderErrors(t *testing.T) {
	service := NewService(&fakeRepository{
		trip:        trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-12"},
		tripFound:   true,
		participant: true,
		items: []trip.DayItineraryItem{{ID: testItemID, Place: trip.TripPlaceSummary{RoutablePlace: &trip.RoutablePlace{
			Provider: "google", GooglePlaceID: "google-1", Latitude: 37.5, Longitude: 127.0,
		}}}},
	}, &fakeProvider{err: ErrProviderNoRoute})

	_, err := service.CreatePreview(context.Background(), "user-1", testTripID, "2026-07-10", testItemID, PreviewInput{Origin: GeoPoint{Latitude: 37.5, Longitude: 127.0}})
	if !errors.Is(err, ErrProviderNoRoute) {
		t.Fatalf("expected ErrProviderNoRoute, got %v", err)
	}
}
