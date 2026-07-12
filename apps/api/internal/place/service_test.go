package place

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const testTripID = "00000000-0000-0000-0000-000000000001"
const testTripDayID = "00000000-0000-0000-0000-000000000011"

func TestServiceSearchDestinations(t *testing.T) {
	provider := &fakeProvider{destinationResults: []DestinationSearchResult{
		{
			CityName:        "오사카",
			CountryName:     "일본",
			CountryCode:     "JP",
			DisplayName:     "오사카, 일본",
			Latitude:        34.6937,
			Longitude:       135.5023,
			RadiusMeters:    25000,
			Provider:        DestinationProviderGoogle,
			ProviderPlaceID: "google-city-osaka",
		},
	}}
	service := NewService(nil, provider)

	results, err := service.SearchDestinations(context.Background(), "user-1", DestinationSearchInput{Query: "  오사카  "})
	if err != nil {
		t.Fatalf("SearchDestinations returned error: %v", err)
	}

	if !provider.destinationCalled {
		t.Fatal("expected provider destination search to be called")
	}
	if provider.destinationInput.Query != "오사카" || provider.destinationInput.Limit != defaultLimit {
		t.Fatalf("expected trimmed query and default limit, got %#v", provider.destinationInput)
	}
	if len(results) != 1 || results[0].DisplayName != "오사카, 일본" || results[0].ProviderPlaceID != "google-city-osaka" {
		t.Fatalf("unexpected destination results %#v", results)
	}
}

func TestServiceSearchDestinationsValidation(t *testing.T) {
	tests := []struct {
		name   string
		userID string
		input  DestinationSearchInput
	}{
		{name: "requires auth", userID: " ", input: DestinationSearchInput{Query: "오사카"}},
		{name: "short query", userID: "user-1", input: DestinationSearchInput{Query: "오"}},
		{name: "long query", userID: "user-1", input: DestinationSearchInput{Query: strings.Repeat("가", maxQueryLen+1)}},
		{name: "low limit", userID: "user-1", input: DestinationSearchInput{Query: "오사카", Limit: -1}},
		{name: "high limit", userID: "user-1", input: DestinationSearchInput{Query: "오사카", Limit: maxLimit + 1}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &fakeProvider{}
			service := NewService(nil, provider)
			_, err := service.SearchDestinations(context.Background(), tt.userID, tt.input)
			expected := ErrValidation
			if strings.TrimSpace(tt.userID) == "" {
				expected = ErrUnauthorized
			}
			if !errors.Is(err, expected) {
				t.Fatalf("expected %v, got %v", expected, err)
			}
			if provider.destinationCalled {
				t.Fatal("expected validation to happen before provider call")
			}
		})
	}
}

func TestServiceSearchDestinationsFiltersInvalidProviderRows(t *testing.T) {
	provider := &fakeProvider{destinationResults: []DestinationSearchResult{
		{CityName: "오사카", CountryName: "일본", CountryCode: "JP", DisplayName: "오사카, 일본", Latitude: 34.6937, Longitude: 135.5023, RadiusMeters: 25000, Provider: DestinationProviderGoogle, ProviderPlaceID: "google-city-osaka"},
		{CityName: "", CountryName: "일본", CountryCode: "JP", DisplayName: "missing city", Latitude: 34.6, Longitude: 135.5, RadiusMeters: 25000, Provider: DestinationProviderGoogle, ProviderPlaceID: "google-missing-city"},
		{CityName: "나라", CountryName: "일본", CountryCode: "JP", DisplayName: "나라, 일본", Latitude: 200, Longitude: 135.8, RadiusMeters: 25000, Provider: DestinationProviderGoogle, ProviderPlaceID: "google-invalid-coordinate"},
	}}
	service := NewService(nil, provider)

	results, err := service.SearchDestinations(context.Background(), "user-1", DestinationSearchInput{Query: "오사카", Limit: 3})
	if err != nil {
		t.Fatalf("SearchDestinations returned error: %v", err)
	}
	if len(results) != 1 || results[0].CityName != "오사카" {
		t.Fatalf("expected only valid destination candidate, got %#v", results)
	}
}

