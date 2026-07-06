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

func TestServiceCreateGooglePlaceScheduleItemCreatesSnapshotAndItem(t *testing.T) {
	repo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	provider := &fakeProvider{details: GooglePlaceDetails{
		GooglePlaceID:    "google-1",
		DisplayName:      "도톤보리",
		FormattedAddress: "Osaka",
		Latitude:         34.6687,
		Longitude:        135.5013,
		PrimaryType:      "tourist_attraction",
		Types:            []string{"tourist_attraction", "point_of_interest"},
	}}
	service := NewService(repo, provider)

	startTime := "09:30"
	endTime := "11:00"
	memo := "강가 산책하기"
	result, err := service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateGooglePlaceScheduleItemInput{GooglePlaceID: " google-1 ", Title: "  오전 산책  ", StartTime: &startTime, EndTime: &endTime, Memo: &memo})
	if err != nil {
		t.Fatalf("CreateGooglePlaceScheduleItem returned error: %v", err)
	}

	if !provider.detailsCalled || provider.detailsInput.GooglePlaceID != "google-1" {
		t.Fatalf("expected details lookup for trimmed google id, got called=%v input=%#v", provider.detailsCalled, provider.detailsInput)
	}
	if repo.createdGoogleRecord.GooglePlaceID != "google-1" || repo.createdGoogleRecord.Name != "도톤보리" || repo.createdGoogleRecord.PlaceType != "sights" {
		t.Fatalf("unexpected created google record: %#v", repo.createdGoogleRecord)
	}
	if repo.createdGoogleRecord.Latitude != 34.6687 || repo.createdGoogleRecord.Longitude != 135.5013 || len(repo.createdGoogleRecord.GoogleTypes) != 2 {
		t.Fatalf("expected provider metadata in record, got %#v", repo.createdGoogleRecord)
	}
	if repo.createdGoogleRecord.Title != "오전 산책" || repo.createdGoogleRecord.StartTime == nil || *repo.createdGoogleRecord.StartTime != "09:30" || repo.createdGoogleRecord.EndTime == nil || *repo.createdGoogleRecord.EndTime != "11:00" || repo.createdGoogleRecord.Memo == nil || *repo.createdGoogleRecord.Memo != "강가 산책하기" {
		t.Fatalf("expected schedule details in record, got %#v", repo.createdGoogleRecord)
	}
	if result.Item.PlaceSchedule == nil || result.Item.PlaceSchedule.Title != "오전 산책" || result.Item.PlaceSchedule.Memo == nil || *result.Item.PlaceSchedule.Memo != "강가 산책하기" || result.Item.StartTime == nil || *result.Item.StartTime != "09:30" || result.Item.EndTime == nil || *result.Item.EndTime != "11:00" {
		t.Fatalf("expected schedule details in result, got %#v", result.Item)
	}
	if result.Day.DayOrder != 2 || result.Item.Place.Name != "도톤보리" || result.Item.ItemOrder != 1 {
		t.Fatalf("unexpected result %#v", result)
	}
}

func TestServiceCreateGooglePlaceScheduleItemReusesExistingTripPlaceWithoutProviderRefresh(t *testing.T) {
	repo := &fakeRepository{
		trip:                trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:           true,
		isParticipant:       true,
		existingGooglePlace: trip.TripPlaceSummary{ID: "place-1", Name: "도톤보리", PlaceType: "sights", Address: "Osaka"},
		existingGoogleFound: true,
	}
	provider := &fakeProvider{}
	service := NewService(repo, provider)

	result, err := service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "저녁 산책"})
	if err != nil {
		t.Fatalf("CreateGooglePlaceScheduleItem returned error: %v", err)
	}

	if provider.detailsCalled {
		t.Fatal("expected existing Google-backed place to be reused without provider details call")
	}
	if repo.appendedGoogleRecord.TripPlaceID != "place-1" || repo.appendedGoogleRecord.Title != "저녁 산책" {
		t.Fatalf("expected append to existing place with schedule details, got %#v", repo.appendedGoogleRecord)
	}
	if result.Item.Place.ID != "place-1" {
		t.Fatalf("expected item to use existing place, got %#v", result.Item)
	}
}

func TestServiceCreateGooglePlaceScheduleItemDuplicateConfirmation(t *testing.T) {
	repo := &fakeRepository{
		trip:                trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:           true,
		isParticipant:       true,
		existingGooglePlace: trip.TripPlaceSummary{ID: "place-1", Name: "도톤보리", PlaceType: "sights", Address: "Osaka"},
		existingGoogleFound: true,
		appendErr:           ErrDuplicateDayPlaceConfirmationNeeded,
	}
	service := NewService(repo, &fakeProvider{})

	_, err := service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "중복 장소"})
	if !errors.Is(err, ErrDuplicateDayPlaceConfirmationNeeded) {
		t.Fatalf("expected duplicate confirmation error, got %v", err)
	}

	repo.appendErr = nil
	_, err = service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "중복 장소", DuplicateConfirmed: true})
	if err != nil {
		t.Fatalf("expected confirmed duplicate to append, got %v", err)
	}
	if !repo.appendedGoogleRecord.DuplicateConfirmed {
		t.Fatalf("expected duplicate confirmation to reach repository, got %#v", repo.appendedGoogleRecord)
	}
}

