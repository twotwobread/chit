package trip

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

const testTripID = "00000000-0000-0000-0000-000000000001"

type fakeRepository struct {
	creator                Creator
	creatorFound           bool
	created                CreateRecord
	trip                   Trip
	tripFound              bool
	isParticipant          bool
	isOwner                bool
	participantCount       int
	previewNames           []string
	listParticipants       []ParticipantListItem
	listParticipantsTripID string
	listed                 []ListItem
	listedUserID           string
	dayLodgingPlaces       []DayLodgingPlace
	dayLodgingPlace        TripPlaceSummary
	dayLodgingFound        bool
	dayLodgingLookupTrip   string
	dayLodgingLookupDate   string
	tripPlaceSummary       TripPlaceSummary
	tripPlaceFound         bool
	tripPlaceLookupTripID  string
	tripPlaceLookupID      string
	setDayLodgingRecord    SetDayLodgingPlaceRecord
	setDayLodgingCalled    bool
	setDayLodgingPlace     TripPlaceSummary
	setDayLodgingErr       error
	deletedDayLodgingTrip  string
	deletedDayLodgingDate  string
	deletedDayLodgingCall  bool
	dayItineraryItems      []DayItineraryItem
	listedItineraryTripID  string
	listedItineraryDate    string
	createdManualRecords   []CreateManualDayItineraryItemRecord
	createdManualItem      DayItineraryItem
	createManualErr        error
	dayItem                DayItineraryItem
	dayItemFound           bool
	dayItemLookupTripID    string
	dayItemLookupDate      string
	dayItemLookupItemID    string
	reorderedRecord        ReorderDayItineraryItemsRecord
	reorderedCalled        bool
	reorderedItems         []DayItineraryItem
	reorderErr             error
	updatedDayItemRecord   UpdateDayItineraryItemRecord
	updatedDayItemCalled   bool
	updatedDayItem         DayItineraryItem
	deletedDayItemTripID   string
	deletedDayItemDate     string
	deletedDayItemID       string
	deletedDayItemCalled   bool
	deletedDayItemOK       bool
	updated                UpdateRecord
	updatedCalled          bool
	deletedID              string
	deletedCalled          bool
	deleteOK               bool
}

func (r *fakeRepository) GetCreator(context.Context, string) (Creator, bool, error) {
	return r.creator, r.creatorFound, nil
}

