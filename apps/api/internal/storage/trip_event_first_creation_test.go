package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func TestTripRepositoryCreatesTripInExistingSavedMeetingWithMembers(t *testing.T) {
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
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid OR id = $2::uuid`, ownerUserID, memberUserID)
	}()

	createdMeeting, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{
		Name:             "등산 모임",
		Visibility:       meeting.MeetingVisibilitySaved,
		CreatedBy:        ownerUserID,
		OwnerDisplayName: "민수",
	})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO meeting_members (meeting_id, user_id, role, display_name)
		VALUES ($1::uuid, $2::uuid, 'member', '지은')
	`, createdMeeting.Meeting.ID, memberUserID); err != nil {
		t.Fatalf("insert meeting member: %v", err)
	}

	createdTrip, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "오사카 3박 4일",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "JPY",
		DefaultTravelMode: "transit",
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingContext: trip.CreateMeetingContextRecord{
			Mode:      trip.MeetingContextModeExisting,
			MeetingID: createdMeeting.Meeting.ID,
		},
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
	if createdTrip.Trip.EventContext == nil {
		t.Fatal("expected linked event context")
	}
	if createdTrip.Trip.EventContext.MeetingID != createdMeeting.Meeting.ID || createdTrip.Trip.EventContext.MeetingName != "등산 모임" || createdTrip.Trip.EventContext.MeetingVisibility != meeting.MeetingVisibilitySaved {
		t.Fatalf("expected saved meeting event context, got %#v", createdTrip.Trip.EventContext)
	}

	participants, err := store.ListTripParticipants(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("ListTripParticipants: %v", err)
	}
	if len(participants) != 2 {
		t.Fatalf("expected owner and saved meeting member trip participants, got %#v", participants)
	}
	assertLinkedParticipantCount(t, ctx, store, createdTrip.Trip.EventContext.EventID, createdMeeting.Meeting.ID, 2)
}

