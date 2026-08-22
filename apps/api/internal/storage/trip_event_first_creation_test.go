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