func (r *fakeRepository) CreateTripWithOwner(_ context.Context, record CreateRecord) (CreateResult, error) {
	r.created = record
	return CreateResult{
		Trip: Trip{
			ID:              testTripID,
			Name:            record.Name,
			StartDate:       record.StartDate.Format(dateLayout),
			EndDate:         record.EndDate.Format(dateLayout),
			DefaultCurrency: record.DefaultCurrency,
			CreatedBy:       record.CreatedBy,
			CreatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			UpdatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
		OwnerParticipant: Participant{
			ID:          "participant-1",
			TripID:      testTripID,
			UserID:      record.CreatedBy,
			Role:        RoleOwner,
			DisplayName: record.OwnerDisplayName,
			JoinedAt:    time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
	}, nil
}

func (r *fakeRepository) GetTripByID(context.Context, string) (Trip, bool, error) {
	return r.trip, r.tripFound, nil
}

func (r *fakeRepository) IsTripParticipant(context.Context, string, string) (bool, error) {
	return r.isParticipant, nil
}

func (r *fakeRepository) IsTripOwner(context.Context, string, string) (bool, error) {
	return r.isOwner, nil
}

func (r *fakeRepository) UpdateTripBasicInfo(_ context.Context, record UpdateRecord) (Trip, error) {
	r.updated = record
	r.updatedCalled = true
	return Trip{
		ID:              record.ID,
		Name:            record.Name,
		StartDate:       record.StartDate.Format(dateLayout),
		EndDate:         record.EndDate.Format(dateLayout),
		DefaultCurrency: record.DefaultCurrency,
		CreatedBy:       r.trip.CreatedBy,
		CreatedAt:       r.trip.CreatedAt,
		UpdatedAt:       time.Date(2026, 6, 22, 9, 0, 0, 0, time.UTC),
	}, nil
}

func (r *fakeRepository) DeleteTripByID(_ context.Context, tripID string) (bool, error) {
	r.deletedID = tripID
	r.deletedCalled = true
	return r.deleteOK, nil
}

func (r *fakeRepository) CountTripParticipants(context.Context, string) (int, error) {
	return r.participantCount, nil
}

func (r *fakeRepository) ListTripParticipantPreviewNames(context.Context, string) ([]string, error) {
	return r.previewNames, nil
}

func (r *fakeRepository) ListTripParticipants(_ context.Context, tripID string) ([]ParticipantListItem, error) {
	r.listParticipantsTripID = tripID
	return r.listParticipants, nil
}

func (r *fakeRepository) ListTripsByParticipantUser(_ context.Context, userID string) ([]ListItem, error) {
	r.listedUserID = userID
	return r.listed, nil
}

func (r *fakeRepository) ListDayLodgingPlacesByTrip(context.Context, string) ([]DayLodgingPlace, error) {
	return r.dayLodgingPlaces, nil
}

func (r *fakeRepository) GetDayLodgingPlaceByTripAndDate(_ context.Context, tripID string, date string) (TripPlaceSummary, bool, error) {
	r.dayLodgingLookupTrip = tripID
	r.dayLodgingLookupDate = date
	return r.dayLodgingPlace, r.dayLodgingFound, nil
}

func (r *fakeRepository) GetTripPlaceSummaryByTripAndPlace(_ context.Context, tripID string, tripPlaceID string) (TripPlaceSummary, bool, error) {
	r.tripPlaceLookupTripID = tripID
	r.tripPlaceLookupID = tripPlaceID
	return r.tripPlaceSummary, r.tripPlaceFound, nil
}

func (r *fakeRepository) SetDayLodgingPlace(_ context.Context, record SetDayLodgingPlaceRecord) (TripPlaceSummary, error) {
	r.setDayLodgingRecord = record
	r.setDayLodgingCalled = true
	if r.setDayLodgingErr != nil {
		return TripPlaceSummary{}, r.setDayLodgingErr
	}
	if r.setDayLodgingPlace.ID != "" {
		return r.setDayLodgingPlace, nil
	}
	return r.tripPlaceSummary, nil
}

func (r *fakeRepository) DeleteDayLodgingPlace(_ context.Context, tripID string, date string) error {
	r.deletedDayLodgingTrip = tripID
	r.deletedDayLodgingDate = date
	r.deletedDayLodgingCall = true
	return nil
}

func (r *fakeRepository) ListItineraryItemsByTripAndDate(_ context.Context, tripID string, date string) ([]DayItineraryItem, error) {
	r.listedItineraryTripID = tripID
	r.listedItineraryDate = date
	return r.dayItineraryItems, nil
}

func (r *fakeRepository) CreateManualDayItineraryItem(_ context.Context, record CreateManualDayItineraryItemRecord) (DayItineraryItem, error) {
	r.createdManualRecords = append(r.createdManualRecords, record)
	if r.createManualErr != nil {
		return DayItineraryItem{}, r.createManualErr
	}
	if r.createdManualItem.ID != "" {
		return r.createdManualItem, nil
	}
	return DayItineraryItem{
		ID:        "item-1",
		ItemOrder: 1,
		Version:   1,
		Place: TripPlaceSummary{
			ID:        "place-1",
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
		},
	}, nil
}

func (r *fakeRepository) GetItineraryItemByTripDateAndID(_ context.Context, tripID string, date string, itemID string) (DayItineraryItem, bool, error) {
	r.dayItemLookupTripID = tripID
	r.dayItemLookupDate = date
	r.dayItemLookupItemID = itemID
	for _, item := range r.dayItineraryItems {
		if item.ID == itemID {
			return item, true, nil
		}
	}
	return r.dayItem, r.dayItemFound, nil
}

func (r *fakeRepository) ReorderDayItineraryItems(_ context.Context, record ReorderDayItineraryItemsRecord) ([]DayItineraryItem, error) {
	r.reorderedRecord = record
	r.reorderedCalled = true
	if r.reorderErr != nil {
		return nil, r.reorderErr
	}
	if r.reorderedItems != nil {
		return r.reorderedItems, nil
	}
	return r.dayItineraryItems, nil
}

func (r *fakeRepository) UpdateDayItineraryItemPlace(_ context.Context, record UpdateDayItineraryItemRecord) (DayItineraryItem, error) {
	r.updatedDayItemRecord = record
	r.updatedDayItemCalled = true
	if r.updatedDayItem.ID != "" {
		return r.updatedDayItem, nil
	}
	return DayItineraryItem{
		ID:        record.ItemID,
		ItemOrder: r.dayItem.ItemOrder,
		Version:   r.dayItem.Version,
		Place: TripPlaceSummary{
			ID:        r.dayItem.Place.ID,
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
		},
	}, nil
}

func (r *fakeRepository) DeleteDayItineraryItem(_ context.Context, tripID string, date string, itemID string) (bool, error) {
	r.deletedDayItemTripID = tripID
	r.deletedDayItemDate = date
	r.deletedDayItemID = itemID
	r.deletedDayItemCalled = true
	return r.deletedDayItemOK, nil
}

func TestServiceCreate(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: "user-1", DisplayName: "민수"}, creatorFound: true}
	service := newTestService(repo)

	result, err := service.Create(context.Background(), "user-1", CreateInput{
		Name:            "  오사카 3박 4일  ",
		StartDate:       "2026-07-10",
		EndDate:         "2026-07-13",
		DefaultCurrency: "JPY",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if result.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("expected trimmed trip name, got %q", result.Trip.Name)
	}
	if result.Trip.CreatedBy != "user-1" {
		t.Fatalf("expected created by user-1, got %q", result.Trip.CreatedBy)
	}
	if result.OwnerParticipant.Role != RoleOwner {
		t.Fatalf("expected owner role, got %q", result.OwnerParticipant.Role)
	}
	if result.OwnerParticipant.DisplayName != "민수" {
		t.Fatalf("expected display name snapshot 민수, got %q", result.OwnerParticipant.DisplayName)
	}
	if repo.created.Name != "오사카 3박 4일" {
		t.Fatalf("expected repository to receive trimmed name, got %q", repo.created.Name)
	}
}

func TestServiceCreateValidation(t *testing.T) {
	service := newTestService(&fakeRepository{creator: Creator{ID: "user-1", DisplayName: "민수"}, creatorFound: true})

	tests := []struct {
		name  string
		input CreateInput
	}{
		{name: "empty name", input: CreateInput{Name: " ", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "invalid start date", input: CreateInput{Name: "오사카", StartDate: "2026/07/10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "end before start", input: CreateInput{Name: "오사카", StartDate: "2026-07-13", EndDate: "2026-07-10", DefaultCurrency: "JPY"}},
		{name: "past start date", input: CreateInput{Name: "오사카", StartDate: "2026-06-20", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "unsupported currency", input: CreateInput{Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "GBP"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.Create(context.Background(), "user-1", tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestServiceCreateRequiresCreator(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.Create(context.Background(), "user-1", CreateInput{
		Name:            "오사카",
		StartDate:       "2026-07-10",
		EndDate:         "2026-07-13",
		DefaultCurrency: "JPY",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceList(t *testing.T) {
	repo := &fakeRepository{listed: []ListItem{{ID: testTripID, Name: "오사카", MyRole: RoleMember, ParticipantCount: 2}}}
	service := newTestService(repo)

	trips, err := service.List(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if repo.listedUserID != "user-1" {
		t.Fatalf("expected repository to receive user-1, got %q", repo.listedUserID)
	}
	if len(trips) != 1 || trips[0].ID != testTripID {
		t.Fatalf("unexpected trips: %#v", trips)
	}
	if trips[0].MyRole != RoleMember || trips[0].ParticipantCount != 2 {
		t.Fatalf("expected role and participant count to pass through service, got %#v", trips[0])
	}
}

func TestServiceListRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.List(context.Background(), " ")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceUpdate(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:              testTripID,
			Name:            "오사카 3박 4일",
			StartDate:       "2026-07-10",
			EndDate:         "2026-07-13",
			DefaultCurrency: "JPY",
			CreatedBy:       "user-1",
			CreatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			UpdatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
		tripFound: true,
		isOwner:   true,
	}
	service := newTestService(repo)

	result, err := service.Update(context.Background(), "user-1", testTripID, UpdateInput{
		Name: stringPtr("  오사카 4박 5일  "),
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	if result.Trip.Name != "오사카 4박 5일" {
		t.Fatalf("expected trimmed updated name, got %q", result.Trip.Name)
	}
	if result.Trip.StartDate != "2026-07-10" || result.Trip.EndDate != "2026-07-13" || result.Trip.DefaultCurrency != "JPY" {
		t.Fatalf("expected unchanged fields to be preserved, got %#v", result.Trip)
	}
	if repo.updated.Name != "오사카 4박 5일" {
		t.Fatalf("expected repository to receive trimmed name, got %q", repo.updated.Name)
	}
}

func TestServiceUpdateAllowsPastDates(t *testing.T) {
	repo := &fakeRepository{
		trip:      Trip{ID: testTripID, Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"},
		tripFound: true,
		isOwner:   true,
	}
	service := newTestService(repo)

	result, err := service.Update(context.Background(), "user-1", testTripID, UpdateInput{
		StartDate: stringPtr("2026-06-01"),
		EndDate:   stringPtr("2026-06-03"),
	})
	if err != nil {
		t.Fatalf("Update returned error for past dates: %v", err)
	}
	if result.Trip.StartDate != "2026-06-01" || result.Trip.EndDate != "2026-06-03" {
		t.Fatalf("expected past dates to be saved, got %#v", result.Trip)
	}
}

func TestServiceUpdateValidation(t *testing.T) {
	baseTrip := Trip{ID: testTripID, Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}
	tests := []struct {
		name  string
		input UpdateInput
	}{
		{name: "empty patch", input: UpdateInput{}},
		{name: "empty name", input: UpdateInput{Name: stringPtr(" ")}},
		{name: "too long name", input: UpdateInput{Name: stringPtr(strings.Repeat("가", 81))}},
		{name: "invalid start date", input: UpdateInput{StartDate: stringPtr("2026/07/10")}},
		{name: "invalid end date", input: UpdateInput{EndDate: stringPtr("2026/07/13")}},
		{name: "merged end before start", input: UpdateInput{StartDate: stringPtr("2026-07-14")}},
		{name: "unsupported currency", input: UpdateInput{DefaultCurrency: stringPtr("GBP")}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: baseTrip, tripFound: true, isOwner: true}
			service := newTestService(repo)
			_, err := service.Update(context.Background(), "user-1", testTripID, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if repo.updatedCalled {
				t.Fatal("expected invalid update not to call repository update")
			}
		})
	}
}

func TestServiceUpdateRequiresOwner(t *testing.T) {
	repo := &fakeRepository{
		trip:      Trip{ID: testTripID, Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"},
		tripFound: true,
		isOwner:   false,
	}
	service := newTestService(repo)

	_, err := service.Update(context.Background(), "user-2", testTripID, UpdateInput{Name: stringPtr("도쿄")})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
	if repo.updatedCalled {
		t.Fatal("expected forbidden update not to call repository update")
	}
}

func TestServiceUpdateNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.Update(context.Background(), "user-1", testTripID, UpdateInput{Name: stringPtr("도쿄")})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceUpdateRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.Update(context.Background(), " ", testTripID, UpdateInput{Name: stringPtr("도쿄")})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceDelete(t *testing.T) {
	repo := &fakeRepository{
		trip:      Trip{ID: testTripID, Name: "오사카"},
		tripFound: true,
		isOwner:   true,
		deleteOK:  true,
	}
	service := newTestService(repo)

	err := service.Delete(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if !repo.deletedCalled || repo.deletedID != testTripID {
		t.Fatalf("expected repository delete for %s, got called=%v id=%q", testTripID, repo.deletedCalled, repo.deletedID)
	}
}

func TestServiceDeleteValidation(t *testing.T) {
	repo := &fakeRepository{}
	service := newTestService(repo)

	err := service.Delete(context.Background(), "user-1", "not-a-uuid")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
	if repo.deletedCalled {
		t.Fatal("expected invalid delete not to call repository delete")
	}
}

func TestServiceDeleteRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	err := service.Delete(context.Background(), " ", testTripID)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceDeleteNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	err := service.Delete(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceDeleteRequiresOwner(t *testing.T) {
	repo := &fakeRepository{
		trip:      Trip{ID: testTripID, Name: "오사카"},
		tripFound: true,
		isOwner:   false,
		deleteOK:  true,
	}
	service := newTestService(repo)

	err := service.Delete(context.Background(), "user-2", testTripID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
	if repo.deletedCalled {
		t.Fatal("expected forbidden delete not to call repository delete")
	}
}

func TestServiceDeleteMapsMissingFinalDeleteToNotFound(t *testing.T) {
	repo := &fakeRepository{
		trip:      Trip{ID: testTripID, Name: "오사카"},
		tripFound: true,
		isOwner:   true,
		deleteOK:  false,
	}
	service := newTestService(repo)

	err := service.Delete(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceGetDetail(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:              testTripID,
			Name:            "오사카 3박 4일",
			StartDate:       "2026-07-10",
			EndDate:         "2026-07-13",
			DefaultCurrency: "JPY",
			CreatedBy:       "user-1",
		},
		tripFound:        true,
		isParticipant:    true,
		participantCount: 4,
		previewNames:     []string{" 민수 ", "지영", ""},
		dayLodgingPlaces: []DayLodgingPlace{
			{Date: "2026-07-11", Place: TripPlaceSummary{ID: testUUID(8001), Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi-Shinsaibashi"}},
		},
	}
	service := newTestService(repo)

	result, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetDetail returned error: %v", err)
	}

	if result.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("expected trip detail, got %#v", result.Trip)
	}
	if result.ParticipantSummary.TotalCount != 4 {
		t.Fatalf("expected total count 4, got %d", result.ParticipantSummary.TotalCount)
	}
	if result.ParticipantSummary.OverflowCount != 1 {
		t.Fatalf("expected overflow count 1, got %d", result.ParticipantSummary.OverflowCount)
	}
	expectedNames := []string{"민수", "지영", "여행자"}
	for index, expected := range expectedNames {
		if result.ParticipantSummary.PreviewNames[index] != expected {
			t.Fatalf("expected preview name %d to be %q, got %q", index, expected, result.ParticipantSummary.PreviewNames[index])
		}
	}
	if len(result.Days) != 4 || result.Days[0].Date != "2026-07-10" || result.Days[0].DayOrder != 1 || result.Days[3].Date != "2026-07-13" || result.Days[3].DayOrder != 4 {
		t.Fatalf("expected virtual days in detail result, got %#v", result.Days)
	}
	if result.Days[0].LodgingPlace != nil {
		t.Fatalf("expected day 1 lodging to be empty, got %#v", result.Days[0].LodgingPlace)
	}
	if result.Days[1].LodgingPlace == nil || result.Days[1].LodgingPlace.Name != "호텔 니코 오사카" {
		t.Fatalf("expected day 2 lodging summary, got %#v", result.Days[1].LodgingPlace)
	}
}

func TestServiceGetDetailValidation(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDetail(context.Background(), "user-1", "not-a-uuid")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestServiceGetDetailNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceGetDetailForbidden(t *testing.T) {
	service := newTestService(&fakeRepository{trip: Trip{ID: testTripID}, tripFound: true})

	_, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestServiceListParticipants(t *testing.T) {
	joinedAt := time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, Name: "오사카"},
		tripFound:     true,
		isParticipant: true,
		listParticipants: []ParticipantListItem{
			{ParticipantID: "participant-1", DisplayName: " 민수 ", Role: RoleOwner, JoinedAt: joinedAt},
			{ParticipantID: "participant-2", DisplayName: "", Role: RoleMember, JoinedAt: joinedAt.Add(time.Hour)},
		},
	}
	service := newTestService(repo)

	participants, err := service.ListParticipants(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("ListParticipants returned error: %v", err)
	}
	if repo.listParticipantsTripID != testTripID {
		t.Fatalf("expected repository to list participants for %s, got %q", testTripID, repo.listParticipantsTripID)
	}
	if len(participants) != 2 {
		t.Fatalf("expected two participants, got %#v", participants)
	}
	if participants[0].ParticipantID != "participant-1" || participants[0].DisplayName != "민수" || participants[0].Role != RoleOwner {
		t.Fatalf("unexpected owner participant: %#v", participants[0])
	}
	if participants[1].DisplayName != "여행자" {
		t.Fatalf("expected blank display name fallback, got %#v", participants[1])
	}
}

func TestServiceListParticipantsValidation(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.ListParticipants(context.Background(), "user-1", "not-a-uuid")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestServiceListParticipantsRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.ListParticipants(context.Background(), " ", testTripID)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceListParticipantsNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.ListParticipants(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceListParticipantsForbidden(t *testing.T) {
	service := newTestService(&fakeRepository{trip: Trip{ID: testTripID}, tripFound: true})

	_, err := service.ListParticipants(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestServiceGetDayItinerary(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:        testTripID,
			StartDate: "2026-07-10",
			EndDate:   "2026-07-13",
		},
		tripFound:       true,
		isParticipant:   true,
		dayLodgingPlace: TripPlaceSummary{ID: "place-1", Name: "우메다 공중정원", PlaceType: "sights", Address: "Umeda"},
		dayLodgingFound: true,
		dayItineraryItems: []DayItineraryItem{
			{
				ID:        "item-1",
				ItemOrder: 1,
				Version:   4,
				IsLodging: true,
				Place: TripPlaceSummary{
					ID:        "place-1",
					Name:      "우메다 공중정원",
					PlaceType: "sights",
					Address:   "Umeda",
				},
			},
		},
	}
	service := newTestService(repo)

	result, err := service.GetDayItinerary(context.Background(), "user-1", testTripID, "2026-07-11")
	if err != nil {
		t.Fatalf("GetDayItinerary returned error: %v", err)
	}

	if result.Day.Date != "2026-07-11" || result.Day.DayOrder != 2 {
		t.Fatalf("expected server-calculated day metadata, got %#v", result.Day)
	}
	if repo.dayLodgingLookupTrip != testTripID || repo.dayLodgingLookupDate != "2026-07-11" {
		t.Fatalf("expected lodging lookup by trip/date, got trip=%q date=%q", repo.dayLodgingLookupTrip, repo.dayLodgingLookupDate)
	}
	if result.Day.LodgingPlace == nil || result.Day.LodgingPlace.Name != "우메다 공중정원" {
		t.Fatalf("expected day lodging summary, got %#v", result.Day.LodgingPlace)
	}
	if repo.listedItineraryTripID != testTripID || repo.listedItineraryDate != "2026-07-11" {
		t.Fatalf("expected repository lookup by trip/date, got trip=%q date=%q", repo.listedItineraryTripID, repo.listedItineraryDate)
	}
	if len(result.Items) != 1 || result.Items[0].Place.Name != "우메다 공중정원" || result.Items[0].Version != 4 || !result.Items[0].IsLodging {
		t.Fatalf("expected itinerary item to pass through, got %#v", result.Items)
	}
}

func TestServiceGetDayItineraryEmpty(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	result, err := service.GetDayItinerary(context.Background(), "user-1", testTripID, "2026-07-10")
	if err != nil {
		t.Fatalf("GetDayItinerary returned error: %v", err)
	}
	if result.Day.DayOrder != 1 || len(result.Items) != 0 {
		t.Fatalf("expected day 1 empty itinerary, got %#v", result)
	}
}

func TestServiceGetDayItineraryValidation(t *testing.T) {
	service := newTestService(&fakeRepository{})

	tests := []struct {
		name   string
		tripID string
		date   string
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10"},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.GetDayItinerary(context.Background(), "user-1", tt.tripID, tt.date)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestServiceGetDayItineraryRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDayItinerary(context.Background(), " ", testTripID, "2026-07-10")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceGetDayItineraryNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDayItinerary(context.Background(), "user-1", testTripID, "2026-07-10")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceGetDayItineraryForbidden(t *testing.T) {
	service := newTestService(&fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true})

	_, err := service.GetDayItinerary(context.Background(), "user-1", testTripID, "2026-07-10")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestServiceGetDayItineraryOutOfRange(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	_, err := service.GetDayItinerary(context.Background(), "user-1", testTripID, "2026-07-14")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	if repo.listedItineraryTripID != "" {
		t.Fatal("expected out-of-range date not to query itinerary items")
	}
}

func TestServiceSetDayLodgingPlace(t *testing.T) {
	placeID := testUUID(8001)
	repo := &fakeRepository{
		trip:             Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:        true,
		isParticipant:    true,
		tripPlaceSummary: TripPlaceSummary{ID: placeID, Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi-Shinsaibashi"},
		tripPlaceFound:   true,
	}
	service := newTestService(repo)

	result, err := service.SetDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11", SetDayLodgingPlaceInput{TripPlaceID: placeID})
	if err != nil {
		t.Fatalf("SetDayLodgingPlace returned error: %v", err)
	}
	if repo.tripPlaceLookupTripID != testTripID || repo.tripPlaceLookupID != placeID {
		t.Fatalf("expected same-trip place lookup, got trip=%q place=%q", repo.tripPlaceLookupTripID, repo.tripPlaceLookupID)
	}
	if !repo.setDayLodgingCalled || repo.setDayLodgingRecord.TripID != testTripID || repo.setDayLodgingRecord.ScheduledDate != "2026-07-11" || repo.setDayLodgingRecord.TripPlaceID != placeID {
		t.Fatalf("expected repository set day lodging call, got called=%v record=%#v", repo.setDayLodgingCalled, repo.setDayLodgingRecord)
	}
	if result.Day.Date != "2026-07-11" || result.Day.DayOrder != 2 || result.Day.LodgingPlace == nil || result.Day.LodgingPlace.ID != placeID {
		t.Fatalf("expected selected day lodging result, got %#v", result)
	}
	if result.LodgingPlace.Name != "호텔 니코 오사카" {
		t.Fatalf("expected lodging summary response, got %#v", result.LodgingPlace)
	}
}

func TestServiceSetDayLodgingPlaceValidationAuthAndTarget(t *testing.T) {
	placeID := testUUID(8001)
	tests := []struct {
		name   string
		repo   *fakeRepository
		user   string
		tripID string
		date   string
		input  SetDayLodgingPlaceInput
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, user: " ", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, user: "user-1", tripID: "not-a-uuid", date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrValidation},
		{name: "invalid date", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026/07/10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrValidation},
		{name: "missing place id", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{}, want: ErrValidation},
		{name: "invalid place id", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: "not-a-uuid"}, want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-14", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrNotFound},
		{name: "place not in trip", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", input: SetDayLodgingPlaceInput{TripPlaceID: placeID}, want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.SetDayLodgingPlace(context.Background(), tt.user, tt.tripID, tt.date, tt.input)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if tt.repo.setDayLodgingCalled {
				t.Fatal("expected failure not to set day lodging")
			}
		})
	}
}

func TestServiceClearDayLodgingPlace(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	err := service.ClearDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11")
	if err != nil {
		t.Fatalf("ClearDayLodgingPlace returned error: %v", err)
	}
	if !repo.deletedDayLodgingCall || repo.deletedDayLodgingTrip != testTripID || repo.deletedDayLodgingDate != "2026-07-11" {
		t.Fatalf("expected repository clear day lodging call, got called=%v trip=%q date=%q", repo.deletedDayLodgingCall, repo.deletedDayLodgingTrip, repo.deletedDayLodgingDate)
	}
}

func TestServiceClearDayLodgingPlaceValidationAndAuth(t *testing.T) {
	tests := []struct {
		name   string
		repo   *fakeRepository
		user   string
		tripID string
		date   string
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, user: " ", tripID: testTripID, date: "2026-07-10", want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, user: "user-1", tripID: "not-a-uuid", date: "2026-07-10", want: ErrValidation},
		{name: "invalid date", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026/07/10", want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-14", want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			err := service.ClearDayLodgingPlace(context.Background(), tt.user, tt.tripID, tt.date)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if tt.repo.deletedDayLodgingCall {
				t.Fatal("expected failure not to clear day lodging")
			}
		})
	}
}

func TestServiceCreateManualDayItineraryItem(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:        testTripID,
			StartDate: "2026-07-10",
			EndDate:   "2026-07-13",
		},
		tripFound:     true,
		isParticipant: true,
		createdManualItem: DayItineraryItem{
			ID:        "item-3",
			ItemOrder: 3,
			Place: TripPlaceSummary{
				ID:        "place-3",
				Name:      "우메다 공중정원",
				PlaceType: "sights",
				Address:   "Umeda",
			},
		},
	}
	service := newTestService(repo)

	result, err := service.CreateManualDayItineraryItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateManualDayItineraryItemInput{
		Name:      "  우메다 공중정원  ",
		Address:   "  Umeda  ",
		PlaceType: "sights",
	})
	if err != nil {
		t.Fatalf("CreateManualDayItineraryItem returned error: %v", err)
	}

	if result.Day.Date != "2026-07-11" || result.Day.DayOrder != 2 {
		t.Fatalf("expected server-calculated day, got %#v", result.Day)
	}
	if result.Item.ID != "item-3" || result.Item.ItemOrder != 3 || result.Item.Place.Name != "우메다 공중정원" {
		t.Fatalf("expected created item to pass through, got %#v", result.Item)
	}
	if len(repo.createdManualRecords) != 1 {
		t.Fatalf("expected one repository create call, got %#v", repo.createdManualRecords)
	}
	record := repo.createdManualRecords[0]
	if record.TripID != testTripID || record.ScheduledDate != "2026-07-11" || record.Name != "우메다 공중정원" || record.Address != "Umeda" || record.PlaceType != "sights" {
		t.Fatalf("expected trimmed create record, got %#v", record)
	}
}

func TestServiceCreateManualDayItineraryItemValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		tripID string
		date   string
		input  CreateManualDayItineraryItemInput
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10", input: CreateManualDayItineraryItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}},
		{name: "blank name", tripID: testTripID, date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: " ", Address: "Umeda", PlaceType: "sights"}},
		{name: "too long name", tripID: testTripID, date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: strings.Repeat("가", 121), Address: "Umeda", PlaceType: "sights"}},
		{name: "blank address", tripID: testTripID, date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: "우메다", Address: " ", PlaceType: "sights"}},
		{name: "too long address", tripID: testTripID, date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: "우메다", Address: strings.Repeat("가", 241), PlaceType: "sights"}},
		{name: "invalid place type", tripID: testTripID, date: "2026-07-10", input: CreateManualDayItineraryItemInput{Name: "우메다", Address: "Umeda", PlaceType: "museum"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}
			service := newTestService(repo)
			_, err := service.CreateManualDayItineraryItem(context.Background(), "user-1", tt.tripID, tt.date, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if len(repo.createdManualRecords) != 0 {
				t.Fatalf("expected invalid input not to create rows, got %#v", repo.createdManualRecords)
			}
		})
	}
}

func TestServiceCreateManualDayItineraryItemAuthAndRange(t *testing.T) {
	tests := []struct {
		name string
		repo *fakeRepository
		user string
		date string
		want error
	}{
		{name: "requires auth", repo: &fakeRepository{}, user: " ", date: "2026-07-10", want: ErrUnauthorized},
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, user: "user-1", date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", date: "2026-07-14", want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.CreateManualDayItineraryItem(context.Background(), tt.user, testTripID, tt.date, CreateManualDayItineraryItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"})
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if len(tt.repo.createdManualRecords) != 0 {
				t.Fatalf("expected failure not to create rows, got %#v", tt.repo.createdManualRecords)
			}
		})
	}
}

func TestServiceCreateManualDayItineraryItemAllowsDuplicates(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)
	input := CreateManualDayItineraryItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}

	if _, err := service.CreateManualDayItineraryItem(context.Background(), "user-1", testTripID, "2026-07-10", input); err != nil {
		t.Fatalf("first create returned error: %v", err)
	}
	if _, err := service.CreateManualDayItineraryItem(context.Background(), "user-1", testTripID, "2026-07-10", input); err != nil {
		t.Fatalf("duplicate create returned error: %v", err)
	}
	if len(repo.createdManualRecords) != 2 {
		t.Fatalf("expected duplicate creates to call repository twice, got %#v", repo.createdManualRecords)
	}
}

func TestServiceUpdateDayItineraryItem(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		dayItem: DayItineraryItem{
			ID:        testUUID(7001),
			ItemOrder: 2,
			Place: TripPlaceSummary{
				ID:        testUUID(8001),
				Name:      "우메다 공중정원",
				Address:   "Umeda",
				PlaceType: "sights",
			},
		},
		dayItemFound: true,
	}
	service := newTestService(repo)

	result, err := service.UpdateDayItineraryItem(context.Background(), "user-1", testTripID, "2026-07-11", testUUID(7001), UpdateDayItineraryItemInput{
		Name:    stringPtr("  우메다 스카이빌딩  "),
		Address: stringPtr("  Umeda Sky Building  "),
	})
	if err != nil {
		t.Fatalf("UpdateDayItineraryItem returned error: %v", err)
	}

	if result.Item.ID != testUUID(7001) || result.Item.ItemOrder != 2 || result.Item.Place.Name != "우메다 스카이빌딩" || result.Item.Place.Address != "Umeda Sky Building" || result.Item.Place.PlaceType != "sights" {
		t.Fatalf("expected updated item with unchanged order/place type, got %#v", result.Item)
	}
	if repo.dayItemLookupTripID != testTripID || repo.dayItemLookupDate != "2026-07-11" || repo.dayItemLookupItemID != testUUID(7001) {
		t.Fatalf("expected item lookup by trip/date/item, got trip=%q date=%q item=%q", repo.dayItemLookupTripID, repo.dayItemLookupDate, repo.dayItemLookupItemID)
	}
	if !repo.updatedDayItemCalled {
		t.Fatal("expected repository update call")
	}
	if repo.updatedDayItemRecord.TripID != testTripID || repo.updatedDayItemRecord.ScheduledDate != "2026-07-11" || repo.updatedDayItemRecord.ItemID != testUUID(7001) || repo.updatedDayItemRecord.Name != "우메다 스카이빌딩" || repo.updatedDayItemRecord.Address != "Umeda Sky Building" || repo.updatedDayItemRecord.PlaceType != "sights" {
		t.Fatalf("expected merged trimmed update record, got %#v", repo.updatedDayItemRecord)
	}
}

func TestServiceUpdateDayItineraryItemValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		tripID string
		date   string
		itemID string
		input  UpdateDayItineraryItemInput
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Name: stringPtr("우메다")}},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Name: stringPtr("우메다")}},
		{name: "invalid item id", tripID: testTripID, date: "2026-07-10", itemID: "not-a-uuid", input: UpdateDayItineraryItemInput{Name: stringPtr("우메다")}},
		{name: "empty patch", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{}},
		{name: "blank name", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Name: stringPtr(" ")}},
		{name: "too long name", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Name: stringPtr(strings.Repeat("가", 121))}},
		{name: "blank address", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Address: stringPtr(" ")}},
		{name: "too long address", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{Address: stringPtr(strings.Repeat("가", 301))}},
		{name: "invalid place type", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateDayItineraryItemInput{PlaceType: stringPtr("museum")}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, dayItem: DayItineraryItem{ID: testUUID(7001), ItemOrder: 1, Place: TripPlaceSummary{ID: testUUID(8001), Name: "우메다", Address: "Umeda", PlaceType: "sights"}}, dayItemFound: true}
			service := newTestService(repo)
			_, err := service.UpdateDayItineraryItem(context.Background(), "user-1", tt.tripID, tt.date, tt.itemID, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if repo.updatedDayItemCalled {
				t.Fatal("expected invalid update not to call repository update")
			}
		})
	}
}

