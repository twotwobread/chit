package storage

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
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

func TestMeetingRepositoryGetsSavedMeetingDetailWithMembersAndEvents(t *testing.T) {
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

	saved, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "등산 모임", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "민수"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner: %v", err)
	}
	createdTrip, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "오사카 3박 4일",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "JPY",
		DefaultTravelMode: "transit",
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingContext:    trip.CreateMeetingContextRecord{Mode: trip.MeetingContextModeExisting, MeetingID: saved.Meeting.ID},
		Destinations: []trip.CreateDestinationRecord{{
			CityName:        "오사카",
			CountryName:     "일본",
			CountryCode:     "JP",
			DisplayName:     "오사카, 일본",
			Latitude:        34.6937,
			Longitude:       135.5023,
			RadiusMeters:    25000,
			Provider:        trip.DestinationProviderGoogle,
			ProviderPlaceID: "google-city-osaka",
		}},
	})
	if err != nil {
		t.Fatalf("CreateTripWithOwner: %v", err)
	}

	detail, found, err := store.GetMeetingDetailForMember(ctx, saved.Meeting.ID, ownerUserID)
	if err != nil || !found {
		t.Fatalf("GetMeetingDetailForMember owner = %#v, %v, %v", detail, found, err)
	}
	if detail.Meeting.ID != saved.Meeting.ID || len(detail.Members) != 1 || detail.Members[0].DisplayName != "민수" {
		t.Fatalf("expected saved meeting member detail, got %#v", detail)
	}
	if len(detail.Events) != 1 || detail.Events[0].Title != "오사카 3박 4일" || detail.Events[0].TripID == nil || *detail.Events[0].TripID != createdTrip.Trip.ID {
		t.Fatalf("expected linked trip event in detail, got %#v", detail.Events)
	}

	_, found, err = store.GetMeetingDetailForMember(ctx, saved.Meeting.ID, outsiderUserID)
	if err != nil {
		t.Fatalf("GetMeetingDetailForMember outsider error: %v", err)
	}
	if found {
		t.Fatal("outsider should not be able to read saved meeting detail")
	}
	_, found, err = store.GetMeetingDetailForMember(ctx, createdTrip.Trip.EventContext.MeetingID, ownerUserID)
	if err != nil {
		t.Fatalf("GetMeetingDetailForMember event context error: %v", err)
	}
	if !found {
		t.Fatal("saved trip event context should be readable through its saved meeting")
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
	var outsiderMemberID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO meeting_members (meeting_id, user_id, role, display_name) VALUES ($1::uuid, $2::uuid, 'member', '지영') RETURNING id::text`, saved.Meeting.ID, outsiderUserID).Scan(&outsiderMemberID); err != nil {
		t.Fatalf("insert saved meeting member: %v", err)
	}

	savedOuting, err := store.CreateEventWithMeeting(ctx, meeting.CreateEventRecord{
		Title:                "성수 저녁",
		StartDate:            time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EndDate:              time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		StartTime:            "19:30",
		PlaceName:            "성수 식당",
		PlaceAddress:         "서울 성동구",
		Category:             meeting.EventCategoryMeal,
		EventType:            meeting.EventTypeOuting,
		DefaultCurrency:      "KRW",
		Status:               meeting.EventStatusPlanned,
		CreatedBy:            ownerUserID,
		OwnerDisplayName:     "민수",
		MeetingMode:          meeting.MeetingModeExisting,
		ExistingMeetingID:    saved.Meeting.ID,
		MeetingVisibility:    meeting.MeetingVisibilitySaved,
		ParticipantMemberIDs: []string{saved.OwnerMember.ID},
	})
	if err != nil {
		t.Fatalf("CreateEventWithMeeting saved outing: %v", err)
	}
	savedOutingDetail, found, err := store.GetEventForParticipant(ctx, savedOuting.Event.ID, ownerUserID)
	if err != nil || !found {
		t.Fatalf("GetEventForParticipant saved outing owner = %#v, %v, %v", savedOutingDetail, found, err)
	}
	if savedOutingDetail.Event.StartTime != "19:30" || savedOutingDetail.Event.PlaceName != "성수 식당" || savedOutingDetail.Event.PlaceAddress != "서울 성동구" || savedOutingDetail.Event.Category != meeting.EventCategoryMeal {
		t.Fatalf("expected saved outing metadata, got %#v", savedOutingDetail.Event)
	}
	if len(savedOutingDetail.Participants) != 1 || savedOutingDetail.Participants[0].MeetingMemberID == nil || *savedOutingDetail.Participants[0].MeetingMemberID != saved.OwnerMember.ID {
		t.Fatalf("expected selected owner participant only, got %#v (excluded member id %s)", savedOutingDetail.Participants, outsiderMemberID)
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

func TestMeetingRepositoryMeetingInviteLifecycleAndMemberDeletion(t *testing.T) {
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
	var memberUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('지은') RETURNING id::text`).Scan(&memberUserID); err != nil {
		t.Fatalf("insert member user: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM meetings WHERE created_by = ANY($1::uuid[])`, []string{ownerUserID, memberUserID})
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = ANY($1::uuid[])`, []string{ownerUserID, memberUserID})
	}()

	created, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "등산 모임", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "민수"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner: %v", err)
	}
	now := time.Date(2026, 8, 23, 10, 0, 0, 0, time.UTC)
	inviteToken := "meeting-token-" + strings.ReplaceAll(ownerUserID, "-", "")
	invite, err := store.CreateOrReturnMeetingInvite(ctx, meeting.CreateMeetingInviteRecord{MeetingID: created.Meeting.ID, CreatedBy: ownerUserID, Token: inviteToken, Now: now, ExpiresAt: now.Add(7 * 24 * time.Hour)})
	if err != nil {
		t.Fatalf("CreateOrReturnMeetingInvite: %v", err)
	}
	if !invite.Created || invite.Invite.MeetingID != created.Meeting.ID || invite.Invite.Token == "" {
		t.Fatalf("unexpected invite result: %#v", invite)
	}
	reused, err := store.CreateOrReturnMeetingInvite(ctx, meeting.CreateMeetingInviteRecord{MeetingID: created.Meeting.ID, CreatedBy: ownerUserID, Token: "meeting-token-reused-abcdefghijklmnopqrstuvwxyz", Now: now.Add(time.Hour), ExpiresAt: now.Add(8 * 24 * time.Hour)})
	if err != nil {
		t.Fatalf("CreateOrReturnMeetingInvite reused: %v", err)
	}
	if reused.Created || reused.Invite.ID != invite.Invite.ID {
		t.Fatalf("expected active invite reuse, got %#v", reused)
	}

	accepted, err := store.AcceptMeetingInvite(ctx, meeting.AcceptMeetingInviteRecord{Token: invite.Invite.Token, UserID: memberUserID, Now: now.Add(time.Hour)})
	if err != nil {
		t.Fatalf("AcceptMeetingInvite: %v", err)
	}
	if accepted.MeetingID != created.Meeting.ID || accepted.Role != meeting.RoleMember || accepted.AlreadyAccepted {
		t.Fatalf("unexpected accept result: %#v", accepted)
	}
	acceptedAgain, err := store.AcceptMeetingInvite(ctx, meeting.AcceptMeetingInviteRecord{Token: invite.Invite.Token, UserID: memberUserID, Now: now.Add(2 * time.Hour)})
	if err != nil {
		t.Fatalf("AcceptMeetingInvite again: %v", err)
	}
	if !acceptedAgain.AlreadyAccepted || acceptedAgain.Role != meeting.RoleMember {
		t.Fatalf("expected idempotent accept, got %#v", acceptedAgain)
	}

	detail, found, err := store.GetMeetingDetailForMember(ctx, created.Meeting.ID, ownerUserID)
	if err != nil || !found {
		t.Fatalf("GetMeetingDetailForMember owner = %#v, %v, %v", detail, found, err)
	}
	var memberID string
	for _, member := range detail.Members {
		if member.UserID == memberUserID {
			memberID = member.ID
		}
	}
	if memberID == "" {
		t.Fatalf("expected accepted meeting member in detail: %#v", detail.Members)
	}
	deleted, err := store.DeleteMeetingMember(ctx, created.Meeting.ID, memberID)
	if err != nil || !deleted {
		t.Fatalf("DeleteMeetingMember = %v, %v", deleted, err)
	}
	_, found, err = store.GetMeetingDetailForMember(ctx, created.Meeting.ID, memberUserID)
	if err != nil {
		t.Fatalf("GetMeetingDetailForMember removed member error: %v", err)
	}
	if found {
		t.Fatal("removed meeting member should not read saved meeting detail")
	}
}
