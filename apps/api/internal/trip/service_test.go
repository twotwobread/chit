package trip

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const testTripID = "00000000-0000-0000-0000-000000000001"

type equalSplitFixtureCase struct {
	Name           string                         `json:"name"`
	AmountMinor    int64                          `json:"amountMinor"`
	Participants   []equalSplitFixtureParticipant `json:"participants"`
	ExpectedSplits []equalSplitFixtureSplit       `json:"expectedSplits"`
}

type equalSplitFixtureParticipant struct {
	ParticipantID string `json:"participantId"`
	DisplayName   string `json:"displayName"`
	JoinedAt      string `json:"joinedAt"`
}

type equalSplitFixtureSplit struct {
	ParticipantID string `json:"participantId"`
	DisplayName   string `json:"displayName"`
	AmountMinor   int64  `json:"amountMinor"`
}

type fakeRepository struct {
	creator                  Creator
	creatorFound             bool
	created                  CreateRecord
	trip                     Trip
	tripFound                bool
	isParticipant            bool
	isOwner                  bool
	participantCount         int
	previewNames             []string
	listParticipants         []ParticipantListItem
	listParticipantsTripID   string
	listed                   []ListItem
	listedUserID             string
	dayLodgingPlaces         []DayLodgingPlace
	dayLodgingPlace          TripPlaceSummary
	dayLodgingFound          bool
	dayLodgingLookupTrip     string
	dayLodgingLookupDate     string
	tripPlaceSummary         TripPlaceSummary
	tripPlaceFound           bool
	tripPlaces               []TripPlaceSummary
	tripPlaceLookupTripID    string
	tripPlaceLookupID        string
	listTripPlacesTripID     string
	manualDayLodgingRecord   CreateManualDayLodgingPlaceRecord
	manualDayLodgingCalled   bool
	manualDayLodgingPlace    TripPlaceSummary
	setDayLodgingRecord      SetDayLodgingPlaceRecord
	setDayLodgingCalled      bool
	setDayLodgingPlace       TripPlaceSummary
	setDayLodgingErr         error
	deletedDayLodgingTrip    string
	deletedDayLodgingDate    string
	deletedDayLodgingCall    bool
	dayScheduleItems         []ScheduleItem
	listedScheduleTripID     string
	listedScheduleDate       string
	dayExpenses              []DayExpenseListItem
	listedDayExpensesTripID  string
	listedDayExpensesDate    string
	listDayExpensesCalled    bool
	listDayExpensesErr       error
	settlementData           SettlementInput
	settlementDataByTrip     map[string]SettlementInput
	settlementDataTripID     string
	settlementDataCalled     bool
	settlementDataErr        error
	expense                  Expense
	expenseFound             bool
	expenseLookupTripID      string
	expenseLookupTripDayID   string
	expenseLookupExpenseID   string
	updatedExpenseRecord     UpdateExpenseRecord
	updatedExpenseCalled     bool
	updatedExpense           Expense
	updateExpenseErr         error
	deletedExpenseTripID     string
	deletedExpenseTripDayID  string
	deletedExpenseID         string
	deletedExpenseCalled     bool
	deletedExpenseOK         bool
	deleteExpenseErr         error
	quickExpenseRecord       CreateQuickExpenseRecord
	quickExpenseCalled       bool
	quickExpenseResult       CreateQuickExpenseResult
	quickExpenseErr          error
	createdManualRecords     []CreateManualScheduleItemRecord
	createdManualItem        ScheduleItem
	createManualErr          error
	dayItem                  ScheduleItem
	dayItemFound             bool
	dayItemLookupTripID      string
	dayItemLookupDate        string
	dayItemLookupItemID      string
	reorderedRecord          ReorderScheduleItemsRecord
	reorderedCalled          bool
	reorderedItems           []ScheduleItem
	reorderErr               error
	markedArrivedRecord      MarkScheduleItemArrivedRecord
	markedArrivedCalled      bool
	markedArrivedResult      MarkScheduleItemArrivedMutationResult
	markedArrivedErr         error
	markedSkippedRecord      MarkScheduleItemSkippedRecord
	markedSkippedCalled      bool
	markedSkippedResult      MarkScheduleItemSkippedMutationResult
	markedSkippedErr         error
	restoredDayItemRecord    RestoreScheduleItemRecord
	restoredDayItemCalled    bool
	restoredDayItemResult    RestoreScheduleItemMutationResult
	restoredDayItemErr       error
	updatedDayItemRecord     UpdateScheduleItemRecord
	updatedDayItemCalled     bool
	updatedDayItem           ScheduleItem
	deletedDayItemTripID     string
	deletedDayItemDate       string
	deletedDayItemID         string
	deletedDayItemCalled     bool
	deletedDayItemOK         bool
	updated                  UpdateRecord
	updatedCalled            bool
	deletedID                string
	deletedCalled            bool
	deleteOK                 bool
	deletedParticipantTripID string
	deletedParticipantID     string
	deletedParticipantCalled bool
	deleteParticipantOK      bool
	inviteRecord             CreateTripInviteRecord
	inviteRecords            []CreateTripInviteRecord
	inviteResult             CreateTripInviteResult
	inviteErr                error
	inviteErrs               []error
	acceptInviteRecord       AcceptTripInviteRecord
	acceptInviteResult       AcceptTripInviteResult
	acceptInviteErr          error
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

func (r *fakeRepository) DeleteTripMemberParticipant(_ context.Context, tripID string, participantID string) (bool, error) {
	r.deletedParticipantTripID = tripID
	r.deletedParticipantID = participantID
	r.deletedParticipantCalled = true
	return r.deleteParticipantOK, nil
}

func (r *fakeRepository) CreateOrReturnTripInvite(_ context.Context, record CreateTripInviteRecord) (CreateTripInviteResult, error) {
	r.inviteRecord = record
	r.inviteRecords = append(r.inviteRecords, record)
	if len(r.inviteErrs) > 0 {
		err := r.inviteErrs[0]
		r.inviteErrs = r.inviteErrs[1:]
		if err != nil {
			return CreateTripInviteResult{}, err
		}
	}
	if r.inviteErr != nil {
		return CreateTripInviteResult{}, r.inviteErr
	}
	if r.inviteResult.Invite.ID != "" {
		return r.inviteResult, nil
	}
	return CreateTripInviteResult{
		Invite: TripInvite{
			ID:        "invite-1",
			TripID:    record.TripID,
			Token:     record.Token,
			ExpiresAt: record.ExpiresAt,
			CreatedAt: record.Now,
			CreatedBy: record.CreatedBy,
		},
		Created: true,
	}, nil
}

func (r *fakeRepository) AcceptTripInvite(_ context.Context, record AcceptTripInviteRecord) (AcceptTripInviteResult, error) {
	r.acceptInviteRecord = record
	if r.acceptInviteErr != nil {
		return AcceptTripInviteResult{}, r.acceptInviteErr
	}
	if r.acceptInviteResult.TripID != "" {
		return r.acceptInviteResult, nil
	}
	return AcceptTripInviteResult{TripID: testTripID, TripName: "오사카", Role: RoleMember, AlreadyAccepted: false}, nil
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

func (r *fakeRepository) ListActiveTripDaysByTrip(context.Context, string) ([]TripDay, error) {
	if r.trip.StartDate == "" || r.trip.EndDate == "" {
		return []TripDay{}, nil
	}
	days, err := tripDaysForRange(r.trip.StartDate, r.trip.EndDate)
	if err != nil {
		return nil, err
	}
	for index := range days {
		days[index].ID = testUUID(7000 + index + 1)
	}
	applyDayLodgingPlaces(days, r.dayLodgingPlaces)
	return days, nil
}

func (r *fakeRepository) GetActiveTripDayByTripAndID(_ context.Context, tripID string, tripDayID string) (TripDay, bool, error) {
	r.dayLodgingLookupTrip = tripID
	r.dayLodgingLookupDate = tripDayID
	if !r.tripFound {
		return TripDay{}, false, nil
	}
	date := tripDayID
	dayOrder := 1
	if parsed, err := parseDate(tripDayID); err == nil {
		date = parsed.Format(dateLayout)
		if order, err := dayOrderInRange(r.trip.StartDate, r.trip.EndDate, parsed); err == nil && order > 0 {
			dayOrder = order
		}
	}
	day := TripDay{ID: tripDayID, Date: date, DayOrder: dayOrder}
	if r.dayLodgingFound {
		day.LodgingPlace = &r.dayLodgingPlace
	}
	return day, true, nil
}

func (r *fakeRepository) GetTripPlaceSummaryByTripAndPlace(_ context.Context, tripID string, tripPlaceID string) (TripPlaceSummary, bool, error) {
	r.tripPlaceLookupTripID = tripID
	r.tripPlaceLookupID = tripPlaceID
	return r.tripPlaceSummary, r.tripPlaceFound, nil
}

func (r *fakeRepository) ListTripPlaces(_ context.Context, tripID string) ([]TripPlaceSummary, error) {
	r.listTripPlacesTripID = tripID
	return append([]TripPlaceSummary(nil), r.tripPlaces...), nil
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

func (r *fakeRepository) CreateManualDayLodgingPlace(_ context.Context, record CreateManualDayLodgingPlaceRecord) (TripPlaceSummary, error) {
	r.manualDayLodgingRecord = record
	r.manualDayLodgingCalled = true
	if r.manualDayLodgingPlace.ID != "" {
		return r.manualDayLodgingPlace, nil
	}
	return TripPlaceSummary{ID: testUUID(8801), Name: record.Name, Address: record.Address, PlaceType: "lodging"}, nil
}

func (r *fakeRepository) DeleteDayLodgingPlace(_ context.Context, tripID string, date string) error {
	r.deletedDayLodgingTrip = tripID
	r.deletedDayLodgingDate = date
	r.deletedDayLodgingCall = true
	return nil
}

func (r *fakeRepository) ListScheduleItemsByTripDay(_ context.Context, tripID string, date string) ([]ScheduleItem, error) {
	r.listedScheduleTripID = tripID
	r.listedScheduleDate = date
	return r.dayScheduleItems, nil
}

func (r *fakeRepository) ListDayExpensesByTripDay(_ context.Context, tripID string, date string) ([]DayExpenseListItem, error) {
	r.listedDayExpensesTripID = tripID
	r.listedDayExpensesDate = date
	r.listDayExpensesCalled = true
	if r.listDayExpensesErr != nil {
		return nil, r.listDayExpensesErr
	}
	if r.dayExpenses != nil {
		return r.dayExpenses, nil
	}
	return []DayExpenseListItem{}, nil
}

func (r *fakeRepository) GetTripSettlementInput(_ context.Context, tripID string) (SettlementInput, error) {
	r.settlementDataTripID = tripID
	r.settlementDataCalled = true
	if r.settlementDataErr != nil {
		return SettlementInput{}, r.settlementDataErr
	}
	if r.settlementDataByTrip != nil {
		return r.settlementDataByTrip[tripID], nil
	}
	return r.settlementData, nil
}

func (r *fakeRepository) GetExpenseByTripDayAndID(_ context.Context, tripID string, tripDayID string, expenseID string) (Expense, bool, error) {
	r.expenseLookupTripID = tripID
	r.expenseLookupTripDayID = tripDayID
	r.expenseLookupExpenseID = expenseID
	if r.expenseFound {
		return r.expense, true, nil
	}
	return Expense{}, false, nil
}

func (r *fakeRepository) UpdateExpense(_ context.Context, record UpdateExpenseRecord) (Expense, error) {
	r.updatedExpenseRecord = record
	r.updatedExpenseCalled = true
	if r.updateExpenseErr != nil {
		return Expense{}, r.updateExpenseErr
	}
	if r.updatedExpense.ID != "" {
		return r.updatedExpense, nil
	}
	itemID := ""
	anchorType := "trip_day"
	var scheduleItemID *string
	placeID := testUUID(8001)
	placeName := "장소 없음"
	placeAddress := "연결된 장소 없음"
	placeType := "etc"
	placeSource := ExpenseDisplaySourceFallback
	if record.ScheduleItemID != nil {
		itemID = *record.ScheduleItemID
		scheduleItemID = &itemID
		anchorType = "schedule_item"
		placeName = "도톤보리"
		placeAddress = "Dotonbori"
		placeType = "food"
		placeSource = ExpenseDisplaySourceLive
	}
	payerID := record.PayerParticipantID
	return Expense{
		ID:             record.ExpenseID,
		TripID:         record.TripID,
		AnchorType:     anchorType,
		TripDayID:      &record.TripDayID,
		ScheduleItemID: scheduleItemID,
		ExpenseDate:    "2026-07-10",
		DisplayTitle:   placeName,
		Place:          &ExpensePlaceDisplay{TripPlaceID: &placeID, Name: placeName, Address: &placeAddress, PlaceType: &placeType, Source: placeSource},
		AmountMinor:    record.AmountMinor,
		Currency:       r.trip.DefaultCurrency,
		Payer:          ExpenseParticipantDisplay{ParticipantID: &payerID, DisplayName: "민수", Source: ExpenseDisplaySourceLive},
		Memo:           record.Memo,
		SplitPolicy:    record.SplitPolicy,
		Splits:         []ExpenseSplit{{Participant: ExpenseParticipantDisplay{ParticipantID: &payerID, DisplayName: "민수", Source: ExpenseDisplaySourceLive}, AmountMinor: record.AmountMinor}},
		CreatedAt:      time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
	}, nil
}

func (r *fakeRepository) DeleteExpenseByTripDayAndID(_ context.Context, tripID string, tripDayID string, expenseID string) (bool, error) {
	r.deletedExpenseTripID = tripID
	r.deletedExpenseTripDayID = tripDayID
	r.deletedExpenseID = expenseID
	r.deletedExpenseCalled = true
	if r.deleteExpenseErr != nil {
		return false, r.deleteExpenseErr
	}
	return r.deletedExpenseOK, nil
}

func (r *fakeRepository) CreateQuickExpense(_ context.Context, record CreateQuickExpenseRecord) (CreateQuickExpenseResult, error) {
	r.quickExpenseRecord = record
	r.quickExpenseCalled = true
	if r.quickExpenseErr != nil {
		return CreateQuickExpenseResult{}, r.quickExpenseErr
	}
	if r.quickExpenseResult.Expense.ID != "" {
		return r.quickExpenseResult, nil
	}
	itemID := record.ScheduleItemID
	tripDayID := record.TripDayID
	placeID := testUUID(8001)
	payerID := record.PayerParticipantID
	placeAddress := "Dotonbori"
	placeType := "food"
	return CreateQuickExpenseResult{Expense: Expense{
		ID:             testUUID(9001),
		TripID:         record.TripID,
		AnchorType:     "schedule_item",
		TripDayID:      &tripDayID,
		ScheduleItemID: &itemID,
		ExpenseDate:    "2026-07-10",
		DisplayTitle:   "도톤보리",
		Place:          &ExpensePlaceDisplay{TripPlaceID: &placeID, Name: "도톤보리", Address: &placeAddress, PlaceType: &placeType, Source: ExpenseDisplaySourceLive},
		AmountMinor:    record.AmountMinor,
		Currency:       r.trip.DefaultCurrency,
		Payer:          ExpenseParticipantDisplay{ParticipantID: &payerID, DisplayName: "민수", Source: ExpenseDisplaySourceLive},
		SplitPolicy:    record.SplitPolicy,
		Splits:         []ExpenseSplit{{Participant: ExpenseParticipantDisplay{ParticipantID: &payerID, DisplayName: "민수", Source: ExpenseDisplaySourceLive}, AmountMinor: record.AmountMinor}},
		CreatedAt:      time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
	}}, nil
}

func (r *fakeRepository) CreateManualScheduleItem(_ context.Context, record CreateManualScheduleItemRecord) (ScheduleItem, error) {
	r.createdManualRecords = append(r.createdManualRecords, record)
	if r.createManualErr != nil {
		return ScheduleItem{}, r.createManualErr
	}
	if r.createdManualItem.ID != "" {
		return r.createdManualItem, nil
	}
	return ScheduleItem{
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

func (r *fakeRepository) GetScheduleItemByTripDayAndID(_ context.Context, tripID string, date string, itemID string) (ScheduleItem, bool, error) {
	r.dayItemLookupTripID = tripID
	r.dayItemLookupDate = date
	r.dayItemLookupItemID = itemID
	for _, item := range r.dayScheduleItems {
		if item.ID == itemID {
			return item, true, nil
		}
	}
	return r.dayItem, r.dayItemFound, nil
}

func (r *fakeRepository) ReorderScheduleItems(_ context.Context, record ReorderScheduleItemsRecord) ([]ScheduleItem, error) {
	r.reorderedRecord = record
	r.reorderedCalled = true
	if r.reorderErr != nil {
		return nil, r.reorderErr
	}
	if r.reorderedItems != nil {
		return r.reorderedItems, nil
	}
	return r.dayScheduleItems, nil
}

func (r *fakeRepository) MarkScheduleItemArrived(_ context.Context, record MarkScheduleItemArrivedRecord) (MarkScheduleItemArrivedMutationResult, error) {
	r.markedArrivedRecord = record
	r.markedArrivedCalled = true
	if r.markedArrivedErr != nil {
		return MarkScheduleItemArrivedMutationResult{}, r.markedArrivedErr
	}
	if r.markedArrivedResult.Item.ID != "" || r.markedArrivedResult.Items != nil {
		return r.markedArrivedResult, nil
	}
	for _, item := range r.dayScheduleItems {
		if item.ID == record.ItemID {
			return MarkScheduleItemArrivedMutationResult{Item: item, Items: r.dayScheduleItems}, nil
		}
	}
	return MarkScheduleItemArrivedMutationResult{}, ErrNotFound
}

func (r *fakeRepository) MarkScheduleItemSkipped(_ context.Context, record MarkScheduleItemSkippedRecord) (MarkScheduleItemSkippedMutationResult, error) {
	r.markedSkippedRecord = record
	r.markedSkippedCalled = true
	if r.markedSkippedErr != nil {
		return MarkScheduleItemSkippedMutationResult{}, r.markedSkippedErr
	}
	if r.markedSkippedResult.Item.ID != "" || r.markedSkippedResult.Items != nil {
		return r.markedSkippedResult, nil
	}
	for _, item := range r.dayScheduleItems {
		if item.ID == record.ItemID {
			return MarkScheduleItemSkippedMutationResult{Item: item, Items: r.dayScheduleItems}, nil
		}
	}
	return MarkScheduleItemSkippedMutationResult{}, ErrNotFound
}

func (r *fakeRepository) RestoreScheduleItem(_ context.Context, record RestoreScheduleItemRecord) (RestoreScheduleItemMutationResult, error) {
	r.restoredDayItemRecord = record
	r.restoredDayItemCalled = true
	if r.restoredDayItemErr != nil {
		return RestoreScheduleItemMutationResult{}, r.restoredDayItemErr
	}
	if r.restoredDayItemResult.Item.ID != "" || r.restoredDayItemResult.Items != nil {
		return r.restoredDayItemResult, nil
	}
	for _, item := range r.dayScheduleItems {
		if item.ID == record.ItemID {
			return RestoreScheduleItemMutationResult{Item: item, Items: r.dayScheduleItems}, nil
		}
	}
	return RestoreScheduleItemMutationResult{}, ErrNotFound
}

func (r *fakeRepository) UpdateScheduleItemPlace(_ context.Context, record UpdateScheduleItemRecord) (ScheduleItem, error) {
	r.updatedDayItemRecord = record
	r.updatedDayItemCalled = true
	if r.updatedDayItem.ID != "" {
		return r.updatedDayItem, nil
	}
	return ScheduleItem{
		ID:        record.ItemID,
		ItemOrder: r.dayItem.ItemOrder,
		Version:   r.dayItem.Version,
		StartTime: record.StartTime,
		EndTime:   record.EndTime,
		Place: TripPlaceSummary{
			ID:        r.dayItem.Place.ID,
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
		},
	}, nil
}

func (r *fakeRepository) DeleteScheduleItem(_ context.Context, tripID string, date string, itemID string) (bool, error) {
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

func TestServiceRemoveParticipant(t *testing.T) {
	participantID := "00000000-0000-0000-0000-000000000222"
	repo := &fakeRepository{
		trip:                Trip{ID: testTripID, Name: "오사카"},
		tripFound:           true,
		isOwner:             true,
		deleteParticipantOK: true,
	}
	service := newTestService(repo)

	err := service.RemoveParticipant(context.Background(), "user-1", testTripID, participantID)
	if err != nil {
		t.Fatalf("RemoveParticipant returned error: %v", err)
	}
	if !repo.deletedParticipantCalled || repo.deletedParticipantTripID != testTripID || repo.deletedParticipantID != participantID {
		t.Fatalf("expected repository member participant delete, got called=%v trip=%q participant=%q", repo.deletedParticipantCalled, repo.deletedParticipantTripID, repo.deletedParticipantID)
	}
}

func TestServiceRemoveParticipantValidation(t *testing.T) {
	participantID := "00000000-0000-0000-0000-000000000222"
	tests := []struct {
		name           string
		userID         string
		tripID         string
		participantID  string
		repo           *fakeRepository
		expect         error
		wantDeleteCall bool
	}{
		{name: "auth required", userID: " ", tripID: testTripID, participantID: participantID, repo: &fakeRepository{}, expect: ErrUnauthorized},
		{name: "invalid trip id", userID: "user-1", tripID: "not-a-uuid", participantID: participantID, repo: &fakeRepository{}, expect: ErrValidation},
		{name: "invalid participant id", userID: "user-1", tripID: testTripID, participantID: "not-a-uuid", repo: &fakeRepository{}, expect: ErrValidation},
		{name: "missing trip", userID: "user-1", tripID: testTripID, participantID: participantID, repo: &fakeRepository{}, expect: ErrNotFound},
		{name: "non owner", userID: "user-2", tripID: testTripID, participantID: participantID, repo: &fakeRepository{trip: Trip{ID: testTripID}, tripFound: true}, expect: ErrForbidden},
		{name: "missing or non-removable target", userID: "user-1", tripID: testTripID, participantID: participantID, repo: &fakeRepository{trip: Trip{ID: testTripID}, tripFound: true, isOwner: true}, expect: ErrNotFound, wantDeleteCall: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := newTestService(tt.repo).RemoveParticipant(context.Background(), tt.userID, tt.tripID, tt.participantID)
			if !errors.Is(err, tt.expect) {
				t.Fatalf("expected %v, got %v", tt.expect, err)
			}
			if tt.repo.deletedParticipantCalled != tt.wantDeleteCall {
				t.Fatalf("expected delete call=%v, got %v", tt.wantDeleteCall, tt.repo.deletedParticipantCalled)
			}
		})
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

func TestServiceCreateInviteCreatesNewInvite(t *testing.T) {
	now := time.Date(2026, 6, 23, 15, 0, 0, 0, time.UTC)
	repo := &fakeRepository{tripFound: true, isOwner: true}
	service := newTestService(repo)
	service.now = func() time.Time { return now }
	service.generateInviteToken = func() (string, error) { return "test-token-abcdefghijklmnopqrstuvwxyz123456", nil }
	service.inviteBaseURL = "https://invite.i-um.app"

	result, err := service.CreateInvite(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("create invite: %v", err)
	}
	if !result.Created {
		t.Fatal("expected invite to be marked created")
	}
	if repo.inviteRecord.TripID != testTripID || repo.inviteRecord.CreatedBy != "user-1" {
		t.Fatalf("unexpected invite record: %#v", repo.inviteRecord)
	}
	if !repo.inviteRecord.ExpiresAt.Equal(now.Add(inviteExpiryDuration)) {
		t.Fatalf("expected 7-day expiry, got %s", repo.inviteRecord.ExpiresAt)
	}
	if result.Invite.InviteURL != "https://invite.i-um.app/invite/test-token-abcdefghijklmnopqrstuvwxyz123456" {
		t.Fatalf("unexpected invite url %q", result.Invite.InviteURL)
	}
}

func TestServiceCreateInviteReusesExistingActiveInvite(t *testing.T) {
	now := time.Date(2026, 6, 23, 15, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		tripFound: true,
		isOwner:   true,
		inviteResult: CreateTripInviteResult{
			Invite: TripInvite{
				ID:        "invite-existing",
				TripID:    testTripID,
				Token:     "existing-token-abcdefghijklmnopqrstuvwxyz12",
				ExpiresAt: now.Add(24 * time.Hour),
				CreatedAt: now.Add(-24 * time.Hour),
				CreatedBy: "user-1",
			},
			Created: false,
		},
	}
	service := newTestService(repo)
	service.now = func() time.Time { return now }
	service.generateInviteToken = func() (string, error) { return "unused-token-abcdefghijklmnopqrstuvwxyz1234", nil }
	service.inviteBaseURL = "https://invite.i-um.app/"

	result, err := service.CreateInvite(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("create invite: %v", err)
	}
	if result.Created {
		t.Fatal("expected existing invite reuse")
	}
	if result.Invite.InviteURL != "https://invite.i-um.app/invite/existing-token-abcdefghijklmnopqrstuvwxyz12" {
		t.Fatalf("unexpected invite url %q", result.Invite.InviteURL)
	}
}

func TestServiceCreateInviteRetriesTokenConflict(t *testing.T) {
	repo := &fakeRepository{tripFound: true, isOwner: true, inviteErrs: []error{ErrConflict, nil}}
	service := newTestService(repo)
	tokens := []string{"conflicting-token-abcdefghijklmnopqrstuvwxyz", "fresh-token-abcdefghijklmnopqrstuvwxyz1234"}
	service.generateInviteToken = func() (string, error) {
		token := tokens[0]
		tokens = tokens[1:]
		return token, nil
	}
	service.inviteBaseURL = "https://invite.i-um.app"

	result, err := service.CreateInvite(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("create invite with retry: %v", err)
	}
	if len(repo.inviteRecords) != 2 {
		t.Fatalf("expected two create attempts, got %#v", repo.inviteRecords)
	}
	if result.Invite.Token != "fresh-token-abcdefghijklmnopqrstuvwxyz1234" || result.Invite.InviteURL != "https://invite.i-um.app/invite/fresh-token-abcdefghijklmnopqrstuvwxyz1234" {
		t.Fatalf("expected retried invite token/url, got %#v", result.Invite)
	}
}

func TestServiceCreateInviteFailures(t *testing.T) {
	cases := []struct {
		name   string
		userID string
		tripID string
		repo   *fakeRepository
		expect error
	}{
		{name: "auth required", tripID: testTripID, repo: &fakeRepository{}, expect: ErrUnauthorized},
		{name: "invalid trip id", userID: "user-1", tripID: "not-a-uuid", repo: &fakeRepository{}, expect: ErrValidation},
		{name: "missing trip", userID: "user-1", tripID: testTripID, repo: &fakeRepository{}, expect: ErrNotFound},
		{name: "non owner", userID: "user-1", tripID: testTripID, repo: &fakeRepository{tripFound: true}, expect: ErrForbidden},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newTestService(tt.repo).CreateInvite(context.Background(), tt.userID, tt.tripID)
			if !errors.Is(err, tt.expect) {
				t.Fatalf("expected %v, got %v", tt.expect, err)
			}
		})
	}
}

func TestServiceAcceptInviteCreatesMember(t *testing.T) {
	now := time.Date(2026, 6, 24, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepository{}
	service := newTestService(repo)
	service.now = func() time.Time { return now }

	result, err := service.AcceptInvite(context.Background(), "user-2", "valid-token-abcdefghijklmnopqrstuvwxyz123456")
	if err != nil {
		t.Fatalf("accept invite: %v", err)
	}
	if repo.acceptInviteRecord.Token != "valid-token-abcdefghijklmnopqrstuvwxyz123456" || repo.acceptInviteRecord.UserID != "user-2" || !repo.acceptInviteRecord.Now.Equal(now) {
		t.Fatalf("unexpected accept record: %#v", repo.acceptInviteRecord)
	}
	if result.TripID != testTripID || result.Role != RoleMember || result.AlreadyAccepted {
		t.Fatalf("unexpected accept result: %#v", result)
	}
}

func TestServiceAcceptInviteReturnsAlreadyAcceptedRoles(t *testing.T) {
	cases := []struct {
		name   string
		result AcceptTripInviteResult
	}{
		{name: "member", result: AcceptTripInviteResult{TripID: testTripID, TripName: "오사카", Role: RoleMember, AlreadyAccepted: true}},
		{name: "owner", result: AcceptTripInviteResult{TripID: testTripID, TripName: "오사카", Role: RoleOwner, AlreadyAccepted: true}},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(&fakeRepository{acceptInviteResult: tt.result})
			result, err := service.AcceptInvite(context.Background(), "user-1", "valid-token-abcdefghijklmnopqrstuvwxyz123456")
			if err != nil {
				t.Fatalf("accept invite: %v", err)
			}
			if result != tt.result {
				t.Fatalf("expected %#v, got %#v", tt.result, result)
			}
		})
	}
}

func TestServiceAcceptInviteFailures(t *testing.T) {
	cases := []struct {
		name   string
		userID string
		token  string
		repo   *fakeRepository
		expect error
	}{
		{name: "auth required", token: "valid-token-abcdefghijklmnopqrstuvwxyz123456", repo: &fakeRepository{}, expect: ErrUnauthorized},
		{name: "blank token", userID: "user-1", token: " ", repo: &fakeRepository{}, expect: ErrValidation},
		{name: "short token", userID: "user-1", token: "short", repo: &fakeRepository{}, expect: ErrValidation},
		{name: "bad charset", userID: "user-1", token: "invalid-token-with-dot.abcdefghijklmnopqrstuvwxyz", repo: &fakeRepository{}, expect: ErrValidation},
		{name: "missing invite", userID: "user-1", token: "valid-token-abcdefghijklmnopqrstuvwxyz123456", repo: &fakeRepository{acceptInviteErr: ErrInviteNotFound}, expect: ErrInviteNotFound},
		{name: "expired invite", userID: "user-1", token: "valid-token-abcdefghijklmnopqrstuvwxyz123456", repo: &fakeRepository{acceptInviteErr: ErrInviteExpired}, expect: ErrInviteExpired},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newTestService(tt.repo).AcceptInvite(context.Background(), tt.userID, tt.token)
			if !errors.Is(err, tt.expect) {
				t.Fatalf("expected %v, got %v", tt.expect, err)
			}
		})
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

func TestServiceGetDayScheduleItems(t *testing.T) {
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
		dayScheduleItems: []ScheduleItem{
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

	result, err := service.GetDayScheduleItems(context.Background(), "user-1", testTripID, "2026-07-11")
	if err != nil {
		t.Fatalf("GetDayScheduleItems returned error: %v", err)
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
	if repo.listedScheduleTripID != testTripID || repo.listedScheduleDate != "2026-07-11" {
		t.Fatalf("expected repository lookup by trip/date, got trip=%q date=%q", repo.listedScheduleTripID, repo.listedScheduleDate)
	}
	if len(result.Items) != 1 || result.Items[0].Place.Name != "우메다 공중정원" || result.Items[0].Version != 4 || !result.Items[0].IsLodging {
		t.Fatalf("expected schedule item to pass through, got %#v", result.Items)
	}
}

func TestServiceGetDayScheduleItemsEmpty(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	result, err := service.GetDayScheduleItems(context.Background(), "user-1", testTripID, "2026-07-10")
	if err != nil {
		t.Fatalf("GetDayScheduleItems returned error: %v", err)
	}
	if result.Day.DayOrder != 1 || len(result.Items) != 0 {
		t.Fatalf("expected day 1 empty schedule, got %#v", result)
	}
}

func TestServiceGetDayScheduleItemsValidation(t *testing.T) {
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
			_, err := service.GetDayScheduleItems(context.Background(), "user-1", tt.tripID, tt.date)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestServiceGetDayScheduleItemsRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDayScheduleItems(context.Background(), " ", testTripID, "2026-07-10")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceGetDayScheduleItemsNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDayScheduleItems(context.Background(), "user-1", testTripID, "2026-07-10")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceGetDayScheduleItemsForbidden(t *testing.T) {
	service := newTestService(&fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true})

	_, err := service.GetDayScheduleItems(context.Background(), "user-1", testTripID, "2026-07-10")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestServiceGetDayScheduleItemsOutOfRange(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	_, err := service.GetDayScheduleItems(context.Background(), "user-1", testTripID, "2026-07-14")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	if repo.listedScheduleTripID != "" {
		t.Fatal("expected out-of-range date not to query schedule items")
	}
}

func TestServiceListDayExpenses(t *testing.T) {
	createdAt := time.Date(2026, 7, 10, 12, 30, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		dayExpenses: []DayExpenseListItem{
			{
				ID:           testUUID(9002),
				DisplayTitle: "라멘",
				Place:        &ExpensePlaceDisplay{Name: "라멘", Source: ExpenseDisplaySourceLive},
				AmountMinor:  1200,
				Currency:     "JPY",
				Payer:        ExpenseParticipantDisplay{DisplayName: "민수", Source: ExpenseDisplaySourceLive},
				SplitPolicy:  ExpenseSplitPolicyEqual,
				Splits: []DayExpenseSplitListItem{
					{SplitOrder: 1, Participant: ExpenseParticipantDisplay{DisplayName: "민수", Source: ExpenseDisplaySourceLive}, AmountMinor: 600},
					{SplitOrder: 2, Participant: ExpenseParticipantDisplay{DisplayName: "지아", Source: ExpenseDisplaySourceLive}, AmountMinor: 600},
				},
				CreatedAt: createdAt,
			},
		},
	}
	service := newTestService(repo)

	result, err := service.ListDayExpenses(context.Background(), "user-1", testTripID, "2026-07-10")
	if err != nil {
		t.Fatalf("ListDayExpenses returned error: %v", err)
	}
	if !repo.listDayExpensesCalled || repo.listedDayExpensesTripID != testTripID || repo.listedDayExpensesDate != "2026-07-10" {
		t.Fatalf("expected list repository call, got trip=%q date=%q called=%v", repo.listedDayExpensesTripID, repo.listedDayExpensesDate, repo.listDayExpensesCalled)
	}
	if len(result.Expenses) != 1 || result.Expenses[0].ID != testUUID(9002) || result.Expenses[0].Place == nil || result.Expenses[0].Place.Name != "라멘" || result.Expenses[0].Payer.DisplayName != "민수" || len(result.Expenses[0].Splits) != 2 || !result.Expenses[0].CreatedAt.Equal(createdAt) {
		t.Fatalf("unexpected day expense result: %#v", result)
	}
}

func TestServiceListDayExpensesEmpty(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	result, err := service.ListDayExpenses(context.Background(), "user-1", testTripID, "2026-07-11")
	if err != nil {
		t.Fatalf("ListDayExpenses returned error: %v", err)
	}
	if result.Expenses == nil || len(result.Expenses) != 0 {
		t.Fatalf("expected empty non-nil expense list, got %#v", result.Expenses)
	}
}

func TestServiceListDayExpensesValidationAuthAndRange(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		repo   *fakeRepository
		userID string
		tripID string
		date   string
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, userID: " ", tripID: testTripID, date: "2026-07-10", want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, userID: "user-1", tripID: "not-a-uuid", date: "2026-07-10", want: ErrValidation},
		{name: "invalid date", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026/07/10", want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: validTrip, tripFound: true}, userID: "user-1", tripID: testTripID, date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}, userID: "user-1", tripID: testTripID, date: "2026-07-14", want: ErrNotFound},
		{name: "repository error", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, listDayExpensesErr: ErrConflict}, userID: "user-1", tripID: testTripID, date: "2026-07-10", want: ErrConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newTestService(tt.repo).ListDayExpenses(context.Background(), tt.userID, tt.tripID, tt.date)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if tt.name != "repository error" && tt.repo.listDayExpensesCalled {
				t.Fatal("expected repository list call not to happen")
			}
		})
	}
}

func TestServiceUpdateExpenseManualSplit(t *testing.T) {
	payerID := testUUID(2001)
	participantA := testUUID(2002)
	participantB := testUUID(2003)
	expenseID := testUUID(9001)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	_, err := service.UpdateExpense(context.Background(), "user-1", testTripID, "2026-07-11", expenseID, UpdateExpenseInput{
		AmountMinor:        1200,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyManual,
		ManualSplits: []ManualExpenseSplitInput{
			{ParticipantID: strings.ToUpper(participantA), AmountMinor: 500},
			{ParticipantID: participantB, AmountMinor: 700},
		},
	})
	if err != nil {
		t.Fatalf("UpdateExpense returned error: %v", err)
	}

	if !repo.updatedExpenseCalled {
		t.Fatal("expected repository update expense to be called")
	}
	if repo.updatedExpenseRecord.SplitPolicy != ExpenseSplitPolicyManual || len(repo.updatedExpenseRecord.ParticipantIDs) != 0 {
		t.Fatalf("unexpected update split policy record: %#v", repo.updatedExpenseRecord)
	}
	if len(repo.updatedExpenseRecord.ManualSplits) != 2 || repo.updatedExpenseRecord.ManualSplits[0].ParticipantID != participantA || repo.updatedExpenseRecord.ManualSplits[0].AmountMinor != 500 || repo.updatedExpenseRecord.ManualSplits[1].ParticipantID != participantB || repo.updatedExpenseRecord.ManualSplits[1].AmountMinor != 700 {
		t.Fatalf("unexpected manual update split records: %#v", repo.updatedExpenseRecord.ManualSplits)
	}
}

func TestServiceUpdateExpenseManualValidation(t *testing.T) {
	payerID := testUUID(2001)
	expenseID := testUUID(9001)
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}
	tests := []struct {
		name  string
		input UpdateExpenseInput
	}{
		{name: "missing policy", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, ParticipantIDs: []string{payerID}}},
		{name: "manual rejects participant ids", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1000}}}},
		{name: "manual rejects empty participant id array", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ParticipantIDs: []string{}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1000}}}},
		{name: "manual mismatch", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 999}}}},
		{name: "equal rejects manual splits", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1000}}}},
		{name: "equal rejects empty manual split array", input: UpdateExpenseInput{AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}
			_, err := newTestService(repo).UpdateExpense(context.Background(), "user-1", testTripID, "2026-07-11", expenseID, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if repo.updatedExpenseCalled {
				t.Fatal("expected invalid manual update not to call repository")
			}
		})
	}
}

