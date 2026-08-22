package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	meetingdomain "github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/notification"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	scheduleRankStep  int64 = 1024
	scheduleRankWidth       = 19
)

var (
	errRetryReorderRankCollision = errors.New("retry reorder rank collision")
	errRebalanceScheduleRanks    = errors.New("rebalance schedule ranks")
)

func syncActiveTripDays(ctx context.Context, tx pgx.Tx, tripID string, startDate pgtype.Date, endDate pgtype.Date) error {
	tripUUID := mustUUID(tripID)
	if _, err := tx.Exec(ctx, `
		UPDATE trip_days
		SET day_order = day_order + 10000,
		    updated_at = now()
		WHERE trip_id = $1::uuid
		  AND deleted_at IS NULL
	`, tripUUID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		WITH excluded AS (
		  UPDATE trip_days
		  SET deleted_at = COALESCE(deleted_at, now()),
		      lodging_trip_place_id = NULL,
		      updated_at = now()
		  WHERE trip_id = $1::uuid
		    AND deleted_at IS NULL
		    AND (date < $2 OR date > $3)
		  RETURNING id
		), archived_items AS (
		  UPDATE schedule_items si
		  SET deleted_at = COALESCE(si.deleted_at, now()),
		      updated_at = now()
		  FROM excluded
		  WHERE si.trip_day_id = excluded.id
		    AND si.deleted_at IS NULL
		  RETURNING si.id
		)
		UPDATE expenses e
		SET anchor_type = 'trip',
		    trip_day_id = NULL,
		    schedule_item_id = NULL,
		    updated_at = now()
		WHERE e.trip_id = $1::uuid
		  AND (
		    e.trip_day_id IN (SELECT id FROM excluded)
		    OR e.schedule_item_id IN (SELECT id FROM archived_items)
		  )
	`, tripUUID, startDate, endDate); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO trip_days (trip_id, date, day_order, deleted_at, updated_at)
		SELECT
		  $1::uuid,
		  day::date,
		  row_number() OVER (ORDER BY day::date)::integer,
		  NULL,
		  now()
		FROM generate_series($2::date, $3::date, interval '1 day') AS day
		ON CONFLICT (trip_id, date) DO UPDATE
		SET day_order = EXCLUDED.day_order,
		    deleted_at = NULL,
		    updated_at = now()
	`, tripUUID, startDate, endDate)
	return err
}

func (s *Store) GetCreator(ctx context.Context, userID string) (trip.Creator, bool, error) {
	row, err := s.queries.GetUserByID(ctx, mustUUID(userID))
	if err == pgx.ErrNoRows {
		return trip.Creator{}, false, nil
	}
	if err != nil {
		return trip.Creator{}, false, err
	}
	return trip.Creator{ID: row.ID, DisplayName: row.DisplayName}, true, nil
}

func (s *Store) CreateTripWithOwner(ctx context.Context, record trip.CreateRecord) (trip.CreateResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.CreateResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	createdTrip, err := qtx.CreateTrip(ctx, db.CreateTripParams{
		Name:              record.Name,
		StartDate:         dateValue(record.StartDate),
		EndDate:           dateValue(record.EndDate),
		DefaultCurrency:   record.DefaultCurrency,
		DefaultTravelMode: record.DefaultTravelMode,
		Column6:           mustUUID(record.CreatedBy),
	})
	if err != nil {
		return trip.CreateResult{}, err
	}

	owner, err := qtx.CreateTripParticipant(ctx, db.CreateTripParticipantParams{
		Column1:     mustUUID(createdTrip.ID),
		Column2:     mustUUID(record.CreatedBy),
		Role:        trip.RoleOwner,
		DisplayName: record.OwnerDisplayName,
	})
	if err != nil {
		return trip.CreateResult{}, err
	}

	eventMeeting, meetingOwner, err := createMeetingWithOwner(ctx, qtx, meetingdomain.CreateMeetingRecord{
		Name:             createdTrip.Name,
		Visibility:       meetingdomain.MeetingVisibilityOneOff,
		CreatedBy:        record.CreatedBy,
		OwnerDisplayName: record.OwnerDisplayName,
	})
	if err != nil {
		return trip.CreateResult{}, err
	}
	createdEvent, err := qtx.CreateEvent(ctx, db.CreateEventParams{
		MeetingID:       mustUUID(eventMeeting.ID),
		EventType:       meetingdomain.EventTypeTrip,
		Title:           createdTrip.Name,
		StartDate:       createdTrip.StartDate,
		EndDate:         createdTrip.EndDate,
		DefaultCurrency: createdTrip.DefaultCurrency,
		Status:          meetingdomain.EventStatusPlanned,
		TripID:          mustUUID(createdTrip.ID),
		CreatedBy:       mustUUID(record.CreatedBy),
	})
	if err != nil {
		return trip.CreateResult{}, err
	}
	if _, err := qtx.CreateEventParticipant(ctx, db.CreateEventParticipantParams{
		EventID:         mustUUID(createdEvent.ID),
		MeetingMemberID: optionalUUID(meetingOwner.ID),
		UserID:          mustUUID(record.CreatedBy),
		Role:            meetingdomain.RoleOwner,
		DisplayName:     record.OwnerDisplayName,
	}); err != nil {
		return trip.CreateResult{}, err
	}
	eventContext := &trip.TripEventContext{
		EventID:           createdEvent.ID,
		MeetingID:         eventMeeting.ID,
		MeetingName:       eventMeeting.Name,
		MeetingVisibility: eventMeeting.Visibility,
	}

	destinations := make([]trip.TripDestination, 0, len(record.Destinations))
	for _, destination := range record.Destinations {
		row, err := qtx.CreateTripDestination(ctx, db.CreateTripDestinationParams{
			TripID:          mustUUID(createdTrip.ID),
			CityName:        destination.CityName,
			CountryName:     destination.CountryName,
			CountryCode:     destination.CountryCode,
			DisplayName:     destination.DisplayName,
			Latitude:        destination.Latitude,
			Longitude:       destination.Longitude,
			RadiusMeters:    int32(destination.RadiusMeters),
			Provider:        destination.Provider,
			ProviderPlaceID: destination.ProviderPlaceID,
			SortOrder:       int32(destination.SortOrder),
		})
		if err != nil {
			return trip.CreateResult{}, err
		}
		destinations = append(destinations, tripDestinationFromCreateRow(row))
	}

	if err := syncActiveTripDays(ctx, tx, createdTrip.ID, createdTrip.StartDate, createdTrip.EndDate); err != nil {
		return trip.CreateResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.CreateResult{}, err
	}

	return trip.CreateResult{
		Trip: trip.Trip{
			ID:                createdTrip.ID,
			Name:              createdTrip.Name,
			StartDate:         dateString(createdTrip.StartDate),
			EndDate:           dateString(createdTrip.EndDate),
			DefaultCurrency:   createdTrip.DefaultCurrency,
			DefaultTravelMode: createdTrip.DefaultTravelMode,
			CreatedBy:         createdTrip.CreatedBy,
			CreatedAt:         createdTrip.CreatedAt.Time,
			UpdatedAt:         createdTrip.UpdatedAt.Time,
			EventContext:      eventContext,
			Destinations:      destinations,
		},
		OwnerParticipant: trip.Participant{
			ID:          owner.ID,
			TripID:      owner.TripID,
			UserID:      owner.UserID,
			Role:        owner.Role,
			DisplayName: owner.DisplayName,
			JoinedAt:    owner.JoinedAt.Time,
		},
	}, nil
}

func (s *Store) GetTripByID(ctx context.Context, tripID string) (trip.Trip, bool, error) {
	row, err := s.queries.GetTripByID(ctx, mustUUID(tripID))
	if err == pgx.ErrNoRows {
		return trip.Trip{}, false, nil
	}
	if err != nil {
		return trip.Trip{}, false, err
	}

	destinations, err := s.listTripDestinations(ctx, tripID)
	if err != nil {
		return trip.Trip{}, false, err
	}

	return trip.Trip{
		ID:                row.TID,
		Name:              row.Name,
		StartDate:         dateString(row.StartDate),
		EndDate:           dateString(row.EndDate),
		DefaultCurrency:   row.DefaultCurrency,
		DefaultTravelMode: row.DefaultTravelMode,
		CreatedBy:         row.TCreatedBy,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
		EventContext:      tripEventContextFromValues(row.EventID, row.MeetingID, row.MeetingName, row.MeetingVisibility),
		Destinations:      destinations,
	}, true, nil
}

func (s *Store) listTripDestinations(ctx context.Context, tripID string) ([]trip.TripDestination, error) {
	rows, err := s.queries.ListTripDestinationsByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	destinations := make([]trip.TripDestination, 0, len(rows))
	for _, row := range rows {
		destinations = append(destinations, tripDestinationFromListRow(row))
	}
	return destinations, nil
}

func createTripLinkedEventParticipant(ctx context.Context, queries *db.Queries, tripID string, userID string, role string, displayName string) error {
	eventContext, err := queries.GetTripEventContextByTripID(ctx, mustUUID(tripID))
	if err == pgx.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	createdMeetingMember, err := queries.CreateMeetingMember(ctx, db.CreateMeetingMemberParams{
		MeetingID:   mustUUID(eventContext.MeetingID),
		UserID:      mustUUID(userID),
		Role:        role,
		DisplayName: displayName,
	})
	meetingMemberID := createdMeetingMember.ID
	if isUniqueConstraintViolation(err, "meeting_members_meeting_user_unique") {
		existingMeetingMember, existingErr := queries.GetMeetingMemberByMeetingAndUser(ctx, db.GetMeetingMemberByMeetingAndUserParams{
			Column1: mustUUID(eventContext.MeetingID),
			Column2: mustUUID(userID),
		})
		if existingErr != nil {
			return existingErr
		}
		meetingMemberID = existingMeetingMember.ID
		err = nil
	}
	if err != nil {
		return err
	}
	_, err = queries.CreateEventParticipant(ctx, db.CreateEventParticipantParams{
		EventID:         mustUUID(eventContext.EventID),
		MeetingMemberID: optionalUUID(meetingMemberID),
		UserID:          mustUUID(userID),
		Role:            role,
		DisplayName:     displayName,
	})
	if isUniqueConstraintViolation(err, "event_participants_event_user_unique") {
		return nil
	}
	return err
}

func getTripEventContextByTripID(ctx context.Context, queries *db.Queries, tripID string) (*trip.TripEventContext, error) {
	row, err := queries.GetTripEventContextByTripID(ctx, mustUUID(tripID))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return tripEventContextFromValues(row.EventID, row.MeetingID, row.MeetingName, row.MeetingVisibility), nil
}

func tripEventContextFromValues(eventID string, meetingID string, meetingName string, meetingVisibility string) *trip.TripEventContext {
	if strings.TrimSpace(eventID) == "" || strings.TrimSpace(meetingID) == "" {
		return nil
	}
	return &trip.TripEventContext{EventID: eventID, MeetingID: meetingID, MeetingName: meetingName, MeetingVisibility: meetingVisibility}
}

func tripDestinationFromCreateRow(row db.CreateTripDestinationRow) trip.TripDestination {
	return trip.TripDestination{
		ID:              row.ID,
		TripID:          row.TripID,
		CityName:        row.CityName,
		CountryName:     row.CountryName,
		CountryCode:     row.CountryCode,
		DisplayName:     row.DisplayName,
		Latitude:        row.Latitude,
		Longitude:       row.Longitude,
		RadiusMeters:    int(row.RadiusMeters),
		Provider:        row.Provider,
		ProviderPlaceID: row.ProviderPlaceID,
		SortOrder:       int(row.SortOrder),
	}
}

func tripDestinationFromListRow(row db.ListTripDestinationsByTripRow) trip.TripDestination {
	return trip.TripDestination{
		ID:              row.ID,
		TripID:          row.TripID,
		CityName:        row.CityName,
		CountryName:     row.CountryName,
		CountryCode:     row.CountryCode,
		DisplayName:     row.DisplayName,
		Latitude:        row.Latitude,
		Longitude:       row.Longitude,
		RadiusMeters:    int(row.RadiusMeters),
		Provider:        row.Provider,
		ProviderPlaceID: row.ProviderPlaceID,
		SortOrder:       int(row.SortOrder),
	}
}

