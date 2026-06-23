package place

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const testTripID = "00000000-0000-0000-0000-000000000001"

func TestServiceSearchGoogle(t *testing.T) {
	repo := &fakeRepository{
		trip:          trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	provider := &fakeProvider{results: []SearchResult{{GooglePlaceID: "google-1", DisplayName: "도톤보리", FormattedAddress: "Osaka", PrimaryType: "tourist_attraction"}}}
	service := NewService(repo, provider)

	results, err := service.SearchGoogle(context.Background(), "user-1", testTripID, "2026-07-11", SearchInput{Query: "  도톤보리  "})
	if err != nil {
		t.Fatalf("SearchGoogle returned error: %v", err)
	}

	if repo.checkedTripID != testTripID || repo.checkedUserID != "user-1" {
		t.Fatalf("expected participant check, got trip=%q user=%q", repo.checkedTripID, repo.checkedUserID)
	}
	if provider.input.Query != "도톤보리" || provider.input.Limit != defaultLimit {
		t.Fatalf("expected trimmed provider input with default limit, got %#v", provider.input)
	}
	if len(results) != 1 || results[0].GooglePlaceID != "google-1" {
		t.Fatalf("expected provider results, got %#v", results)
	}
}

func TestServiceSearchGoogleValidation(t *testing.T) {
	validRepo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	tests := []struct {
		name   string
		tripID string
		date   string
		input  SearchInput
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10", input: SearchInput{Query: "도톤보리"}},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10", input: SearchInput{Query: "도톤보리"}},
		{name: "short query", tripID: testTripID, date: "2026-07-10", input: SearchInput{Query: "도"}},
		{name: "long query", tripID: testTripID, date: "2026-07-10", input: SearchInput{Query: strings.Repeat("가", maxQueryLen+1)}},
		{name: "low limit", tripID: testTripID, date: "2026-07-10", input: SearchInput{Query: "도톤보리", Limit: -1}},
		{name: "high limit", tripID: testTripID, date: "2026-07-10", input: SearchInput{Query: "도톤보리", Limit: maxLimit + 1}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &fakeProvider{}
			service := NewService(validRepo, provider)
			_, err := service.SearchGoogle(context.Background(), "user-1", tt.tripID, tt.date, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if provider.called {
				t.Fatal("expected validation to happen before provider call")
			}
		})
	}
}

func TestServiceSearchGoogleAuthorizationAndRange(t *testing.T) {
	tests := []struct {
		name        string
		userID      string
		repo        *fakeRepository
		date        string
		expectedErr error
	}{
		{name: "requires auth", userID: " ", repo: &fakeRepository{}, date: "2026-07-10", expectedErr: ErrUnauthorized},
		{name: "missing trip", userID: "user-1", repo: &fakeRepository{}, date: "2026-07-10", expectedErr: ErrNotFound},
		{name: "forbidden", userID: "user-1", repo: &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, date: "2026-07-10", expectedErr: ErrForbidden},
		{name: "out of range", userID: "user-1", repo: &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, date: "2026-07-14", expectedErr: ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &fakeProvider{}
			service := NewService(tt.repo, provider)
			_, err := service.SearchGoogle(context.Background(), tt.userID, testTripID, tt.date, SearchInput{Query: "도톤보리"})
			if !errors.Is(err, tt.expectedErr) {
				t.Fatalf("expected %v, got %v", tt.expectedErr, err)
			}
			if provider.called {
				t.Fatal("expected auth/range failure before provider call")
			}
		})
	}
}

func TestServiceSearchGoogleProviderErrors(t *testing.T) {
	repo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	service := NewService(repo, &fakeProvider{err: ErrProviderRateLimited})

	_, err := service.SearchGoogle(context.Background(), "user-1", testTripID, "2026-07-10", SearchInput{Query: "도톤보리", Limit: 3})
	if !errors.Is(err, ErrProviderRateLimited) {
		t.Fatalf("expected provider error to pass through, got %v", err)
	}

	service = NewService(repo, nil)
	_, err = service.SearchGoogle(context.Background(), "user-1", testTripID, "2026-07-10", SearchInput{Query: "도톤보리"})
	if !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("expected ErrProviderUnavailable, got %v", err)
	}
}

type fakeRepository struct {
	trip          trip.Trip
	tripFound     bool
	isParticipant bool
	checkedTripID string
	checkedUserID string
}

func (r *fakeRepository) GetTripByID(context.Context, string) (trip.Trip, bool, error) {
	return r.trip, r.tripFound, nil
}

func (r *fakeRepository) IsTripParticipant(_ context.Context, tripID string, userID string) (bool, error) {
	r.checkedTripID = tripID
	r.checkedUserID = userID
	return r.isParticipant, nil
}

type fakeProvider struct {
	called  bool
	input   ProviderSearchInput
	results []SearchResult
	err     error
}

func (p *fakeProvider) Search(_ context.Context, input ProviderSearchInput) ([]SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}