func TestServiceCreateQuickExpense(t *testing.T) {
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	itemID := testUUID(7001)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	result, err := service.CreateQuickExpense(context.Background(), "user-1", testTripID, "2026-07-11", CreateQuickExpenseInput{
		ScheduleItemID:     itemID,
		AmountMinor:        1001,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{strings.ToUpper(splitParticipantID)},
	})
	if err != nil {
		t.Fatalf("CreateQuickExpense returned error: %v", err)
	}

	if !repo.quickExpenseCalled {
		t.Fatal("expected repository quick expense creation to be called")
	}
	if repo.quickExpenseRecord.TripID != testTripID || repo.quickExpenseRecord.TripDayID != "2026-07-11" || repo.quickExpenseRecord.ScheduleItemID != itemID || repo.quickExpenseRecord.PayerParticipantID != payerID || repo.quickExpenseRecord.AmountMinor != 1001 || repo.quickExpenseRecord.SplitPolicy != ExpenseSplitPolicyEqual || repo.quickExpenseRecord.CreatedBy != "user-1" {
		t.Fatalf("unexpected quick expense record: %#v", repo.quickExpenseRecord)
	}
	if len(repo.quickExpenseRecord.ParticipantIDs) != 1 || repo.quickExpenseRecord.ParticipantIDs[0] != splitParticipantID {
		t.Fatalf("expected payer-excluded one-person split target, got %#v", repo.quickExpenseRecord.ParticipantIDs)
	}
	if result.Expense.ID == "" || result.Expense.AmountMinor != 1001 || result.Expense.Currency != "JPY" || result.Expense.ScheduleItemID == nil || *result.Expense.ScheduleItemID != itemID {
		t.Fatalf("unexpected quick expense result: %#v", result.Expense)
	}
}

