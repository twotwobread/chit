package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
)

func TestMeetingRepositoryDeletesSoloMeetingsAndEventsDuringAccountDeletion(t *testing.T) {
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
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('삭제 대상') RETURNING id::text`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}

	saved, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "삭제될 모임", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "삭제 대상"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner saved: %v", err)
	}
	oneOffEvent, err := store.CreateEventWithMeeting(ctx, meeting.CreateEventRecord{
		Title:             "삭제될 일정",
		StartDate:         time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EventType:         meeting.EventTypeOuting,
		DefaultCurrency:   "KRW",
		Status:            meeting.EventStatusPlanned,
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "삭제 대상",
		MeetingMode:       meeting.MeetingModeOneOff,
		NewMeetingName:    "삭제될 일정",
		MeetingVisibility: meeting.MeetingVisibilityOneOff,
	})
	if err != nil {
		t.Fatalf("CreateEventWithMeeting one-off: %v", err)
	}

	if err := store.DeleteAccount(ctx, ownerUserID, time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	var meetingCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM meetings WHERE id = ANY($1::uuid[])`, []string{saved.Meeting.ID, oneOffEvent.Meeting.ID}).Scan(&meetingCount); err != nil {
		t.Fatalf("count meetings after deletion: %v", err)
	}
	if meetingCount != 0 {
		t.Fatalf("expected solo saved and one-off meetings to be deleted, count=%d", meetingCount)
	}
	var eventCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM events WHERE id = $1::uuid`, oneOffEvent.Event.ID).Scan(&eventCount); err != nil {
		t.Fatalf("count events after deletion: %v", err)
	}
	if eventCount != 0 {
		t.Fatalf("expected solo event to be deleted, count=%d", eventCount)
	}
}

func TestMeetingRepositoryCreatesEventsAndHidesOneOffMeetingsFromSavedList(t *testing.T) {
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
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('민수') RETURNING id::text`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	var outsiderUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('지영') RETURNING id::text`).Scan(&outsiderUserID); err != nil {
		t.Fatalf("insert outsider user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, outsiderUserID})
	}()

	creator, ok, err := store.GetMeetingCreator(ctx, ownerUserID)
	if err != nil || !ok || creator.DisplayName != "민수" {
		t.Fatalf("GetMeetingCreator = %#v, %v, %v", creator, ok, err)
	}

	saved, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "동네 친구들", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "민수"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner saved: %v", err)
	}
	oneOffEvent, err := store.CreateEventWithMeeting(ctx, meeting.CreateEventRecord{
		Title:             "성수 저녁",
		StartDate:         time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EventType:         meeting.EventTypeOuting,
		DefaultCurrency:   "KRW",
		Status:            meeting.EventStatusPlanned,
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingMode:       meeting.MeetingModeOneOff,
		NewMeetingName:    "성수 저녁",
		MeetingVisibility: meeting.MeetingVisibilityOneOff,
	})
	if err != nil {
		t.Fatalf("CreateEventWithMeeting one-off: %v", err)
	}

	meetings, err := store.ListSavedMeetingsByMemberUser(ctx, ownerUserID)
	if err != nil {
		t.Fatalf("ListSavedMeetingsByMemberUser: %v", err)
	}
	if len(meetings) != 1 || meetings[0].ID != saved.Meeting.ID || meetings[0].Visibility != meeting.MeetingVisibilitySaved {
		t.Fatalf("expected only saved meeting in list, got %#v", meetings)
	}

	detail, found, err := store.GetEventForParticipant(ctx, oneOffEvent.Event.ID, ownerUserID)
	if err != nil || !found {
		t.Fatalf("GetEventForParticipant owner = %#v, %v, %v", detail, found, err)
	}
	if detail.Event.MeetingVisibility != meeting.MeetingVisibilityOneOff || detail.Meeting.Visibility != meeting.MeetingVisibilityOneOff {
		t.Fatalf("expected one-off event visibility, got %#v", detail)
	}
	_, found, err = store.GetEventForParticipant(ctx, oneOffEvent.Event.ID, outsiderUserID)
	if err != nil {
		t.Fatalf("GetEventForParticipant outsider error: %v", err)
	}
	if found {
		t.Fatal("outsider should not be able to read event without event participation")
	}
}