func TestServiceUpdateDayItineraryItemAuthRangeAndTarget(t *testing.T) {
	tests := []struct {
		name string
		repo *fakeRepository
		user string
		date string
		want error
	}{
		{name: "requires auth", repo: &fakeRepository{}, user: " ", date: "2026-07-10", want: ErrUnauthorized},
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, user: "user-1", date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", date: "2026-07-14", want: ErrNotFound},
		{name: "item not in day", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", date: "2026-07-10", want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.UpdateDayItineraryItem(context.Background(), tt.user, testTripID, tt.date, testUUID(7001), UpdateDayItineraryItemInput{Name: stringPtr("우메다")})
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if tt.want != ErrNotFound || tt.name != "item not in day" {
				if tt.repo.updatedDayItemCalled {
					t.Fatal("expected failure not to update item")
				}
			}
		})
	}
}

func TestServiceDeleteDayItineraryItem(t *testing.T) {
	repo := &fakeRepository{
		trip:             Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:        true,
		isParticipant:    true,
		deletedDayItemOK: true,
	}
	service := newTestService(repo)

	err := service.DeleteDayItineraryItem(context.Background(), "user-1", testTripID, "2026-07-11", testUUID(7001))
	if err != nil {
		t.Fatalf("DeleteDayItineraryItem returned error: %v", err)
	}
	if !repo.deletedDayItemCalled || repo.deletedDayItemTripID != testTripID || repo.deletedDayItemDate != "2026-07-11" || repo.deletedDayItemID != testUUID(7001) {
		t.Fatalf("expected repository delete by trip/date/item, got trip=%q date=%q item=%q called=%v", repo.deletedDayItemTripID, repo.deletedDayItemDate, repo.deletedDayItemID, repo.deletedDayItemCalled)
	}
}

func TestServiceReorderDayItineraryItemsValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	anchorBefore := testUUID(7002)
	anchorAfter := testUUID(7003)
	tests := []struct {
		name  string
		user  string
		trip  string
		date  string
		moves []ReorderDayItineraryMoveInput
	}{
		{name: "missing auth", user: " ", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "invalid trip id", user: "user-1", trip: "not-a-uuid", date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "invalid date", user: "user-1", trip: testTripID, date: "2026/07/10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "empty moves", user: "user-1", trip: testTripID, date: "2026-07-10", moves: nil},
		{name: "both anchors nil", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), ClientVersion: 1}}},
		{name: "duplicate ids", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7001)), ClientVersion: 1}}},
		{name: "invalid client version", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 0}}},
		{name: "missing referenced item", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7999), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "missing anchor item", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayItineraryMoveInput{{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7999)), AfterItemID: &anchorAfter, ClientVersion: 1}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{
				trip:              validTrip,
				tripFound:         true,
				isParticipant:     true,
				dayItineraryItems: []DayItineraryItem{{ID: testUUID(7001)}, {ID: anchorBefore}, {ID: anchorAfter}},
			}
			service := newTestService(repo)
			_, err := service.ReorderDayItineraryItems(context.Background(), tt.user, tt.trip, tt.date, tt.moves)
			want := ErrValidation
			if tt.name == "missing auth" {
				want = ErrUnauthorized
			}
			if !errors.Is(err, want) {
				t.Fatalf("expected %v, got %v", want, err)
			}
			if repo.reorderedCalled {
				t.Fatal("expected invalid reorder not to reach repository")
			}
		})
	}
}