func TestServiceCreateQuickExpenseManualSplit(t *testing.T) {
	payerID := testUUID(2001)
	participantA := testUUID(2002)
	participantB := testUUID(2003)
	itemID := testUUID(7001)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)

	_, err := service.CreateQuickExpense(context.Background(), "user-1", testTripID, "2026-07-11", CreateQuickExpenseInput{
		ScheduleItemID:     itemID,
		AmountMinor:        1000,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyManual,
		ManualSplits: []ManualExpenseSplitInput{
			{ParticipantID: strings.ToUpper(participantA), AmountMinor: 300},
			{ParticipantID: participantB, AmountMinor: 700},
		},
	})
	if err != nil {
		t.Fatalf("CreateQuickExpense returned error: %v", err)
	}

	if !repo.quickExpenseCalled {
		t.Fatal("expected repository quick expense creation to be called")
	}
	if repo.quickExpenseRecord.SplitPolicy != ExpenseSplitPolicyManual {
		t.Fatalf("expected manual split policy, got %#v", repo.quickExpenseRecord)
	}
	if len(repo.quickExpenseRecord.ParticipantIDs) != 0 {
		t.Fatalf("manual record must not carry equal participant IDs: %#v", repo.quickExpenseRecord.ParticipantIDs)
	}
	if len(repo.quickExpenseRecord.ManualSplits) != 2 || repo.quickExpenseRecord.ManualSplits[0].ParticipantID != participantA || repo.quickExpenseRecord.ManualSplits[0].AmountMinor != 300 || repo.quickExpenseRecord.ManualSplits[1].ParticipantID != participantB || repo.quickExpenseRecord.ManualSplits[1].AmountMinor != 700 {
		t.Fatalf("unexpected manual split records: %#v", repo.quickExpenseRecord.ManualSplits)
	}
}