func TestServiceCreateGooglePlaceScheduleItemValidationAndProviderData(t *testing.T) {
	validRepo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	service := NewService(validRepo, &fakeProvider{})

	_, err := service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", CreateGooglePlaceScheduleItemInput{})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected invalid google place id validation error, got %v", err)
	}

	provider := &fakeProvider{details: GooglePlaceDetails{GooglePlaceID: "google-1", DisplayName: "도톤보리", FormattedAddress: "Osaka", Latitude: 0, Longitude: 181, PrimaryType: "cafe", Types: []string{"cafe"}}}
	service = NewService(validRepo, provider)
	_, err = service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "도톤보리"})
	if !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("expected invalid provider data to be unavailable, got %v", err)
	}
}

func TestServiceCreateGooglePlaceScheduleItemValidatesScheduleDetails(t *testing.T) {
	repo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	service := NewService(repo, &fakeProvider{})
	endTime := "11:00"
	badStart := "9:00"
	startAfterEnd := "12:00"
	memoTooLong := strings.Repeat("가", 1001)

	tests := []struct {
		name  string
		input CreateGooglePlaceScheduleItemInput
	}{
		{name: "blank title", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "   "}},
		{name: "too long title", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: strings.Repeat("가", 121)}},
		{name: "bad start time", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "도톤보리", StartTime: &badStart}},
		{name: "end without start", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "도톤보리", EndTime: &endTime}},
		{name: "end before start", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "도톤보리", StartTime: &startAfterEnd, EndTime: &endTime}},
		{name: "too long memo", input: CreateGooglePlaceScheduleItemInput{GooglePlaceID: "google-1", Title: "도톤보리", Memo: &memoTooLong}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.CreateGooglePlaceScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected validation error, got %v", err)
			}
		})
	}
}

func TestMapGooglePlaceType(t *testing.T) {
	if got := mapGooglePlaceType("coffee_shop", nil); got != "cafe" {
		t.Fatalf("expected coffee_shop to map to cafe, got %q", got)
	}
	if got := mapGooglePlaceType("unknown", []string{"restaurant"}); got != "food" {
		t.Fatalf("expected raw type fallback to food, got %q", got)
	}
	if got := mapGooglePlaceType("unknown", []string{"point_of_interest"}); got != "etc" {
		t.Fatalf("expected unknown type to map to etc, got %q", got)
	}
}

type fakeRepository struct {
	trip                 trip.Trip
	tripFound            bool
	isParticipant        bool
	checkedTripID        string
	checkedUserID        string
	existingGooglePlace  trip.TripPlaceSummary
	existingGoogleFound  bool
	createdGoogleRecord  CreateGooglePlaceScheduleItemRecord
	appendedGoogleRecord AppendGooglePlaceScheduleItemRecord
	appendErr            error
}

func (r *fakeRepository) GetTripByID(context.Context, string) (trip.Trip, bool, error) {
	return r.trip, r.tripFound, nil
}

func (r *fakeRepository) IsTripParticipant(_ context.Context, tripID string, userID string) (bool, error) {
	r.checkedTripID = tripID
	r.checkedUserID = userID
	return r.isParticipant, nil
}

func (r *fakeRepository) GetActiveTripDayByTripAndID(_ context.Context, tripID string, tripDayID string) (trip.TripDay, bool, error) {
	if !r.tripFound || tripDayID == "2026-07-14" {
		return trip.TripDay{}, false, nil
	}
	return trip.TripDay{ID: tripDayID, Date: "2026-07-10", DayOrder: 1}, true, nil
}

func (r *fakeRepository) GetGoogleTripPlaceByGooglePlaceID(context.Context, string, string) (trip.TripPlaceSummary, bool, error) {
	return r.existingGooglePlace, r.existingGoogleFound, nil
}

func (r *fakeRepository) AppendGooglePlaceScheduleItem(_ context.Context, record AppendGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error) {
	r.appendedGoogleRecord = record
	if r.appendErr != nil {
		return trip.ScheduleItem{}, r.appendErr
	}
	placeSummary := r.existingGooglePlace
	if placeSummary.ID == "" {
		placeSummary = trip.TripPlaceSummary{ID: record.TripPlaceID, Name: "도톤보리", PlaceType: "sights", Address: "Osaka"}
	}
	return trip.ScheduleItem{ID: "item-1", ItemOrder: 1, Version: 1, StartTime: record.StartTime, EndTime: record.EndTime, Place: placeSummary, PlaceSchedule: &trip.PlaceScheduleItemDetails{Title: record.Title, Memo: record.Memo}}, nil
}

func (r *fakeRepository) CreateGooglePlaceScheduleItem(_ context.Context, record CreateGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error) {
	r.createdGoogleRecord = record
	if r.appendErr != nil {
		return trip.ScheduleItem{}, r.appendErr
	}
	return trip.ScheduleItem{
		ID:            "item-1",
		ItemOrder:     1,
		Version:       1,
		StartTime:     record.StartTime,
		EndTime:       record.EndTime,
		PlaceSchedule: &trip.PlaceScheduleItemDetails{Title: record.Title, Memo: record.Memo},
		Place: trip.TripPlaceSummary{
			ID:        "place-1",
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
		},
	}, nil
}

type fakeProvider struct {
	called        bool
	input         ProviderSearchInput
	results       []SearchResult
	err           error
	detailsCalled bool
	detailsInput  ProviderDetailsInput
	details       GooglePlaceDetails
	detailsErr    error
}

func (p *fakeProvider) Search(_ context.Context, input ProviderSearchInput) ([]SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}

func (p *fakeProvider) Details(_ context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error) {
	p.detailsCalled = true
	p.detailsInput = input
	return p.details, p.detailsErr
}