func TestServiceReorderDayItineraryItemsAuthConflictAndRange(t *testing.T) {
	move := ReorderDayItineraryMoveInput{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7002)), ClientVersion: 1}
	tests := []struct {
		name string
		repo *fakeRepository
		user string
		date string
		want error
	}{
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, dayItineraryItems: []DayItineraryItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}}, user: "user-1", date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true, dayItineraryItems: []DayItineraryItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}}, user: "user-1", date: "2026-07-14", want: ErrNotFound},
		{name: "conflict", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true, dayItineraryItems: []DayItineraryItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}, reorderErr: ErrConflict}, user: "user-1", date: "2026-07-10", want: ErrConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.ReorderDayItineraryItems(context.Background(), tt.user, testTripID, tt.date, []ReorderDayItineraryMoveInput{move})
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestServiceReorderDayItineraryItemsSuccess(t *testing.T) {
	reorderedItems := []DayItineraryItem{
		{ID: testUUID(7001), ItemOrder: 1, Version: 1},
		{ID: testUUID(7004), ItemOrder: 2, Version: 2},
		{ID: testUUID(7003), ItemOrder: 3, Version: 1},
		{ID: testUUID(7002), ItemOrder: 4, Version: 2},
	}
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		dayItineraryItems: []DayItineraryItem{
			{ID: testUUID(7001)},
			{ID: testUUID(7002)},
			{ID: testUUID(7003)},
			{ID: testUUID(7004)},
		},
		reorderedItems: reorderedItems,
	}
	service := newTestService(repo)

	result, err := service.ReorderDayItineraryItems(context.Background(), "user-1", testTripID, "2026-07-11", []ReorderDayItineraryMoveInput{
		{ItemID: testUUID(7004), BeforeItemID: stringPtr(testUUID(7001)), AfterItemID: stringPtr(testUUID(7002)), ClientVersion: 1},
		{ItemID: testUUID(7002), BeforeItemID: stringPtr(testUUID(7003)), ClientVersion: 1},
	})
	if err != nil {
		t.Fatalf("ReorderDayItineraryItems returned error: %v", err)
	}
	if !repo.reorderedCalled {
		t.Fatal("expected repository reorder to be called")
	}
	if repo.reorderedRecord.TripID != testTripID || repo.reorderedRecord.ScheduledDate != "2026-07-11" {
		t.Fatalf("unexpected reorder record metadata: %#v", repo.reorderedRecord)
	}
	if len(repo.reorderedRecord.Moves) != 2 {
		t.Fatalf("expected two recorded moves, got %#v", repo.reorderedRecord.Moves)
	}
	if result.Day.Date != "2026-07-11" || result.Day.DayOrder != 2 {
		t.Fatalf("unexpected day mapping: %#v", result.Day)
	}
	if len(result.Items) != len(reorderedItems) {
		t.Fatalf("expected reordered items to be returned, got %#v", result.Items)
	}
	for index, want := range reorderedItems {
		if result.Items[index].ID != want.ID || result.Items[index].ItemOrder != want.ItemOrder || result.Items[index].Version != want.Version {
			t.Fatalf("unexpected reordered result at %d: got %#v want %#v", index, result.Items[index], want)
		}
	}
}

func TestServiceDeleteDayItineraryItemFailures(t *testing.T) {
	tests := []struct {
		name   string
		repo   *fakeRepository
		user   string
		tripID string
		date   string
		itemID string
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, user: " ", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, user: "user-1", tripID: "not-a-uuid", date: "2026-07-10", itemID: testUUID(7001), want: ErrValidation},
		{name: "invalid date", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026/07/10", itemID: testUUID(7001), want: ErrValidation},
		{name: "invalid item id", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: "not-a-uuid", want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-14", itemID: testUUID(7001), want: ErrNotFound},
		{name: "item not found", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			err := service.DeleteDayItineraryItem(context.Background(), tt.user, tt.tripID, tt.date, tt.itemID)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func testUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}

func stringPtr(value string) *string {
	return &value
}

func newTestService(repo Repository) *Service {
	service := NewService(repo)
	service.today = func() time.Time { return time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC) }
	return service
}