func TestServiceCreateQuickExpenseValidationAuthAndRange(t *testing.T) {
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	itemID := testUUID(7001)
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}
	validInput := func() CreateQuickExpenseInput {
		return CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID, splitParticipantID}}
	}
	tests := []struct {
		name   string
		repo   *fakeRepository
		userID string
		tripID string
		date   string
		input  CreateQuickExpenseInput
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, userID: " ", tripID: testTripID, date: "2026-07-10", input: validInput(), want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, userID: "user-1", tripID: "not-a-uuid", date: "2026-07-10", input: validInput(), want: ErrValidation},
		{name: "invalid date", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026/07/10", input: validInput(), want: ErrValidation},
		{name: "invalid item id", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: "bad", AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}}, want: ErrValidation},
		{name: "invalid payer id", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: "bad", SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}}, want: ErrValidation},
		{name: "invalid amount", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 0, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}}, want: ErrValidation},
		{name: "missing split policy", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, ParticipantIDs: []string{payerID}}, want: ErrValidation},
		{name: "missing equal split participants", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual}, want: ErrValidation},
		{name: "invalid equal split participant id", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{"bad"}}, want: ErrValidation},
		{name: "duplicate equal split participant ids", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{splitParticipantID, splitParticipantID}}, want: ErrValidation},
		{name: "equal rejects manual splits", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1}}}, want: ErrValidation},
		{name: "equal rejects empty manual split array", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyEqual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{}}, want: ErrValidation},
		{name: "manual rejects participant ids", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ParticipantIDs: []string{payerID}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1}}}, want: ErrValidation},
		{name: "manual rejects empty participant id array", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ParticipantIDs: []string{}, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 1}}}, want: ErrValidation},
		{name: "manual missing splits", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual}, want: ErrValidation},
		{name: "manual split sum mismatch", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 999}}}, want: ErrValidation},
		{name: "manual duplicate participants", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 500}, {ParticipantID: payerID, AmountMinor: 500}}}, want: ErrValidation},
		{name: "manual non-positive amount", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: payerID, AmountMinor: 0}, {ParticipantID: splitParticipantID, AmountMinor: 1000}}}, want: ErrValidation},
		{name: "manual invalid participant id", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: CreateQuickExpenseInput{ScheduleItemID: itemID, AmountMinor: 1000, PayerParticipantID: payerID, SplitPolicy: ExpenseSplitPolicyManual, ManualSplits: []ManualExpenseSplitInput{{ParticipantID: "bad", AmountMinor: 1000}}}, want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: validInput(), want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: validTrip, tripFound: true}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: validInput(), want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}, userID: "user-1", tripID: testTripID, date: "2026-07-14", input: validInput(), want: ErrNotFound},
		{name: "repository not found", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, quickExpenseErr: ErrNotFound}, userID: "user-1", tripID: testTripID, date: "2026-07-10", input: validInput(), want: ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newTestService(tt.repo).CreateQuickExpense(context.Background(), tt.userID, tt.tripID, tt.date, tt.input)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if (errors.Is(tt.want, ErrValidation) || errors.Is(tt.want, ErrUnauthorized) || tt.name == "missing trip" || tt.name == "forbidden" || tt.name == "out of range") && tt.repo.quickExpenseCalled {
				t.Fatal("expected quick expense repository call not to happen")
			}
		})
	}
}

func TestSelectExpenseSplitParticipants(t *testing.T) {
	participants := []ExpenseSplitParticipant{
		{ParticipantID: testUUID(2001), DisplayName: "민수", JoinedAt: time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)},
		{ParticipantID: testUUID(2002), DisplayName: "지영", JoinedAt: time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)},
		{ParticipantID: testUUID(2003), DisplayName: "현우", JoinedAt: time.Date(2026, 7, 10, 11, 0, 0, 0, time.UTC)},
	}

	selected, err := SelectExpenseSplitParticipants(participants, []string{testUUID(2003), testUUID(2001)})
	if err != nil {
		t.Fatalf("SelectExpenseSplitParticipants returned error: %v", err)
	}
	if len(selected) != 2 || selected[0].ParticipantID != testUUID(2001) || selected[1].ParticipantID != testUUID(2003) {
		t.Fatalf("expected selected current participants in source order, got %#v", selected)
	}

	tests := []struct {
		name           string
		participantIDs []string
	}{
		{name: "empty", participantIDs: nil},
		{name: "duplicate", participantIDs: []string{testUUID(2001), testUUID(2001)}},
		{name: "unknown", participantIDs: []string{testUUID(2999)}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := SelectExpenseSplitParticipants(participants, tt.participantIDs)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestAllocateEqualExpenseSplits(t *testing.T) {
	participants := []ExpenseSplitParticipant{
		{ParticipantID: testUUID(2003), DisplayName: "현우", JoinedAt: time.Date(2026, 7, 10, 11, 0, 0, 0, time.UTC)},
		{ParticipantID: testUUID(2001), DisplayName: " 민수 ", JoinedAt: time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)},
		{ParticipantID: testUUID(2002), DisplayName: "", JoinedAt: time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)},
	}

	splits, err := AllocateEqualExpenseSplits(1000, participants)
	if err != nil {
		t.Fatalf("AllocateEqualExpenseSplits returned error: %v", err)
	}

	if len(splits) != 3 {
		t.Fatalf("expected 3 splits, got %#v", splits)
	}
	expectedAmounts := []int64{334, 333, 333}
	expectedIDs := []string{testUUID(2001), testUUID(2002), testUUID(2003)}
	expectedNames := []string{"민수", "여행자", "현우"}
	var total int64
	for index, split := range splits {
		if split.ParticipantID != expectedIDs[index] || split.AmountMinor != expectedAmounts[index] || split.SplitOrder != index+1 || split.ParticipantDisplayName != expectedNames[index] {
			t.Fatalf("unexpected split at %d: %#v", index, split)
		}
		total += split.AmountMinor
	}
	if total != 1000 {
		t.Fatalf("expected split total 1000, got %d", total)
	}
}

