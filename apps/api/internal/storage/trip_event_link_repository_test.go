package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func TestTripRepositoryCreatesAndDeletesLinkedTripEventContext(t *testing.T) {
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

	created, err := store.CreateTripWithOwner(ctx, trip.CreateRecord{
		Name:              "오사카 3박 4일",
		StartDate:         time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2026, 7, 13, 0, 0, 0, 0, time.UTC),
		DefaultCurrency:   "JPY",
		DefaultTravelMode: "transit",
		CreatedBy:         ownerUserID,
		OwnerDisplayName:  "민수",
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
	if created.Trip.EventContext == nil || created.Trip.EventContext.MeetingVisibility != meeting.MeetingVisibilityOneOff || created.Trip.EventContext.MeetingName != "오사카 3박 4일" {
		t.Fatalf("expected created trip event context, got %#v", created.Trip.EventContext)
	}

	listed, err := store.ListTripsByParticipantUser(ctx, ownerUserID)
	if err != nil {
		t.Fatalf("ListTripsByParticipantUser: %v", err)
	}
	if len(listed) != 1 || listed[0].EventContext == nil || listed[0].EventContext.EventID != created.Trip.EventContext.EventID {
		t.Fatalf("expected list event context for created trip, got %#v", listed)
	}

	found, ok, err := store.GetTripByID(ctx, created.Trip.ID)
	if err != nil || !ok {
		t.Fatalf("GetTripByID = %#v, %v, %v", found, ok, err)
	}
	if found.EventContext == nil || found.EventContext.EventID != created.Trip.EventContext.EventID {
		t.Fatalf("expected detail event context, got %#v", found.EventContext)
	}

	invite, err := store.CreateOrReturnTripInvite(ctx, trip.CreateTripInviteRecord{
		TripID:    created.Trip.ID,
		CreatedBy: ownerUserID,
		Token:     "trip-event-link-test-token-" + ownerUserID,
		Now:       time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		ExpiresAt: time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("CreateOrReturnTripInvite: %v", err)
	}
	accepted, err := store.AcceptTripInvite(ctx, trip.AcceptTripInviteRecord{Token: invite.Invite.Token, UserID: memberUserID, Now: time.Date(2026, 7, 1, 1, 0, 0, 0, time.UTC)})
	if err != nil || accepted.AlreadyAccepted {
		t.Fatalf("AcceptTripInvite = %#v, %v", accepted, err)
	}
	assertLinkedParticipantCount(t, ctx, store, created.Trip.EventContext.EventID, created.Trip.EventContext.MeetingID, 2)

	participants, err := store.ListTripParticipants(ctx, created.Trip.ID)
	if err != nil {
		t.Fatalf("ListTripParticipants: %v", err)
	}
	var memberParticipantID string
	for _, participant := range participants {
		if participant.DisplayName == "지은" {
			memberParticipantID = participant.ParticipantID
		}
	}
	if memberParticipantID == "" {
		t.Fatalf("expected accepted member participant in %#v", participants)
	}
	removed, err := store.DeleteTripMemberParticipant(ctx, created.Trip.ID, memberParticipantID)
	if err != nil || !removed {
		t.Fatalf("DeleteTripMemberParticipant = %v, %v", removed, err)
	}
	assertLinkedParticipantCount(t, ctx, store, created.Trip.EventContext.EventID, created.Trip.EventContext.MeetingID, 1)

	deleted, err := store.DeleteTripByID(ctx, created.Trip.ID)
	if err != nil || !deleted {
		t.Fatalf("DeleteTripByID = %v, %v", deleted, err)
	}
	var linkedCount int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM events e
		JOIN meetings m ON m.id = e.meeting_id
		WHERE e.id = $1::uuid OR m.id = $2::uuid
	`, created.Trip.EventContext.EventID, created.Trip.EventContext.MeetingID).Scan(&linkedCount); err != nil {
		t.Fatalf("count linked event context rows: %v", err)
	}
	if linkedCount != 0 {
		t.Fatalf("expected linked event and one-off meeting to be deleted with trip, count=%d", linkedCount)
	}
}

func assertLinkedParticipantCount(t *testing.T, ctx context.Context, store *Store, eventID string, meetingID string, want int) {
	t.Helper()
	var participantCount int
	if err := store.pool.QueryRow(ctx, `
		SELECT count(*)::int
		FROM event_participants ep
		JOIN meeting_members mm ON mm.id = ep.meeting_member_id
		WHERE ep.event_id = $1::uuid
		  AND mm.meeting_id = $2::uuid
	`, eventID, meetingID).Scan(&participantCount); err != nil {
		t.Fatalf("count linked event participants: %v", err)
	}
	if participantCount != want {
		t.Fatalf("expected %d linked participants, got %d", want, participantCount)
	}
}