func (s *Store) IsTripParticipant(ctx context.Context, tripID string, userID string) (bool, error) {
	_, err := s.queries.GetTripParticipantMembership(ctx, db.GetTripParticipantMembershipParams{
		Column1: mustUUID(tripID),
		Column2: mustUUID(userID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) GetCurrentTripParticipantID(ctx context.Context, tripID string, userID string) (string, bool, error) {
	participantID, err := s.queries.GetTripParticipantMembership(ctx, db.GetTripParticipantMembershipParams{
		Column1: mustUUID(tripID),
		Column2: mustUUID(userID),
	})
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return participantID, true, nil
}

func (s *Store) IsTripOwner(ctx context.Context, tripID string, userID string) (bool, error) {
	role, err := s.queries.GetTripParticipantRole(ctx, db.GetTripParticipantRoleParams{
		Column1: mustUUID(tripID),
		Column2: mustUUID(userID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return role == trip.RoleOwner, nil
}

func (s *Store) UpdateTripBasicInfo(ctx context.Context, record trip.UpdateRecord) (trip.Trip, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.Trip{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	row, err := qtx.UpdateTripBasicInfo(ctx, db.UpdateTripBasicInfoParams{
		Column1:           mustUUID(record.ID),
		Name:              record.Name,
		StartDate:         dateValue(record.StartDate),
		EndDate:           dateValue(record.EndDate),
		DefaultCurrency:   record.DefaultCurrency,
		DefaultTravelMode: record.DefaultTravelMode,
	})
	if err != nil {
		return trip.Trip{}, err
	}
	if err := syncActiveTripDays(ctx, tx, row.ID, row.StartDate, row.EndDate); err != nil {
		return trip.Trip{}, err
	}
	if err := qtx.UpdateTripEventFromTripBasicInfo(ctx, db.UpdateTripEventFromTripBasicInfoParams{
		TripID:          mustUUID(row.ID),
		Name:            row.Name,
		StartDate:       row.StartDate,
		EndDate:         row.EndDate,
		DefaultCurrency: row.DefaultCurrency,
	}); err != nil {
		return trip.Trip{}, err
	}
	eventContext, err := getTripEventContextByTripID(ctx, qtx, row.ID)
	if err != nil {
		return trip.Trip{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return trip.Trip{}, err
	}

	destinations, err := s.listTripDestinations(ctx, row.ID)
	if err != nil {
		return trip.Trip{}, err
	}

	return trip.Trip{
		ID:                row.ID,
		Name:              row.Name,
		StartDate:         dateString(row.StartDate),
		EndDate:           dateString(row.EndDate),
		DefaultCurrency:   row.DefaultCurrency,
		DefaultTravelMode: row.DefaultTravelMode,
		CreatedBy:         row.CreatedBy,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
		EventContext:      eventContext,
		Destinations:      destinations,
	}, nil
}

func (s *Store) DeleteTripByID(ctx context.Context, tripID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tripUUID := mustUUID(tripID)
	if _, err := tx.Exec(ctx, `DELETE FROM expenses WHERE trip_id = $1::uuid`, tripUUID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM schedule_items WHERE trip_id = $1::uuid`, tripUUID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM trip_days WHERE trip_id = $1::uuid`, tripUUID); err != nil {
		return false, err
	}

	qtx := s.queries.WithTx(tx)
	if hasCleanupJobs, err := storageObjectDeletionJobsTableExists(ctx, tx); err != nil {
		return false, err
	} else if hasCleanupJobs {
		if err := qtx.EnqueueFlightBoardingPassDeletionJobsForTrip(ctx, db.EnqueueFlightBoardingPassDeletionJobsForTripParams{Reason: "trip_deleted", TripID: tripUUID}); err != nil {
			return false, err
		}
	}
	if err := qtx.DeleteTripEventByTripID(ctx, tripUUID); err != nil {
		return false, err
	}
	_, err = qtx.DeleteTripByID(ctx, tripUUID)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) DeleteTripMemberParticipant(ctx context.Context, tripID string, participantID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	if hasCleanupJobs, err := storageObjectDeletionJobsTableExists(ctx, tx); err != nil {
		return false, err
	} else if hasCleanupJobs {
		if err := qtx.EnqueueFlightBoardingPassDeletionJobsForParticipant(ctx, db.EnqueueFlightBoardingPassDeletionJobsForParticipantParams{Reason: "participant_removed", TripID: mustUUID(tripID), ParticipantID: mustUUID(participantID)}); err != nil {
			return false, err
		}
	}
	if err := qtx.DeleteTripLinkedEventParticipantByTripParticipant(ctx, db.DeleteTripLinkedEventParticipantByTripParticipantParams{
		TripID:        mustUUID(tripID),
		ParticipantID: mustUUID(participantID),
	}); err != nil {
		return false, err
	}
	_, err = qtx.DeleteTripMemberParticipant(ctx, db.DeleteTripMemberParticipantParams{
		TripID:        mustUUID(tripID),
		ParticipantID: mustUUID(participantID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) CreateOrReturnTripInvite(ctx context.Context, record trip.CreateTripInviteRecord) (trip.CreateTripInviteResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.CreateTripInviteResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	if _, err := qtx.LockTripForInvite(ctx, mustUUID(record.TripID)); err == pgx.ErrNoRows {
		return trip.CreateTripInviteResult{}, trip.ErrNotFound
	} else if err != nil {
		return trip.CreateTripInviteResult{}, err
	}

	current, err := qtx.GetCurrentTripInviteForUpdate(ctx, mustUUID(record.TripID))
	if err != nil && err != pgx.ErrNoRows {
		return trip.CreateTripInviteResult{}, err
	}
	if err == nil {
		invite := tripInviteFromRow(current.ID, current.TripID, current.Token, current.ExpiresAt, current.CreatedAt, current.CreatedBy)
		if invite.ExpiresAt.After(record.Now) {
			if err := tx.Commit(ctx); err != nil {
				return trip.CreateTripInviteResult{}, err
			}
			return trip.CreateTripInviteResult{Invite: invite, Created: false}, nil
		}
		if err := qtx.DeactivateTripInvite(ctx, db.DeactivateTripInviteParams{
			InviteID:      mustUUID(current.ID),
			DeactivatedAt: timestamptzValue(record.Now),
		}); err != nil {
			return trip.CreateTripInviteResult{}, err
		}
	}

	created, err := qtx.CreateTripInvite(ctx, db.CreateTripInviteParams{
		TripID:    mustUUID(record.TripID),
		Token:     record.Token,
		CreatedBy: mustUUID(record.CreatedBy),
		ExpiresAt: timestamptzValue(record.ExpiresAt),
		CreatedAt: timestamptzValue(record.Now),
	})
	if isUniqueConstraintViolation(err, "trip_invites_token_unique") || isUniqueConstraintViolation(err, "trip_invites_one_current_per_trip") {
		return trip.CreateTripInviteResult{}, trip.ErrConflict
	}
	if err != nil {
		return trip.CreateTripInviteResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return trip.CreateTripInviteResult{}, err
	}

	return trip.CreateTripInviteResult{
		Invite:  tripInviteFromRow(created.ID, created.TripID, created.Token, created.ExpiresAt, created.CreatedAt, created.CreatedBy),
		Created: true,
	}, nil
}

func (s *Store) AcceptTripInvite(ctx context.Context, record trip.AcceptTripInviteRecord) (trip.AcceptTripInviteResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.AcceptTripInviteResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	invite, err := qtx.GetTripInviteForAccept(ctx, record.Token)
	if err == pgx.ErrNoRows {
		return trip.AcceptTripInviteResult{}, trip.ErrInviteNotFound
	}
	if err != nil {
		return trip.AcceptTripInviteResult{}, err
	}
	if invite.DeactivatedAt.Valid || !invite.ExpiresAt.Time.After(record.Now) {
		return trip.AcceptTripInviteResult{}, trip.ErrInviteExpired
	}

	participantRole, err := qtx.GetTripParticipantRole(ctx, db.GetTripParticipantRoleParams{
		Column1: mustUUID(invite.TiTripID),
		Column2: mustUUID(record.UserID),
	})
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return trip.AcceptTripInviteResult{}, err
		}
		return trip.AcceptTripInviteResult{TripID: invite.TiTripID, TripName: invite.TripName, Role: participantRole, AlreadyAccepted: true}, nil
	}
	if err != pgx.ErrNoRows {
		return trip.AcceptTripInviteResult{}, err
	}

	user, err := qtx.GetUserByID(ctx, mustUUID(record.UserID))
	if err == pgx.ErrNoRows {
		return trip.AcceptTripInviteResult{}, trip.ErrUnauthorized
	}
	if err != nil {
		return trip.AcceptTripInviteResult{}, err
	}

	displayName := trip.NormalizeParticipantDisplayName(user.DisplayName)
	_, err = qtx.CreateTripParticipant(ctx, db.CreateTripParticipantParams{
		Column1:     mustUUID(invite.TiTripID),
		Column2:     mustUUID(record.UserID),
		Role:        trip.RoleMember,
		DisplayName: displayName,
	})
	if isUniqueConstraintViolation(err, "trip_participants_trip_user_unique") {
		participantRole, err := qtx.GetTripParticipantRole(ctx, db.GetTripParticipantRoleParams{
			Column1: mustUUID(invite.TiTripID),
			Column2: mustUUID(record.UserID),
		})
		if err != nil {
			return trip.AcceptTripInviteResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return trip.AcceptTripInviteResult{}, err
		}
		return trip.AcceptTripInviteResult{TripID: invite.TiTripID, TripName: invite.TripName, Role: participantRole, AlreadyAccepted: true}, nil
	}
	if err != nil {
		return trip.AcceptTripInviteResult{}, err
	}
	if err := createTripLinkedEventParticipant(ctx, qtx, invite.TiTripID, record.UserID, meetingdomain.RoleMember, displayName); err != nil {
		return trip.AcceptTripInviteResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.AcceptTripInviteResult{}, err
	}
	return trip.AcceptTripInviteResult{TripID: invite.TiTripID, TripName: invite.TripName, Role: trip.RoleMember, AlreadyAccepted: false}, nil
}

func (s *Store) CountTripParticipants(ctx context.Context, tripID string) (int, error) {
	count, err := s.queries.CountTripParticipantsByTripID(ctx, mustUUID(tripID))
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (s *Store) ListTripParticipantPreviewNames(ctx context.Context, tripID string) ([]string, error) {
	return s.queries.ListTripParticipantPreviewByTripID(ctx, mustUUID(tripID))
}

func (s *Store) GetTripParticipantSummary(ctx context.Context, tripID string) (trip.ParticipantSummary, error) {
	row, err := s.queries.GetTripParticipantSummaryByTripID(ctx, mustUUID(tripID))
	if err != nil {
		return trip.ParticipantSummary{}, err
	}
	return trip.ParticipantSummary{TotalCount: int(row.TotalCount), PreviewNames: row.PreviewNames}, nil
}

func (s *Store) ListTripParticipants(ctx context.Context, tripID string) ([]trip.ParticipantListItem, error) {
	rows, err := s.queries.ListTripParticipantsByTripID(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}

	participants := make([]trip.ParticipantListItem, 0, len(rows))
	for _, row := range rows {
		participants = append(participants, trip.ParticipantListItem{
			ParticipantID: row.ID,
			DisplayName:   row.DisplayName,
			Role:          row.Role,
			JoinedAt:      row.JoinedAt.Time,
		})
	}
	return participants, nil
}

func (s *Store) ListTripsByParticipantUser(ctx context.Context, userID string) ([]trip.ListItem, error) {
	rows, err := s.queries.ListTripsByParticipantUser(ctx, mustUUID(userID))
	if err != nil {
		return nil, err
	}

	trips := make([]trip.ListItem, 0, len(rows))
	for _, row := range rows {
		trips = append(trips, trip.ListItem{
			ID:                row.ID,
			ParticipantID:     row.ParticipantID,
			Name:              row.Name,
			StartDate:         dateString(row.StartDate),
			EndDate:           dateString(row.EndDate),
			DefaultCurrency:   row.DefaultCurrency,
			DefaultTravelMode: row.DefaultTravelMode,
			JoinedAt:          row.JoinedAt.Time,
			CreatedAt:         row.CreatedAt.Time,
			MyRole:            row.MyRole,
			ParticipantCount:  int(row.ParticipantCount),
			EventContext:      tripEventContextFromValues(row.EventID, row.MeetingID, row.MeetingName, row.MeetingVisibility),
		})
	}
	return trips, nil
}

func (s *Store) ListActiveTripDaysByTrip(ctx context.Context, tripID string) ([]trip.TripDay, error) {
	rows, err := s.queries.ListActiveTripDaysByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}

	days := make([]trip.TripDay, 0, len(rows))
	for _, row := range rows {
		days = append(days, trip.TripDay{
			ID:           row.ID,
			Date:         dateString(row.Date),
			DayOrder:     int(row.DayOrder),
			LodgingPlace: lodgingPlaceFromActiveTripDay(row.LodgingTripPlaceID, row.LodgingPlaceName, row.LodgingPlaceType, row.LodgingPlaceAddress, row.LodgingPlaceProvider, row.LodgingGooglePlaceID, row.LodgingLatitude, row.LodgingLongitude),
		})
	}
	return days, nil
}

func (s *Store) GetActiveTripDayByTripAndID(ctx context.Context, tripID string, tripDayID string) (trip.TripDay, bool, error) {
	tripDayUUID := pgtype.UUID{}
	if err := tripDayUUID.Scan(tripDayID); err != nil {
		row, err := s.queries.GetActiveTripDayByTripAndDate(ctx, db.GetActiveTripDayByTripAndDateParams{
			TripID: mustUUID(tripID),
			Date:   dateTextValue(tripDayID),
		})
		if err == pgx.ErrNoRows {
			return trip.TripDay{}, false, nil
		}
		if err != nil {
			return trip.TripDay{}, false, err
		}
		return trip.TripDay{
			ID:           row.ID,
			Date:         dateString(row.Date),
			DayOrder:     int(row.DayOrder),
			LodgingPlace: lodgingPlaceFromActiveTripDay(row.LodgingTripPlaceID, row.LodgingPlaceName, row.LodgingPlaceType, row.LodgingPlaceAddress, row.LodgingPlaceProvider, row.LodgingGooglePlaceID, row.LodgingLatitude, row.LodgingLongitude),
		}, true, nil
	}

	row, err := s.queries.GetActiveTripDayByTripAndID(ctx, db.GetActiveTripDayByTripAndIDParams{
		TripID:    mustUUID(tripID),
		TripDayID: tripDayUUID,
	})
	if err == pgx.ErrNoRows {
		return trip.TripDay{}, false, nil
	}
	if err != nil {
		return trip.TripDay{}, false, err
	}
	return trip.TripDay{
		ID:           row.ID,
		Date:         dateString(row.Date),
		DayOrder:     int(row.DayOrder),
		LodgingPlace: lodgingPlaceFromActiveTripDay(row.LodgingTripPlaceID, row.LodgingPlaceName, row.LodgingPlaceType, row.LodgingPlaceAddress, row.LodgingPlaceProvider, row.LodgingGooglePlaceID, row.LodgingLatitude, row.LodgingLongitude),
	}, true, nil
}

func (s *Store) ListDayLodgingPlacesByTrip(ctx context.Context, tripID string) ([]trip.DayLodgingPlace, error) {
	days, err := s.ListActiveTripDaysByTrip(ctx, tripID)
	if err != nil {
		return nil, err
	}
	lodgingPlaces := make([]trip.DayLodgingPlace, 0)
	for _, day := range days {
		if day.LodgingPlace != nil {
			lodgingPlaces = append(lodgingPlaces, trip.DayLodgingPlace{Date: day.Date, Place: *day.LodgingPlace})
		}
	}
	return lodgingPlaces, nil
}

func (s *Store) GetDayLodgingPlaceByTripAndDate(ctx context.Context, tripID string, date string) (trip.TripPlaceSummary, bool, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
		  tp.id::text,
		  tp.name,
		  tp.place_type,
		  tp.address,
		  tp.provider,
		  tp.google_place_id,
		  tp.latitude,
		  tp.longitude
		FROM trip_days td
		JOIN trip_places tp
		  ON tp.id = td.lodging_trip_place_id
		 AND tp.trip_id = td.trip_id
		WHERE td.trip_id = $1::uuid
		  AND td.date = $2
		  AND td.deleted_at IS NULL
	`, mustUUID(tripID), dateTextValue(date))
	var id, name, placeType, address, provider string
	var googlePlaceID pgtype.Text
	var latitude, longitude pgtype.Float8
	if err := row.Scan(&id, &name, &placeType, &address, &provider, &googlePlaceID, &latitude, &longitude); err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, false, nil
	} else if err != nil {
		return trip.TripPlaceSummary{}, false, err
	}
	return tripPlaceSummary(id, name, placeType, address, provider, googlePlaceID, latitude, longitude), true, nil
}

func (s *Store) GetTripPlaceSummaryByTripAndPlace(ctx context.Context, tripID string, tripPlaceID string) (trip.TripPlaceSummary, bool, error) {
	row, err := s.queries.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
		TripID:      mustUUID(tripID),
		TripPlaceID: mustUUID(tripPlaceID),
	})
	if err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, false, nil
	}
	if err != nil {
		return trip.TripPlaceSummary{}, false, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), true, nil
}

func (s *Store) ListTripPlaces(ctx context.Context, tripID string) ([]trip.TripPlaceSummary, error) {
	rows, err := s.queries.ListTripPlacesByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	places := make([]trip.TripPlaceSummary, 0, len(rows))
	for _, row := range rows {
		places = append(places, tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude))
	}
	return places, nil
}

func (s *Store) GetGoogleTripPlaceByGooglePlaceID(ctx context.Context, tripID string, googlePlaceID string) (trip.TripPlaceSummary, bool, error) {
	row, err := s.queries.GetGoogleTripPlaceByGooglePlaceID(ctx, db.GetGoogleTripPlaceByGooglePlaceIDParams{
		TripID:        mustUUID(tripID),
		GooglePlaceID: textValue(googlePlaceID),
	})
	if err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, false, nil
	}
	if err != nil {
		return trip.TripPlaceSummary{}, false, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), true, nil
}

func (s *Store) SetDayLodgingPlace(ctx context.Context, record trip.SetDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	row, err := s.queries.SetDayLodgingPlace(ctx, db.SetDayLodgingPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripDayID:   mustUUID(record.TripDayID),
		TripPlaceID: mustUUID(record.TripPlaceID),
	})
	if isForeignKeyConstraintViolation(err, "trip_days_lodging_trip_place_fk") {
		return trip.TripPlaceSummary{}, trip.ErrNotFound
	}
	if err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), nil
}

func (s *Store) CreateManualDayLodgingPlace(ctx context.Context, record trip.CreateManualDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	place, err := qtx.CreateTripPlace(ctx, db.CreateTripPlaceParams{
		TripID:    mustUUID(record.TripID),
		Name:      record.Name,
		Address:   record.Address,
		PlaceType: "lodging",
	})
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}

	row, err := qtx.SetDayLodgingPlace(ctx, db.SetDayLodgingPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripDayID:   mustUUID(record.TripDayID),
		TripPlaceID: mustUUID(place.ID),
	})
	if isForeignKeyConstraintViolation(err, "trip_days_lodging_trip_place_fk") || err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.TripPlaceSummary{}, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), nil
}

func (s *Store) CreateManualTripPlace(ctx context.Context, record trip.CreateManualTripPlaceRecord) (trip.TripPlaceSummary, error) {
	row, err := s.queries.CreateTripPlace(ctx, db.CreateTripPlaceParams{
		TripID:    mustUUID(record.TripID),
		Name:      record.Name,
		Address:   record.Address,
		PlaceType: record.PlaceType,
	})
	if isForeignKeyViolation(err) {
		return trip.TripPlaceSummary{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), nil
}

func (s *Store) CreateGoogleDayLodgingPlace(ctx context.Context, record place.CreateGoogleDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	placeRow, err := qtx.UpsertGoogleTripPlace(ctx, db.UpsertGoogleTripPlaceParams{
		TripID:            mustUUID(record.TripID),
		Name:              record.Name,
		Address:           record.Address,
		PlaceType:         record.PlaceType,
		GooglePlaceID:     textValue(record.GooglePlaceID),
		Latitude:          float8Value(record.Latitude),
		Longitude:         float8Value(record.Longitude),
		GooglePrimaryType: textValue(record.GooglePrimaryType),
		GoogleTypes:       record.GoogleTypes,
	})
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}

	row, err := qtx.SetDayLodgingPlace(ctx, db.SetDayLodgingPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripDayID:   mustUUID(record.TripDayID),
		TripPlaceID: mustUUID(placeRow.ID),
	})
	if isForeignKeyConstraintViolation(err, "trip_days_lodging_trip_place_fk") || err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, place.ErrNotFound
	}
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.TripPlaceSummary{}, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), nil
}

func (s *Store) DeleteDayLodgingPlace(ctx context.Context, tripID string, tripDayID string) error {
	return s.queries.DeleteDayLodgingPlace(ctx, db.DeleteDayLodgingPlaceParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
	})
}

func (s *Store) ListScheduleItemsByTripDay(ctx context.Context, tripID string, tripDayID string) ([]trip.ScheduleItem, error) {
	rows, err := s.queries.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
	})
	if err != nil {
		return nil, err
	}
	return mapScheduleItems(rows), nil
}

func (s *Store) ListTripScheduleItems(ctx context.Context, tripID string) ([]trip.TripScheduleItemsDayListItem, error) {
	rows, err := s.queries.ListTripScheduleItemsByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []trip.TripScheduleItemsDayListItem{}, nil
	}

	dayIndexByID := make(map[string]int, len(rows))
	days := make([]trip.TripScheduleItemsDayListItem, 0)
	for _, row := range rows {
		dayIndex, ok := dayIndexByID[row.TripDayID]
		if !ok {
			days = append(days, trip.TripScheduleItemsDayListItem{TripDayID: row.TripDayID, Items: []trip.ScheduleItem{}})
			dayIndex = len(days) - 1
			dayIndexByID[row.TripDayID] = dayIndex
		}
		days[dayIndex].Items = append(days[dayIndex].Items, trip.ScheduleItem{
			ID:            row.ID,
			ItemOrder:     len(days[dayIndex].Items) + 1,
			Version:       int(row.Version),
			ItemType:      trip.ScheduleItemTypePlace,
			IsLodging:     boolFromSQL(row.IsLodging),
			StartTime:     timeTextPtrFromSQL(row.StartTime),
			EndTime:       timeTextPtrFromSQL(row.EndTime),
			ArrivedAt:     timePtrFromTimestamptz(row.ArrivedAt),
			SkippedAt:     timePtrFromTimestamptz(row.SkippedAt),
			Place:         tripPlaceSummaryFromNullable(row.TripPlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude),
			PlaceSchedule: placeScheduleItemDetails(row.PlaceTitle, row.PlaceMemo, row.PlaceName.String),
		})
	}
	return days, nil
}

func (s *Store) ListDayExpensesByTripDay(ctx context.Context, tripID string, tripDayID string) ([]trip.DayExpenseListItem, error) {
	expenseRows, err := s.queries.ListDayExpensesByTripDay(ctx, db.ListDayExpensesByTripDayParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
	})
	if err != nil {
		return nil, err
	}
	if len(expenseRows) == 0 {
		return []trip.DayExpenseListItem{}, nil
	}

	expenseIDs := make([]pgtype.UUID, 0, len(expenseRows))
	expenses := make([]trip.DayExpenseListItem, 0, len(expenseRows))
	expenseIndexByID := make(map[string]int, len(expenseRows))
	for _, expenseRow := range expenseRows {
		expenseIDs = append(expenseIDs, mustUUID(expenseRow.ID))
		expenseIndexByID[expenseRow.ID] = len(expenses)
		expenses = append(expenses, trip.DayExpenseListItem{
			ID:                  expenseRow.ID,
			AnchorType:          expenseRow.AnchorType,
			TripDayID:           optionalString(expenseRow.TripDayID),
			ScheduleItemID:      optionalString(expenseRow.ScheduleItemID),
			ExpenseDate:         dateString(expenseRow.ExpenseDate),
			DisplayTitle:        expenseRow.DisplayTitle,
			Place:               expensePlaceDisplay(expenseRow.TripPlaceID, expenseRow.PlaceName, expenseRow.PlaceAddress, expenseRow.PlaceType, expenseRow.PlaceSource),
			AmountMinor:         expenseRow.AmountMinor,
			Currency:            expenseRow.Currency,
			ExpenseCategory:     expenseRow.ExpenseCategory,
			ExpenseKind:         expenseRow.ExpenseKind,
			Payer:               expenseParticipantDisplay(expenseRow.PayerParticipantID, expenseRow.PayerDisplayName, expenseRow.PayerSource),
			ClientMutationID:    textPtr(expenseRow.ClientMutationID),
			SplitPolicy:         expenseRow.SplitPolicy,
			Splits:              []trip.DayExpenseSplitListItem{},
			IncludeInSettlement: expenseRow.IncludeInSettlement,
			Receipt:             receiptSummary(expenseRow.ReceiptExists, expenseRow.ReceiptContentType, expenseRow.ReceiptByteSize, expenseRow.ReceiptUploadedAt),
			CreatedAt:           expenseRow.CreatedAt.Time,
		})
	}

	splitRows, err := s.queries.ListDayExpenseSplitsByExpenseIDs(ctx, expenseIDs)
	if err != nil {
		return nil, err
	}
	appendDayExpenseSplits(expenses, expenseIndexByID, splitRows)
	return expenses, nil
}

func (s *Store) ListTripExpenses(ctx context.Context, tripID string, searchQuery string) (trip.ListTripExpensesResult, error) {
	expenseRows, err := s.queries.ListTripExpensesByTrip(ctx, db.ListTripExpensesByTripParams{
		TripID:      mustUUID(tripID),
		SearchQuery: searchQuery,
	})
	if err != nil {
		return trip.ListTripExpensesResult{}, err
	}
	result := trip.ListTripExpensesResult{TripExpenses: []trip.DayExpenseListItem{}, Days: []trip.TripExpenseDayListItem{}}
	if len(expenseRows) == 0 {
		return result, nil
	}

	expenseIDs := make([]pgtype.UUID, 0, len(expenseRows))
	type expenseLocation struct {
		tripLevel    bool
		dayIndex     int
		expenseIndex int
	}
	expenseLocationByID := make(map[string]expenseLocation, len(expenseRows))
	dayIndexByID := make(map[string]int, len(expenseRows))
	for _, expenseRow := range expenseRows {
		expenseIDs = append(expenseIDs, mustUUID(expenseRow.ID))
		expense := trip.DayExpenseListItem{
			ID:                  expenseRow.ID,
			AnchorType:          expenseRow.AnchorType,
			TripDayID:           optionalString(expenseRow.TripDayID),
			ScheduleItemID:      optionalString(expenseRow.ScheduleItemID),
			ExpenseDate:         dateString(expenseRow.ExpenseDate),
			DisplayTitle:        expenseRow.DisplayTitle,
			Place:               expensePlaceDisplay(expenseRow.TripPlaceID, expenseRow.PlaceName, expenseRow.PlaceAddress, expenseRow.PlaceType, expenseRow.PlaceSource),
			AmountMinor:         expenseRow.AmountMinor,
			Currency:            expenseRow.Currency,
			ExpenseCategory:     expenseRow.ExpenseCategory,
			ExpenseKind:         expenseRow.ExpenseKind,
			Payer:               expenseParticipantDisplay(expenseRow.PayerParticipantID, expenseRow.PayerDisplayName, expenseRow.PayerSource),
			ClientMutationID:    textPtr(expenseRow.ClientMutationID),
			SplitPolicy:         expenseRow.SplitPolicy,
			Splits:              []trip.DayExpenseSplitListItem{},
			IncludeInSettlement: expenseRow.IncludeInSettlement,
			Receipt:             receiptSummary(expenseRow.ReceiptExists, expenseRow.ReceiptContentType, expenseRow.ReceiptByteSize, expenseRow.ReceiptUploadedAt),
			CreatedAt:           expenseRow.CreatedAt.Time,
		}
		if expenseRow.AnchorType == "trip" {
			expenseLocationByID[expenseRow.ID] = expenseLocation{tripLevel: true, expenseIndex: len(result.TripExpenses)}
			result.TripExpenses = append(result.TripExpenses, expense)
			continue
		}

		tripDayID := expenseRow.TripDayID
		dayIndex, ok := dayIndexByID[tripDayID]
		if !ok {
			result.Days = append(result.Days, trip.TripExpenseDayListItem{TripDayID: tripDayID, Expenses: []trip.DayExpenseListItem{}})
			dayIndex = len(result.Days) - 1
			dayIndexByID[tripDayID] = dayIndex
		}
		expenseLocationByID[expenseRow.ID] = expenseLocation{dayIndex: dayIndex, expenseIndex: len(result.Days[dayIndex].Expenses)}
		result.Days[dayIndex].Expenses = append(result.Days[dayIndex].Expenses, expense)
	}

	splitRows, err := s.queries.ListDayExpenseSplitsByExpenseIDs(ctx, expenseIDs)
	if err != nil {
		return trip.ListTripExpensesResult{}, err
	}
	for _, splitRow := range splitRows {
		location, ok := expenseLocationByID[splitRow.ExpenseID]
		if !ok {
			continue
		}
		split := trip.DayExpenseSplitListItem{
			SplitOrder:  int(splitRow.SplitOrder),
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, splitRow.ParticipantSource),
			AmountMinor: splitRow.AmountMinor,
		}
		if location.tripLevel {
			if location.expenseIndex < len(result.TripExpenses) {
				result.TripExpenses[location.expenseIndex].Splits = append(result.TripExpenses[location.expenseIndex].Splits, split)
			}
			continue
		}
		if location.dayIndex >= len(result.Days) || location.expenseIndex >= len(result.Days[location.dayIndex].Expenses) {
			continue
		}
		result.Days[location.dayIndex].Expenses[location.expenseIndex].Splits = append(result.Days[location.dayIndex].Expenses[location.expenseIndex].Splits, split)
	}
	return result, nil
}

func appendDayExpenseSplits(expenses []trip.DayExpenseListItem, expenseIndexByID map[string]int, splitRows []db.ListDayExpenseSplitsByExpenseIDsRow) {
	for _, splitRow := range splitRows {
		expenseIndex, ok := expenseIndexByID[splitRow.ExpenseID]
		if !ok || expenseIndex >= len(expenses) {
			continue
		}
		expenses[expenseIndex].Splits = append(expenses[expenseIndex].Splits, trip.DayExpenseSplitListItem{
			SplitOrder:  int(splitRow.SplitOrder),
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, splitRow.ParticipantSource),
			AmountMinor: splitRow.AmountMinor,
		})
	}
}

func (s *Store) GetTripSettlementInput(ctx context.Context, tripID string) (trip.SettlementInput, error) {
	tripUUID := mustUUID(tripID)
	participantRows, err := s.queries.ListSettlementParticipantsByTrip(ctx, tripUUID)
	if err != nil {
		return trip.SettlementInput{}, err
	}
	participants := make([]trip.SettlementParticipantInput, 0, len(participantRows))
	for _, row := range participantRows {
		participants = append(participants, trip.SettlementParticipantInput{
			ParticipantID: row.ID,
			DisplayName:   row.DisplayName,
			JoinedAt:      row.JoinedAt.Time,
		})
	}

	settlementRows, err := s.queries.ListSettlementRowsByTrip(ctx, tripUUID)
	if err != nil {
		return trip.SettlementInput{}, err
	}
	expenseIndexByID := make(map[string]int, len(settlementRows))
	expenses := make([]trip.SettlementExpenseInput, 0)
	for _, row := range settlementRows {
		expenseIndex, ok := expenseIndexByID[row.ExpenseID]
		if !ok {
			expenses = append(expenses, trip.SettlementExpenseInput{
				ExpenseID:            row.ExpenseID,
				Currency:             row.Currency,
				AmountMinor:          row.ExpenseAmountMinor,
				PayerParticipantID:   optionalString(row.PayerParticipantID),
				PayerDisplayName:     row.PayerDisplayName,
				PayerParticipantLive: row.PayerParticipantLive,
				Splits:               []trip.SettlementSplitInput{},
			})
			expenseIndex = len(expenses) - 1
			expenseIndexByID[row.ExpenseID] = expenseIndex
		}
		if row.SplitOrder > 0 {
			expenses[expenseIndex].Splits = append(expenses[expenseIndex].Splits, trip.SettlementSplitInput{
				ParticipantID:   optionalString(row.SplitParticipantID),
				DisplayName:     row.SplitParticipantDisplayName,
				ParticipantLive: row.SplitParticipantLive,
				AmountMinor:     row.SplitAmountMinor,
				SplitOrder:      int(row.SplitOrder),
			})
		}
	}

	return trip.SettlementInput{Participants: participants, Expenses: expenses}, nil
}

func (s *Store) GetTripSettlementInputs(ctx context.Context, tripIDs []string) (map[string]trip.SettlementInput, error) {
	inputByTripID := make(map[string]*trip.SettlementInput, len(tripIDs))
	tripUUIDs := make([]pgtype.UUID, 0, len(tripIDs))
	for _, tripID := range tripIDs {
		if _, ok := inputByTripID[tripID]; ok {
			continue
		}
		inputByTripID[tripID] = &trip.SettlementInput{Participants: []trip.SettlementParticipantInput{}, Expenses: []trip.SettlementExpenseInput{}}
		tripUUIDs = append(tripUUIDs, mustUUID(tripID))
	}
	if len(tripUUIDs) == 0 {
		return map[string]trip.SettlementInput{}, nil
	}

	participantRows, err := s.queries.ListSettlementParticipantsByTrips(ctx, tripUUIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range participantRows {
		input, ok := inputByTripID[row.TripID]
		if !ok {
			continue
		}
		input.Participants = append(input.Participants, trip.SettlementParticipantInput{
			ParticipantID: row.ID,
			DisplayName:   row.DisplayName,
			JoinedAt:      row.JoinedAt.Time,
		})
	}

	settlementRows, err := s.queries.ListSettlementRowsByTrips(ctx, tripUUIDs)
	if err != nil {
		return nil, err
	}
	expenseIndexByKey := make(map[string]int, len(settlementRows))
	for _, row := range settlementRows {
		input, ok := inputByTripID[row.TripID]
		if !ok {
			continue
		}
		expenseKey := row.TripID + ":" + row.ExpenseID
		expenseIndex, ok := expenseIndexByKey[expenseKey]
		if !ok {
			input.Expenses = append(input.Expenses, trip.SettlementExpenseInput{
				ExpenseID:            row.ExpenseID,
				Currency:             row.Currency,
				AmountMinor:          row.ExpenseAmountMinor,
				PayerParticipantID:   optionalString(row.PayerParticipantID),
				PayerDisplayName:     row.PayerDisplayName,
				PayerParticipantLive: row.PayerParticipantLive,
				Splits:               []trip.SettlementSplitInput{},
			})
			expenseIndex = len(input.Expenses) - 1
			expenseIndexByKey[expenseKey] = expenseIndex
		}
		if row.SplitOrder > 0 {
			input.Expenses[expenseIndex].Splits = append(input.Expenses[expenseIndex].Splits, trip.SettlementSplitInput{
				ParticipantID:   optionalString(row.SplitParticipantID),
				DisplayName:     row.SplitParticipantDisplayName,
				ParticipantLive: row.SplitParticipantLive,
				AmountMinor:     row.SplitAmountMinor,
				SplitOrder:      int(row.SplitOrder),
			})
		}
	}

	inputs := make(map[string]trip.SettlementInput, len(inputByTripID))
	for tripID, input := range inputByTripID {
		inputs[tripID] = *input
	}
	return inputs, nil
}

func (s *Store) GetExpenseByTripDayAndID(ctx context.Context, tripID string, tripDayID string, expenseID string) (trip.Expense, bool, error) {
	expenseRow, err := s.queries.GetExpenseByTripDayAndID(ctx, db.GetExpenseByTripDayAndIDParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
		ExpenseID: mustUUID(expenseID),
	})
	if err == pgx.ErrNoRows {
		return trip.Expense{}, false, nil
	}
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense := expenseFromGetRow(expenseRow)
	splits, err := s.listExpenseSplits(ctx, s.queries, expenseID)
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense.Splits = splits
	return expense, true, nil
}

func (s *Store) GetTripExpenseByID(ctx context.Context, tripID string, expenseID string) (trip.Expense, bool, error) {
	expenseRow, err := s.queries.GetTripExpenseByID(ctx, db.GetTripExpenseByIDParams{
		TripID:    mustUUID(tripID),
		ExpenseID: mustUUID(expenseID),
	})
	if err == pgx.ErrNoRows {
		return trip.Expense{}, false, nil
	}
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense := expenseFromTripGetRow(expenseRow)
	splits, err := s.listExpenseSplits(ctx, s.queries, expenseID)
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense.Splits = splits
	return expense, true, nil
}

func (s *Store) UpdateExpense(ctx context.Context, record trip.UpdateExpenseRecord) (trip.Expense, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.Expense{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	if _, err := qtx.GetExpenseByTripDayAndID(ctx, db.GetExpenseByTripDayAndIDParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.TripDayID),
		ExpenseID: mustUUID(record.ExpenseID),
	}); err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	} else if err != nil {
		return trip.Expense{}, err
	}

	payerRow, err := qtx.GetQuickExpensePayerParticipant(ctx, db.GetQuickExpensePayerParticipantParams{
		TripID:             mustUUID(record.TripID),
		PayerParticipantID: mustUUID(record.PayerParticipantID),
	})
	if err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.Expense{}, err
	}

	anchorType := "trip_day"
	scheduleItemID := pgtype.UUID{}
	tripPlaceID := pgtype.UUID{}
	placeName := textValue("장소 없음")
	placeAddress := textValue("연결된 장소 없음")
	placeType := textValue("etc")
	if record.ScheduleItemID != nil {
		itemRow, err := qtx.GetQuickExpenseScheduleItem(ctx, db.GetQuickExpenseScheduleItemParams{
			TripID:         mustUUID(record.TripID),
			TripDayID:      mustUUID(record.TripDayID),
			ScheduleItemID: mustUUID(*record.ScheduleItemID),
		})
		if err == pgx.ErrNoRows {
			return trip.Expense{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.Expense{}, err
		}
		anchorType = "schedule_item"
		scheduleItemID = mustUUID(itemRow.ScheduleItemID)
		tripPlaceID = mustUUID(itemRow.TripPlaceID)
		placeName = textValue(itemRow.PlaceName)
		placeAddress = textValue(itemRow.PlaceAddress)
		placeType = textValue(itemRow.PlaceType)
	} else if record.TripPlaceID != nil {
		placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
			TripID:      mustUUID(record.TripID),
			TripPlaceID: mustUUID(*record.TripPlaceID),
		})
		if err == pgx.ErrNoRows {
			return trip.Expense{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.Expense{}, err
		}
		tripPlaceID = mustUUID(placeRow.ID)
		placeName = textValue(placeRow.Name)
		placeAddress = textValue(placeRow.Address)
		placeType = textValue(placeRow.PlaceType)
	}

	participantRows, err := qtx.ListQuickExpenseSplitParticipants(ctx, mustUUID(record.TripID))
	if err != nil {
		return trip.Expense{}, err
	}
	allParticipants := make([]trip.ExpenseSplitParticipant, 0, len(participantRows))
	for _, participantRow := range participantRows {
		allParticipants = append(allParticipants, trip.ExpenseSplitParticipant{
			ParticipantID: participantRow.ID,
			UserID:        participantRow.UserID,
			DisplayName:   participantRow.DisplayName,
			JoinedAt:      participantRow.JoinedAt.Time,
		})
	}
	splitRecords, err := trip.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return trip.Expense{}, err
	}

	updatedRow, err := qtx.UpdateExpense(ctx, db.UpdateExpenseParams{
		AnchorType:          anchorType,
		ScheduleItemID:      scheduleItemID,
		TripPlaceID:         tripPlaceID,
		PlaceName:           placeName,
		PlaceAddress:        placeAddress,
		PlaceType:           placeType,
		Title:               nullableText(record.Title),
		AmountMinor:         record.AmountMinor,
		Currency:            nullableText(record.Currency),
		ExpenseCategory:     nullableText(record.ExpenseCategory),
		ExpenseKind:         nullableText(record.ExpenseKind),
		SplitPolicy:         record.SplitPolicy,
		PayerParticipantID:  mustUUID(payerRow.ID),
		PayerDisplayName:    trip.NormalizeParticipantDisplayName(payerRow.DisplayName),
		Memo:                nullableText(record.Memo),
		IncludeInSettlement: nullableBool(record.IncludeInSettlement),
		TripID:              mustUUID(record.TripID),
		TripDayID:           mustUUID(record.TripDayID),
		ExpenseID:           mustUUID(record.ExpenseID),
	})
	if isForeignKeyViolation(err) {
		return trip.Expense{}, trip.ErrConflict
	}
	if err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.Expense{}, err
	}

	if err := qtx.DeleteExpenseSplitsByExpenseID(ctx, mustUUID(record.ExpenseID)); err != nil {
		return trip.Expense{}, err
	}

	splits := make([]trip.ExpenseSplit, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		splitRow, err := qtx.InsertExpenseSplit(ctx, db.InsertExpenseSplitParams{
			ExpenseID:              mustUUID(updatedRow.ID),
			ParticipantID:          mustUUID(splitRecord.ParticipantID),
			ParticipantDisplayName: splitRecord.ParticipantDisplayName,
			AmountMinor:            splitRecord.AmountMinor,
			SplitOrder:             int32(splitRecord.SplitOrder),
		})
		if isForeignKeyViolation(err) {
			return trip.Expense{}, trip.ErrConflict
		}
		if err != nil {
			return trip.Expense{}, err
		}
		splits = append(splits, trip.ExpenseSplit{
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, trip.ExpenseDisplaySourceLive),
			AmountMinor: splitRow.AmountMinor,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.Expense{}, err
	}

	expense := expenseFromUpdateRow(updatedRow)
	expense.Splits = splits
	return expense, nil
}

func (s *Store) UpdateTripExpense(ctx context.Context, record trip.UpdateExpenseRecord) (trip.Expense, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.Expense{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	if _, err := qtx.GetTripExpenseByID(ctx, db.GetTripExpenseByIDParams{
		TripID:    mustUUID(record.TripID),
		ExpenseID: mustUUID(record.ExpenseID),
	}); err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	} else if err != nil {
		return trip.Expense{}, err
	}

	payerRow, err := qtx.GetQuickExpensePayerParticipant(ctx, db.GetQuickExpensePayerParticipantParams{
		TripID:             mustUUID(record.TripID),
		PayerParticipantID: mustUUID(record.PayerParticipantID),
	})
	if err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.Expense{}, err
	}

	tripPlaceID := pgtype.UUID{}
	placeName := pgtype.Text{}
	placeAddress := pgtype.Text{}
	placeType := pgtype.Text{}
	if record.TripPlaceID != nil {
		placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
			TripID:      mustUUID(record.TripID),
			TripPlaceID: mustUUID(*record.TripPlaceID),
		})
		if err == pgx.ErrNoRows {
			return trip.Expense{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.Expense{}, err
		}
		tripPlaceID = mustUUID(placeRow.ID)
		placeName = textValue(placeRow.Name)
		placeAddress = textValue(placeRow.Address)
		placeType = textValue(placeRow.PlaceType)
	}

	participantRows, err := qtx.ListQuickExpenseSplitParticipants(ctx, mustUUID(record.TripID))
	if err != nil {
		return trip.Expense{}, err
	}
	allParticipants := make([]trip.ExpenseSplitParticipant, 0, len(participantRows))
	for _, participantRow := range participantRows {
		allParticipants = append(allParticipants, trip.ExpenseSplitParticipant{
			ParticipantID: participantRow.ID,
			UserID:        participantRow.UserID,
			DisplayName:   participantRow.DisplayName,
			JoinedAt:      participantRow.JoinedAt.Time,
		})
	}
	splitRecords, err := trip.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return trip.Expense{}, err
	}

	updatedRow, err := qtx.UpdateTripExpense(ctx, db.UpdateTripExpenseParams{
		Title:               nullableText(record.Title),
		TripPlaceID:         tripPlaceID,
		PlaceName:           placeName,
		PlaceAddress:        placeAddress,
		PlaceType:           placeType,
		AmountMinor:         record.AmountMinor,
		Currency:            nullableText(record.Currency),
		ExpenseCategory:     nullableText(record.ExpenseCategory),
		ExpenseKind:         nullableText(record.ExpenseKind),
		SplitPolicy:         record.SplitPolicy,
		PayerParticipantID:  mustUUID(payerRow.ID),
		PayerDisplayName:    trip.NormalizeParticipantDisplayName(payerRow.DisplayName),
		Memo:                nullableText(record.Memo),
		IncludeInSettlement: nullableBool(record.IncludeInSettlement),
		TripID:              mustUUID(record.TripID),
		ExpenseID:           mustUUID(record.ExpenseID),
	})
	if isForeignKeyViolation(err) {
		return trip.Expense{}, trip.ErrConflict
	}
	if err == pgx.ErrNoRows {
		return trip.Expense{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.Expense{}, err
	}

	if err := qtx.DeleteExpenseSplitsByExpenseID(ctx, mustUUID(record.ExpenseID)); err != nil {
		return trip.Expense{}, err
	}

	splits := make([]trip.ExpenseSplit, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		splitRow, err := qtx.InsertExpenseSplit(ctx, db.InsertExpenseSplitParams{
			ExpenseID:              mustUUID(updatedRow.ID),
			ParticipantID:          mustUUID(splitRecord.ParticipantID),
			ParticipantDisplayName: splitRecord.ParticipantDisplayName,
			AmountMinor:            splitRecord.AmountMinor,
			SplitOrder:             int32(splitRecord.SplitOrder),
		})
		if isForeignKeyViolation(err) {
			return trip.Expense{}, trip.ErrConflict
		}
		if err != nil {
			return trip.Expense{}, err
		}
		splits = append(splits, trip.ExpenseSplit{
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, trip.ExpenseDisplaySourceLive),
			AmountMinor: splitRow.AmountMinor,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.Expense{}, err
	}

	expense := expenseFromUpdateTripRow(updatedRow)
	expense.Splits = splits
	return expense, nil
}

func (s *Store) DeleteTripExpenseByID(ctx context.Context, tripID string, expenseID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)
	if err := qtx.EnqueueExpenseReceiptDeletionJobForExpense(ctx, db.EnqueueExpenseReceiptDeletionJobForExpenseParams{Reason: "expense_deleted", TripID: mustUUID(tripID), ExpenseID: mustUUID(expenseID)}); err != nil {
		return false, err
	}
	_, err = qtx.DeleteTripExpenseByID(ctx, db.DeleteTripExpenseByIDParams{
		TripID:    mustUUID(tripID),
		ExpenseID: mustUUID(expenseID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) DeleteExpenseByTripDayAndID(ctx context.Context, tripID string, tripDayID string, expenseID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)
	if err := qtx.EnqueueExpenseReceiptDeletionJobForExpense(ctx, db.EnqueueExpenseReceiptDeletionJobForExpenseParams{Reason: "expense_deleted", TripID: mustUUID(tripID), ExpenseID: mustUUID(expenseID)}); err != nil {
		return false, err
	}
	_, err = qtx.DeleteExpenseByTripDayAndID(ctx, db.DeleteExpenseByTripDayAndIDParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
		ExpenseID: mustUUID(expenseID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) CreateQuickExpense(ctx context.Context, record trip.CreateQuickExpenseRecord) (trip.CreateQuickExpenseResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	tripRow, err := qtx.GetTripDefaultCurrencyForQuickExpense(ctx, mustUUID(record.TripID))
	if err == pgx.ErrNoRows {
		return trip.CreateQuickExpenseResult{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	dayRow, err := qtx.GetActiveTripDayByTripAndID(ctx, db.GetActiveTripDayByTripAndIDParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.TripDayID),
	})
	if err == pgx.ErrNoRows {
		return trip.CreateQuickExpenseResult{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	if record.ClientMutationID != nil {
		expense, found, err := s.quickExpenseByClientMutationID(ctx, qtx, record.TripID, record.CreatedBy, *record.ClientMutationID)
		if err != nil {
			return trip.CreateQuickExpenseResult{}, err
		}
		if found {
			return trip.CreateQuickExpenseResult{Expense: expense}, nil
		}
	}

	anchorType := "trip_day"
	tripDayID := mustUUID(dayRow.ID)
	scheduleItemID := pgtype.UUID{}
	tripPlaceID := pgtype.UUID{}
	placeName := textValue("장소 없음")
	placeAddress := textValue("연결된 장소 없음")
	placeType := textValue("etc")
	expenseDate := dayRow.Date
	placeSource := trip.ExpenseDisplaySourceFallback
	if record.ScheduleItemID != nil {
		itemRow, err := qtx.GetQuickExpenseScheduleItem(ctx, db.GetQuickExpenseScheduleItemParams{
			TripID:         mustUUID(record.TripID),
			TripDayID:      mustUUID(record.TripDayID),
			ScheduleItemID: mustUUID(*record.ScheduleItemID),
		})
		if err == pgx.ErrNoRows {
			return trip.CreateQuickExpenseResult{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.CreateQuickExpenseResult{}, err
		}
		anchorType = "schedule_item"
		tripDayID = mustUUID(itemRow.TripDayID)
		scheduleItemID = mustUUID(itemRow.ScheduleItemID)
		tripPlaceID = mustUUID(itemRow.TripPlaceID)
		placeName = textValue(itemRow.PlaceName)
		placeAddress = textValue(itemRow.PlaceAddress)
		placeType = textValue(itemRow.PlaceType)
		expenseDate = itemRow.TripDayDate
		placeSource = trip.ExpenseDisplaySourceLive
	} else if record.TripPlaceID != nil {
		placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
			TripID:      mustUUID(record.TripID),
			TripPlaceID: mustUUID(*record.TripPlaceID),
		})
		if err == pgx.ErrNoRows {
			return trip.CreateQuickExpenseResult{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.CreateQuickExpenseResult{}, err
		}
		tripPlaceID = mustUUID(placeRow.ID)
		placeName = textValue(placeRow.Name)
		placeAddress = textValue(placeRow.Address)
		placeType = textValue(placeRow.PlaceType)
		placeSource = trip.ExpenseDisplaySourceLive
	} else {
		return trip.CreateQuickExpenseResult{}, trip.ErrValidation
	}

	payerRow, err := qtx.GetQuickExpensePayerParticipant(ctx, db.GetQuickExpensePayerParticipantParams{
		TripID:             mustUUID(record.TripID),
		PayerParticipantID: mustUUID(record.PayerParticipantID),
	})
	if err == pgx.ErrNoRows {
		return trip.CreateQuickExpenseResult{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	participantRows, err := qtx.ListQuickExpenseSplitParticipants(ctx, mustUUID(record.TripID))
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}
	allParticipants := make([]trip.ExpenseSplitParticipant, 0, len(participantRows))
	for _, participantRow := range participantRows {
		allParticipants = append(allParticipants, trip.ExpenseSplitParticipant{
			ParticipantID: participantRow.ID,
			UserID:        participantRow.UserID,
			DisplayName:   participantRow.DisplayName,
			JoinedAt:      participantRow.JoinedAt.Time,
		})
	}
	splitRecords, err := trip.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	expenseRow, err := qtx.InsertExpense(ctx, db.InsertExpenseParams{
		TripID:              mustUUID(record.TripID),
		AnchorType:          anchorType,
		TripDayID:           tripDayID,
		ScheduleItemID:      scheduleItemID,
		ExpenseDate:         expenseDate,
		TripPlaceID:         tripPlaceID,
		PlaceName:           placeName,
		PlaceAddress:        placeAddress,
		PlaceType:           placeType,
		Title:               pgtype.Text{},
		AmountMinor:         record.AmountMinor,
		Currency:            expenseCurrency(record.Currency, tripRow.DefaultCurrency),
		ExpenseCategory:     expenseCategory(record.ExpenseCategory, textString(placeType)),
		ExpenseKind:         expenseKind(record.ExpenseKind),
		SplitPolicy:         record.SplitPolicy,
		PayerParticipantID:  mustUUID(payerRow.ID),
		PayerDisplayName:    trip.NormalizeParticipantDisplayName(payerRow.DisplayName),
		Memo:                nullableText(record.Memo),
		ClientMutationID:    nullableText(record.ClientMutationID),
		IncludeInSettlement: record.IncludeInSettlement,
		CreatedBy:           mustUUID(record.CreatedBy),
	})
	if isUniqueConstraintViolation(err, "expenses_client_mutation_unique_idx") && record.ClientMutationID != nil {
		_ = tx.Rollback(ctx)
		expense, found, lookupErr := s.quickExpenseByClientMutationID(ctx, s.queries, record.TripID, record.CreatedBy, *record.ClientMutationID)
		if lookupErr != nil {
			return trip.CreateQuickExpenseResult{}, lookupErr
		}
		if found {
			return trip.CreateQuickExpenseResult{Expense: expense}, nil
		}
		return trip.CreateQuickExpenseResult{}, err
	}
	if isForeignKeyViolation(err) {
		return trip.CreateQuickExpenseResult{}, trip.ErrConflict
	}
	if err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	splits := make([]trip.ExpenseSplit, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		splitRow, err := qtx.InsertExpenseSplit(ctx, db.InsertExpenseSplitParams{
			ExpenseID:              mustUUID(expenseRow.ID),
			ParticipantID:          mustUUID(splitRecord.ParticipantID),
			ParticipantDisplayName: splitRecord.ParticipantDisplayName,
			AmountMinor:            splitRecord.AmountMinor,
			SplitOrder:             int32(splitRecord.SplitOrder),
		})
		if isForeignKeyViolation(err) {
			return trip.CreateQuickExpenseResult{}, trip.ErrConflict
		}
		if err != nil {
			return trip.CreateQuickExpenseResult{}, err
		}
		participantID := splitRow.ParticipantID
		splits = append(splits, trip.ExpenseSplit{
			Participant: expenseParticipantDisplay(participantID, splitRow.ParticipantDisplayName, trip.ExpenseDisplaySourceLive),
			AmountMinor: splitRow.AmountMinor,
		})
	}

	receipt := receiptSummary(expenseRow.ReceiptExists, expenseRow.ReceiptContentType, expenseRow.ReceiptByteSize, expenseRow.ReceiptUploadedAt)
	if record.ReceiptDraftID != nil {
		receipt, err = attachExpenseReceiptDraft(ctx, qtx, record.TripID, record.CreatedBy, expenseRow.ID, *record.ReceiptDraftID)
		if err != nil {
			return trip.CreateQuickExpenseResult{}, err
		}
	}

	notificationParticipants := notificationParticipantsFromTripParticipants(allParticipants)
	if err := createExpenseCreatedNotifications(ctx, tx, qtx, expenseCreatedNotificationInput{
		TripID:           expenseRow.TripID,
		ExpenseID:        expenseRow.ID,
		CreatorUserID:    record.CreatedBy,
		ActorDisplayName: notificationActorDisplayName(record.CreatedBy, notificationParticipants),
		ExpenseTitle:     expenseDisplayTitle(expenseRow.Title, expenseRow.PlaceName),
		AmountMinor:      expenseRow.AmountMinor,
		Currency:         expenseRow.Currency,
		Payer: notification.ExpenseCreatedParticipant{
			ParticipantID: payerRow.ID,
			UserID:        payerRow.UserID,
			DisplayName:   payerRow.DisplayName,
		},
		Splits: notificationParticipantsFromSplitRecords(splitRecords),
	}); err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.CreateQuickExpenseResult{}, err
	}

	return trip.CreateQuickExpenseResult{Expense: trip.Expense{
		ID:                  expenseRow.ID,
		TripID:              expenseRow.TripID,
		AnchorType:          expenseRow.AnchorType,
		TripDayID:           optionalString(expenseRow.TripDayID),
		ScheduleItemID:      optionalString(expenseRow.ScheduleItemID),
		ExpenseDate:         dateString(expenseRow.ExpenseDate),
		Title:               textPtr(expenseRow.Title),
		DisplayTitle:        expenseDisplayTitle(expenseRow.Title, expenseRow.PlaceName),
		Place:               expensePlaceDisplay(expenseRow.TripPlaceID, expenseRow.PlaceName, expenseRow.PlaceAddress, expenseRow.PlaceType, placeSource),
		AmountMinor:         expenseRow.AmountMinor,
		Currency:            expenseRow.Currency,
		ExpenseCategory:     expenseRow.ExpenseCategory,
		ExpenseKind:         expenseRow.ExpenseKind,
		Payer:               expenseParticipantDisplay(expenseRow.PayerParticipantID, expenseRow.PayerDisplayName, trip.ExpenseDisplaySourceLive),
		Memo:                textPtr(expenseRow.Memo),
		ClientMutationID:    textPtr(expenseRow.ClientMutationID),
		SplitPolicy:         expenseRow.SplitPolicy,
		Splits:              splits,
		IncludeInSettlement: expenseRow.IncludeInSettlement,
		Receipt:             receipt,
		CreatedAt:           expenseRow.CreatedAt.Time,
	}}, nil
}

func (s *Store) CreateTripExpense(ctx context.Context, record trip.CreateTripExpenseRecord) (trip.CreateTripExpenseResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	tripRow, err := qtx.GetTripDefaultCurrencyForQuickExpense(ctx, mustUUID(record.TripID))
	if err == pgx.ErrNoRows {
		return trip.CreateTripExpenseResult{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	anchorType := "trip"
	tripDayID := pgtype.UUID{}
	scheduleItemID := pgtype.UUID{}
	tripPlaceID := pgtype.UUID{}
	placeName := pgtype.Text{}
	placeAddress := pgtype.Text{}
	placeType := pgtype.Text{}
	placeSource := ""
	if record.ScheduleItemID != nil {
		itemRow, err := qtx.GetTripExpenseScheduleItem(ctx, db.GetTripExpenseScheduleItemParams{
			TripID:         mustUUID(record.TripID),
			ScheduleItemID: mustUUID(*record.ScheduleItemID),
		})
		if err == pgx.ErrNoRows {
			return trip.CreateTripExpenseResult{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.CreateTripExpenseResult{}, err
		}
		if record.TripDayID != nil && *record.TripDayID != itemRow.TripDayID {
			return trip.CreateTripExpenseResult{}, trip.ErrValidation
		}
		anchorType = "schedule_item"
		tripDayID = mustUUID(itemRow.TripDayID)
		scheduleItemID = mustUUID(itemRow.ScheduleItemID)
		tripPlaceID = mustUUID(itemRow.TripPlaceID)
		placeName = textValue(itemRow.PlaceName)
		placeAddress = textValue(itemRow.PlaceAddress)
		placeType = textValue(itemRow.PlaceType)
		placeSource = trip.ExpenseDisplaySourceLive
	} else if record.TripPlaceID != nil {
		placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
			TripID:      mustUUID(record.TripID),
			TripPlaceID: mustUUID(*record.TripPlaceID),
		})
		if err == pgx.ErrNoRows {
			return trip.CreateTripExpenseResult{}, trip.ErrNotFound
		}
		if err != nil {
			return trip.CreateTripExpenseResult{}, err
		}
		tripPlaceID = mustUUID(placeRow.ID)
		placeName = textValue(placeRow.Name)
		placeAddress = textValue(placeRow.Address)
		placeType = textValue(placeRow.PlaceType)
		placeSource = trip.ExpenseDisplaySourceLive
		if record.TripDayID != nil {
			anchorType = "trip_day"
			tripDayID = mustUUID(*record.TripDayID)
		}
	} else if record.TripDayID != nil {
		anchorType = "trip_day"
		tripDayID = mustUUID(*record.TripDayID)
	}

	payerRow, err := qtx.GetQuickExpensePayerParticipant(ctx, db.GetQuickExpensePayerParticipantParams{
		TripID:             mustUUID(record.TripID),
		PayerParticipantID: mustUUID(record.PayerParticipantID),
	})
	if err == pgx.ErrNoRows {
		return trip.CreateTripExpenseResult{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	participantRows, err := qtx.ListQuickExpenseSplitParticipants(ctx, mustUUID(record.TripID))
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}
	allParticipants := make([]trip.ExpenseSplitParticipant, 0, len(participantRows))
	for _, participantRow := range participantRows {
		allParticipants = append(allParticipants, trip.ExpenseSplitParticipant{
			ParticipantID: participantRow.ID,
			UserID:        participantRow.UserID,
			DisplayName:   participantRow.DisplayName,
			JoinedAt:      participantRow.JoinedAt.Time,
		})
	}
	splitRecords, err := trip.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	expenseRow, err := qtx.InsertExpense(ctx, db.InsertExpenseParams{
		TripID:              mustUUID(record.TripID),
		AnchorType:          anchorType,
		TripDayID:           tripDayID,
		ScheduleItemID:      scheduleItemID,
		ExpenseDate:         dateValue(record.ExpenseDate),
		Title:               nullableText(record.Title),
		TripPlaceID:         tripPlaceID,
		PlaceName:           placeName,
		PlaceAddress:        placeAddress,
		PlaceType:           placeType,
		AmountMinor:         record.AmountMinor,
		Currency:            expenseCurrency(record.Currency, tripRow.DefaultCurrency),
		ExpenseCategory:     expenseCategory(record.ExpenseCategory, textString(placeType)),
		ExpenseKind:         expenseKind(record.ExpenseKind),
		SplitPolicy:         record.SplitPolicy,
		PayerParticipantID:  mustUUID(payerRow.ID),
		PayerDisplayName:    trip.NormalizeParticipantDisplayName(payerRow.DisplayName),
		Memo:                nullableText(record.Memo),
		IncludeInSettlement: record.IncludeInSettlement,
		CreatedBy:           mustUUID(record.CreatedBy),
	})
	if isForeignKeyViolation(err) {
		return trip.CreateTripExpenseResult{}, trip.ErrConflict
	}
	if err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	splits := make([]trip.ExpenseSplit, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		splitRow, err := qtx.InsertExpenseSplit(ctx, db.InsertExpenseSplitParams{
			ExpenseID:              mustUUID(expenseRow.ID),
			ParticipantID:          mustUUID(splitRecord.ParticipantID),
			ParticipantDisplayName: splitRecord.ParticipantDisplayName,
			AmountMinor:            splitRecord.AmountMinor,
			SplitOrder:             int32(splitRecord.SplitOrder),
		})
		if isForeignKeyViolation(err) {
			return trip.CreateTripExpenseResult{}, trip.ErrConflict
		}
		if err != nil {
			return trip.CreateTripExpenseResult{}, err
		}
		splits = append(splits, trip.ExpenseSplit{
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, trip.ExpenseDisplaySourceLive),
			AmountMinor: splitRow.AmountMinor,
		})
	}

	receipt := receiptSummary(expenseRow.ReceiptExists, expenseRow.ReceiptContentType, expenseRow.ReceiptByteSize, expenseRow.ReceiptUploadedAt)
	if record.ReceiptDraftID != nil {
		receipt, err = attachExpenseReceiptDraft(ctx, qtx, record.TripID, record.CreatedBy, expenseRow.ID, *record.ReceiptDraftID)
		if err != nil {
			return trip.CreateTripExpenseResult{}, err
		}
	}

	notificationParticipants := notificationParticipantsFromTripParticipants(allParticipants)
	if err := createExpenseCreatedNotifications(ctx, tx, qtx, expenseCreatedNotificationInput{
		TripID:           expenseRow.TripID,
		ExpenseID:        expenseRow.ID,
		CreatorUserID:    record.CreatedBy,
		ActorDisplayName: notificationActorDisplayName(record.CreatedBy, notificationParticipants),
		ExpenseTitle:     expenseDisplayTitle(expenseRow.Title, expenseRow.PlaceName),
		AmountMinor:      expenseRow.AmountMinor,
		Currency:         expenseRow.Currency,
		Payer: notification.ExpenseCreatedParticipant{
			ParticipantID: payerRow.ID,
			UserID:        payerRow.UserID,
			DisplayName:   payerRow.DisplayName,
		},
		Splits: notificationParticipantsFromSplitRecords(splitRecords),
	}); err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.CreateTripExpenseResult{}, err
	}

	expense := expenseFromInsertRow(expenseRow, splits, placeSource)
	expense.Receipt = receipt
	return trip.CreateTripExpenseResult{Expense: expense}, nil
}

func (s *Store) GetScheduleItemByTripDayAndID(ctx context.Context, tripID string, tripDayID string, itemID string) (trip.ScheduleItem, bool, error) {
	row, err := s.queries.GetScheduleItemByTripDayAndID(ctx, db.GetScheduleItemByTripDayAndIDParams{
		TripID:         mustUUID(tripID),
		TripDayID:      mustUUID(tripDayID),
		ScheduleItemID: mustUUID(itemID),
	})
	if err == pgx.ErrNoRows {
		return trip.ScheduleItem{}, false, nil
	}
	if err != nil {
		return trip.ScheduleItem{}, false, err
	}
	return scheduleItemFromGetRow(row), true, nil
}

func (s *Store) CreateManualScheduleItem(ctx context.Context, record trip.CreateManualScheduleItemRecord) (trip.ScheduleItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	place, err := qtx.CreateTripPlace(ctx, db.CreateTripPlaceParams{
		TripID:    mustUUID(record.TripID),
		Name:      record.Name,
		Address:   record.Address,
		PlaceType: record.PlaceType,
	})
	if err != nil {
		return trip.ScheduleItem{}, err
	}

	item, err := createScheduleItemAtEnd(ctx, tx, record.TripID, record.TripDayID, place.ID, record.Name, nil, nil, nil)
	if err != nil {
		if errors.Is(err, trip.ErrConflict) || isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return trip.ScheduleItem{}, trip.ErrConflict
		}
		return trip.ScheduleItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.ScheduleItem{}, err
	}

	return trip.ScheduleItem{
		ID:            item.ID,
		ItemOrder:     int(item.ItemOrder),
		Version:       int(item.Version),
		ItemType:      trip.ScheduleItemTypePlace,
		StartTime:     timeTextPtrFromSQL(item.StartTime),
		EndTime:       timeTextPtrFromSQL(item.EndTime),
		ArrivedAt:     timePtrFromTimestamptz(item.ArrivedAt),
		SkippedAt:     timePtrFromTimestamptz(item.SkippedAt),
		Place:         tripPlaceSummary(place.ID, place.Name, place.PlaceType, place.Address, place.Provider, place.GooglePlaceID, place.Latitude, place.Longitude),
		PlaceSchedule: placeScheduleItemDetails(item.PlaceTitle, item.PlaceMemo, place.Name),
	}, nil
}

func (s *Store) AppendGooglePlaceScheduleItem(ctx context.Context, record place.AppendGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripPlaceID: mustUUID(record.TripPlaceID),
	})
	if err == pgx.ErrNoRows {
		return trip.ScheduleItem{}, place.ErrNotFound
	}
	if err != nil {
		return trip.ScheduleItem{}, err
	}

	if err := lockSameDayScheduleOrdering(ctx, tx, record.TripID, record.TripDayID); err != nil {
		return trip.ScheduleItem{}, err
	}

	duplicateCount, err := qtx.CountScheduleItemsByTripDayAndPlace(ctx, db.CountScheduleItemsByTripDayAndPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripDayID:   mustUUID(record.TripDayID),
		TripPlaceID: mustUUID(record.TripPlaceID),
	})
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	if duplicateCount > 0 && !record.DuplicateConfirmed {
		return trip.ScheduleItem{}, place.DuplicateDayPlaceConfirmationError{TripPlaceID: record.TripPlaceID}
	}

	item, err := createScheduleItemAtEnd(ctx, tx, record.TripID, record.TripDayID, record.TripPlaceID, record.Title, record.Memo, record.StartTime, record.EndTime)
	if err != nil {
		if errors.Is(err, trip.ErrConflict) || isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return trip.ScheduleItem{}, place.ErrConflict
		}
		return trip.ScheduleItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.ScheduleItem{}, err
	}

	return trip.ScheduleItem{
		ID:            item.ID,
		ItemOrder:     int(item.ItemOrder),
		Version:       int(item.Version),
		ItemType:      trip.ScheduleItemTypePlace,
		StartTime:     timeTextPtrFromSQL(item.StartTime),
		EndTime:       timeTextPtrFromSQL(item.EndTime),
		ArrivedAt:     timePtrFromTimestamptz(item.ArrivedAt),
		SkippedAt:     timePtrFromTimestamptz(item.SkippedAt),
		Place:         tripPlaceSummary(placeRow.ID, placeRow.Name, placeRow.PlaceType, placeRow.Address, placeRow.Provider, placeRow.GooglePlaceID, placeRow.Latitude, placeRow.Longitude),
		PlaceSchedule: placeScheduleItemDetails(item.PlaceTitle, item.PlaceMemo, placeRow.Name),
	}, nil
}

func (s *Store) ListTripPlaceBookmarks(ctx context.Context, tripID string) ([]place.TripPlaceBookmark, error) {
	rows, err := s.queries.ListTripPlaceBookmarks(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	items := make([]place.TripPlaceBookmark, 0, len(rows))
	for _, row := range rows {
		items = append(items, tripPlaceBookmark(row.ID, row.TripID, row.Category, row.CreatedAt, row.UpdatedAt, row.PlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude))
	}
	return items, nil
}

func (s *Store) UpsertGoogleTripPlaceBookmark(ctx context.Context, record place.CreateGoogleTripPlaceBookmarkRecord) (place.TripPlaceBookmark, error) {
	row, err := s.queries.UpsertGoogleTripPlaceBookmark(ctx, db.UpsertGoogleTripPlaceBookmarkParams{
		TripID:            mustUUID(record.TripID),
		Name:              record.Name,
		Address:           record.Address,
		PlaceType:         record.PlaceType,
		GooglePlaceID:     textValue(record.GooglePlaceID),
		Latitude:          float8Value(record.Latitude),
		Longitude:         float8Value(record.Longitude),
		GooglePrimaryType: textValue(record.GooglePrimaryType),
		GoogleTypes:       record.GoogleTypes,
		Category:          record.Category,
	})
	if err != nil {
		return place.TripPlaceBookmark{}, err
	}
	return tripPlaceBookmark(row.ID, row.TripID, row.Category, row.CreatedAt, row.UpdatedAt, row.PlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude), nil
}

func (s *Store) DeleteTripPlaceBookmark(ctx context.Context, tripID string, bookmarkID string) (bool, error) {
	_, err := s.queries.DeleteTripPlaceBookmark(ctx, db.DeleteTripPlaceBookmarkParams{
		TripID:     mustUUID(tripID),
		BookmarkID: mustUUID(bookmarkID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) CreateGooglePlaceScheduleItem(ctx context.Context, record place.CreateGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	placeRow, err := qtx.UpsertGoogleTripPlace(ctx, db.UpsertGoogleTripPlaceParams{
		TripID:            mustUUID(record.TripID),
		Name:              record.Name,
		Address:           record.Address,
		PlaceType:         record.PlaceType,
		GooglePlaceID:     textValue(record.GooglePlaceID),
		Latitude:          float8Value(record.Latitude),
		Longitude:         float8Value(record.Longitude),
		GooglePrimaryType: textValue(record.GooglePrimaryType),
		GoogleTypes:       record.GoogleTypes,
	})
	if err != nil {
		return trip.ScheduleItem{}, err
	}

	if err := lockSameDayScheduleOrdering(ctx, tx, record.TripID, record.TripDayID); err != nil {
		return trip.ScheduleItem{}, err
	}

	duplicateCount, err := qtx.CountScheduleItemsByTripDayAndPlace(ctx, db.CountScheduleItemsByTripDayAndPlaceParams{
		TripID:      mustUUID(record.TripID),
		TripDayID:   mustUUID(record.TripDayID),
		TripPlaceID: mustUUID(placeRow.ID),
	})
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	if duplicateCount > 0 && !record.DuplicateConfirmed {
		return trip.ScheduleItem{}, place.DuplicateDayPlaceConfirmationError{TripPlaceID: placeRow.ID}
	}

	item, err := createScheduleItemAtEnd(ctx, tx, record.TripID, record.TripDayID, placeRow.ID, record.Title, record.Memo, record.StartTime, record.EndTime)
	if err != nil {
		if errors.Is(err, trip.ErrConflict) || isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return trip.ScheduleItem{}, place.ErrConflict
		}
		return trip.ScheduleItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.ScheduleItem{}, err
	}

	return trip.ScheduleItem{
		ID:            item.ID,
		ItemOrder:     int(item.ItemOrder),
		Version:       int(item.Version),
		ItemType:      trip.ScheduleItemTypePlace,
		StartTime:     timeTextPtrFromSQL(item.StartTime),
		EndTime:       timeTextPtrFromSQL(item.EndTime),
		ArrivedAt:     timePtrFromTimestamptz(item.ArrivedAt),
		SkippedAt:     timePtrFromTimestamptz(item.SkippedAt),
		Place:         tripPlaceSummary(placeRow.ID, placeRow.Name, placeRow.PlaceType, placeRow.Address, placeRow.Provider, placeRow.GooglePlaceID, placeRow.Latitude, placeRow.Longitude),
		PlaceSchedule: placeScheduleItemDetails(item.PlaceTitle, item.PlaceMemo, placeRow.Name),
	}, nil
}

func (s *Store) CreateGooglePlaceScheduleItemsBatch(ctx context.Context, record place.CreateGooglePlaceScheduleItemsBatchRecord) (place.CreateGooglePlaceScheduleItemsBatchMutationResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	if err := lockSameDayScheduleOrdering(ctx, tx, record.TripID, record.TripDayID); err != nil {
		return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
	}

	type resolvedBatchItem struct {
		recordItem place.CreateGooglePlaceScheduleItemsBatchRecordItem
		placeID    string
		placeName  string
		placeType  string
		address    string
		provider   string
		googleID   pgtype.Text
		latitude   pgtype.Float8
		longitude  pgtype.Float8
	}
	resolved := make([]resolvedBatchItem, 0, len(record.Items))

	for _, item := range record.Items {
		var resolvedItem resolvedBatchItem
		resolvedItem.recordItem = item
		if item.TripPlaceID != "" {
			placeRow, err := qtx.GetTripPlaceSummaryByTripAndPlace(ctx, db.GetTripPlaceSummaryByTripAndPlaceParams{
				TripID:      mustUUID(record.TripID),
				TripPlaceID: mustUUID(item.TripPlaceID),
			})
			if err == pgx.ErrNoRows {
				return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, place.ErrNotFound
			}
			if err != nil {
				return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
			}
			resolvedItem.placeID = placeRow.ID
			resolvedItem.placeName = placeRow.Name
			resolvedItem.placeType = placeRow.PlaceType
			resolvedItem.address = placeRow.Address
			resolvedItem.provider = placeRow.Provider
			resolvedItem.googleID = placeRow.GooglePlaceID
			resolvedItem.latitude = placeRow.Latitude
			resolvedItem.longitude = placeRow.Longitude
		} else {
			placeRow, err := qtx.UpsertGoogleTripPlace(ctx, db.UpsertGoogleTripPlaceParams{
				TripID:            mustUUID(record.TripID),
				Name:              item.Name,
				Address:           item.Address,
				PlaceType:         item.PlaceType,
				GooglePlaceID:     textValue(item.GooglePlaceID),
				Latitude:          float8Value(item.Latitude),
				Longitude:         float8Value(item.Longitude),
				GooglePrimaryType: textValue(item.GooglePrimaryType),
				GoogleTypes:       item.GoogleTypes,
			})
			if err != nil {
				return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
			}
			resolvedItem.placeID = placeRow.ID
			resolvedItem.placeName = placeRow.Name
			resolvedItem.placeType = placeRow.PlaceType
			resolvedItem.address = placeRow.Address
			resolvedItem.provider = placeRow.Provider
			resolvedItem.googleID = placeRow.GooglePlaceID
			resolvedItem.latitude = placeRow.Latitude
			resolvedItem.longitude = placeRow.Longitude
		}

		resolved = append(resolved, resolvedItem)
	}

	createdItems := make([]trip.ScheduleItem, 0, len(resolved))
	for _, item := range resolved {
		appended, err := createScheduleItemAtEnd(ctx, tx, record.TripID, record.TripDayID, item.placeID, item.recordItem.Title, nil, nil, nil)
		if err != nil {
			if errors.Is(err, trip.ErrConflict) || isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
				return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, place.ErrConflict
			}
			return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
		}
		createdItems = append(createdItems, trip.ScheduleItem{
			ID:            appended.ID,
			ItemOrder:     int(appended.ItemOrder),
			Version:       int(appended.Version),
			ItemType:      trip.ScheduleItemTypePlace,
			StartTime:     timeTextPtrFromSQL(appended.StartTime),
			EndTime:       timeTextPtrFromSQL(appended.EndTime),
			ArrivedAt:     timePtrFromTimestamptz(appended.ArrivedAt),
			SkippedAt:     timePtrFromTimestamptz(appended.SkippedAt),
			Place:         tripPlaceSummary(item.placeID, item.placeName, item.placeType, item.address, item.provider, item.googleID, item.latitude, item.longitude),
			PlaceSchedule: placeScheduleItemDetails(appended.PlaceTitle, appended.PlaceMemo, item.placeName),
		})
	}

	rows, err := qtx.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.TripDayID),
	})
	if err != nil {
		return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return place.CreateGooglePlaceScheduleItemsBatchMutationResult{}, err
	}

	return place.CreateGooglePlaceScheduleItemsBatchMutationResult{CreatedItems: createdItems, ScheduleItems: mapScheduleItems(rows)}, nil
}

type appendedScheduleItemRow struct {
	ID         string
	ItemOrder  int
	Version    int
	StartTime  pgtype.Time
	EndTime    pgtype.Time
	PlaceTitle pgtype.Text
	PlaceMemo  pgtype.Text
	ArrivedAt  pgtype.Timestamptz
	SkippedAt  pgtype.Timestamptz
}

func createScheduleItemAtEnd(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string, placeID string, title string, memo *string, startTime *string, endTime *string) (appendedScheduleItemRow, error) {
	if err := lockSameDayScheduleOrdering(ctx, tx, tripID, tripDayID); err != nil {
		return appendedScheduleItemRow{}, err
	}

	current, err := loadOrderedScheduleRowsForUpdate(ctx, tx, tripID, tripDayID)
	if err != nil {
		return appendedScheduleItemRow{}, err
	}
	if needsRebalance, err := orderedScheduleRanksNeedRebalance(current); err != nil {
		return appendedScheduleItemRow{}, err
	} else if needsRebalance {
		current, err = rebalanceScheduleRanks(ctx, tx, tripID, tripDayID, current)
		if err != nil {
			return appendedScheduleItemRow{}, err
		}
	}

	nextRank, err := nextAppendScheduleRank(current)
	if errors.Is(err, errRebalanceScheduleRanks) {
		current, err = rebalanceScheduleRanks(ctx, tx, tripID, tripDayID, current)
		if err != nil {
			return appendedScheduleItemRow{}, err
		}
		nextRank, err = nextAppendScheduleRank(current)
	}
	if errors.Is(err, errRebalanceScheduleRanks) {
		return appendedScheduleItemRow{}, trip.ErrConflict
	}
	if err != nil {
		return appendedScheduleItemRow{}, err
	}

	var item appendedScheduleItemRow
	err = tx.QueryRow(ctx, `
		INSERT INTO schedule_items (
			trip_id,
			trip_day_id,
			trip_place_id,
			place_title,
			place_memo,
			start_time,
			end_time,
			item_order,
			rank
		) VALUES (
			$1::uuid,
			$2::uuid,
			$3::uuid,
			$4,
			$5,
			$6::time,
			$7::time,
			(
				SELECT COALESCE(MAX(item_order), 0) + 1
				FROM schedule_items
				WHERE trip_day_id = $2::uuid
				  AND deleted_at IS NULL
			),
			$8
		)
		RETURNING id::text, item_order, version, start_time, end_time, place_title, place_memo, arrived_at, skipped_at
	`, mustUUID(tripID), mustUUID(tripDayID), mustUUID(placeID), title, textPtrToSQL(memo), timeTextPtrToSQL(startTime), timeTextPtrToSQL(endTime), nextRank).Scan(&item.ID, &item.ItemOrder, &item.Version, &item.StartTime, &item.EndTime, &item.PlaceTitle, &item.PlaceMemo, &item.ArrivedAt, &item.SkippedAt)
	if err != nil {
		if isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return appendedScheduleItemRow{}, trip.ErrConflict
		}
		return appendedScheduleItemRow{}, err
	}
	return item, nil
}

func (s *Store) ReorderScheduleItems(ctx context.Context, record trip.ReorderScheduleItemsRecord) ([]trip.ScheduleItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockSameDayScheduleOrdering(ctx, tx, record.TripID, record.TripDayID); err != nil {
		return nil, err
	}

	current, err := loadOrderedScheduleRowsForUpdate(ctx, tx, record.TripID, record.TripDayID)
	if err != nil {
		return nil, err
	}
	if err := validateReorderScheduleItemTimeUpdateExpectations(current, record.TimeUpdates); err != nil {
		return nil, err
	}

	for _, move := range record.Moves {
		current, err = applyReorderMove(ctx, tx, record.TripID, record.TripDayID, current, move)
		if err != nil {
			return nil, err
		}
	}
	for _, update := range record.TimeUpdates {
		if err := updateScheduleItemTimesInReorder(ctx, tx, record.TripID, record.TripDayID, update); err != nil {
			return nil, err
		}
	}

	qtx := s.queries.WithTx(tx)
	rows, err := qtx.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.TripDayID),
	})
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return mapScheduleItems(rows), nil
}

func (s *Store) MoveScheduleItemToDay(ctx context.Context, record trip.MoveScheduleItemToDayRecord) (trip.MoveScheduleItemToDayMutationResult, error) {
	if record.SourceTripDayID == record.TargetTripDayID {
		return trip.MoveScheduleItemToDayMutationResult{}, trip.ErrValidation
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockTwoDayScheduleOrdering(ctx, tx, record.TripID, record.SourceTripDayID, record.TargetTripDayID); err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	sourceRows, err := loadOrderedScheduleRowsForUpdate(ctx, tx, record.TripID, record.SourceTripDayID)
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	targetRows, err := loadOrderedScheduleRowsForUpdate(ctx, tx, record.TripID, record.TargetTripDayID)
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	sourceIndex := indexOrderedScheduleItem(sourceRows, record.ScheduleItemID)
	if sourceIndex < 0 || sourceRows[sourceIndex].Version != record.ClientVersion {
		return trip.MoveScheduleItemToDayMutationResult{}, trip.ErrConflict
	}

	needsRebalance, err := orderedScheduleRanksNeedRebalance(targetRows)
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	if needsRebalance {
		targetRows, err = rebalanceScheduleRanks(ctx, tx, record.TripID, record.TargetTripDayID, targetRows)
		if err != nil {
			return trip.MoveScheduleItemToDayMutationResult{}, err
		}
	}

	appendRank, err := nextAppendScheduleRank(targetRows)
	if errors.Is(err, errRebalanceScheduleRanks) {
		return trip.MoveScheduleItemToDayMutationResult{}, trip.ErrConflict
	}
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	moved, err := moveScheduleItemAndAnchoredExpenses(ctx, tx, record, appendRank)
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	if !moved {
		return trip.MoveScheduleItemToDayMutationResult{}, trip.ErrConflict
	}

	if err := renumberScheduleItemOrders(ctx, tx, record.TripID, record.SourceTripDayID); err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	if err := renumberScheduleItemOrders(ctx, tx, record.TripID, record.TargetTripDayID); err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	qtx := s.queries.WithTx(tx)
	sourceItems, err := qtx.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.SourceTripDayID),
	})
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}
	targetItems, err := qtx.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(record.TripID),
		TripDayID: mustUUID(record.TargetTripDayID),
	})
	if err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	mappedTargetItems := mapScheduleItems(targetItems)
	movedIndex := indexScheduleItem(mappedTargetItems, record.ScheduleItemID)
	if movedIndex < 0 {
		return trip.MoveScheduleItemToDayMutationResult{}, trip.ErrConflict
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.MoveScheduleItemToDayMutationResult{}, err
	}

	return trip.MoveScheduleItemToDayMutationResult{
		MovedItem:   mappedTargetItems[movedIndex],
		SourceItems: mapScheduleItems(sourceItems),
		TargetItems: mappedTargetItems,
	}, nil
}

func (s *Store) MarkScheduleItemArrived(ctx context.Context, record trip.MarkScheduleItemArrivedRecord) (trip.MarkScheduleItemArrivedMutationResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.MarkScheduleItemArrivedMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := loadExecutionScheduleRowsForUpdate(ctx, tx, record.TripID, record.TripDayID)
	if err != nil {
		return trip.MarkScheduleItemArrivedMutationResult{}, err
	}

	targetIndex := indexExecutionScheduleItem(current, record.ItemID)
	if targetIndex < 0 {
		return trip.MarkScheduleItemArrivedMutationResult{}, trip.ErrNotFound
	}
	if current[targetIndex].SkippedAt.Valid {
		return trip.MarkScheduleItemArrivedMutationResult{}, trip.ErrConflict
	}

	if !current[targetIndex].ArrivedAt.Valid {
		firstPendingIndex := firstPendingExecutionScheduleItem(current)
		if firstPendingIndex < 0 || current[firstPendingIndex].ID != record.ItemID {
			return trip.MarkScheduleItemArrivedMutationResult{}, trip.ErrConflict
		}

		commandTag, err := tx.Exec(ctx, `
			UPDATE schedule_items
			SET arrived_at = now(), updated_at = now()
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $3::uuid
			  AND arrived_at IS NULL
			  AND skipped_at IS NULL
		`, mustUUID(record.TripID), mustUUID(record.TripDayID), mustUUID(record.ItemID))
		if err != nil {
			return trip.MarkScheduleItemArrivedMutationResult{}, err
		}
		if commandTag.RowsAffected() != 1 {
			return trip.MarkScheduleItemArrivedMutationResult{}, trip.ErrConflict
		}
	}

	targetItem, items, err := s.latestDayScheduleMutationSnapshot(ctx, tx, record.TripID, record.TripDayID, record.ItemID)
	if err != nil {
		return trip.MarkScheduleItemArrivedMutationResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.MarkScheduleItemArrivedMutationResult{}, err
	}

	return trip.MarkScheduleItemArrivedMutationResult{Item: targetItem, Items: items}, nil
}

func (s *Store) MarkScheduleItemSkipped(ctx context.Context, record trip.MarkScheduleItemSkippedRecord) (trip.MarkScheduleItemSkippedMutationResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.MarkScheduleItemSkippedMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := loadExecutionScheduleRowsForUpdate(ctx, tx, record.TripID, record.TripDayID)
	if err != nil {
		return trip.MarkScheduleItemSkippedMutationResult{}, err
	}

	targetIndex := indexExecutionScheduleItem(current, record.ItemID)
	if targetIndex < 0 {
		return trip.MarkScheduleItemSkippedMutationResult{}, trip.ErrNotFound
	}
	if current[targetIndex].ArrivedAt.Valid {
		return trip.MarkScheduleItemSkippedMutationResult{}, trip.ErrConflict
	}

	if !current[targetIndex].SkippedAt.Valid {
		firstPendingIndex := firstPendingExecutionScheduleItem(current)
		if firstPendingIndex < 0 || current[firstPendingIndex].ID != record.ItemID {
			return trip.MarkScheduleItemSkippedMutationResult{}, trip.ErrConflict
		}

		commandTag, err := tx.Exec(ctx, `
			UPDATE schedule_items
			SET skipped_at = now(), updated_at = now()
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $3::uuid
			  AND arrived_at IS NULL
			  AND skipped_at IS NULL
		`, mustUUID(record.TripID), mustUUID(record.TripDayID), mustUUID(record.ItemID))
		if err != nil {
			return trip.MarkScheduleItemSkippedMutationResult{}, err
		}
		if commandTag.RowsAffected() != 1 {
			return trip.MarkScheduleItemSkippedMutationResult{}, trip.ErrConflict
		}
	}

	targetItem, items, err := s.latestDayScheduleMutationSnapshot(ctx, tx, record.TripID, record.TripDayID, record.ItemID)
	if err != nil {
		return trip.MarkScheduleItemSkippedMutationResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.MarkScheduleItemSkippedMutationResult{}, err
	}

	return trip.MarkScheduleItemSkippedMutationResult{Item: targetItem, Items: items}, nil
}

func (s *Store) RestoreScheduleItem(ctx context.Context, record trip.RestoreScheduleItemRecord) (trip.RestoreScheduleItemMutationResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.RestoreScheduleItemMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := loadExecutionScheduleRowsForUpdate(ctx, tx, record.TripID, record.TripDayID)
	if err != nil {
		return trip.RestoreScheduleItemMutationResult{}, err
	}

	targetIndex := indexExecutionScheduleItem(current, record.ItemID)
	if targetIndex < 0 {
		return trip.RestoreScheduleItemMutationResult{}, trip.ErrNotFound
	}
	if current[targetIndex].ArrivedAt.Valid {
		return trip.RestoreScheduleItemMutationResult{}, trip.ErrConflict
	}

	if current[targetIndex].SkippedAt.Valid {
		commandTag, err := tx.Exec(ctx, `
			UPDATE schedule_items
			SET skipped_at = NULL, updated_at = now()
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $3::uuid
			  AND arrived_at IS NULL
			  AND skipped_at IS NOT NULL
		`, mustUUID(record.TripID), mustUUID(record.TripDayID), mustUUID(record.ItemID))
		if err != nil {
			return trip.RestoreScheduleItemMutationResult{}, err
		}
		if commandTag.RowsAffected() != 1 {
			return trip.RestoreScheduleItemMutationResult{}, trip.ErrConflict
		}
	}

	targetItem, items, err := s.latestDayScheduleMutationSnapshot(ctx, tx, record.TripID, record.TripDayID, record.ItemID)
	if err != nil {
		return trip.RestoreScheduleItemMutationResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.RestoreScheduleItemMutationResult{}, err
	}

	return trip.RestoreScheduleItemMutationResult{Item: targetItem, Items: items}, nil
}

func (s *Store) latestDayScheduleMutationSnapshot(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string, itemID string) (trip.ScheduleItem, []trip.ScheduleItem, error) {
	qtx := s.queries.WithTx(tx)
	rows, err := qtx.ListScheduleItemsByTripDay(ctx, db.ListScheduleItemsByTripDayParams{
		TripID:    mustUUID(tripID),
		TripDayID: mustUUID(tripDayID),
	})
	if err != nil {
		return trip.ScheduleItem{}, nil, err
	}
	items := mapScheduleItems(rows)
	targetItem, ok := findScheduleItem(items, itemID)
	if !ok {
		return trip.ScheduleItem{}, nil, trip.ErrNotFound
	}
	return targetItem, items, nil
}

func (s *Store) UpdateScheduleItemPlace(ctx context.Context, record trip.UpdateScheduleItemRecord) (trip.ScheduleItem, error) {
	row, err := s.queries.UpdateTripPlaceSnapshotByScheduleItem(ctx, db.UpdateTripPlaceSnapshotByScheduleItemParams{
		TripID:         mustUUID(record.TripID),
		TripDayID:      mustUUID(record.TripDayID),
		ScheduleItemID: mustUUID(record.ItemID),
		StartTime:      timeTextPtrToSQL(record.StartTime),
		EndTime:        timeTextPtrToSQL(record.EndTime),
		PlaceMemo:      textPtrToSQL(record.Memo),
		Name:           record.Name,
		Address:        record.Address,
		PlaceType:      record.PlaceType,
	})
	if err == pgx.ErrNoRows {
		return trip.ScheduleItem{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.ScheduleItem{}, err
	}
	return trip.ScheduleItem{
		ID:            row.ID,
		ItemOrder:     int(row.ItemOrder),
		Version:       int(row.Version),
		ItemType:      trip.ScheduleItemTypePlace,
		IsLodging:     boolFromSQL(row.IsLodging),
		StartTime:     timeTextPtrFromSQL(row.StartTime),
		EndTime:       timeTextPtrFromSQL(row.EndTime),
		ArrivedAt:     timePtrFromTimestamptz(row.ArrivedAt),
		SkippedAt:     timePtrFromTimestamptz(row.SkippedAt),
		Place:         tripPlaceSummary(row.TripPlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude),
		PlaceSchedule: placeScheduleItemDetails(row.PlaceTitle, row.PlaceMemo, row.PlaceName),
	}, nil
}

func (s *Store) DeleteScheduleItem(ctx context.Context, tripID string, tripDayID string, itemID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockSameDayScheduleOrdering(ctx, tx, tripID, tripDayID); err != nil {
		return false, err
	}

	qtx := s.queries.WithTx(tx)
	_, err = qtx.SoftDeleteScheduleItemByTripDayAndID(ctx, db.SoftDeleteScheduleItemByTripDayAndIDParams{
		TripID:         mustUUID(tripID),
		TripDayID:      mustUUID(tripDayID),
		ScheduleItemID: mustUUID(itemID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

type orderedScheduleRow struct {
	ID        string
	Rank      string
	Version   int
	StartTime pgtype.Time
	EndTime   pgtype.Time
}

type executionScheduleRow struct {
	ID        string
	ArrivedAt pgtype.Timestamptz
	SkippedAt pgtype.Timestamptz
}

func loadExecutionScheduleRowsForUpdate(ctx context.Context, tx pgx.Tx, tripID string, date string) ([]executionScheduleRow, error) {
	rows, err := tx.Query(ctx, `
		SELECT id::text, arrived_at, skipped_at
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND deleted_at IS NULL
		ORDER BY rank ASC, id ASC
		FOR UPDATE
	`, mustUUID(tripID), mustUUID(date))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ordered := make([]executionScheduleRow, 0)
	for rows.Next() {
		var item executionScheduleRow
		if err := rows.Scan(&item.ID, &item.ArrivedAt, &item.SkippedAt); err != nil {
			return nil, err
		}
		ordered = append(ordered, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ordered, nil
}

func loadOrderedScheduleRowsForUpdate(ctx context.Context, tx pgx.Tx, tripID string, date string) ([]orderedScheduleRow, error) {
	rows, err := tx.Query(ctx, `
		SELECT id::text, rank, version, start_time, end_time
		FROM schedule_items
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND deleted_at IS NULL
		ORDER BY rank ASC, id ASC
		FOR UPDATE
	`, mustUUID(tripID), mustUUID(date))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ordered := make([]orderedScheduleRow, 0)
	for rows.Next() {
		var item orderedScheduleRow
		if err := rows.Scan(&item.ID, &item.Rank, &item.Version, &item.StartTime, &item.EndTime); err != nil {
			return nil, err
		}
		ordered = append(ordered, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ordered, nil
}

func validateReorderScheduleItemTimeUpdateExpectations(current []orderedScheduleRow, updates []trip.ReorderScheduleItemTimeUpdateRecord) error {
	if len(updates) == 0 {
		return nil
	}
	for _, update := range updates {
		index := indexOrderedScheduleItem(current, update.ItemID)
		if index < 0 {
			return trip.ErrConflict
		}
		row := current[index]
		if !timeTextPtrEqualsSQL(row.StartTime, update.ExpectedStartTime) || !timeTextPtrEqualsSQL(row.EndTime, update.ExpectedEndTime) {
			return trip.ErrConflict
		}
	}
	return nil
}

func updateScheduleItemTimesInReorder(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string, update trip.ReorderScheduleItemTimeUpdateRecord) error {
	commandTag, err := tx.Exec(ctx, `
		UPDATE schedule_items
		SET start_time = $4::time,
		    end_time = $5::time,
		    updated_at = now()
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND id = $3::uuid
		  AND deleted_at IS NULL
	`, mustUUID(tripID), mustUUID(tripDayID), mustUUID(update.ItemID), timeTextPtrToSQL(update.StartTime), timeTextPtrToSQL(update.EndTime))
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() != 1 {
		return trip.ErrConflict
	}
	return nil
}

func timeTextPtrEqualsSQL(current pgtype.Time, expected *string) bool {
	currentText := timeTextPtrFromSQL(current)
	if currentText == nil || expected == nil {
		return currentText == nil && expected == nil
	}
	return *currentText == *expected
}

type reorderMovePlan struct {
	moved       orderedScheduleRow
	remaining   []orderedScheduleRow
	insertIndex int
	target      []orderedScheduleRow
}

func lockSameDayScheduleOrdering(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`, "schedule_items:"+tripID+":"+tripDayID)
	return err
}

func lockTwoDayScheduleOrdering(ctx context.Context, tx pgx.Tx, tripID string, firstTripDayID string, secondTripDayID string) error {
	left := firstTripDayID
	right := secondTripDayID
	if right < left {
		left, right = right, left
	}
	if err := lockSameDayScheduleOrdering(ctx, tx, tripID, left); err != nil {
		return err
	}
	return lockSameDayScheduleOrdering(ctx, tx, tripID, right)
}

func moveScheduleItemAndAnchoredExpenses(ctx context.Context, tx pgx.Tx, record trip.MoveScheduleItemToDayRecord, appendRank string) (bool, error) {
	var movedCount int
	err := tx.QueryRow(ctx, `
		WITH moved AS (
			UPDATE schedule_items
			SET trip_day_id = $3::uuid,
			    item_order = (
			      SELECT COALESCE(MAX(item_order), 0) + 1
			      FROM schedule_items
			      WHERE trip_day_id = $3::uuid
			        AND deleted_at IS NULL
			    ),
			    rank = $5,
			    version = version + 1,
			    arrived_at = NULL,
			    skipped_at = NULL,
			    updated_at = now()
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $4::uuid
			  AND version = $6
			  AND deleted_at IS NULL
			RETURNING id, trip_id
		), updated_expenses AS (
			UPDATE expenses e
			SET trip_day_id = $3::uuid,
			    updated_at = now()
			FROM moved m
			WHERE e.trip_id = m.trip_id
			  AND e.schedule_item_id = m.id
			  AND e.anchor_type = 'schedule_item'
			RETURNING e.id
		)
		SELECT count(*)::int FROM moved
	`, mustUUID(record.TripID), mustUUID(record.SourceTripDayID), mustUUID(record.TargetTripDayID), mustUUID(record.ScheduleItemID), appendRank, record.ClientVersion).Scan(&movedCount)
	if err != nil {
		if isUniqueConstraintViolation(err, "schedule_items_active_day_order_unique") || isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return false, trip.ErrConflict
		}
		return false, err
	}
	return movedCount == 1, nil
}

func renumberScheduleItemOrders(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string) error {
	if _, err := tx.Exec(ctx, `
		WITH ordered AS (
			SELECT id, row_number() OVER (ORDER BY rank ASC, id ASC)::integer AS next_order
			FROM schedule_items
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND deleted_at IS NULL
		)
		UPDATE schedule_items si
		SET item_order = ordered.next_order + 10000
		FROM ordered
		WHERE si.id = ordered.id
	`, mustUUID(tripID), mustUUID(tripDayID)); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		WITH ordered AS (
			SELECT id, row_number() OVER (ORDER BY rank ASC, id ASC)::integer AS next_order
			FROM schedule_items
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND deleted_at IS NULL
		)
		UPDATE schedule_items si
		SET item_order = ordered.next_order
		FROM ordered
		WHERE si.id = ordered.id
	`, mustUUID(tripID), mustUUID(tripDayID))
	return err
}

func applyReorderMove(ctx context.Context, tx pgx.Tx, tripID string, date string, current []orderedScheduleRow, move trip.ReorderDayScheduleMoveRecord) ([]orderedScheduleRow, error) {
	ordered := current
	retriedRankCollision := false
	rebalanced := false
	for {
		next, err := applyReorderMoveOnce(ctx, tx, tripID, date, ordered, move)
		if err == nil {
			return next, nil
		}

		if errors.Is(err, errRetryReorderRankCollision) && !retriedRankCollision {
			retriedRankCollision = true
			ordered, err = loadOrderedScheduleRowsForUpdate(ctx, tx, tripID, date)
			if err != nil {
				return nil, err
			}
			continue
		}

		if errors.Is(err, errRebalanceScheduleRanks) && !rebalanced {
			plan, planErr := planReorderMove(ordered, move)
			if planErr != nil {
				return nil, planErr
			}
			ordered, err = rebalanceScheduleRanks(ctx, tx, tripID, date, plan.target)
			if err != nil {
				return nil, err
			}
			rebalanced = true
			continue
		}

		if errors.Is(err, errRetryReorderRankCollision) || errors.Is(err, errRebalanceScheduleRanks) {
			return nil, trip.ErrConflict
		}
		return nil, err
	}
}

func applyReorderMoveOnce(ctx context.Context, tx pgx.Tx, tripID string, date string, current []orderedScheduleRow, move trip.ReorderDayScheduleMoveRecord) ([]orderedScheduleRow, error) {
	plan, err := planReorderMove(current, move)
	if err != nil {
		return nil, err
	}

	needsRebalance, err := orderedScheduleRanksNeedRebalance(current)
	if err != nil {
		return nil, err
	}
	if needsRebalance {
		return nil, errRebalanceScheduleRanks
	}

	newRank, err := reorderedRank(plan.remaining, plan.insertIndex)
	if err != nil {
		return nil, err
	}

	commandTag, err := execReorderRankUpdate(ctx, tx, tripID, date, move.ItemID, newRank, move.ClientVersion)
	if err != nil {
		if isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
			return nil, errRetryReorderRankCollision
		}
		return nil, err
	}
	if commandTag.RowsAffected() != 1 {
		return nil, trip.ErrConflict
	}

	moved := plan.moved
	moved.Rank = newRank
	moved.Version++
	next := append([]orderedScheduleRow{}, plan.remaining[:plan.insertIndex]...)
	next = append(next, moved)
	next = append(next, plan.remaining[plan.insertIndex:]...)
	return next, nil
}

func planReorderMove(current []orderedScheduleRow, move trip.ReorderDayScheduleMoveRecord) (reorderMovePlan, error) {
	movedIndex := indexOrderedScheduleItem(current, move.ItemID)
	if movedIndex < 0 {
		return reorderMovePlan{}, trip.ErrConflict
	}
	if current[movedIndex].Version != move.ClientVersion {
		return reorderMovePlan{}, trip.ErrConflict
	}

	moved := current[movedIndex]
	remaining := append(append([]orderedScheduleRow{}, current[:movedIndex]...), current[movedIndex+1:]...)
	insertIndex, err := reorderInsertIndex(remaining, move)
	if err != nil {
		return reorderMovePlan{}, err
	}
	target := append([]orderedScheduleRow{}, remaining[:insertIndex]...)
	target = append(target, moved)
	target = append(target, remaining[insertIndex:]...)
	return reorderMovePlan{moved: moved, remaining: remaining, insertIndex: insertIndex, target: target}, nil
}

func execReorderRankUpdate(ctx context.Context, tx pgx.Tx, tripID string, date string, itemID string, newRank string, clientVersion int) (pgconn.CommandTag, error) {
	if _, err := tx.Exec(ctx, `SAVEPOINT reorder_rank_update`); err != nil {
		return pgconn.CommandTag{}, err
	}

	commandTag, err := tx.Exec(ctx, `
		UPDATE schedule_items
		SET rank = $4, version = version + 1
		WHERE trip_id = $1::uuid
		  AND trip_day_id = $2::uuid
		  AND id = $3::uuid
		  AND version = $5
		  AND deleted_at IS NULL
	`, mustUUID(tripID), mustUUID(date), mustUUID(itemID), newRank, clientVersion)
	if err != nil {
		if rollbackErr := rollbackReorderRankUpdateSavepoint(ctx, tx); rollbackErr != nil {
			return commandTag, rollbackErr
		}
		return commandTag, err
	}

	if _, err := tx.Exec(ctx, `RELEASE SAVEPOINT reorder_rank_update`); err != nil {
		return commandTag, err
	}
	return commandTag, nil
}

func rollbackReorderRankUpdateSavepoint(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `ROLLBACK TO SAVEPOINT reorder_rank_update`); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `RELEASE SAVEPOINT reorder_rank_update`)
	return err
}

func reorderInsertIndex(remaining []orderedScheduleRow, move trip.ReorderDayScheduleMoveRecord) (int, error) {
	if move.BeforeItemID == nil && move.AfterItemID == nil {
		return 0, trip.ErrConflict
	}
	if move.BeforeItemID == nil {
		if len(remaining) == 0 || remaining[0].ID != *move.AfterItemID {
			return 0, trip.ErrConflict
		}
		return 0, nil
	}
	if move.AfterItemID == nil {
		if len(remaining) == 0 || remaining[len(remaining)-1].ID != *move.BeforeItemID {
			return 0, trip.ErrConflict
		}
		return len(remaining), nil
	}

	beforeIndex := indexOrderedScheduleItem(remaining, *move.BeforeItemID)
	if beforeIndex < 0 || beforeIndex+1 >= len(remaining) || remaining[beforeIndex+1].ID != *move.AfterItemID {
		return 0, trip.ErrConflict
	}
	return beforeIndex + 1, nil
}

func reorderedRank(remaining []orderedScheduleRow, insertIndex int) (string, error) {
	var previousRank *string
	if insertIndex > 0 {
		previousRank = &remaining[insertIndex-1].Rank
	}
	var nextRank *string
	if insertIndex < len(remaining) {
		nextRank = &remaining[insertIndex].Rank
	}
	return rankBetween(previousRank, nextRank)
}

func nextAppendScheduleRank(current []orderedScheduleRow) (string, error) {
	if len(current) == 0 {
		return rankForPosition(1)
	}
	previousValue, err := parsePositiveDecimalRank(current[len(current)-1].Rank)
	if err != nil {
		return "", err
	}
	return formatRankWithinLimit(new(big.Int).Add(previousValue, big.NewInt(scheduleRankStep)))
}

func orderedScheduleRanksNeedRebalance(items []orderedScheduleRow) (bool, error) {
	for _, item := range items {
		if _, err := parsePositiveDecimalRank(item.Rank); err != nil {
			return false, err
		}
		if len(item.Rank) > scheduleRankWidth {
			return true, nil
		}
	}
	return false, nil
}

func rebalanceScheduleRanks(ctx context.Context, tx pgx.Tx, tripID string, tripDayID string, ordered []orderedScheduleRow) ([]orderedScheduleRow, error) {
	finalRanks := make([]string, len(ordered))
	for index := range ordered {
		rank, err := rankForPosition(index + 1)
		if errors.Is(err, errRebalanceScheduleRanks) {
			return nil, trip.ErrConflict
		}
		if err != nil {
			return nil, err
		}
		finalRanks[index] = rank
	}

	for index, item := range ordered {
		temporaryRank := fmt.Sprintf("rebalance:%04d:%s", index, item.ID)
		commandTag, err := tx.Exec(ctx, `
			UPDATE schedule_items
			SET rank = $4
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $3::uuid
			  AND deleted_at IS NULL
		`, mustUUID(tripID), mustUUID(tripDayID), mustUUID(item.ID), temporaryRank)
		if err != nil {
			if isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
				return nil, trip.ErrConflict
			}
			return nil, err
		}
		if commandTag.RowsAffected() != 1 {
			return nil, trip.ErrConflict
		}
	}

	rebalanced := make([]orderedScheduleRow, len(ordered))
	for index, item := range ordered {
		commandTag, err := tx.Exec(ctx, `
			UPDATE schedule_items
			SET rank = $4
			WHERE trip_id = $1::uuid
			  AND trip_day_id = $2::uuid
			  AND id = $3::uuid
			  AND deleted_at IS NULL
		`, mustUUID(tripID), mustUUID(tripDayID), mustUUID(item.ID), finalRanks[index])
		if err != nil {
			if isUniqueConstraintViolation(err, "schedule_items_active_day_rank_unique") {
				return nil, trip.ErrConflict
			}
			return nil, err
		}
		if commandTag.RowsAffected() != 1 {
			return nil, trip.ErrConflict
		}
		rebalanced[index] = item
		rebalanced[index].Rank = finalRanks[index]
	}
	return rebalanced, nil
}

func rankBetween(previousRank *string, nextRank *string) (string, error) {
	if previousRank == nil && nextRank == nil {
		return "", trip.ErrConflict
	}
	if previousRank == nil {
		nextValue, err := parsePositiveDecimalRank(*nextRank)
		if err != nil {
			return "", fmt.Errorf("parse next rank %q: %w", *nextRank, err)
		}
		candidate := new(big.Int).Div(nextValue, big.NewInt(2))
		if candidate.Sign() <= 0 || candidate.Cmp(nextValue) >= 0 {
			return "", errRebalanceScheduleRanks
		}
		return formatRankWithinLimit(candidate)
	}

	previousValue, err := parsePositiveDecimalRank(*previousRank)
	if err != nil {
		return "", fmt.Errorf("parse previous rank %q: %w", *previousRank, err)
	}
	if nextRank == nil {
		return formatRankWithinLimit(new(big.Int).Add(previousValue, big.NewInt(scheduleRankStep)))
	}

	nextValue, err := parsePositiveDecimalRank(*nextRank)
	if err != nil {
		return "", fmt.Errorf("parse next rank %q: %w", *nextRank, err)
	}
	gap := new(big.Int).Sub(nextValue, previousValue)
	if gap.Cmp(big.NewInt(1)) <= 0 {
		return "", errRebalanceScheduleRanks
	}
	return formatRankWithinLimit(new(big.Int).Add(previousValue, new(big.Int).Div(gap, big.NewInt(2))))
}

func rankForPosition(position int) (string, error) {
	if position <= 0 {
		return "", trip.ErrConflict
	}
	return formatRankWithinLimit(new(big.Int).Mul(big.NewInt(int64(position)), big.NewInt(scheduleRankStep)))
}

func parsePositiveDecimalRank(rank string) (*big.Int, error) {
	value, ok := new(big.Int).SetString(rank, 10)
	if !ok || value.Sign() <= 0 {
		return nil, fmt.Errorf("invalid positive decimal rank")
	}
	return value, nil
}

func formatRankWithinLimit(value *big.Int) (string, error) {
	if value.Sign() <= 0 {
		return "", errRebalanceScheduleRanks
	}
	formatted := formatRank(value)
	if len(formatted) > scheduleRankWidth {
		return "", errRebalanceScheduleRanks
	}
	return formatted, nil
}

func formatRank(value *big.Int) string {
	raw := value.String()
	if len(raw) >= scheduleRankWidth {
		return raw
	}
	return strings.Repeat("0", scheduleRankWidth-len(raw)) + raw
}

func indexScheduleItem(items []trip.ScheduleItem, itemID string) int {
	for index, item := range items {
		if item.ID == itemID {
			return index
		}
	}
	return -1
}

func indexOrderedScheduleItem(items []orderedScheduleRow, itemID string) int {
	for index, item := range items {
		if item.ID == itemID {
			return index
		}
	}
	return -1
}

func indexExecutionScheduleItem(items []executionScheduleRow, itemID string) int {
	for index, item := range items {
		if item.ID == itemID {
			return index
		}
	}
	return -1
}

func firstPendingExecutionScheduleItem(items []executionScheduleRow) int {
	for index, item := range items {
		if !item.ArrivedAt.Valid && !item.SkippedAt.Valid {
			return index
		}
	}
	return -1
}

func mapScheduleItems(rows []db.ListScheduleItemsByTripDayRow) []trip.ScheduleItem {
	items := make([]trip.ScheduleItem, 0, len(rows))
	for index, row := range rows {
		item := trip.ScheduleItem{
			ID:            row.ID,
			ItemOrder:     index + 1,
			Version:       int(row.Version),
			ItemType:      trip.ScheduleItemTypePlace,
			IsLodging:     boolFromSQL(row.IsLodging),
			StartTime:     timeTextPtrFromSQL(row.StartTime),
			EndTime:       timeTextPtrFromSQL(row.EndTime),
			ArrivedAt:     timePtrFromTimestamptz(row.ArrivedAt),
			SkippedAt:     timePtrFromTimestamptz(row.SkippedAt),
			Place:         tripPlaceSummaryFromNullable(row.TripPlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude),
			PlaceSchedule: placeScheduleItemDetails(row.PlaceTitle, row.PlaceMemo, row.PlaceName.String),
		}
		items = append(items, item)
	}
	return items
}

func scheduleItemFromGetRow(row db.GetScheduleItemByTripDayAndIDRow) trip.ScheduleItem {
	item := trip.ScheduleItem{
		ID:            row.ID,
		ItemOrder:     int(row.ItemOrder),
		Version:       int(row.Version),
		ItemType:      trip.ScheduleItemTypePlace,
		IsLodging:     boolFromSQL(row.IsLodging),
		StartTime:     timeTextPtrFromSQL(row.StartTime),
		EndTime:       timeTextPtrFromSQL(row.EndTime),
		ArrivedAt:     timePtrFromTimestamptz(row.ArrivedAt),
		SkippedAt:     timePtrFromTimestamptz(row.SkippedAt),
		Place:         tripPlaceSummaryFromNullable(row.TripPlaceID, row.PlaceName, row.PlaceType, row.Address, row.Provider, row.GooglePlaceID, row.Latitude, row.Longitude),
		PlaceSchedule: placeScheduleItemDetails(row.PlaceTitle, row.PlaceMemo, row.PlaceName.String),
	}
	return item
}

func tripPlaceBookmark(id string, tripID string, category string, createdAt pgtype.Timestamptz, updatedAt pgtype.Timestamptz, placeID string, placeName string, placeType string, address string, provider string, googlePlaceID pgtype.Text, latitude pgtype.Float8, longitude pgtype.Float8) place.TripPlaceBookmark {
	return place.TripPlaceBookmark{
		ID:        id,
		TripID:    tripID,
		Category:  category,
		CreatedAt: timeFromTimestamptz(createdAt),
		UpdatedAt: timeFromTimestamptz(updatedAt),
		Place:     tripPlaceSummary(placeID, placeName, placeType, address, provider, googlePlaceID, latitude, longitude),
	}
}

func lodgingPlaceFromActiveTripDay(id string, name pgtype.Text, placeType pgtype.Text, address pgtype.Text, provider pgtype.Text, googlePlaceID pgtype.Text, latitude pgtype.Float8, longitude pgtype.Float8) *trip.TripPlaceSummary {
	if id == "" || !name.Valid || !placeType.Valid || !address.Valid || !provider.Valid {
		return nil
	}
	place := tripPlaceSummary(id, name.String, placeType.String, address.String, provider.String, googlePlaceID, latitude, longitude)
	return &place
}

func tripPlaceSummary(id string, name string, placeType string, address string, provider string, googlePlaceID pgtype.Text, latitude pgtype.Float8, longitude pgtype.Float8) trip.TripPlaceSummary {
	return trip.TripPlaceSummary{
		ID:            id,
		Name:          name,
		PlaceType:     placeType,
		Address:       address,
		RoutablePlace: routablePlace(provider, googlePlaceID, latitude, longitude),
	}
}

func tripPlaceSummaryFromNullable(id string, name pgtype.Text, placeType pgtype.Text, address pgtype.Text, provider pgtype.Text, googlePlaceID pgtype.Text, latitude pgtype.Float8, longitude pgtype.Float8) trip.TripPlaceSummary {
	if id == "" || !name.Valid || !placeType.Valid || !address.Valid || !provider.Valid {
		return trip.TripPlaceSummary{}
	}
	return tripPlaceSummary(id, name.String, placeType.String, address.String, provider.String, googlePlaceID, latitude, longitude)
}

func placeScheduleItemDetails(title pgtype.Text, memo pgtype.Text, fallbackTitle string) *trip.PlaceScheduleItemDetails {
	resolvedTitle := fallbackTitle
	if title.Valid && title.String != "" {
		resolvedTitle = title.String
	}
	if resolvedTitle == "" {
		return nil
	}
	return &trip.PlaceScheduleItemDetails{Title: resolvedTitle, Memo: textPtrFromSQL(memo)}
}

func routablePlace(provider string, googlePlaceID pgtype.Text, latitude pgtype.Float8, longitude pgtype.Float8) *trip.RoutablePlace {
	if provider != "google" || !googlePlaceID.Valid || !latitude.Valid || !longitude.Valid {
		return nil
	}
	return &trip.RoutablePlace{
		Provider:      "google",
		GooglePlaceID: googlePlaceID.String,
		Latitude:      latitude.Float64,
		Longitude:     longitude.Float64,
	}
}

func findScheduleItem(items []trip.ScheduleItem, itemID string) (trip.ScheduleItem, bool) {
	for _, item := range items {
		if item.ID == itemID {
			return item, true
		}
	}
	return trip.ScheduleItem{}, false
}

func boolFromSQL(value interface{}) bool {
	result, _ := value.(bool)
	return result
}

func timeFromTimestamptz(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time.UTC()
}

func timePtrFromTimestamptz(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	timestamp := value.Time.UTC()
	return &timestamp
}

func timeTextPtrFromSQL(value pgtype.Time) *string {
	if !value.Valid {
		return nil
	}
	totalMinutes := value.Microseconds / int64(time.Minute/time.Microsecond)
	hours := totalMinutes / 60
	minutes := totalMinutes % 60
	text := fmt.Sprintf("%02d:%02d", hours, minutes)
	return &text
}

func textPtrFromSQL(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	text := value.String
	return &text
}

func textPtrToSQL(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func timeTextPtrToSQL(value *string) pgtype.Time {
	if value == nil {
		return pgtype.Time{}
	}
	parsed, err := time.Parse("15:04", *value)
	if err != nil {
		return pgtype.Time{}
	}
	microseconds := int64(parsed.Hour())*int64(time.Hour/time.Microsecond) + int64(parsed.Minute())*int64(time.Minute/time.Microsecond)
	return pgtype.Time{Microseconds: microseconds, Valid: true}
}

type expenseReceiptObjectJSON struct {
	Role        string    `json:"role"`
	Bucket      string    `json:"bucket"`
	ObjectKey   string    `json:"objectKey"`
	Generation  string    `json:"generation"`
	ContentType string    `json:"contentType"`
	ByteSize    int       `json:"byteSize"`
	UploadedAt  time.Time `json:"uploadedAt"`
}

func marshalExpenseReceiptObjects(objects []trip.ExpenseReceiptObject) ([]byte, string, int32, int32, pgtype.Timestamptz, error) {
	if len(objects) == 0 || len(objects) > 2 {
		return nil, "", 0, 0, pgtype.Timestamptz{}, trip.ErrValidation
	}
	jsonObjects := make([]expenseReceiptObjectJSON, 0, len(objects))
	totalBytes := 0
	for _, object := range objects {
		jsonObjects = append(jsonObjects, expenseReceiptObjectJSON{
			Role:        strings.TrimSpace(string(object.Role)),
			Bucket:      strings.TrimSpace(object.Bucket),
			ObjectKey:   strings.TrimSpace(object.ObjectKey),
			Generation:  strings.TrimSpace(object.Generation),
			ContentType: strings.TrimSpace(object.ContentType),
			ByteSize:    object.ByteSize,
			UploadedAt:  object.UploadedAt.UTC(),
		})
		totalBytes += object.ByteSize
	}
	data, err := json.Marshal(jsonObjects)
	if err != nil {
		return nil, "", 0, 0, pgtype.Timestamptz{}, err
	}
	return data, strings.TrimSpace(objects[0].ContentType), int32(len(objects)), int32(totalBytes), timestamptzValue(objects[0].UploadedAt), nil
}

func unmarshalExpenseReceiptObjects(data []byte) ([]trip.ExpenseReceiptObject, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var jsonObjects []expenseReceiptObjectJSON
	if err := json.Unmarshal(data, &jsonObjects); err != nil {
		return nil, err
	}
	objects := make([]trip.ExpenseReceiptObject, 0, len(jsonObjects))
	for _, object := range jsonObjects {
		objects = append(objects, trip.ExpenseReceiptObject{
			Role:        trip.ReceiptImageRole(object.Role),
			Bucket:      object.Bucket,
			ObjectKey:   object.ObjectKey,
			Generation:  object.Generation,
			ContentType: object.ContentType,
			ByteSize:    object.ByteSize,
			UploadedAt:  object.UploadedAt,
		})
	}
	return objects, nil
}

func attachExpenseReceiptDraft(ctx context.Context, queries *db.Queries, tripID string, userID string, expenseID string, receiptDraftID string) (trip.ExpenseReceiptSummary, error) {
	draft, err := queries.GetExpenseReceiptDraftForUpdate(ctx, db.GetExpenseReceiptDraftForUpdateParams{ReceiptDraftID: mustUUID(receiptDraftID), TripID: mustUUID(tripID), CreatedByUserID: mustUUID(userID)})
	if errors.Is(err, pgx.ErrNoRows) {
		return trip.ExpenseReceiptSummary{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.ExpenseReceiptSummary{}, err
	}
	if draft.Status != "draft" || !timeFromTimestamptz(draft.ExpiresAt).After(time.Now().UTC()) {
		return trip.ExpenseReceiptSummary{}, trip.ErrNotFound
	}
	row, err := queries.UpsertExpenseReceipt(ctx, db.UpsertExpenseReceiptParams{
		ExpenseID:        mustUUID(expenseID),
		TripID:           mustUUID(tripID),
		UploadedByUserID: mustUUID(userID),
		ObjectsJson:      draft.ObjectsJson,
		ImageCount:       draft.ImageCount,
		ContentType:      draft.ContentType,
		ByteSize:         draft.ByteSize,
		UploadedAt:       draft.UploadedAt,
	})
	if err != nil {
		return trip.ExpenseReceiptSummary{}, err
	}
	if err := queries.MarkExpenseReceiptDraftUsed(ctx, db.MarkExpenseReceiptDraftUsedParams{ExpenseID: mustUUID(expenseID), ReceiptDraftID: mustUUID(receiptDraftID), TripID: mustUUID(tripID), CreatedByUserID: mustUUID(userID)}); err != nil {
		return trip.ExpenseReceiptSummary{}, err
	}
	return receiptSummary(row.Exists, row.ContentType, row.ByteSize, row.UploadedAt), nil
}

func (s *Store) CreateExpenseReceiptDraft(ctx context.Context, record trip.CreateExpenseReceiptDraftRecord) (trip.CreateExpenseReceiptDraftResult, error) {
	extractionJSON, err := json.Marshal(record.Extraction)
	if err != nil {
		return trip.CreateExpenseReceiptDraftResult{}, err
	}
	objectsJSON, contentType, imageCount, byteSize, uploadedAt, err := marshalExpenseReceiptObjects(record.Objects)
	if err != nil {
		return trip.CreateExpenseReceiptDraftResult{}, err
	}
	row, err := s.queries.InsertExpenseReceiptDraft(ctx, db.InsertExpenseReceiptDraftParams{
		TripID:          mustUUID(record.TripID),
		CreatedByUserID: mustUUID(record.CreatedByUserID),
		CaptureMode:     string(record.CaptureMode),
		ObjectsJson:     objectsJSON,
		ImageCount:      imageCount,
		ContentType:     contentType,
		ByteSize:        byteSize,
		UploadedAt:      uploadedAt,
		ExtractionJson:  extractionJSON,
		Confidence:      record.Extraction.Confidence,
		Warnings:        record.Extraction.Warnings,
		ExpiresAt:       timestamptzValue(record.ExpiresAt),
	})
	if err != nil {
		return trip.CreateExpenseReceiptDraftResult{}, err
	}
	return trip.CreateExpenseReceiptDraftResult{Draft: trip.ExpenseReceiptDraft{
		ID:          row.ID,
		TripID:      row.TripID,
		CaptureMode: trip.ReceiptCaptureMode(row.CaptureMode),
		ImageCount:  int(row.ImageCount),
		ContentType: row.ContentType,
		ByteSize:    int(row.ByteSize),
		Extraction:  record.Extraction,
		ExpiresAt:   timeFromTimestamptz(row.ExpiresAt),
		CreatedAt:   timeFromTimestamptz(row.CreatedAt),
	}}, nil
}

func (s *Store) CancelExpenseReceiptDraft(ctx context.Context, tripID string, userID string, receiptDraftID string) ([]trip.ExpenseReceiptObject, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)
	rows, err := qtx.CancelExpenseReceiptDraft(ctx, db.CancelExpenseReceiptDraftParams{
		ReceiptDraftID:  mustUUID(receiptDraftID),
		TripID:          mustUUID(tripID),
		CreatedByUserID: mustUUID(userID),
	})
	if err != nil {
		return nil, err
	}
	objects := make([]trip.ExpenseReceiptObject, 0, len(rows))
	for _, objectsJSON := range rows {
		draftObjects, err := unmarshalExpenseReceiptObjects(objectsJSON)
		if err != nil {
			return nil, err
		}
		for _, object := range draftObjects {
			if err := createExpenseReceiptStorageObjectDeletionJob(ctx, qtx, object, "receipt_draft_cancelled"); err != nil {
				return nil, err
			}
			objects = append(objects, object)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return objects, nil
}

func (s *Store) UpsertExpenseReceipt(ctx context.Context, record trip.UpsertExpenseReceiptRecord) (trip.UpsertExpenseReceiptResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.UpsertExpenseReceiptResult{}, err
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	oldObjects := []trip.ExpenseReceiptObject{}
	locked, err := qtx.LockExpenseReceiptForUpdate(ctx, db.LockExpenseReceiptForUpdateParams{TripID: mustUUID(record.TripID), ExpenseID: mustUUID(record.ExpenseID)})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return trip.UpsertExpenseReceiptResult{}, err
	}
	if err == nil {
		oldObjects, err = unmarshalExpenseReceiptObjects(locked.ObjectsJson)
		if err != nil {
			return trip.UpsertExpenseReceiptResult{}, err
		}
	}

	objects := []trip.ExpenseReceiptObject{record.Object}
	objectsJSON, contentType, imageCount, byteSize, uploadedAt, err := marshalExpenseReceiptObjects(objects)
	if err != nil {
		return trip.UpsertExpenseReceiptResult{}, err
	}
	row, err := qtx.UpsertExpenseReceipt(ctx, db.UpsertExpenseReceiptParams{
		ExpenseID:        mustUUID(record.ExpenseID),
		TripID:           mustUUID(record.TripID),
		UploadedByUserID: mustUUID(record.UploadedByUserID),
		ObjectsJson:      objectsJSON,
		ImageCount:       imageCount,
		ContentType:      contentType,
		ByteSize:         byteSize,
		UploadedAt:       uploadedAt,
	})
	if err != nil {
		if isForeignKeyViolation(err) {
			return trip.UpsertExpenseReceiptResult{}, trip.ErrNotFound
		}
		return trip.UpsertExpenseReceiptResult{}, err
	}
	for _, oldObject := range oldObjects {
		if err := createExpenseReceiptStorageObjectDeletionJob(ctx, qtx, oldObject, "receipt_replaced"); err != nil {
			return trip.UpsertExpenseReceiptResult{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return trip.UpsertExpenseReceiptResult{}, err
	}
	return trip.UpsertExpenseReceiptResult{Receipt: receiptSummary(row.Exists, row.ContentType, row.ByteSize, row.UploadedAt), OldObjects: oldObjects}, nil
}

func (s *Store) ClearExpenseReceipt(ctx context.Context, tripID string, expenseID string) ([]trip.ExpenseReceiptObject, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)
	rows, err := qtx.ClearExpenseReceipt(ctx, db.ClearExpenseReceiptParams{TripID: mustUUID(tripID), ExpenseID: mustUUID(expenseID)})
	if err != nil {
		return nil, err
	}
	objects := make([]trip.ExpenseReceiptObject, 0, len(rows))
	for _, objectsJSON := range rows {
		clearedObjects, err := unmarshalExpenseReceiptObjects(objectsJSON)
		if err != nil {
			return nil, err
		}
		for _, object := range clearedObjects {
			if err := createExpenseReceiptStorageObjectDeletionJob(ctx, qtx, object, "receipt_deleted"); err != nil {
				return nil, err
			}
			objects = append(objects, object)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return objects, nil
}

func (s *Store) GetExpenseReceiptObject(ctx context.Context, tripID string, expenseID string) (trip.ExpenseReceiptObject, error) {
	row, err := s.queries.GetExpenseReceiptObject(ctx, db.GetExpenseReceiptObjectParams{TripID: mustUUID(tripID), ExpenseID: mustUUID(expenseID)})
	if errors.Is(err, pgx.ErrNoRows) {
		return trip.ExpenseReceiptObject{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.ExpenseReceiptObject{}, err
	}
	objects, err := unmarshalExpenseReceiptObjects(row.ObjectsJson)
	if err != nil {
		return trip.ExpenseReceiptObject{}, err
	}
	if len(objects) == 0 {
		return trip.ExpenseReceiptObject{}, trip.ErrNotFound
	}
	object := objects[0]
	object.ContentType = row.ContentType
	object.ByteSize = int(row.ByteSize)
	object.UploadedAt = timeFromTimestamptz(row.UploadedAt)
	return object, nil
}

func createExpenseReceiptStorageObjectDeletionJob(ctx context.Context, queries *db.Queries, object trip.ExpenseReceiptObject, reason string) error {
	_, err := queries.CreateStorageObjectDeletionJob(ctx, db.CreateStorageObjectDeletionJobParams{Bucket: object.Bucket, ObjectKey: object.ObjectKey, ObjectGeneration: textPtrToSQL(&object.Generation), Reason: reason})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

func (s *Store) listExpenseSplits(ctx context.Context, queries *db.Queries, expenseID string) ([]trip.ExpenseSplit, error) {
	splitRows, err := queries.ListExpenseSplitsByExpenseID(ctx, mustUUID(expenseID))
	if err != nil {
		return nil, err
	}
	splits := make([]trip.ExpenseSplit, 0, len(splitRows))
	for _, splitRow := range splitRows {
		splits = append(splits, trip.ExpenseSplit{
			Participant: expenseParticipantDisplay(splitRow.ParticipantID, splitRow.ParticipantDisplayName, splitRow.ParticipantSource),
			AmountMinor: splitRow.AmountMinor,
		})
	}
	return splits, nil
}

func (s *Store) quickExpenseByClientMutationID(ctx context.Context, queries *db.Queries, tripID string, createdBy string, clientMutationID string) (trip.Expense, bool, error) {
	existing, err := queries.GetExpenseIDByClientMutationID(ctx, db.GetExpenseIDByClientMutationIDParams{
		TripID:           mustUUID(tripID),
		CreatedBy:        mustUUID(createdBy),
		ClientMutationID: textValue(clientMutationID),
	})
	if err == pgx.ErrNoRows {
		return trip.Expense{}, false, nil
	}
	if err != nil {
		return trip.Expense{}, false, err
	}
	if existing.AnchorType == "trip" {
		row, err := queries.GetTripExpenseByID(ctx, db.GetTripExpenseByIDParams{TripID: mustUUID(tripID), ExpenseID: mustUUID(existing.ID)})
		if err != nil {
			return trip.Expense{}, false, err
		}
		expense := expenseFromTripGetRow(row)
		splits, err := s.listExpenseSplits(ctx, queries, existing.ID)
		if err != nil {
			return trip.Expense{}, false, err
		}
		expense.Splits = splits
		return expense, true, nil
	}
	row, err := queries.GetExpenseByTripDayAndID(ctx, db.GetExpenseByTripDayAndIDParams{TripID: mustUUID(tripID), TripDayID: mustUUID(existing.TripDayID), ExpenseID: mustUUID(existing.ID)})
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense := expenseFromGetRow(row)
	splits, err := s.listExpenseSplits(ctx, queries, existing.ID)
	if err != nil {
		return trip.Expense{}, false, err
	}
	expense.Splits = splits
	return expense, true, nil
}

func expenseFromGetRow(row db.GetExpenseByTripDayAndIDRow) trip.Expense {
	return trip.Expense{
		ID:                  row.ID,
		TripID:              row.TripID,
		AnchorType:          row.AnchorType,
		TripDayID:           optionalString(row.TripDayID),
		ScheduleItemID:      optionalString(row.ScheduleItemID),
		ExpenseDate:         dateString(row.ExpenseDate),
		Title:               textPtr(row.Title),
		DisplayTitle:        row.DisplayTitle,
		Place:               expensePlaceDisplay(row.TripPlaceID, row.PlaceName, row.PlaceAddress, row.PlaceType, row.PlaceSource),
		AmountMinor:         row.AmountMinor,
		Currency:            row.Currency,
		ExpenseCategory:     row.ExpenseCategory,
		ExpenseKind:         row.ExpenseKind,
		Payer:               expenseParticipantDisplay(row.PayerParticipantID, row.PayerDisplayName, row.PayerSource),
		Memo:                textPtr(row.Memo),
		ClientMutationID:    textPtr(row.ClientMutationID),
		SplitPolicy:         row.SplitPolicy,
		Splits:              []trip.ExpenseSplit{},
		IncludeInSettlement: row.IncludeInSettlement,
		Receipt:             receiptSummary(row.ReceiptExists, row.ReceiptContentType, row.ReceiptByteSize, row.ReceiptUploadedAt),
		CreatedAt:           row.CreatedAt.Time,
	}
}

func expenseFromTripGetRow(row db.GetTripExpenseByIDRow) trip.Expense {
	return trip.Expense{
		ID:                  row.ID,
		TripID:              row.TripID,
		AnchorType:          row.AnchorType,
		TripDayID:           optionalString(row.TripDayID),
		ScheduleItemID:      optionalString(row.ScheduleItemID),
		ExpenseDate:         dateString(row.ExpenseDate),
		Title:               textPtr(row.Title),
		DisplayTitle:        row.DisplayTitle,
		Place:               expensePlaceDisplay(row.TripPlaceID, row.PlaceName, row.PlaceAddress, row.PlaceType, row.PlaceSource),
		AmountMinor:         row.AmountMinor,
		Currency:            row.Currency,
		ExpenseCategory:     row.ExpenseCategory,
		ExpenseKind:         row.ExpenseKind,
		Payer:               expenseParticipantDisplay(row.PayerParticipantID, row.PayerDisplayName, row.PayerSource),
		Memo:                textPtr(row.Memo),
		ClientMutationID:    textPtr(row.ClientMutationID),
		SplitPolicy:         row.SplitPolicy,
		Splits:              []trip.ExpenseSplit{},
		IncludeInSettlement: row.IncludeInSettlement,
		Receipt:             receiptSummary(row.ReceiptExists, row.ReceiptContentType, row.ReceiptByteSize, row.ReceiptUploadedAt),
		CreatedAt:           row.CreatedAt.Time,
	}
}

func expenseFromUpdateRow(row db.UpdateExpenseRow) trip.Expense {
	placeSource := ""
	if row.PlaceName != "" {
		placeSource = trip.ExpenseDisplaySourceFallback
	}
	return trip.Expense{
		ID:                  row.ID,
		TripID:              row.TripID,
		AnchorType:          row.AnchorType,
		TripDayID:           optionalString(row.TripDayID),
		ScheduleItemID:      optionalString(row.ScheduleItemID),
		ExpenseDate:         dateString(row.ExpenseDate),
		Title:               textPtr(row.Title),
		DisplayTitle:        expenseDisplayTitle(row.Title, row.PlaceName),
		Place:               expensePlaceDisplay(row.TripPlaceID, row.PlaceName, row.PlaceAddress, row.PlaceType, placeSource),
		AmountMinor:         row.AmountMinor,
		Currency:            row.Currency,
		ExpenseCategory:     row.ExpenseCategory,
		ExpenseKind:         row.ExpenseKind,
		Payer:               expenseParticipantDisplay(row.PayerParticipantID, row.PayerDisplayName, trip.ExpenseDisplaySourceLive),
		Memo:                textPtr(row.Memo),
		ClientMutationID:    textPtr(row.ClientMutationID),
		SplitPolicy:         row.SplitPolicy,
		Splits:              []trip.ExpenseSplit{},
		IncludeInSettlement: row.IncludeInSettlement,
		Receipt:             receiptSummary(row.ReceiptExists, row.ReceiptContentType, row.ReceiptByteSize, row.ReceiptUploadedAt),
		CreatedAt:           row.CreatedAt.Time,
	}
}

func expenseFromUpdateTripRow(row db.UpdateTripExpenseRow) trip.Expense {
	placeSource := ""
	if row.PlaceName != "" {
		placeSource = trip.ExpenseDisplaySourceFallback
	}
	return trip.Expense{
		ID:                  row.ID,
		TripID:              row.TripID,
		AnchorType:          row.AnchorType,
		TripDayID:           optionalString(row.TripDayID),
		ScheduleItemID:      optionalString(row.ScheduleItemID),
		ExpenseDate:         dateString(row.ExpenseDate),
		Title:               textPtr(row.Title),
		DisplayTitle:        expenseDisplayTitle(row.Title, row.PlaceName),
		Place:               expensePlaceDisplay(row.TripPlaceID, row.PlaceName, row.PlaceAddress, row.PlaceType, placeSource),
		AmountMinor:         row.AmountMinor,
		Currency:            row.Currency,
		ExpenseCategory:     row.ExpenseCategory,
		ExpenseKind:         row.ExpenseKind,
		Payer:               expenseParticipantDisplay(row.PayerParticipantID, row.PayerDisplayName, trip.ExpenseDisplaySourceLive),
		Memo:                textPtr(row.Memo),
		ClientMutationID:    textPtr(row.ClientMutationID),
		SplitPolicy:         row.SplitPolicy,
		Splits:              []trip.ExpenseSplit{},
		IncludeInSettlement: row.IncludeInSettlement,
		Receipt:             receiptSummary(row.ReceiptExists, row.ReceiptContentType, row.ReceiptByteSize, row.ReceiptUploadedAt),
		CreatedAt:           row.CreatedAt.Time,
	}
}

func expenseFromInsertRow(row db.InsertExpenseRow, splits []trip.ExpenseSplit, placeSource string) trip.Expense {
	return trip.Expense{
		ID:                  row.ID,
		TripID:              row.TripID,
		AnchorType:          row.AnchorType,
		TripDayID:           optionalString(row.TripDayID),
		ScheduleItemID:      optionalString(row.ScheduleItemID),
		ExpenseDate:         dateString(row.ExpenseDate),
		Title:               textPtr(row.Title),
		DisplayTitle:        expenseDisplayTitle(row.Title, row.PlaceName),
		Place:               expensePlaceDisplay(row.TripPlaceID, row.PlaceName, row.PlaceAddress, row.PlaceType, placeSource),
		AmountMinor:         row.AmountMinor,
		Currency:            row.Currency,
		ExpenseCategory:     row.ExpenseCategory,
		ExpenseKind:         row.ExpenseKind,
		Payer:               expenseParticipantDisplay(row.PayerParticipantID, row.PayerDisplayName, trip.ExpenseDisplaySourceLive),
		Memo:                textPtr(row.Memo),
		ClientMutationID:    textPtr(row.ClientMutationID),
		SplitPolicy:         row.SplitPolicy,
		Splits:              splits,
		IncludeInSettlement: row.IncludeInSettlement,
		Receipt:             receiptSummary(row.ReceiptExists, row.ReceiptContentType, row.ReceiptByteSize, row.ReceiptUploadedAt),
		CreatedAt:           row.CreatedAt.Time,
	}
}

func expenseCurrency(value *string, defaultCurrency string) string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return defaultCurrency
	}
	return strings.TrimSpace(*value)
}

func expenseKind(value string) string {
	if strings.TrimSpace(value) == "" {
		return trip.ExpenseKindRegular
	}
	return value
}

func expenseCategory(value *string, placeType string) string {
	if value != nil && strings.TrimSpace(*value) != "" {
		return strings.TrimSpace(*value)
	}
	if strings.TrimSpace(placeType) != "" {
		return strings.TrimSpace(placeType)
	}
	return trip.ExpenseCategoryEtc
}

func textString(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func receiptSummary(exists bool, contentTypeValue string, byteSizeValue int32, uploadedAtValue pgtype.Timestamptz) trip.ExpenseReceiptSummary {
	if !exists {
		return trip.ExpenseReceiptSummary{Exists: false}
	}
	contentType := contentTypeValue
	byteSize := int(byteSizeValue)
	uploadedAt := timeFromTimestamptz(uploadedAtValue)
	return trip.ExpenseReceiptSummary{Exists: true, ContentType: &contentType, ByteSize: &byteSize, UploadedAt: &uploadedAt}
}

func expenseDisplayTitle(title pgtype.Text, fallback string) string {
	if title.Valid && strings.TrimSpace(title.String) != "" {
		return title.String
	}
	if fallback != "" {
		return fallback
	}
	return "지출"
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func expensePlaceDisplay(tripPlaceID string, name string, address string, placeType string, source string) *trip.ExpensePlaceDisplay {
	if source == "" || name == "" {
		return nil
	}
	return &trip.ExpensePlaceDisplay{
		TripPlaceID: optionalString(tripPlaceID),
		Name:        name,
		Address:     optionalString(address),
		PlaceType:   optionalString(placeType),
		Source:      source,
	}
}

func expenseParticipantDisplay(participantID string, displayName string, source string) trip.ExpenseParticipantDisplay {
	if displayName == "" {
		displayName = "여행자"
	}
	if source == "" {
		source = trip.ExpenseDisplaySourceFallback
	}
	return trip.ExpenseParticipantDisplay{
		ParticipantID: optionalString(participantID),
		DisplayName:   displayName,
		Source:        source,
	}
}

func float8Value(value float64) pgtype.Float8 {
	return pgtype.Float8{Float64: value, Valid: true}
}

func dateValue(value time.Time) pgtype.Date {
	return pgtype.Date{Time: value, Valid: true}
}

func nullableBool(value *bool) pgtype.Bool {
	if value == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *value, Valid: true}
}

func dateString(value pgtype.Date) string {
	return value.Time.Format("2006-01-02")
}

func dateTextValue(value string) pgtype.Date {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: parsed, Valid: true}
}

func tripInviteFromRow(id string, tripID string, token string, expiresAt pgtype.Timestamptz, createdAt pgtype.Timestamptz, createdBy string) trip.TripInvite {
	return trip.TripInvite{
		ID:        id,
		TripID:    tripID,
		Token:     token,
		ExpiresAt: expiresAt.Time,
		CreatedAt: createdAt.Time,
		CreatedBy: createdBy,
	}
}

func isUniqueConstraintViolation(err error, constraintName string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraintName
}

func isForeignKeyConstraintViolation(err error, constraintName string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503" && pgErr.ConstraintName == constraintName
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func storageObjectDeletionJobsTableExists(ctx context.Context, tx pgx.Tx) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('public.storage_object_deletion_jobs') IS NOT NULL`).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}