func TestAllocateEqualExpenseSplitsMatchesGoldenFixture(t *testing.T) {
	for _, fixtureCase := range loadEqualSplitFixtureCases(t) {
		t.Run(fixtureCase.Name, func(t *testing.T) {
			participants := make([]ExpenseSplitParticipant, 0, len(fixtureCase.Participants))
			for _, fixtureParticipant := range fixtureCase.Participants {
				joinedAt, err := time.Parse(time.RFC3339, fixtureParticipant.JoinedAt)
				if err != nil {
					t.Fatalf("parse joinedAt %q: %v", fixtureParticipant.JoinedAt, err)
				}
				participants = append(participants, ExpenseSplitParticipant{
					ParticipantID: fixtureParticipant.ParticipantID,
					DisplayName:   fixtureParticipant.DisplayName,
					JoinedAt:      joinedAt,
				})
			}

			splits, err := AllocateEqualExpenseSplits(fixtureCase.AmountMinor, participants)
			if err != nil {
				t.Fatalf("AllocateEqualExpenseSplits returned error: %v", err)
			}
			if len(splits) != len(fixtureCase.ExpectedSplits) {
				t.Fatalf("expected %d splits, got %#v", len(fixtureCase.ExpectedSplits), splits)
			}

			var total int64
			for index, expectedSplit := range fixtureCase.ExpectedSplits {
				got := splits[index]
				if got.ParticipantID != expectedSplit.ParticipantID || got.ParticipantDisplayName != expectedSplit.DisplayName || got.AmountMinor != expectedSplit.AmountMinor || got.SplitOrder != index+1 {
					t.Fatalf("unexpected split at %d: got %#v expected %#v", index, got, expectedSplit)
				}
				total += got.AmountMinor
			}
			if total != fixtureCase.AmountMinor {
				t.Fatalf("expected split total %d, got %d", fixtureCase.AmountMinor, total)
			}
		})
	}
}

func loadEqualSplitFixtureCases(t *testing.T) []equalSplitFixtureCase {
	t.Helper()

	fixturePath := filepath.Join("..", "..", "..", "..", "packages", "api-contract", "fixtures", "equal-split-cases.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("read equal split fixture: %v", err)
	}

	var fixtureCases []equalSplitFixtureCase
	if err := json.Unmarshal(data, &fixtureCases); err != nil {
		t.Fatalf("parse equal split fixture: %v", err)
	}
	if len(fixtureCases) == 0 {
		t.Fatal("expected at least one equal split fixture case")
	}
	return fixtureCases
}

func TestAllocateEqualExpenseSplitsAllowsZeroMinorUnitShares(t *testing.T) {
	splits, err := AllocateEqualExpenseSplits(1, []ExpenseSplitParticipant{
		{ParticipantID: testUUID(2001), DisplayName: "민수", JoinedAt: time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)},
		{ParticipantID: testUUID(2002), DisplayName: "지영", JoinedAt: time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)},
	})
	if err != nil {
		t.Fatalf("AllocateEqualExpenseSplits returned error: %v", err)
	}
	if splits[0].AmountMinor != 1 || splits[1].AmountMinor != 0 {
		t.Fatalf("expected one minor unit assigned by order, got %#v", splits)
	}
}

func TestServiceListTripPlaces(t *testing.T) {
	places := []TripPlaceSummary{
		{ID: testUUID(8001), Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi-Shinsaibashi"},
		{ID: testUUID(8002), Name: "도톤보리", PlaceType: "sights", Address: "Dotonbori"},
	}
	repo := &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true, tripPlaces: places}
	service := newTestService(repo)

	result, err := service.ListTripPlaces(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("ListTripPlaces returned error: %v", err)
	}
	if repo.listTripPlacesTripID != testTripID {
		t.Fatalf("expected list trip places lookup by trip, got %q", repo.listTripPlacesTripID)
	}
	if len(result.Places) != 2 || result.Places[0].Name != "호텔 니코 오사카" || result.Places[1].Name != "도톤보리" {
		t.Fatalf("expected existing trip places in repository order, got %#v", result.Places)
	}
}

func TestServiceCreateManualDayLodgingPlace(t *testing.T) {
	repo := &fakeRepository{
		trip:                  Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:             true,
		isParticipant:         true,
		manualDayLodgingPlace: TripPlaceSummary{ID: testUUID(8801), Name: "호텔 니코 오사카", PlaceType: "lodging", Address: "Nishi-Shinsaibashi"},
	}
	service := newTestService(repo)

	result, err := service.CreateManualDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11", CreateManualDayLodgingPlaceInput{
		Name:    " 호텔 니코 오사카 ",
		Address: " Nishi-Shinsaibashi ",
	})
	if err != nil {
		t.Fatalf("CreateManualDayLodgingPlace returned error: %v", err)
	}
	if !repo.manualDayLodgingCalled || repo.manualDayLodgingRecord.TripID != testTripID || repo.manualDayLodgingRecord.TripDayID != "2026-07-11" || repo.manualDayLodgingRecord.Name != "호텔 니코 오사카" || repo.manualDayLodgingRecord.Address != "Nishi-Shinsaibashi" {
		t.Fatalf("expected normalized manual lodging record, got called=%v record=%#v", repo.manualDayLodgingCalled, repo.manualDayLodgingRecord)
	}
	if result.Day.LodgingPlace == nil || result.Day.LodgingPlace.ID != testUUID(8801) || result.LodgingPlace.PlaceType != "lodging" {
		t.Fatalf("expected created lodging place set on day, got %#v", result)
	}
}

func TestServiceCreateManualDayLodgingPlaceValidation(t *testing.T) {
	tests := []struct {
		name  string
		input CreateManualDayLodgingPlaceInput
	}{
		{name: "blank name", input: CreateManualDayLodgingPlaceInput{Name: " ", Address: "Nishi"}},
		{name: "too long name", input: CreateManualDayLodgingPlaceInput{Name: strings.Repeat("가", 121), Address: "Nishi"}},
		{name: "blank address", input: CreateManualDayLodgingPlaceInput{Name: "호텔", Address: " "}},
		{name: "too long address", input: CreateManualDayLodgingPlaceInput{Name: "호텔", Address: strings.Repeat("가", 301)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true}
			service := newTestService(repo)
			_, err := service.CreateManualDayLodgingPlace(context.Background(), "user-1", testTripID, "2026-07-11", tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if repo.manualDayLodgingCalled {
				t.Fatal("expected invalid input not to call repository")
			}
		})
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
	if !repo.setDayLodgingCalled || repo.setDayLodgingRecord.TripID != testTripID || repo.setDayLodgingRecord.TripDayID != "2026-07-11" || repo.setDayLodgingRecord.TripPlaceID != placeID {
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

func TestServiceCreateManualScheduleItem(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:        testTripID,
			StartDate: "2026-07-10",
			EndDate:   "2026-07-13",
		},
		tripFound:     true,
		isParticipant: true,
		createdManualItem: ScheduleItem{
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

	result, err := service.CreateManualScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", CreateManualScheduleItemInput{
		Name:      "  우메다 공중정원  ",
		Address:   "  Umeda  ",
		PlaceType: "sights",
	})
	if err != nil {
		t.Fatalf("CreateManualScheduleItem returned error: %v", err)
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
	if record.TripID != testTripID || record.TripDayID != "2026-07-11" || record.Name != "우메다 공중정원" || record.Address != "Umeda" || record.PlaceType != "sights" {
		t.Fatalf("expected trimmed create record, got %#v", record)
	}
}

func TestServiceCreateManualScheduleItemValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		tripID string
		date   string
		input  CreateManualScheduleItemInput
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10", input: CreateManualScheduleItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10", input: CreateManualScheduleItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}},
		{name: "blank name", tripID: testTripID, date: "2026-07-10", input: CreateManualScheduleItemInput{Name: " ", Address: "Umeda", PlaceType: "sights"}},
		{name: "too long name", tripID: testTripID, date: "2026-07-10", input: CreateManualScheduleItemInput{Name: strings.Repeat("가", 121), Address: "Umeda", PlaceType: "sights"}},
		{name: "blank address", tripID: testTripID, date: "2026-07-10", input: CreateManualScheduleItemInput{Name: "우메다", Address: " ", PlaceType: "sights"}},
		{name: "too long address", tripID: testTripID, date: "2026-07-10", input: CreateManualScheduleItemInput{Name: "우메다", Address: strings.Repeat("가", 241), PlaceType: "sights"}},
		{name: "invalid place type", tripID: testTripID, date: "2026-07-10", input: CreateManualScheduleItemInput{Name: "우메다", Address: "Umeda", PlaceType: "museum"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}
			service := newTestService(repo)
			_, err := service.CreateManualScheduleItem(context.Background(), "user-1", tt.tripID, tt.date, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if len(repo.createdManualRecords) != 0 {
				t.Fatalf("expected invalid input not to create rows, got %#v", repo.createdManualRecords)
			}
		})
	}
}

func TestServiceCreateManualScheduleItemAuthAndRange(t *testing.T) {
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
			_, err := service.CreateManualScheduleItem(context.Background(), tt.user, testTripID, tt.date, CreateManualScheduleItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"})
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if len(tt.repo.createdManualRecords) != 0 {
				t.Fatalf("expected failure not to create rows, got %#v", tt.repo.createdManualRecords)
			}
		})
	}
}

func TestServiceCreateManualScheduleItemAllowsDuplicates(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
	}
	service := newTestService(repo)
	input := CreateManualScheduleItemInput{Name: "우메다", Address: "Umeda", PlaceType: "sights"}

	if _, err := service.CreateManualScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", input); err != nil {
		t.Fatalf("first create returned error: %v", err)
	}
	if _, err := service.CreateManualScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", input); err != nil {
		t.Fatalf("duplicate create returned error: %v", err)
	}
	if len(repo.createdManualRecords) != 2 {
		t.Fatalf("expected duplicate creates to call repository twice, got %#v", repo.createdManualRecords)
	}
}

func TestServiceUpdateScheduleItem(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		dayItem: ScheduleItem{
			ID:        testUUID(7001),
			ItemOrder: 2,
			StartTime: stringPtr("09:00"),
			EndTime:   stringPtr("10:00"),
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

	result, err := service.UpdateScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", testUUID(7001), UpdateScheduleItemInput{
		Name:      stringPtr("  우메다 스카이빌딩  "),
		Address:   stringPtr("  Umeda Sky Building  "),
		StartTime: stringPtr(" 09:30 "),
		EndTime:   stringPtr(""),
	})
	if err != nil {
		t.Fatalf("UpdateScheduleItem returned error: %v", err)
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
	if repo.updatedDayItemRecord.TripID != testTripID || repo.updatedDayItemRecord.TripDayID != "2026-07-11" || repo.updatedDayItemRecord.ItemID != testUUID(7001) || repo.updatedDayItemRecord.Name != "우메다 스카이빌딩" || repo.updatedDayItemRecord.Address != "Umeda Sky Building" || repo.updatedDayItemRecord.PlaceType != "sights" {
		t.Fatalf("expected merged trimmed update record, got %#v", repo.updatedDayItemRecord)
	}
	if repo.updatedDayItemRecord.StartTime == nil || *repo.updatedDayItemRecord.StartTime != "09:30" || repo.updatedDayItemRecord.EndTime != nil {
		t.Fatalf("expected start time set and end time cleared, got start=%v end=%v", repo.updatedDayItemRecord.StartTime, repo.updatedDayItemRecord.EndTime)
	}
}

func TestServiceUpdateScheduleItemValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		tripID string
		date   string
		itemID string
		input  UpdateScheduleItemInput
	}{
		{name: "invalid trip id", tripID: "not-a-uuid", date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Name: stringPtr("우메다")}},
		{name: "invalid date", tripID: testTripID, date: "2026/07/10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Name: stringPtr("우메다")}},
		{name: "invalid item id", tripID: testTripID, date: "2026-07-10", itemID: "not-a-uuid", input: UpdateScheduleItemInput{Name: stringPtr("우메다")}},
		{name: "empty patch", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{}},
		{name: "blank name", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Name: stringPtr(" ")}},
		{name: "too long name", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Name: stringPtr(strings.Repeat("가", 121))}},
		{name: "blank address", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Address: stringPtr(" ")}},
		{name: "too long address", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{Address: stringPtr(strings.Repeat("가", 301))}},
		{name: "invalid place type", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{PlaceType: stringPtr("museum")}},
		{name: "invalid start time", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{StartTime: stringPtr("9:00")}},
		{name: "end time without start time", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{EndTime: stringPtr("10:00")}},
		{name: "end time before start time", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{StartTime: stringPtr("11:00"), EndTime: stringPtr("10:00")}},
		{name: "end time equal start time", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{StartTime: stringPtr("10:00"), EndTime: stringPtr("10:00")}},
		{name: "clearing start clears existing end", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), input: UpdateScheduleItemInput{StartTime: stringPtr(""), EndTime: stringPtr("10:00")}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, dayItem: ScheduleItem{ID: testUUID(7001), ItemOrder: 1, Place: TripPlaceSummary{ID: testUUID(8001), Name: "우메다", Address: "Umeda", PlaceType: "sights"}}, dayItemFound: true}
			service := newTestService(repo)
			_, err := service.UpdateScheduleItem(context.Background(), "user-1", tt.tripID, tt.date, tt.itemID, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if repo.updatedDayItemCalled {
				t.Fatal("expected invalid update not to call repository update")
			}
		})
	}
}

func TestServiceUpdateScheduleItemAuthRangeAndTarget(t *testing.T) {
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
			_, err := service.UpdateScheduleItem(context.Background(), tt.user, testTripID, tt.date, testUUID(7001), UpdateScheduleItemInput{Name: stringPtr("우메다")})
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

func TestServiceDeleteScheduleItem(t *testing.T) {
	repo := &fakeRepository{
		trip:             Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:        true,
		isParticipant:    true,
		deletedDayItemOK: true,
	}
	service := newTestService(repo)

	err := service.DeleteScheduleItem(context.Background(), "user-1", testTripID, "2026-07-11", testUUID(7001))
	if err != nil {
		t.Fatalf("DeleteScheduleItem returned error: %v", err)
	}
	if !repo.deletedDayItemCalled || repo.deletedDayItemTripID != testTripID || repo.deletedDayItemDate != "2026-07-11" || repo.deletedDayItemID != testUUID(7001) {
		t.Fatalf("expected repository delete by trip/date/item, got trip=%q date=%q item=%q called=%v", repo.deletedDayItemTripID, repo.deletedDayItemDate, repo.deletedDayItemID, repo.deletedDayItemCalled)
	}
}

func TestServiceReorderScheduleItemsValidation(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	anchorBefore := testUUID(7002)
	anchorAfter := testUUID(7003)
	tests := []struct {
		name  string
		user  string
		trip  string
		date  string
		moves []ReorderDayScheduleMoveInput
	}{
		{name: "missing auth", user: " ", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "invalid trip id", user: "user-1", trip: "not-a-uuid", date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "invalid date", user: "user-1", trip: testTripID, date: "2026/07/10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "empty moves", user: "user-1", trip: testTripID, date: "2026-07-10", moves: nil},
		{name: "both anchors nil", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), ClientVersion: 1}}},
		{name: "duplicate ids", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7001)), ClientVersion: 1}}},
		{name: "invalid client version", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: &anchorBefore, ClientVersion: 0}}},
		{name: "missing referenced item", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7999), BeforeItemID: &anchorBefore, ClientVersion: 1}}},
		{name: "missing anchor item", user: "user-1", trip: testTripID, date: "2026-07-10", moves: []ReorderDayScheduleMoveInput{{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7999)), AfterItemID: &anchorAfter, ClientVersion: 1}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{
				trip:             validTrip,
				tripFound:        true,
				isParticipant:    true,
				dayScheduleItems: []ScheduleItem{{ID: testUUID(7001)}, {ID: anchorBefore}, {ID: anchorAfter}},
			}
			service := newTestService(repo)
			_, err := service.ReorderScheduleItems(context.Background(), tt.user, tt.trip, tt.date, tt.moves)
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