func TestServiceSearchDestinationsProviderErrors(t *testing.T) {
	service := NewService(nil, &fakeProvider{destinationErr: ErrProviderRateLimited})
	_, err := service.SearchDestinations(context.Background(), "user-1", DestinationSearchInput{Query: "오사카"})
	if !errors.Is(err, ErrProviderRateLimited) {
		t.Fatalf("expected provider error to pass through, got %v", err)
	}

	service = NewService(nil, nil)
	_, err = service.SearchDestinations(context.Background(), "user-1", DestinationSearchInput{Query: "오사카"})
	if !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("expected ErrProviderUnavailable, got %v", err)
	}
}

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

func TestServiceSearchGoogleSignsRepresentativePhotoTokens(t *testing.T) {
	repo := &fakeRepository{
		trip:          trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	provider := &fakeProvider{results: []SearchResult{{
		GooglePlaceID:    "google-1",
		DisplayName:      "도톤보리",
		FormattedAddress: "Osaka",
		PrimaryType:      "tourist_attraction",
		Latitude:         34.6687,
		Longitude:        135.5013,
		Photo:            &SearchResultPhoto{Name: "places/google-1/photos/photo-1"},
	}}}
	service := NewService(repo, provider, WithPhotoTokenSecret("test-photo-secret"))

	results, err := service.SearchGoogle(context.Background(), "user-1", testTripID, "2026-07-11", SearchInput{Query: "도톤보리"})
	if err != nil {
		t.Fatalf("SearchGoogle returned error: %v", err)
	}
	if results[0].Photo == nil || results[0].Photo.Token == "" {
		t.Fatalf("expected signed photo token, got %#v", results[0].Photo)
	}
	if strings.Contains(results[0].Photo.Token, "places/") {
		t.Fatalf("expected token not to expose raw Google photo name, got %q", results[0].Photo.Token)
	}

	photoProvider := &fakeProvider{photo: GooglePlacePhoto{URI: "https://lh3.googleusercontent.com/photo"}}
	photoService := NewService(repo, photoProvider, WithPhotoTokenSecret("test-photo-secret"))
	photo, err := photoService.GetGooglePlacePhoto(context.Background(), "user-1", testTripID, "2026-07-11", PhotoInput{Token: results[0].Photo.Token, MaxWidthPx: 320})
	if err != nil {
		t.Fatalf("GetGooglePlacePhoto returned error: %v", err)
	}
	if photo.URI != "https://lh3.googleusercontent.com/photo" {
		t.Fatalf("unexpected photo %#v", photo)
	}
	if photoProvider.photoInput.Name != "places/google-1/photos/photo-1" || photoProvider.photoInput.MaxWidthPx != 320 {
		t.Fatalf("expected provider photo input to restore signed photo name, got %#v", photoProvider.photoInput)
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

func TestServiceCreateGoogleDayLodgingPlaceCreatesGooglePlaceAndDoesNotAppendScheduleItem(t *testing.T) {
	repo := &fakeRepository{trip: trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
	provider := &fakeProvider{details: GooglePlaceDetails{
		GooglePlaceID:    "google-hotel-1",
		DisplayName:      "호텔 니코 오사카",
		FormattedAddress: "Nishi-Shinsaibashi",
		Latitude:         34.6721,
		Longitude:        135.5019,
		PrimaryType:      "lodging",
		Types:            []string{"lodging", "point_of_interest"},
	}}
	service := NewService(repo, provider)

	result, err := service.CreateGoogleDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11", CreateGoogleDayLodgingPlaceInput{GooglePlaceID: " google-hotel-1 "})
	if err != nil {
		t.Fatalf("CreateGoogleDayLodgingPlace returned error: %v", err)
	}

	if !provider.detailsCalled || provider.detailsInput.GooglePlaceID != "google-hotel-1" {
		t.Fatalf("expected details lookup for trimmed google id, got called=%v input=%#v", provider.detailsCalled, provider.detailsInput)
	}
	if repo.createdGoogleLodgingRecord.GooglePlaceID != "google-hotel-1" || repo.createdGoogleLodgingRecord.Name != "호텔 니코 오사카" || repo.createdGoogleLodgingRecord.PlaceType != "lodging" || repo.createdGoogleLodgingRecord.TripDayID != testTripDayID {
		t.Fatalf("unexpected created google lodging record: %#v", repo.createdGoogleLodgingRecord)
	}
	if repo.createdGoogleLodgingRecord.Latitude != 34.6721 || repo.createdGoogleLodgingRecord.Longitude != 135.5019 || len(repo.createdGoogleLodgingRecord.GoogleTypes) != 2 {
		t.Fatalf("expected provider metadata in lodging record, got %#v", repo.createdGoogleLodgingRecord)
	}
	if repo.appendedGoogleRecord.TripPlaceID != "" {
		t.Fatalf("expected no schedule append for Day lodging registration, got %#v", repo.appendedGoogleRecord)
	}
	if result.Day.LodgingPlace == nil || result.Day.LodgingPlace.ID != result.LodgingPlace.ID || result.LodgingPlace.Name != "호텔 니코 오사카" {
		t.Fatalf("expected Google lodging set on day, got %#v", result)
	}
}

func TestServiceCreateGoogleDayLodgingPlaceReusesExistingTripPlaceWithoutProviderRefresh(t *testing.T) {
	repo := &fakeRepository{
		trip:                trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:           true,
		isParticipant:       true,
		existingGooglePlace: trip.TripPlaceSummary{ID: "place-1", Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi"},
		existingGoogleFound: true,
	}
	provider := &fakeProvider{}
	service := NewService(repo, provider)

	result, err := service.CreateGoogleDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11", CreateGoogleDayLodgingPlaceInput{GooglePlaceID: "google-hotel-1"})
	if err != nil {
		t.Fatalf("CreateGoogleDayLodgingPlace returned error: %v", err)
	}

	if provider.detailsCalled {
		t.Fatal("expected existing Google-backed place to be reused without provider details call")
	}
	if repo.setGoogleLodgingRecord.TripPlaceID != "place-1" || repo.setGoogleLodgingRecord.TripDayID != testTripDayID {
		t.Fatalf("expected existing Google place to be set as lodging with resolved day id, got %#v", repo.setGoogleLodgingRecord)
	}
	if result.LodgingPlace.ID != "place-1" || result.Day.LodgingPlace == nil || result.Day.LodgingPlace.ID != "place-1" {
		t.Fatalf("expected existing place in result, got %#v", result)
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

func TestServiceCreateGoogleTripPlaceBookmarkCreatesGoogleSnapshot(t *testing.T) {
	repo := &fakeRepository{
		trip:          trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	provider := &fakeProvider{details: GooglePlaceDetails{
		GooglePlaceID:    "google-airport-1",
		DisplayName:      "간사이공항",
		FormattedAddress: "Kansai International Airport",
		Latitude:         34.4347,
		Longitude:        135.244,
		PrimaryType:      "airport",
		Types:            []string{"airport", "point_of_interest"},
	}}
	service := NewService(repo, provider)

	result, err := service.CreateGoogleTripPlaceBookmark(context.Background(), "user-1", testTripID, CreateGoogleTripPlaceBookmarkInput{GooglePlaceID: " google-airport-1 "})
	if err != nil {
		t.Fatalf("CreateGoogleTripPlaceBookmark returned error: %v", err)
	}

	if !provider.detailsCalled || provider.detailsInput.GooglePlaceID != "google-airport-1" {
		t.Fatalf("expected provider details for trimmed google id, got called=%v input=%#v", provider.detailsCalled, provider.detailsInput)
	}
	if repo.createdBookmarkRecord.GooglePlaceID != "google-airport-1" || repo.createdBookmarkRecord.PlaceType != "transport" || repo.createdBookmarkRecord.Category != "transport" {
		t.Fatalf("unexpected bookmark record %#v", repo.createdBookmarkRecord)
	}
	if result.Bookmark.Category != "transport" || result.Bookmark.Place.Name != "간사이공항" || result.Bookmark.Place.PlaceType != "transport" {
		t.Fatalf("unexpected bookmark result %#v", result.Bookmark)
	}
}

func TestServiceListAndDeleteTripPlaceBookmarksAuthorizeParticipants(t *testing.T) {
	repo := &fakeRepository{
		trip:          trip.Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		bookmarks: []TripPlaceBookmark{{
			ID:       "bookmark-1",
			TripID:   testTripID,
			Category: "cafe",
			Place:    trip.TripPlaceSummary{ID: "place-1", Name: "우메다 카페", PlaceType: "cafe", Address: "Umeda"},
		}},
	}
	service := NewService(repo, nil)

	bookmarks, err := service.ListTripPlaceBookmarks(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("ListTripPlaceBookmarks returned error: %v", err)
	}
	if len(bookmarks) != 1 || bookmarks[0].ID != "bookmark-1" || repo.checkedTripID != testTripID || repo.checkedUserID != "user-1" {
		t.Fatalf("unexpected bookmarks/auth state bookmarks=%#v repo=%#v", bookmarks, repo)
	}

	if err := service.DeleteTripPlaceBookmark(context.Background(), "user-1", testTripID, " bookmark-1 "); err != nil {
		t.Fatalf("DeleteTripPlaceBookmark returned error: %v", err)
	}
	if repo.deletedBookmarkID != "bookmark-1" {
		t.Fatalf("expected trimmed bookmark id, got %q", repo.deletedBookmarkID)
	}
}

func TestServiceCreateGoogleTripPlaceBookmarkValidationAndAuth(t *testing.T) {
	service := NewService(&fakeRepository{trip: trip.Trip{ID: testTripID}, tripFound: true, isParticipant: true}, &fakeProvider{})
	if _, err := service.CreateGoogleTripPlaceBookmark(context.Background(), " ", testTripID, CreateGoogleTripPlaceBookmarkInput{GooglePlaceID: "google-1"}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
	if _, err := service.CreateGoogleTripPlaceBookmark(context.Background(), "user-1", testTripID, CreateGoogleTripPlaceBookmarkInput{GooglePlaceID: " "}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation for blank google id, got %v", err)
	}
	if _, err := NewService(&fakeRepository{trip: trip.Trip{ID: testTripID}, tripFound: true}, &fakeProvider{}).CreateGoogleTripPlaceBookmark(context.Background(), "user-1", testTripID, CreateGoogleTripPlaceBookmarkInput{GooglePlaceID: "google-1"}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden for non-participant, got %v", err)
	}
}

func TestMapProviderPlaceType(t *testing.T) {
	tests := []struct {
		name        string
		provider    string
		primaryType string
		types       []string
		want        string
	}{
		{name: "google primary cafe", provider: DestinationProviderGoogle, primaryType: "coffee_shop", want: "cafe"},
		{name: "google fallback food", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"restaurant"}, want: "food"},
		{name: "google airport transport", provider: DestinationProviderGoogle, primaryType: "airport", want: "transport"},
		{name: "google station fallback transport", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"point_of_interest", "train_station"}, want: "transport"},
		{name: "google unknown etc", provider: DestinationProviderGoogle, primaryType: "unknown", types: []string{"point_of_interest"}, want: "etc"},
		{name: "unknown provider etc", provider: "naver", primaryType: "restaurant", want: "etc"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MapProviderPlaceType(tt.provider, tt.primaryType, tt.types); got != tt.want {
				t.Fatalf("MapProviderPlaceType() = %q, want %q", got, tt.want)
			}
		})
	}
}

type fakeRepository struct {
	trip                       trip.Trip
	tripFound                  bool
	isParticipant              bool
	checkedTripID              string
	checkedUserID              string
	existingGooglePlace        trip.TripPlaceSummary
	existingGoogleFound        bool
	createdGoogleRecord        CreateGooglePlaceScheduleItemRecord
	createdGoogleLodgingRecord CreateGoogleDayLodgingPlaceRecord
	createdBookmarkRecord      CreateGoogleTripPlaceBookmarkRecord
	bookmarks                  []TripPlaceBookmark
	deletedBookmarkID          string
	setGoogleLodgingRecord     trip.SetDayLodgingPlaceRecord
	appendedGoogleRecord       AppendGooglePlaceScheduleItemRecord
	appendErr                  error
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
	day := trip.TripDay{ID: testTripDayID, Date: "2026-07-10", DayOrder: 1}
	switch tripDayID {
	case "2026-07-11":
		day.Date = "2026-07-11"
		day.DayOrder = 2
	case "2026-07-12":
		day.Date = "2026-07-12"
		day.DayOrder = 3
	}
	return day, true, nil
}

func (r *fakeRepository) GetGoogleTripPlaceByGooglePlaceID(context.Context, string, string) (trip.TripPlaceSummary, bool, error) {
	return r.existingGooglePlace, r.existingGoogleFound, nil
}

func (r *fakeRepository) SetDayLodgingPlace(_ context.Context, record trip.SetDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	r.setGoogleLodgingRecord = record
	if r.appendErr != nil {
		return trip.TripPlaceSummary{}, r.appendErr
	}
	placeSummary := r.existingGooglePlace
	if placeSummary.ID == "" {
		placeSummary = trip.TripPlaceSummary{ID: record.TripPlaceID, Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi"}
	}
	return placeSummary, nil
}

func (r *fakeRepository) CreateGoogleDayLodgingPlace(_ context.Context, record CreateGoogleDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	r.createdGoogleLodgingRecord = record
	if r.appendErr != nil {
		return trip.TripPlaceSummary{}, r.appendErr
	}
	return trip.TripPlaceSummary{
		ID:        "place-1",
		Name:      record.Name,
		PlaceType: record.PlaceType,
		Address:   record.Address,
	}, nil
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

func (r *fakeRepository) ListTripPlaceBookmarks(context.Context, string) ([]TripPlaceBookmark, error) {
	return r.bookmarks, nil
}

func (r *fakeRepository) UpsertGoogleTripPlaceBookmark(_ context.Context, record CreateGoogleTripPlaceBookmarkRecord) (TripPlaceBookmark, error) {
	r.createdBookmarkRecord = record
	if r.appendErr != nil {
		return TripPlaceBookmark{}, r.appendErr
	}
	return TripPlaceBookmark{
		ID:       "bookmark-1",
		TripID:   record.TripID,
		Category: record.Category,
		Place: trip.TripPlaceSummary{
			ID:        "place-1",
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
			RoutablePlace: &trip.RoutablePlace{
				Provider:      "google",
				GooglePlaceID: record.GooglePlaceID,
				Latitude:      record.Latitude,
				Longitude:     record.Longitude,
			},
		},
	}, nil
}

func (r *fakeRepository) DeleteTripPlaceBookmark(_ context.Context, _ string, bookmarkID string) (bool, error) {
	r.deletedBookmarkID = bookmarkID
	if r.appendErr != nil {
		return false, r.appendErr
	}
	return true, nil
}

type fakeProvider struct {
	called             bool
	input              ProviderSearchInput
	results            []SearchResult
	err                error
	destinationCalled  bool
	destinationInput   ProviderDestinationSearchInput
	destinationResults []DestinationSearchResult
	destinationErr     error
	detailsCalled      bool
	detailsInput       ProviderDetailsInput
	details            GooglePlaceDetails
	detailsErr         error
	photoCalled        bool
	photoInput         ProviderPhotoInput
	photo              GooglePlacePhoto
	photoErr           error
}

func (p *fakeProvider) Search(_ context.Context, input ProviderSearchInput) ([]SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}

func (p *fakeProvider) SearchDestinations(_ context.Context, input ProviderDestinationSearchInput) ([]DestinationSearchResult, error) {
	p.destinationCalled = true
	p.destinationInput = input
	return p.destinationResults, p.destinationErr
}

func (p *fakeProvider) Details(_ context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error) {
	p.detailsCalled = true
	p.detailsInput = input
	return p.details, p.detailsErr
}

func (p *fakeProvider) Description(_ context.Context, input ProviderDescriptionInput) (GooglePlaceDescription, error) {
	return GooglePlaceDescription{GooglePlaceID: input.GooglePlaceID}, nil
}

func (p *fakeProvider) Photo(_ context.Context, input ProviderPhotoInput) (GooglePlacePhoto, error) {
	p.photoCalled = true
	p.photoInput = input
	return p.photo, p.photoErr
}
