package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func TestEventExpenseRepositoryLifecycleAndSettlementInput(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for storage integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Skipf("database unavailable for storage integration test: %v", err)
	}
	defer store.Close()
	if err := store.pool.Ping(ctx); err != nil {
		t.Skipf("database unavailable for storage integration test: %v", err)
	}

	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('이벤트 지출 소유자') RETURNING id::text`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	var memberUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('이벤트 지출 멤버') RETURNING id::text`).Scan(&memberUserID); err != nil {
		t.Fatalf("insert member user: %v", err)
	}

	createdMeeting, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "성수 지출 모임", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "민수"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner: %v", err)
	}
	var memberMeetingMemberID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO meeting_members (meeting_id, user_id, role, display_name)
		VALUES ($1::uuid, $2::uuid, 'member', '지은')
		RETURNING id::text
	`, createdMeeting.Meeting.ID, memberUserID).Scan(&memberMeetingMemberID); err != nil {
		t.Fatalf("insert member: %v", err)
	}

	createdEvent, err := store.CreateEventWithMeeting(ctx, meeting.CreateEventRecord{
		ExistingMeetingID:    createdMeeting.Meeting.ID,
		ParticipantMemberIDs: []string{createdMeeting.OwnerMember.ID, memberMeetingMemberID},
		Title:                "성수 저녁",
		StartDate:            time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EndDate:              time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:      "KRW",
		EventType:            meeting.EventTypeOuting,
		Status:               meeting.EventStatusPlanned,
		CreatedBy:            ownerUserID,
		OwnerDisplayName:     "민수",
	})
	if err != nil {
		t.Fatalf("CreateEventWithMeeting: %v", err)
	}
	var memberEventParticipantID string
	if err := store.pool.QueryRow(ctx, `SELECT id::text FROM event_participants WHERE event_id = $1::uuid AND user_id = $2::uuid`, createdEvent.Event.ID, memberUserID).Scan(&memberEventParticipantID); err != nil {
		t.Fatalf("find member event participant: %v", err)
	}

	eventContext, found, err := store.GetExpenseEventForParticipant(ctx, createdEvent.Event.ID, ownerUserID)
	if err != nil || !found {
		t.Fatalf("GetExpenseEventForParticipant = %#v, %v, %v", eventContext, found, err)
	}
	if eventContext.CurrentParticipantID != createdEvent.OwnerParticipant.ID || eventContext.DefaultCurrency != "KRW" {
		t.Fatalf("unexpected event ledger context: %#v", eventContext)
	}

	title := "저녁 식사"
	memo := "공통 지출"
	createdExpense, err := store.CreateEventExpense(ctx, trip.EventExpenseRecord{
		EventID:             createdEvent.Event.ID,
		Title:               &title,
		ExpenseDate:         time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		AmountMinor:         42000,
		Currency:            stringPtr("KRW"),
		ExpenseCategory:     stringPtr(trip.ExpenseCategoryFood),
		ExpenseKind:         trip.ExpenseKindRegular,
		PayerParticipantID:  createdEvent.OwnerParticipant.ID,
		SplitPolicy:         trip.ExpenseSplitPolicyEqual,
		ParticipantIDs:      []string{createdEvent.OwnerParticipant.ID, memberEventParticipantID},
		Memo:                &memo,
		IncludeInSettlement: true,
		CreatedBy:           ownerUserID,
	})
	if err != nil {
		t.Fatalf("CreateEventExpense: %v", err)
	}
	if createdExpense.Expense.EventID != createdEvent.Event.ID || createdExpense.Expense.TripID != "" || createdExpense.Expense.AnchorType != "event" || len(createdExpense.Expense.Splits) != 2 {
		t.Fatalf("unexpected created event expense: %#v", createdExpense.Expense)
	}

	listed, err := store.ListEventExpenses(ctx, createdEvent.Event.ID)
	if err != nil {
		t.Fatalf("ListEventExpenses: %v", err)
	}
	if len(listed.Expenses) != 1 || listed.Expenses[0].ID != createdExpense.Expense.ID || listed.Expenses[0].EventID != createdEvent.Event.ID || len(listed.Expenses[0].Splits) != 2 {
		t.Fatalf("unexpected listed event expenses: %#v", listed.Expenses)
	}

	settlementInput, err := store.GetEventSettlementInput(ctx, createdEvent.Event.ID)
	if err != nil {
		t.Fatalf("GetEventSettlementInput: %v", err)
	}
	if len(settlementInput.Participants) != 2 || len(settlementInput.Expenses) != 1 || len(settlementInput.Expenses[0].Splits) != 2 {
		t.Fatalf("unexpected event settlement input: %#v", settlementInput)
	}

	if _, err := store.pool.Exec(ctx, `DELETE FROM event_participants WHERE id = $1::uuid`, memberEventParticipantID); err != nil {
		t.Fatalf("delete member event participant: %v", err)
	}
	afterParticipantDelete, err := store.ListEventExpenses(ctx, createdEvent.Event.ID)
	if err != nil {
		t.Fatalf("ListEventExpenses after participant delete: %v", err)
	}
	foundDeletedParticipantSnapshot := false
	if len(afterParticipantDelete.Expenses) == 1 {
		for _, split := range afterParticipantDelete.Expenses[0].Splits {
			if split.Participant.DisplayName == "지은" && split.Participant.ParticipantID == nil && split.Participant.Source == trip.ExpenseDisplaySourceFallback {
				foundDeletedParticipantSnapshot = true
			}
		}
	}
	if !foundDeletedParticipantSnapshot {
		t.Fatalf("expected deleted participant fallback snapshot, got %#v", afterParticipantDelete.Expenses)
	}

	deleted, err := store.DeleteEventExpenseByID(ctx, createdEvent.Event.ID, createdExpense.Expense.ID)
	if err != nil || !deleted {
		t.Fatalf("DeleteEventExpenseByID = %v, %v", deleted, err)
	}
	afterDelete, err := store.ListEventExpenses(ctx, createdEvent.Event.ID)
	if err != nil {
		t.Fatalf("ListEventExpenses after delete: %v", err)
	}
	if len(afterDelete.Expenses) != 0 {
		t.Fatalf("expected event expenses deleted, got %#v", afterDelete.Expenses)
	}
}