func TestServiceReorderScheduleItemsAuthConflictAndRange(t *testing.T) {
	move := ReorderDayScheduleMoveInput{ItemID: testUUID(7001), BeforeItemID: stringPtr(testUUID(7002)), ClientVersion: 1}
	tests := []struct {
		name string
		repo *fakeRepository
		user string
		date string
		want error
	}{
		{name: "missing trip", repo: &fakeRepository{}, user: "user-1", date: "2026-07-10", want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, dayScheduleItems: []ScheduleItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}}, user: "user-1", date: "2026-07-10", want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true, dayScheduleItems: []ScheduleItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}}, user: "user-1", date: "2026-07-14", want: ErrNotFound},
		{name: "conflict", repo: &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}, tripFound: true, isParticipant: true, dayScheduleItems: []ScheduleItem{{ID: testUUID(7001)}, {ID: testUUID(7002)}}, reorderErr: ErrConflict}, user: "user-1", date: "2026-07-10", want: ErrConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.ReorderScheduleItems(context.Background(), tt.user, testTripID, tt.date, []ReorderDayScheduleMoveInput{move})
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestServiceReorderScheduleItemsSuccess(t *testing.T) {
	reorderedItems := []ScheduleItem{
		{ID: testUUID(7001), ItemOrder: 1, Version: 1},
		{ID: testUUID(7004), ItemOrder: 2, Version: 2},
		{ID: testUUID(7003), ItemOrder: 3, Version: 1},
		{ID: testUUID(7002), ItemOrder: 4, Version: 2},
	}
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:     true,
		isParticipant: true,
		dayScheduleItems: []ScheduleItem{
			{ID: testUUID(7001)},
			{ID: testUUID(7002)},
			{ID: testUUID(7003)},
			{ID: testUUID(7004)},
		},
		reorderedItems: reorderedItems,
	}
	service := newTestService(repo)

	result, err := service.ReorderScheduleItems(context.Background(), "user-1", testTripID, "2026-07-11", []ReorderDayScheduleMoveInput{
		{ItemID: testUUID(7004), BeforeItemID: stringPtr(testUUID(7001)), AfterItemID: stringPtr(testUUID(7002)), ClientVersion: 1},
		{ItemID: testUUID(7002), BeforeItemID: stringPtr(testUUID(7003)), ClientVersion: 1},
	})
	if err != nil {
		t.Fatalf("ReorderScheduleItems returned error: %v", err)
	}
	if !repo.reorderedCalled {
		t.Fatal("expected repository reorder to be called")
	}
	if repo.reorderedRecord.TripID != testTripID || repo.reorderedRecord.TripDayID != "2026-07-11" {
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

func TestServiceMarkScheduleItemArrived(t *testing.T) {
	arrivedAt := time.Date(2026, 7, 10, 9, 30, 0, 0, time.UTC)
	items := []ScheduleItem{
		{ID: testUUID(7001), ItemOrder: 1, Version: 1, ArrivedAt: &arrivedAt, Place: TripPlaceSummary{ID: testUUID(8001), Name: "도톤보리", Address: "Dotonbori", PlaceType: "food"}},
		{ID: testUUID(7002), ItemOrder: 2, Version: 1, Place: TripPlaceSummary{ID: testUUID(8002), Name: "오사카성", Address: "Osakajo", PlaceType: "sights"}},
	}
	repo := &fakeRepository{
		trip:                Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:           true,
		isParticipant:       true,
		dayLodgingPlace:     TripPlaceSummary{ID: testUUID(8003), Name: "호텔", Address: "Namba", PlaceType: "lodging"},
		dayLodgingFound:     true,
		markedArrivedResult: MarkScheduleItemArrivedMutationResult{Item: items[0], Items: items},
	}
	service := newTestService(repo)

	result, err := service.MarkScheduleItemArrived(context.Background(), "user-1", testTripID, "2026-07-10", testUUID(7001))
	if err != nil {
		t.Fatalf("MarkScheduleItemArrived returned error: %v", err)
	}

	if !repo.markedArrivedCalled {
		t.Fatal("expected repository arrival mutation to be called")
	}
	if repo.markedArrivedRecord.TripID != testTripID || repo.markedArrivedRecord.TripDayID != "2026-07-10" || repo.markedArrivedRecord.ItemID != testUUID(7001) {
		t.Fatalf("unexpected arrival record: %#v", repo.markedArrivedRecord)
	}
	if result.Day.Date != "2026-07-10" || result.Day.DayOrder != 1 || result.Day.LodgingPlace == nil {
		t.Fatalf("unexpected result day: %#v", result.Day)
	}
	if result.Item.ID != testUUID(7001) || result.Item.ArrivedAt == nil || !result.Item.ArrivedAt.Equal(arrivedAt) {
		t.Fatalf("unexpected arrived item: %#v", result.Item)
	}
	if len(result.Items) != 2 || result.Items[1].ID != testUUID(7002) {
		t.Fatalf("expected full latest day snapshot, got %#v", result.Items)
	}
}

func TestServiceMarkScheduleItemArrivedFailures(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
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
		{name: "forbidden", repo: &fakeRepository{trip: validTrip, tripFound: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrForbidden},
		{name: "out of range", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-14", itemID: testUUID(7001), want: ErrNotFound},
		{name: "item not found", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, markedArrivedErr: ErrNotFound}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
		{name: "out of order conflict", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, markedArrivedErr: ErrConflict}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7002), want: ErrConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			_, err := service.MarkScheduleItemArrived(context.Background(), tt.user, tt.tripID, tt.date, tt.itemID)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestServiceMarkScheduleItemSkipped(t *testing.T) {
	skippedAt := time.Date(2026, 7, 10, 10, 30, 0, 0, time.UTC)
	items := []ScheduleItem{
		{ID: testUUID(7001), ItemOrder: 1, Version: 1, SkippedAt: &skippedAt, Place: TripPlaceSummary{ID: testUUID(8001), Name: "도톤보리", Address: "Dotonbori", PlaceType: "food"}},
		{ID: testUUID(7002), ItemOrder: 2, Version: 1, Place: TripPlaceSummary{ID: testUUID(8002), Name: "오사카성", Address: "Osakajo", PlaceType: "sights"}},
	}
	repo := &fakeRepository{
		trip:                Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:           true,
		isParticipant:       true,
		markedSkippedResult: MarkScheduleItemSkippedMutationResult{Item: items[0], Items: items},
	}
	service := newTestService(repo)

	result, err := service.MarkScheduleItemSkipped(context.Background(), "user-1", testTripID, "2026-07-10", testUUID(7001))
	if err != nil {
		t.Fatalf("MarkScheduleItemSkipped returned error: %v", err)
	}

	if !repo.markedSkippedCalled {
		t.Fatal("expected repository skip mutation to be called")
	}
	if repo.markedSkippedRecord.TripID != testTripID || repo.markedSkippedRecord.TripDayID != "2026-07-10" || repo.markedSkippedRecord.ItemID != testUUID(7001) {
		t.Fatalf("unexpected skip record: %#v", repo.markedSkippedRecord)
	}
	if result.Day.Date != "2026-07-10" || result.Day.DayOrder != 1 {
		t.Fatalf("unexpected result day: %#v", result.Day)
	}
	if result.Item.ID != testUUID(7001) || result.Item.SkippedAt == nil || !result.Item.SkippedAt.Equal(skippedAt) {
		t.Fatalf("unexpected skipped item: %#v", result.Item)
	}
	if len(result.Items) != 2 || result.Items[1].ID != testUUID(7002) {
		t.Fatalf("expected full latest day snapshot, got %#v", result.Items)
	}
}

func TestServiceRestoreScheduleItem(t *testing.T) {
	items := []ScheduleItem{
		{ID: testUUID(7001), ItemOrder: 1, Version: 1, Place: TripPlaceSummary{ID: testUUID(8001), Name: "도톤보리", Address: "Dotonbori", PlaceType: "food"}},
		{ID: testUUID(7002), ItemOrder: 2, Version: 1, Place: TripPlaceSummary{ID: testUUID(8002), Name: "오사카성", Address: "Osakajo", PlaceType: "sights"}},
	}
	repo := &fakeRepository{
		trip:                  Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"},
		tripFound:             true,
		isParticipant:         true,
		restoredDayItemResult: RestoreScheduleItemMutationResult{Item: items[0], Items: items},
	}
	service := newTestService(repo)

	result, err := service.RestoreScheduleItem(context.Background(), "user-1", testTripID, "2026-07-10", testUUID(7001))
	if err != nil {
		t.Fatalf("RestoreScheduleItem returned error: %v", err)
	}

	if !repo.restoredDayItemCalled {
		t.Fatal("expected repository restore mutation to be called")
	}
	if repo.restoredDayItemRecord.TripID != testTripID || repo.restoredDayItemRecord.TripDayID != "2026-07-10" || repo.restoredDayItemRecord.ItemID != testUUID(7001) {
		t.Fatalf("unexpected restore record: %#v", repo.restoredDayItemRecord)
	}
	if result.Day.Date != "2026-07-10" || result.Day.DayOrder != 1 {
		t.Fatalf("unexpected result day: %#v", result.Day)
	}
	if result.Item.ID != testUUID(7001) || result.Item.SkippedAt != nil {
		t.Fatalf("unexpected restored item: %#v", result.Item)
	}
	if len(result.Items) != 2 || result.Items[1].ID != testUUID(7002) {
		t.Fatalf("expected full latest day snapshot, got %#v", result.Items)
	}
}

func TestServiceDayScheduleSkipAndRestoreFailures(t *testing.T) {
	validTrip := Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13"}
	tests := []struct {
		name   string
		action string
		repo   *fakeRepository
		user   string
		tripID string
		date   string
		itemID string
		want   error
	}{
		{name: "skip requires auth", action: "skip", repo: &fakeRepository{}, user: " ", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrUnauthorized},
		{name: "skip invalid trip id", action: "skip", repo: &fakeRepository{}, user: "user-1", tripID: "not-a-uuid", date: "2026-07-10", itemID: testUUID(7001), want: ErrValidation},
		{name: "skip invalid date", action: "skip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026/07/10", itemID: testUUID(7001), want: ErrValidation},
		{name: "skip invalid item id", action: "skip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: "not-a-uuid", want: ErrValidation},
		{name: "skip missing trip", action: "skip", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
		{name: "skip forbidden", action: "skip", repo: &fakeRepository{trip: validTrip, tripFound: true}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrForbidden},
		{name: "skip out of range", action: "skip", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true}, user: "user-1", tripID: testTripID, date: "2026-07-14", itemID: testUUID(7001), want: ErrNotFound},
		{name: "skip item not found", action: "skip", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, markedSkippedErr: ErrNotFound}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
		{name: "skip conflict", action: "skip", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, markedSkippedErr: ErrConflict}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7002), want: ErrConflict},
		{name: "restore requires auth", action: "restore", repo: &fakeRepository{}, user: " ", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrUnauthorized},
		{name: "restore invalid item id", action: "restore", repo: &fakeRepository{}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: "not-a-uuid", want: ErrValidation},
		{name: "restore item not found", action: "restore", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, restoredDayItemErr: ErrNotFound}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrNotFound},
		{name: "restore conflict", action: "restore", repo: &fakeRepository{trip: validTrip, tripFound: true, isParticipant: true, restoredDayItemErr: ErrConflict}, user: "user-1", tripID: testTripID, date: "2026-07-10", itemID: testUUID(7001), want: ErrConflict},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(tt.repo)
			var err error
			if tt.action == "skip" {
				_, err = service.MarkScheduleItemSkipped(context.Background(), tt.user, tt.tripID, tt.date, tt.itemID)
			} else {
				_, err = service.RestoreScheduleItem(context.Background(), tt.user, tt.tripID, tt.date, tt.itemID)
			}
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestServiceDeleteScheduleItemFailures(t *testing.T) {
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
			err := service.DeleteScheduleItem(context.Background(), tt.user, tt.tripID, tt.date, tt.itemID)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestServiceGetMySettlementSummaryFiltersCurrentUserNonZeroBalances(t *testing.T) {
	currentParticipant := testUUID(2001)
	friendParticipant := testUUID(2002)
	thirdParticipant := testUUID(2003)
	joinedAt := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		listed: []ListItem{
			{
				ID:              testUUID(1001),
				ParticipantID:   currentParticipant,
				Name:            "오사카",
				StartDate:       "2026-07-10",
				EndDate:         "2026-07-14",
				DefaultCurrency: "KRW",
			},
			{
				ID:              testUUID(1002),
				ParticipantID:   currentParticipant,
				Name:            "도쿄",
				StartDate:       "2026-08-01",
				EndDate:         "2026-08-03",
				DefaultCurrency: "USD",
			},
			{
				ID:              testUUID(1003),
				ParticipantID:   currentParticipant,
				Name:            "정산 완료",
				StartDate:       "2026-09-01",
				EndDate:         "2026-09-02",
				DefaultCurrency: "KRW",
			},
		},
		settlementDataByTrip: map[string]SettlementInput{
			testUUID(1001): {
				Participants: []SettlementParticipantInput{
					{ParticipantID: currentParticipant, DisplayName: "민수", JoinedAt: joinedAt},
					{ParticipantID: friendParticipant, DisplayName: "지영", JoinedAt: joinedAt.Add(time.Hour)},
				},
				Expenses: []SettlementExpenseInput{
					settlementExpense(testUUID(3001), "KRW", 1000, friendParticipant, []SettlementSplitInput{{ParticipantID: stringPtr(currentParticipant), DisplayName: "민수", ParticipantLive: true, AmountMinor: 500}, {ParticipantID: stringPtr(friendParticipant), DisplayName: "지영", ParticipantLive: true, AmountMinor: 500}}),
				},
			},
			testUUID(1002): {
				Participants: []SettlementParticipantInput{
					{ParticipantID: currentParticipant, DisplayName: "민수", JoinedAt: joinedAt},
					{ParticipantID: thirdParticipant, DisplayName: "유나", JoinedAt: joinedAt.Add(time.Hour)},
				},
				Expenses: []SettlementExpenseInput{
					settlementExpense(testUUID(3002), "USD", 700, currentParticipant, []SettlementSplitInput{{ParticipantID: stringPtr(currentParticipant), DisplayName: "민수", ParticipantLive: true, AmountMinor: 700}}),
					settlementExpense(testUUID(3003), "JPY", 900, currentParticipant, []SettlementSplitInput{{ParticipantID: stringPtr(currentParticipant), DisplayName: "민수", ParticipantLive: true, AmountMinor: 450}, {ParticipantID: stringPtr(thirdParticipant), DisplayName: "유나", ParticipantLive: true, AmountMinor: 450}}),
				},
			},
			testUUID(1003): {
				Participants: []SettlementParticipantInput{
					{ParticipantID: currentParticipant, DisplayName: "민수", JoinedAt: joinedAt},
				},
			},
		},
	}

	result, err := newTestService(repo).GetMySettlementSummary(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("GetMySettlementSummary returned error: %v", err)
	}
	if repo.listedUserID != "user-1" {
		t.Fatalf("expected listed user user-1, got %q", repo.listedUserID)
	}
	if len(result.Trips) != 2 {
		t.Fatalf("expected two non-zero trip summaries, got %#v", result.Trips)
	}

	first := result.Trips[0]
	if first.TripID != testUUID(1001) || first.TripName != "오사카" || first.StartDate != "2026-07-10" || first.EndDate != "2026-07-14" {
		t.Fatalf("unexpected first trip metadata: %#v", first)
	}
	if len(first.CurrencySummaries) != 1 || first.CurrencySummaries[0].Currency != "KRW" || first.CurrencySummaries[0].Direction != MySettlementDirectionSend || first.CurrencySummaries[0].NetMinor != 500 {
		t.Fatalf("unexpected first trip summary: %#v", first.CurrencySummaries)
	}

	second := result.Trips[1]
	if second.TripID != testUUID(1002) || second.TripName != "도쿄" {
		t.Fatalf("unexpected second trip metadata: %#v", second)
	}
	if len(second.CurrencySummaries) != 1 || second.CurrencySummaries[0].Currency != "JPY" || second.CurrencySummaries[0].Direction != MySettlementDirectionReceive || second.CurrencySummaries[0].NetMinor != 450 {
		t.Fatalf("expected only non-zero JPY receive summary, got %#v", second.CurrencySummaries)
	}
}

func TestServiceGetMySettlementSummaryRejectsBlankUser(t *testing.T) {
	_, err := newTestService(&fakeRepository{}).GetMySettlementSummary(context.Background(), " ")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestServiceGetMySettlementSummaryMapsInconsistentSettlement(t *testing.T) {
	currentParticipant := testUUID(2001)
	repo := &fakeRepository{
		listed: []ListItem{{ID: testUUID(1001), ParticipantID: currentParticipant, Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-14", DefaultCurrency: "KRW"}},
		settlementDataByTrip: map[string]SettlementInput{
			testUUID(1001): {
				Participants: []SettlementParticipantInput{{ParticipantID: currentParticipant, DisplayName: "민수", JoinedAt: time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)}},
				Expenses: []SettlementExpenseInput{
					settlementExpense(testUUID(3001), "KRW", 1000, currentParticipant, []SettlementSplitInput{{ParticipantID: stringPtr(currentParticipant), DisplayName: "민수", ParticipantLive: true, AmountMinor: 900}}),
				},
			},
		},
	}

	_, err := newTestService(repo).GetMySettlementSummary(context.Background(), "user-1")
	if !errors.Is(err, ErrSettlementSummaryUnavailable) {
		t.Fatalf("expected settlement summary unavailable, got %v", err)
	}
}

func TestServiceGetTripSettlementCalculatesBalancesAndTransfers(t *testing.T) {
	participantA := testUUID(2001)
	participantB := testUUID(2002)
	participantC := testUUID(2003)
	joinedAt := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "KRW"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{
				{ParticipantID: participantB, DisplayName: "지영", JoinedAt: joinedAt.Add(2 * time.Hour)},
				{ParticipantID: participantA, DisplayName: "민수", JoinedAt: joinedAt},
				{ParticipantID: participantC, DisplayName: "유나", JoinedAt: joinedAt.Add(3 * time.Hour)},
			},
			Expenses: []SettlementExpenseInput{
				{
					ExpenseID:             testUUID(3001),
					Currency:              "KRW",
					AmountMinor:           1000,
					PayerParticipantID:    stringPtr(participantA),
					PayerDisplayName:      "민수",
					PayerParticipantLive:  true,
					PayerParticipantOrder: 0,
					Splits: []SettlementSplitInput{
						{ParticipantID: stringPtr(participantA), DisplayName: "민수", ParticipantLive: true, AmountMinor: 500},
						{ParticipantID: stringPtr(participantB), DisplayName: "지영", ParticipantLive: true, AmountMinor: 500},
					},
				},
			},
		},
	}

	result, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetTripSettlement returned error: %v", err)
	}

	if result.TripID != testTripID || result.DefaultCurrency != "KRW" {
		t.Fatalf("unexpected settlement metadata: %#v", result)
	}
	if len(result.CurrencySummaries) != 1 {
		t.Fatalf("expected one currency summary, got %#v", result.CurrencySummaries)
	}
	summary := result.CurrencySummaries[0]
	if summary.Currency != "KRW" || summary.TotalPaidMinor != 1000 || summary.TotalShareMinor != 1000 {
		t.Fatalf("unexpected summary totals: %#v", summary)
	}
	if len(summary.Balances) != 3 {
		t.Fatalf("expected all current participants including zero rows, got %#v", summary.Balances)
	}
	assertSettlementBalance(t, summary.Balances[0], participantA, "민수", SettlementParticipantStatusCurrent, 1000, 500, 500)
	assertSettlementBalance(t, summary.Balances[1], participantB, "지영", SettlementParticipantStatusCurrent, 0, 500, -500)
	assertSettlementBalance(t, summary.Balances[2], participantC, "유나", SettlementParticipantStatusCurrent, 0, 0, 0)
	if len(summary.SuggestedTransfers) != 1 {
		t.Fatalf("expected one transfer, got %#v", summary.SuggestedTransfers)
	}
	assertSettlementTransfer(t, summary.SuggestedTransfers[0], participantB, "지영", participantA, "민수", 500)
}

func TestServiceGetTripSettlementEmptyTrip(t *testing.T) {
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "JPY"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{{ParticipantID: testUUID(2001), DisplayName: "민수", JoinedAt: time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)}},
		},
	}

	result, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetTripSettlement returned error: %v", err)
	}
	if result.DefaultCurrency != "JPY" || len(result.CurrencySummaries) != 0 {
		t.Fatalf("expected empty settlement summaries, got %#v", result)
	}
}

