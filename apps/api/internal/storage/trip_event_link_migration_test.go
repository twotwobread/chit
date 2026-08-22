package storage

import (
	"os"
	"strings"
	"testing"
)

func TestTripEventLinkMigrationBackfillsExistingTrips(t *testing.T) {
	migration, err := os.ReadFile("../../migrations/00033_link_trips_to_events.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	source := string(migration)

	for _, want := range []string{
		"FROM trips t",
		"WHERE NOT EXISTS (",
		"WHERE existing_event.trip_id = t.id",
		"INSERT INTO meetings",
		"'one_off'",
		"INSERT INTO meeting_members",
		"JOIN trip_participants tp ON tp.trip_id = ttl.trip_id",
		"INSERT INTO events",
		"'trip'",
		"trip_id",
		"INSERT INTO event_participants",
		"JOIN inserted_meeting_members imm",
		"DELETE FROM meetings",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("migration %q missing %q", "00033_link_trips_to_events.sql", want)
		}
	}
}
