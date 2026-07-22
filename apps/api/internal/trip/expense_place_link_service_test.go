package trip

import (
	"context"
	"testing"
)

func TestServiceCreateManualTripPlaceDoesNotRequireDay(t *testing.T) {
	repo := &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "KRW"}, tripFound: true, isParticipant: true}
	result, err := newTestService(repo).CreateManualTripPlace(context.Background(), "user-1", testTripID, CreateManualTripPlaceInput{
		Name:      " 주식회사비플랜트 ",
		Address:   " 서울특별시 마포구 월드컵로 14길 108, 지층 ",
		PlaceType: "food",
	})
	if err != nil {
		t.Fatalf("CreateManualTripPlace returned error: %v", err)
	}
	if !repo.manualTripPlaceCalled {
		t.Fatal("expected repository manual trip place creation")
	}
	if repo.manualDayLodgingCalled || repo.setDayLodgingCalled {
		t.Fatalf("manual trip place must not mutate day lodging: manual=%v set=%v", repo.manualDayLodgingCalled, repo.setDayLodgingCalled)
	}
	if repo.manualTripPlaceRecord.TripID != testTripID || repo.manualTripPlaceRecord.Name != "주식회사비플랜트" || repo.manualTripPlaceRecord.PlaceType != "food" {
		t.Fatalf("unexpected manual trip place record: %#v", repo.manualTripPlaceRecord)
	}
	if result.Place.ID == "" || result.Place.PlaceType != "food" {
		t.Fatalf("unexpected manual trip place result: %#v", result.Place)
	}
}

func TestServiceCreateTripExpenseAllowsTripPlaceWithoutSchedule(t *testing.T) {
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	tripPlaceID := testUUID(8001)
	repo := &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "KRW"}, tripFound: true, isParticipant: true}
	_, err := newTestService(repo).CreateTripExpense(context.Background(), "user-1", testTripID, CreateTripExpenseInput{
		ExpenseDate:        "2026-07-04",
		TripPlaceID:        &tripPlaceID,
		AmountMinor:        17800,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{splitParticipantID},
	})
	if err != nil {
		t.Fatalf("CreateTripExpense returned error: %v", err)
	}
	if !repo.tripExpenseCalled {
		t.Fatal("expected repository trip expense creation")
	}
	if repo.tripExpenseRecord.ScheduleItemID != nil || repo.tripExpenseRecord.TripPlaceID == nil || *repo.tripExpenseRecord.TripPlaceID != tripPlaceID || repo.tripExpenseRecord.Title != nil {
		t.Fatalf("unexpected trip expense record: %#v", repo.tripExpenseRecord)
	}
}

func TestServiceCreateQuickExpenseAllowsTripPlaceWithoutSchedule(t *testing.T) {
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	tripPlaceID := testUUID(8001)
	repo := &fakeRepository{trip: Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "KRW"}, tripFound: true, isParticipant: true}
	_, err := newTestService(repo).CreateQuickExpense(context.Background(), "user-1", testTripID, "2026-07-11", CreateQuickExpenseInput{
		TripPlaceID:        &tripPlaceID,
		AmountMinor:        17800,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{splitParticipantID},
	})
	if err != nil {
		t.Fatalf("CreateQuickExpense returned error: %v", err)
	}
	if !repo.quickExpenseCalled {
		t.Fatal("expected repository quick expense creation")
	}
	if repo.quickExpenseRecord.ScheduleItemID != nil || repo.quickExpenseRecord.TripPlaceID == nil || *repo.quickExpenseRecord.TripPlaceID != tripPlaceID {
		t.Fatalf("unexpected quick expense record: %#v", repo.quickExpenseRecord)
	}
}