func TestTripRepositoryEventParticipantSelectionCreatesSubset(t *testing.T) {
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

	fixture := createParticipantSelectionFixture(t, ctx, store, 5)
	defer cleanupParticipantSelectionFixture(t, store, fixture)

	selectedMemberIDs := []string{fixture.memberIDs[fixture.ownerUserID], fixture.memberIDs[fixture.memberUserIDs[0]], fixture.memberIDs[fixture.memberUserIDs[1]], fixture.memberIDs[fixture.memberUserIDs[2]]}
	createdTrip, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "선택 참여 오사카",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "JPY",
		DefaultTravelMode: "transit",
		CreatedBy:         fixture.ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingContext: trip.CreateMeetingContextRecord{
			Mode:                 trip.MeetingContextModeExisting,
			MeetingID:            fixture.meetingID,
			ParticipantMemberIDs: selectedMemberIDs,
		},
		Destinations: participantSelectionDestination("google-city-osaka-subset"),
	})
	if err != nil {
		t.Fatalf("CreateTripWithOwner subset: %v", err)
	}

	participants, err := store.ListTripParticipants(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("ListTripParticipants: %v", err)
	}
	if len(participants) != 4 {
		t.Fatalf("expected four selected trip participants, got %#v", participants)
	}
	selectedUserIDs := map[string]struct{}{fixture.ownerUserID: {}, fixture.memberUserIDs[0]: {}, fixture.memberUserIDs[1]: {}, fixture.memberUserIDs[2]: {}}
	for _, participant := range participants {
		if _, ok := selectedUserIDs[participant.UserID]; !ok {
			t.Fatalf("unexpected participant user %q in %#v", participant.UserID, participants)
		}
	}
	assertLinkedParticipantCount(t, ctx, store, createdTrip.Trip.EventContext.EventID, fixture.meetingID, 4)

	var meetingMemberCount int
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM meeting_members WHERE meeting_id = $1::uuid`, fixture.meetingID).Scan(&meetingMemberCount); err != nil {
		t.Fatalf("count meeting members: %v", err)
	}
	if meetingMemberCount != 6 {
		t.Fatalf("expected all six meeting members to remain, got %d", meetingMemberCount)
	}
}

func TestTripRepositoryReplaceParticipantsPreservesExpenseSnapshots(t *testing.T) {
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

	fixture := createParticipantSelectionFixture(t, ctx, store, 3)
	defer cleanupParticipantSelectionFixture(t, store, fixture)

	createdTrip, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "교체 참여 오사카",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "JPY",
		DefaultTravelMode: "transit",
		CreatedBy:         fixture.ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingContext:    trip.CreateMeetingContextRecord{Mode: trip.MeetingContextModeExisting, MeetingID: fixture.meetingID},
		Destinations:      participantSelectionDestination("google-city-osaka-replace"),
	})
	if err != nil {
		t.Fatalf("CreateTripWithOwner all members: %v", err)
	}

	participants, err := store.ListTripParticipants(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("ListTripParticipants before replace: %v", err)
	}
	var removedParticipantID string
	for _, participant := range participants {
		if participant.UserID == fixture.memberUserIDs[1] {
			removedParticipantID = participant.ParticipantID
			break
		}
	}
	if removedParticipantID == "" {
		t.Fatalf("expected removable participant in %#v", participants)
	}

	expenseID := insertParticipantSelectionExpense(t, ctx, store, createdTrip.Trip.ID, fixture.ownerUserID, removedParticipantID, "지은")

	result, err := store.ReplaceTripParticipants(ctx, trip.ReplaceParticipantsRecord{
		TripID:      createdTrip.Trip.ID,
		RequestedBy: fixture.ownerUserID,
		ParticipantMemberIDs: []string{
			fixture.memberIDs[fixture.ownerUserID],
			fixture.memberIDs[fixture.memberUserIDs[0]],
		},
	})
	if err != nil {
		t.Fatalf("ReplaceTripParticipants: %v", err)
	}
	if result.CurrentUserParticipantID == nil {
		t.Fatalf("expected current user participant id in replacement response")
	}
	if len(result.Participants) != 2 {
		t.Fatalf("expected two remaining participants, got %#v", result.Participants)
	}
	for _, participant := range result.Participants {
		if participant.UserID == fixture.memberUserIDs[1] {
			t.Fatalf("expected removed participant absent, got %#v", result.Participants)
		}
	}

	var payerParticipantID *string
	var payerDisplayName string
	if err := store.pool.QueryRow(ctx, `SELECT payer_participant_id::text, payer_display_name FROM expenses WHERE id = $1::uuid`, expenseID).Scan(&payerParticipantID, &payerDisplayName); err != nil {
		t.Fatalf("load expense snapshot: %v", err)
	}
	if payerParticipantID != nil || payerDisplayName != "지은" {
		t.Fatalf("expected removed payer snapshot, got participant=%v name=%q", payerParticipantID, payerDisplayName)
	}

	var splitParticipantID *string
	var splitDisplayName string
	if err := store.pool.QueryRow(ctx, `SELECT participant_id::text, participant_display_name FROM expense_splits WHERE expense_id = $1::uuid`, expenseID).Scan(&splitParticipantID, &splitDisplayName); err != nil {
		t.Fatalf("load split snapshot: %v", err)
	}
	if splitParticipantID != nil || splitDisplayName != "지은" {
		t.Fatalf("expected removed split snapshot, got participant=%v name=%q", splitParticipantID, splitDisplayName)
	}

	settlementInput, err := store.GetTripSettlementInput(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("GetTripSettlementInput: %v", err)
	}
	settlement, err := trip.BuildTripSettlement(createdTrip.Trip.ID, "JPY", settlementInput)
	if err != nil {
		t.Fatalf("BuildTripSettlement with removed snapshot: %v", err)
	}
	if len(settlement.CurrencySummaries) != 1 || len(settlement.CurrencySummaries[0].Balances) < 1 {
		t.Fatalf("expected settlement summary with historical snapshot, got %#v", settlement)
	}
}

func TestTripRepositoryPromoteOneOffMeetingPreservesEventLedgerAndSavedList(t *testing.T) {
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
	var promotedMeetingID string
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM trips WHERE created_by = $1::uuid`, ownerUserID)
		if promotedMeetingID != "" {
			_, _ = store.pool.Exec(context.Background(), `DELETE FROM meetings WHERE id = $1::uuid`, promotedMeetingID)
		}
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid OR id = $2::uuid`, ownerUserID, memberUserID)
	}()

	createdTrip, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "성수 저녁",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "KRW",
		DefaultTravelMode: "transit",
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "민수",
		MeetingContext:    trip.CreateMeetingContextRecord{Mode: trip.MeetingContextModeOneOff},
		Destinations:      participantSelectionDestination("google-city-seongsu-promote"),
	})
	if err != nil {
		t.Fatalf("CreateTripWithOwner one-off: %v", err)
	}
	if createdTrip.Trip.EventContext == nil || createdTrip.Trip.EventContext.MeetingVisibility != meeting.MeetingVisibilityOneOff {
		t.Fatalf("expected one-off event context, got %#v", createdTrip.Trip.EventContext)
	}
	promotedMeetingID = createdTrip.Trip.EventContext.MeetingID

	inviteToken := "promote-one-off-token-1234567890abcd"
	_, err = store.CreateOrReturnTripInvite(ctx, trip.CreateTripInviteRecord{TripID: createdTrip.Trip.ID, CreatedBy: ownerUserID, Token: inviteToken, Now: time.Now(), ExpiresAt: time.Now().Add(24 * time.Hour)})
	if err != nil {
		t.Fatalf("CreateOrReturnTripInvite: %v", err)
	}
	if _, err := store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: inviteToken, UserID: memberUserID, Now: time.Now()}); err != nil {
		t.Fatalf("AcceptTripInvite: %v", err)
	}

	participants, err := store.ListTripParticipants(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("ListTripParticipants before promote: %v", err)
	}
	var memberParticipantID string
	for _, participant := range participants {
		if participant.UserID == memberUserID {
			memberParticipantID = participant.ParticipantID
			break
		}
	}
	if memberParticipantID == "" {
		t.Fatalf("expected accepted invite member in trip participants: %#v", participants)
	}
	expenseID := insertParticipantSelectionExpense(t, ctx, store, createdTrip.Trip.ID, ownerUserID, memberParticipantID, "지은")

	beforeCounts := promotionCounts(t, ctx, store, createdTrip.Trip.ID, createdTrip.Trip.EventContext.EventID, expenseID)

	result, err := store.PromoteTripMeeting(ctx, trip.PromoteMeetingRecord{TripID: createdTrip.Trip.ID, RequestedBy: ownerUserID, MeetingName: "성수 저녁 모임"})
	if err != nil {
		t.Fatalf("PromoteTripMeeting: %v", err)
	}
	if result.Meeting.ID != promotedMeetingID || result.Meeting.Visibility != meeting.MeetingVisibilitySaved || result.Meeting.Name != "성수 저녁 모임" {
		t.Fatalf("unexpected promoted meeting: %#v", result.Meeting)
	}
	if result.Trip.EventContext == nil || result.Trip.EventContext.MeetingID != promotedMeetingID || result.Trip.EventContext.MeetingVisibility != meeting.MeetingVisibilitySaved || result.Trip.EventContext.MeetingName != "성수 저녁 모임" {
		t.Fatalf("unexpected promoted trip context: %#v", result.Trip.EventContext)
	}

	afterCounts := promotionCounts(t, ctx, store, createdTrip.Trip.ID, createdTrip.Trip.EventContext.EventID, expenseID)
	if beforeCounts != afterCounts {
		t.Fatalf("expected promotion to preserve counts, before=%#v after=%#v", beforeCounts, afterCounts)
	}

	meetings, err := store.ListSavedMeetingsByMemberUser(ctx, ownerUserID)
	if err != nil {
		t.Fatalf("ListSavedMeetingsByMemberUser: %v", err)
	}
	foundSaved := false
	for _, item := range meetings {
		if item.ID == promotedMeetingID && item.Name == "성수 저녁 모임" && item.Visibility == meeting.MeetingVisibilitySaved && item.MemberCount == 2 {
			foundSaved = true
			break
		}
	}
	if !foundSaved {
		t.Fatalf("expected promoted meeting in saved list, got %#v", meetings)
	}

	settlementInput, err := store.GetTripSettlementInput(ctx, createdTrip.Trip.ID)
	if err != nil {
		t.Fatalf("GetTripSettlementInput: %v", err)
	}
	settlement, err := trip.BuildTripSettlement(createdTrip.Trip.ID, "KRW", settlementInput)
	if err != nil {
		t.Fatalf("BuildTripSettlement after promotion: %v", err)
	}
	if len(settlement.CurrencySummaries) != 1 || len(settlement.CurrencySummaries[0].Balances) != 2 {
		t.Fatalf("expected settlement to preserve two participant balances, got %#v", settlement)
	}
}

type promotionCountSnapshot struct {
	TripParticipants  int
	EventParticipants int
	Expenses          int
	ExpenseSplits     int
}

func promotionCounts(t *testing.T, ctx context.Context, store *Store, tripID string, eventID string, expenseID string) promotionCountSnapshot {
	t.Helper()
	var snapshot promotionCountSnapshot
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM trip_participants WHERE trip_id = $1::uuid`, tripID).Scan(&snapshot.TripParticipants); err != nil {
		t.Fatalf("count trip participants: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM event_participants WHERE event_id = $1::uuid`, eventID).Scan(&snapshot.EventParticipants); err != nil {
		t.Fatalf("count event participants: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM expenses WHERE trip_id = $1::uuid`, tripID).Scan(&snapshot.Expenses); err != nil {
		t.Fatalf("count expenses: %v", err)
	}
	if err := store.pool.QueryRow(ctx, `SELECT count(*)::int FROM expense_splits WHERE expense_id = $1::uuid`, expenseID).Scan(&snapshot.ExpenseSplits); err != nil {
		t.Fatalf("count expense splits: %v", err)
	}
	return snapshot
}

type participantSelectionFixture struct {
	ownerUserID   string
	memberUserIDs []string
	meetingID     string
	memberIDs     map[string]string
}

func createParticipantSelectionFixture(t *testing.T, ctx context.Context, store *Store, memberCount int) participantSelectionFixture {
	t.Helper()
	var ownerUserID string
	if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ('민수') RETURNING id::text`).Scan(&ownerUserID); err != nil {
		t.Fatalf("insert owner user: %v", err)
	}
	createdMeeting, err := store.CreateMeetingWithOwner(ctx, meeting.CreateMeetingRecord{Name: "참여 선택 모임", Visibility: meeting.MeetingVisibilitySaved, CreatedBy: ownerUserID, OwnerDisplayName: "민수"})
	if err != nil {
		t.Fatalf("CreateMeetingWithOwner: %v", err)
	}
	fixture := participantSelectionFixture{ownerUserID: ownerUserID, meetingID: createdMeeting.Meeting.ID, memberIDs: map[string]string{ownerUserID: createdMeeting.OwnerMember.ID}}
	for index := 0; index < memberCount; index++ {
		name := []string{"지영", "지은", "현우", "서연", "도윤"}[index]
		var userID string
		if err := store.pool.QueryRow(ctx, `INSERT INTO users (display_name) VALUES ($1) RETURNING id::text`, name).Scan(&userID); err != nil {
			t.Fatalf("insert member user %d: %v", index, err)
		}
		var memberID string
		if err := store.pool.QueryRow(ctx, `
			INSERT INTO meeting_members (meeting_id, user_id, role, display_name)
			VALUES ($1::uuid, $2::uuid, 'member', $3)
			RETURNING id::text
		`, fixture.meetingID, userID, name).Scan(&memberID); err != nil {
			t.Fatalf("insert meeting member %d: %v", index, err)
		}
		fixture.memberUserIDs = append(fixture.memberUserIDs, userID)
		fixture.memberIDs[userID] = memberID
	}
	return fixture
}

func cleanupParticipantSelectionFixture(t *testing.T, store *Store, fixture participantSelectionFixture) {
	t.Helper()
	ctx := context.Background()
	_, _ = store.pool.Exec(ctx, `DELETE FROM trips WHERE created_by = $1::uuid`, fixture.ownerUserID)
	_, _ = store.pool.Exec(ctx, `DELETE FROM meetings WHERE id = $1::uuid`, fixture.meetingID)
	ids := append([]string{fixture.ownerUserID}, fixture.memberUserIDs...)
	for _, userID := range ids {
		_, _ = store.pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, userID)
	}
}

func participantSelectionDestination(providerPlaceID string) []trip.CreateDestinationRecord {
	return []trip.CreateDestinationRecord{{
		CityName:        "오사카",
		CountryName:     "일본",
		CountryCode:     "JP",
		DisplayName:     "오사카, 일본",
		Latitude:        34.6937,
		Longitude:       135.5023,
		RadiusMeters:    25000,
		Provider:        trip.DestinationProviderGoogle,
		ProviderPlaceID: providerPlaceID,
	}}
}

func insertParticipantSelectionExpense(t *testing.T, ctx context.Context, store *Store, tripID string, createdBy string, participantID string, displayName string) string {
	t.Helper()
	var expenseID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO expenses (
			trip_id, anchor_type, expense_date, title, place_name, place_address, place_type,
			amount_minor, currency, payer_participant_id, payer_display_name, created_by
		) VALUES (
			$1::uuid, 'trip', '2026-07-10', '간식', '편의점', '주소', 'food',
			1000, 'JPY', $2::uuid, $3, $4::uuid
		)
		RETURNING id::text
	`, tripID, participantID, displayName, createdBy).Scan(&expenseID); err != nil {
		t.Fatalf("insert participant selection expense: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO expense_splits (expense_id, participant_id, participant_display_name, amount_minor, split_order)
		VALUES ($1::uuid, $2::uuid, $3, 1000, 1)
	`, expenseID, participantID, displayName); err != nil {
		t.Fatalf("insert participant selection split: %v", err)
	}
	return expenseID
}