func TestServiceGetTripSettlementSortsCurrenciesAndDoesNotNetAcrossCurrencies(t *testing.T) {
	participantA := testUUID(2001)
	participantB := testUUID(2002)
	joinedAt := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "KRW"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{
				{ParticipantID: participantA, DisplayName: "민수", JoinedAt: joinedAt},
				{ParticipantID: participantB, DisplayName: "지영", JoinedAt: joinedAt.Add(time.Hour)},
			},
			Expenses: []SettlementExpenseInput{
				settlementExpense(testUUID(3001), "USD", 900, participantA, []SettlementSplitInput{{ParticipantID: stringPtr(participantA), DisplayName: "민수", ParticipantLive: true, AmountMinor: 450}, {ParticipantID: stringPtr(participantB), DisplayName: "지영", ParticipantLive: true, AmountMinor: 450}}),
				settlementExpense(testUUID(3002), "KRW", 300, participantB, []SettlementSplitInput{{ParticipantID: stringPtr(participantA), DisplayName: "민수", ParticipantLive: true, AmountMinor: 150}, {ParticipantID: stringPtr(participantB), DisplayName: "지영", ParticipantLive: true, AmountMinor: 150}}),
			},
		},
	}

	result, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetTripSettlement returned error: %v", err)
	}
	if len(result.CurrencySummaries) != 2 || result.CurrencySummaries[0].Currency != "KRW" || result.CurrencySummaries[1].Currency != "USD" {
		t.Fatalf("expected default currency first and independent USD summary, got %#v", result.CurrencySummaries)
	}
	assertSettlementTransfer(t, result.CurrencySummaries[0].SuggestedTransfers[0], participantA, "민수", participantB, "지영", 150)
	assertSettlementTransfer(t, result.CurrencySummaries[1].SuggestedTransfers[0], participantB, "지영", participantA, "민수", 450)
}

func TestServiceGetTripSettlementIncludesRemovedSnapshots(t *testing.T) {
	participantA := testUUID(2001)
	joinedAt := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "KRW"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{{ParticipantID: participantA, DisplayName: "민수", JoinedAt: joinedAt}},
			Expenses: []SettlementExpenseInput{
				{
					ExpenseID:        testUUID(3001),
					Currency:         "KRW",
					AmountMinor:      600,
					PayerDisplayName: "탈퇴한 사용자",
					Splits: []SettlementSplitInput{
						{ParticipantID: stringPtr(participantA), DisplayName: "민수", ParticipantLive: true, AmountMinor: 600},
					},
				},
			},
		},
	}

	result, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetTripSettlement returned error: %v", err)
	}
	summary := result.CurrencySummaries[0]
	if len(summary.Balances) != 2 {
		t.Fatalf("expected current and removed balance rows, got %#v", summary.Balances)
	}
	assertSettlementBalance(t, summary.Balances[0], participantA, "민수", SettlementParticipantStatusCurrent, 0, 600, -600)
	assertRemovedSettlementBalance(t, summary.Balances[1], "탈퇴한 사용자", 600, 0, 600)
	if summary.SuggestedTransfers[0].ToParticipant.ParticipantID != nil || summary.SuggestedTransfers[0].ToParticipant.ParticipantStatus != SettlementParticipantStatusRemoved {
		t.Fatalf("expected transfer to removed participant snapshot, got %#v", summary.SuggestedTransfers[0])
	}
	assertSettlementTransfer(t, summary.SuggestedTransfers[0], participantA, "민수", "", "탈퇴한 사용자", 600)
}

func TestServiceGetTripSettlementDeterministicGreedyTransfers(t *testing.T) {
	participantA := testUUID(2001)
	participantB := testUUID(2002)
	participantC := testUUID(2003)
	participantD := testUUID(2004)
	joinedAt := time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "KRW"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{
				{ParticipantID: participantA, DisplayName: "민수", JoinedAt: joinedAt},
				{ParticipantID: participantB, DisplayName: "지영", JoinedAt: joinedAt.Add(time.Hour)},
				{ParticipantID: participantC, DisplayName: "유나", JoinedAt: joinedAt.Add(2 * time.Hour)},
				{ParticipantID: participantD, DisplayName: "준호", JoinedAt: joinedAt.Add(3 * time.Hour)},
			},
			Expenses: []SettlementExpenseInput{
				settlementExpense(testUUID(3001), "KRW", 400, participantA, []SettlementSplitInput{{ParticipantID: stringPtr(participantC), DisplayName: "유나", ParticipantLive: true, AmountMinor: 300}, {ParticipantID: stringPtr(participantD), DisplayName: "준호", ParticipantLive: true, AmountMinor: 100}}),
				settlementExpense(testUUID(3002), "KRW", 100, participantB, []SettlementSplitInput{{ParticipantID: stringPtr(participantD), DisplayName: "준호", ParticipantLive: true, AmountMinor: 100}}),
			},
		},
	}

	result, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetTripSettlement returned error: %v", err)
	}
	transfers := result.CurrencySummaries[0].SuggestedTransfers
	if len(transfers) != 3 {
		t.Fatalf("expected three deterministic transfers, got %#v", transfers)
	}
	assertSettlementTransfer(t, transfers[0], participantC, "유나", participantA, "민수", 300)
	assertSettlementTransfer(t, transfers[1], participantD, "준호", participantA, "민수", 100)
	assertSettlementTransfer(t, transfers[2], participantD, "준호", participantB, "지영", 100)
}

func TestServiceGetTripSettlementRejectsInconsistentData(t *testing.T) {
	participantA := testUUID(2001)
	repo := &fakeRepository{
		trip:          Trip{ID: testTripID, DefaultCurrency: "KRW"},
		tripFound:     true,
		isParticipant: true,
		settlementData: SettlementInput{
			Participants: []SettlementParticipantInput{{ParticipantID: participantA, DisplayName: "민수", JoinedAt: time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)}},
			Expenses: []SettlementExpenseInput{
				settlementExpense(testUUID(3001), "KRW", 1000, participantA, []SettlementSplitInput{{ParticipantID: stringPtr(participantA), DisplayName: "민수", ParticipantLive: true, AmountMinor: 999}}),
			},
		},
	}

	_, err := newTestService(repo).GetTripSettlement(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrSettlementDataInconsistent) {
		t.Fatalf("expected ErrSettlementDataInconsistent, got %v", err)
	}
}

func TestServiceGetTripSettlementValidationAuthAndAccess(t *testing.T) {
	validTrip := Trip{ID: testTripID, DefaultCurrency: "KRW"}
	tests := []struct {
		name   string
		repo   *fakeRepository
		userID string
		tripID string
		want   error
	}{
		{name: "requires auth", repo: &fakeRepository{}, userID: " ", tripID: testTripID, want: ErrUnauthorized},
		{name: "invalid trip id", repo: &fakeRepository{}, userID: "user-1", tripID: "bad", want: ErrValidation},
		{name: "missing trip", repo: &fakeRepository{}, userID: "user-1", tripID: testTripID, want: ErrNotFound},
		{name: "forbidden", repo: &fakeRepository{trip: validTrip, tripFound: true}, userID: "user-1", tripID: testTripID, want: ErrForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := newTestService(tt.repo).GetTripSettlement(context.Background(), tt.userID, tt.tripID)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if (errors.Is(tt.want, ErrValidation) || errors.Is(tt.want, ErrUnauthorized) || errors.Is(tt.want, ErrNotFound) || errors.Is(tt.want, ErrForbidden)) && tt.repo.settlementDataCalled {
				t.Fatal("expected invalid settlement request not to load settlement data")
			}
		})
	}
}

func settlementExpense(expenseID string, currency string, amountMinor int64, payerParticipantID string, splits []SettlementSplitInput) SettlementExpenseInput {
	return SettlementExpenseInput{
		ExpenseID:             expenseID,
		Currency:              currency,
		AmountMinor:           amountMinor,
		PayerParticipantID:    stringPtr(payerParticipantID),
		PayerDisplayName:      payerParticipantID,
		PayerParticipantLive:  true,
		PayerParticipantOrder: 0,
		Splits:                splits,
	}
}

func assertSettlementBalance(t *testing.T, balance SettlementBalance, participantID string, displayName string, status string, paidMinor int64, shareMinor int64, netMinor int64) {
	t.Helper()
	if balance.Participant.ParticipantID == nil || *balance.Participant.ParticipantID != participantID || balance.Participant.DisplayName != displayName || balance.Participant.ParticipantStatus != status || balance.PaidMinor != paidMinor || balance.ShareMinor != shareMinor || balance.NetMinor != netMinor {
		t.Fatalf("unexpected balance: %#v", balance)
	}
}

func assertRemovedSettlementBalance(t *testing.T, balance SettlementBalance, displayName string, paidMinor int64, shareMinor int64, netMinor int64) {
	t.Helper()
	if balance.Participant.ParticipantID != nil || balance.Participant.DisplayName != displayName || balance.Participant.ParticipantStatus != SettlementParticipantStatusRemoved || balance.PaidMinor != paidMinor || balance.ShareMinor != shareMinor || balance.NetMinor != netMinor {
		t.Fatalf("unexpected removed balance: %#v", balance)
	}
}

func assertSettlementTransfer(t *testing.T, transfer SettlementTransfer, fromParticipantID string, fromName string, toParticipantID string, toName string, amountMinor int64) {
	t.Helper()
	if transfer.FromParticipant.DisplayName != fromName || transfer.ToParticipant.DisplayName != toName || transfer.AmountMinor != amountMinor {
		t.Fatalf("unexpected transfer: %#v", transfer)
	}
	if fromParticipantID == "" {
		if transfer.FromParticipant.ParticipantID != nil {
			t.Fatalf("expected nil from participant id, got %#v", transfer.FromParticipant)
		}
	} else if transfer.FromParticipant.ParticipantID == nil || *transfer.FromParticipant.ParticipantID != fromParticipantID {
		t.Fatalf("unexpected from participant: %#v", transfer.FromParticipant)
	}
	if toParticipantID == "" {
		if transfer.ToParticipant.ParticipantID != nil {
			t.Fatalf("expected nil to participant id, got %#v", transfer.ToParticipant)
		}
	} else if transfer.ToParticipant.ParticipantID == nil || *transfer.ToParticipant.ParticipantID != toParticipantID {
		t.Fatalf("unexpected to participant: %#v", transfer.ToParticipant)
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
