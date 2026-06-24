package storage

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

var errRetryReorderRankCollision = errors.New("retry reorder rank collision")

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
		Name:            record.Name,
		StartDate:       dateValue(record.StartDate),
		EndDate:         dateValue(record.EndDate),
		DefaultCurrency: record.DefaultCurrency,
		Column5:         mustUUID(record.CreatedBy),
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

	if err := tx.Commit(ctx); err != nil {
		return trip.CreateResult{}, err
	}

	return trip.CreateResult{
		Trip: trip.Trip{
			ID:              createdTrip.ID,
			Name:            createdTrip.Name,
			StartDate:       dateString(createdTrip.StartDate),
			EndDate:         dateString(createdTrip.EndDate),
			DefaultCurrency: createdTrip.DefaultCurrency,
			CreatedBy:       createdTrip.CreatedBy,
			CreatedAt:       createdTrip.CreatedAt.Time,
			UpdatedAt:       createdTrip.UpdatedAt.Time,
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

	return trip.Trip{
		ID:              row.ID,
		Name:            row.Name,
		StartDate:       dateString(row.StartDate),
		EndDate:         dateString(row.EndDate),
		DefaultCurrency: row.DefaultCurrency,
		CreatedBy:       row.CreatedBy,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}, true, nil
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
	row, err := s.queries.UpdateTripBasicInfo(ctx, db.UpdateTripBasicInfoParams{
		Column1:         mustUUID(record.ID),
		Name:            record.Name,
		StartDate:       dateValue(record.StartDate),
		EndDate:         dateValue(record.EndDate),
		DefaultCurrency: record.DefaultCurrency,
	})
	if err != nil {
		return trip.Trip{}, err
	}

	return trip.Trip{
		ID:              row.ID,
		Name:            row.Name,
		StartDate:       dateString(row.StartDate),
		EndDate:         dateString(row.EndDate),
		DefaultCurrency: row.DefaultCurrency,
		CreatedBy:       row.CreatedBy,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}, nil
}

func (s *Store) DeleteTripByID(ctx context.Context, tripID string) (bool, error) {
	_, err := s.queries.DeleteTripByID(ctx, mustUUID(tripID))
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
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

	_, err = qtx.CreateTripParticipant(ctx, db.CreateTripParticipantParams{
		Column1:     mustUUID(invite.TiTripID),
		Column2:     mustUUID(record.UserID),
		Role:        trip.RoleMember,
		DisplayName: trip.NormalizeParticipantDisplayName(user.DisplayName),
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
			ID:               row.ID,
			Name:             row.Name,
			StartDate:        dateString(row.StartDate),
			EndDate:          dateString(row.EndDate),
			DefaultCurrency:  row.DefaultCurrency,
			JoinedAt:         row.JoinedAt.Time,
			CreatedAt:        row.CreatedAt.Time,
			MyRole:           row.MyRole,
			ParticipantCount: int(row.ParticipantCount),
		})
	}
	return trips, nil
}

func (s *Store) ListDayLodgingPlacesByTrip(ctx context.Context, tripID string) ([]trip.DayLodgingPlace, error) {
	rows, err := s.queries.ListDayLodgingPlacesByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}

	items := make([]trip.DayLodgingPlace, 0, len(rows))
	for _, row := range rows {
		items = append(items, trip.DayLodgingPlace{
			Date: dateString(row.LodgingDate),
			Place: trip.TripPlaceSummary{
				ID:        row.ID,
				Name:      row.Name,
				PlaceType: row.PlaceType,
				Address:   row.Address,
			},
		})
	}
	return items, nil
}

func (s *Store) GetDayLodgingPlaceByTripAndDate(ctx context.Context, tripID string, date string) (trip.TripPlaceSummary, bool, error) {
	row, err := s.queries.GetDayLodgingPlaceByTripAndDate(ctx, db.GetDayLodgingPlaceByTripAndDateParams{
		TripID:      mustUUID(tripID),
		LodgingDate: dateTextValue(date),
	})
	if err == pgx.ErrNoRows {
		return trip.TripPlaceSummary{}, false, nil
	}
	if err != nil {
		return trip.TripPlaceSummary{}, false, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address), true, nil
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
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address), true, nil
}

func (s *Store) SetDayLodgingPlace(ctx context.Context, record trip.SetDayLodgingPlaceRecord) (trip.TripPlaceSummary, error) {
	row, err := s.queries.SetDayLodgingPlace(ctx, db.SetDayLodgingPlaceParams{
		TripID:      mustUUID(record.TripID),
		LodgingDate: dateTextValue(record.ScheduledDate),
		TripPlaceID: mustUUID(record.TripPlaceID),
	})
	if isForeignKeyConstraintViolation(err, "day_lodging_places_trip_place_fk") {
		return trip.TripPlaceSummary{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.TripPlaceSummary{}, err
	}
	return tripPlaceSummary(row.ID, row.Name, row.PlaceType, row.Address), nil
}

func (s *Store) DeleteDayLodgingPlace(ctx context.Context, tripID string, date string) error {
	return s.queries.DeleteDayLodgingPlace(ctx, db.DeleteDayLodgingPlaceParams{
		TripID:      mustUUID(tripID),
		LodgingDate: dateTextValue(date),
	})
}

func (s *Store) ListItineraryItemsByTripAndDate(ctx context.Context, tripID string, date string) ([]trip.DayItineraryItem, error) {
	rows, err := s.queries.ListItineraryItemsByTripAndDate(ctx, db.ListItineraryItemsByTripAndDateParams{
		Column1:       mustUUID(tripID),
		ScheduledDate: dateTextValue(date),
	})
	if err != nil {
		return nil, err
	}

	return mapDayItineraryItems(rows), nil
}

func (s *Store) CreateManualDayItineraryItem(ctx context.Context, record trip.CreateManualDayItineraryItemRecord) (trip.DayItineraryItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return trip.DayItineraryItem{}, err
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
		return trip.DayItineraryItem{}, err
	}

	item, err := qtx.CreateItineraryItemAtEnd(ctx, db.CreateItineraryItemAtEndParams{
		TripID:        mustUUID(record.TripID),
		ScheduledDate: dateTextValue(record.ScheduledDate),
		TripPlaceID:   mustUUID(place.ID),
	})
	if err != nil {
		if isUniqueConstraintViolation(err, "itinerary_items_trip_date_order_unique") || isUniqueConstraintViolation(err, "itinerary_items_trip_date_rank_unique") {
			return trip.DayItineraryItem{}, trip.ErrConflict
		}
		return trip.DayItineraryItem{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return trip.DayItineraryItem{}, err
	}

	return trip.DayItineraryItem{
		ID:        item.ID,
		ItemOrder: int(item.ItemOrder),
		Version:   int(item.Version),
		Place: trip.TripPlaceSummary{
			ID:        place.ID,
			Name:      place.Name,
			PlaceType: place.PlaceType,
			Address:   place.Address,
		},
	}, nil
}

func (s *Store) GetItineraryItemByTripDateAndID(ctx context.Context, tripID string, date string, itemID string) (trip.DayItineraryItem, bool, error) {
	row, err := s.queries.GetItineraryItemByTripDateAndID(ctx, db.GetItineraryItemByTripDateAndIDParams{
		TripID:        mustUUID(tripID),
		ScheduledDate: dateTextValue(date),
		ItemID:        mustUUID(itemID),
	})
	if err == pgx.ErrNoRows {
		return trip.DayItineraryItem{}, false, nil
	}
	if err != nil {
		return trip.DayItineraryItem{}, false, err
	}
	return trip.DayItineraryItem{
		ID:        row.ID,
		ItemOrder: int(row.ItemOrder),
		Version:   int(row.Version),
		IsLodging: boolFromSQL(row.IsLodging),
		Place: trip.TripPlaceSummary{
			ID:        row.TripPlaceID,
			Name:      row.PlaceName,
			PlaceType: row.PlaceType,
			Address:   row.Address,
		},
	}, true, nil
}

func (s *Store) ReorderDayItineraryItems(ctx context.Context, record trip.ReorderDayItineraryItemsRecord) ([]trip.DayItineraryItem, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := loadOrderedItineraryRowsForUpdate(ctx, tx, record.TripID, record.ScheduledDate)
	if err != nil {
		return nil, err
	}

	for _, move := range record.Moves {
		current, err = applyReorderMove(ctx, tx, record.TripID, record.ScheduledDate, current, move)
		if err != nil {
			return nil, err
		}
	}

	qtx := s.queries.WithTx(tx)
	rows, err := qtx.ListItineraryItemsByTripAndDate(ctx, db.ListItineraryItemsByTripAndDateParams{
		Column1:       mustUUID(record.TripID),
		ScheduledDate: dateTextValue(record.ScheduledDate),
	})
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return mapDayItineraryItems(rows), nil
}

func (s *Store) UpdateDayItineraryItemPlace(ctx context.Context, record trip.UpdateDayItineraryItemRecord) (trip.DayItineraryItem, error) {
	row, err := s.queries.UpdateTripPlaceSnapshotByItineraryItem(ctx, db.UpdateTripPlaceSnapshotByItineraryItemParams{
		TripID:        mustUUID(record.TripID),
		ScheduledDate: dateTextValue(record.ScheduledDate),
		ItemID:        mustUUID(record.ItemID),
		Name:          record.Name,
		Address:       record.Address,
		PlaceType:     record.PlaceType,
	})
	if err == pgx.ErrNoRows {
		return trip.DayItineraryItem{}, trip.ErrNotFound
	}
	if err != nil {
		return trip.DayItineraryItem{}, err
	}
	return trip.DayItineraryItem{
		ID:        row.ID,
		ItemOrder: int(row.ItemOrder),
		Version:   int(row.Version),
		IsLodging: boolFromSQL(row.IsLodging),
		Place: trip.TripPlaceSummary{
			ID:        row.TripPlaceID,
			Name:      row.PlaceName,
			PlaceType: row.PlaceType,
			Address:   row.Address,
		},
	}, nil
}

func (s *Store) DeleteDayItineraryItem(ctx context.Context, tripID string, date string, itemID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	placeID, err := qtx.DeleteItineraryItemByTripDateAndID(ctx, db.DeleteItineraryItemByTripDateAndIDParams{
		TripID:        mustUUID(tripID),
		ScheduledDate: dateTextValue(date),
		ItemID:        mustUUID(itemID),
	})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	remaining, err := qtx.CountItineraryItemsByTripPlaceID(ctx, db.CountItineraryItemsByTripPlaceIDParams{
		TripID:      mustUUID(tripID),
		TripPlaceID: mustUUID(placeID),
	})
	if err != nil {
		return false, err
	}
	if remaining == 0 {
		lodgingReferences, err := qtx.CountDayLodgingPlacesByTripPlaceID(ctx, db.CountDayLodgingPlacesByTripPlaceIDParams{
			TripID:      mustUUID(tripID),
			TripPlaceID: mustUUID(placeID),
		})
		if err != nil {
			return false, err
		}
		if lodgingReferences == 0 {
			if err := qtx.DeleteTripPlaceByID(ctx, db.DeleteTripPlaceByIDParams{
				TripID:      mustUUID(tripID),
				TripPlaceID: mustUUID(placeID),
			}); err != nil {
				return false, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

type orderedItineraryRow struct {
	ID      string
	Rank    string
	Version int
}

func loadOrderedItineraryRowsForUpdate(ctx context.Context, tx pgx.Tx, tripID string, date string) ([]orderedItineraryRow, error) {
	rows, err := tx.Query(ctx, `
		SELECT id::text, rank, version
		FROM itinerary_items
		WHERE trip_id = $1::uuid
		  AND scheduled_date = $2
		ORDER BY rank ASC, id ASC
		FOR UPDATE
	`, mustUUID(tripID), dateTextValue(date))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ordered := make([]orderedItineraryRow, 0)
	for rows.Next() {
		var item orderedItineraryRow
		if err := rows.Scan(&item.ID, &item.Rank, &item.Version); err != nil {
			return nil, err
		}
		ordered = append(ordered, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ordered, nil
}

func applyReorderMove(ctx context.Context, tx pgx.Tx, tripID string, date string, current []orderedItineraryRow, move trip.ReorderDayItineraryMoveRecord) ([]orderedItineraryRow, error) {
	ordered := current
	for attempt := 0; attempt < 2; attempt++ {
		next, err := applyReorderMoveOnce(ctx, tx, tripID, date, ordered, move)
		if err == nil {
			return next, nil
		}
		if !errors.Is(err, errRetryReorderRankCollision) {
			return nil, err
		}
		if attempt == 1 {
			return nil, trip.ErrConflict
		}

		ordered, err = loadOrderedItineraryRowsForUpdate(ctx, tx, tripID, date)
		if err != nil {
			return nil, err
		}
	}

	return nil, trip.ErrConflict
}

func applyReorderMoveOnce(ctx context.Context, tx pgx.Tx, tripID string, date string, current []orderedItineraryRow, move trip.ReorderDayItineraryMoveRecord) ([]orderedItineraryRow, error) {
	movedIndex := indexOrderedItineraryItem(current, move.ItemID)
	if movedIndex < 0 {
		return nil, trip.ErrConflict
	}
	if current[movedIndex].Version != move.ClientVersion {
		return nil, trip.ErrConflict
	}

	moved := current[movedIndex]
	remaining := append(append([]orderedItineraryRow{}, current[:movedIndex]...), current[movedIndex+1:]...)
	insertIndex, err := reorderInsertIndex(remaining, move)
	if err != nil {
		return nil, err
	}

	newRank, err := reorderedRank(remaining, insertIndex)
	if err != nil {
		return nil, err
	}

	commandTag, err := execReorderRankUpdate(ctx, tx, tripID, date, move.ItemID, newRank, move.ClientVersion)
	if err != nil {
		if isUniqueConstraintViolation(err, "itinerary_items_trip_date_rank_unique") {
			return nil, errRetryReorderRankCollision
		}
		return nil, err
	}
	if commandTag.RowsAffected() != 1 {
		return nil, trip.ErrConflict
	}

	moved.Rank = newRank
	moved.Version++
	next := append([]orderedItineraryRow{}, remaining[:insertIndex]...)
	next = append(next, moved)
	next = append(next, remaining[insertIndex:]...)
	return next, nil
}

func execReorderRankUpdate(ctx context.Context, tx pgx.Tx, tripID string, date string, itemID string, newRank string, clientVersion int) (pgconn.CommandTag, error) {
	if _, err := tx.Exec(ctx, `SAVEPOINT reorder_rank_update`); err != nil {
		return pgconn.CommandTag{}, err
	}

	commandTag, err := tx.Exec(ctx, `
		UPDATE itinerary_items
		SET rank = $4, version = version + 1
		WHERE trip_id = $1::uuid
		  AND scheduled_date = $2
		  AND id = $3::uuid
		  AND version = $5
	`, mustUUID(tripID), dateTextValue(date), mustUUID(itemID), newRank, clientVersion)
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

func reorderInsertIndex(remaining []orderedItineraryRow, move trip.ReorderDayItineraryMoveRecord) (int, error) {
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

	beforeIndex := indexOrderedItineraryItem(remaining, *move.BeforeItemID)
	if beforeIndex < 0 || beforeIndex+1 >= len(remaining) || remaining[beforeIndex+1].ID != *move.AfterItemID {
		return 0, trip.ErrConflict
	}
	return beforeIndex + 1, nil
}

func reorderedRank(remaining []orderedItineraryRow, insertIndex int) (string, error) {
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

func rankBetween(previousRank *string, nextRank *string) (string, error) {
	const rankStep int64 = 1024

	if previousRank == nil && nextRank == nil {
		return "", trip.ErrConflict
	}
	if previousRank == nil {
		nextValue, ok := new(big.Int).SetString(*nextRank, 10)
		if !ok {
			return "", fmt.Errorf("parse next rank %q", *nextRank)
		}
		candidate := new(big.Int).Div(nextValue, big.NewInt(2))
		if candidate.Sign() <= 0 || candidate.Cmp(nextValue) >= 0 {
			return "", trip.ErrConflict
		}
		return formatRank(candidate), nil
	}

	previousValue, ok := new(big.Int).SetString(*previousRank, 10)
	if !ok {
		return "", fmt.Errorf("parse previous rank %q", *previousRank)
	}
	if nextRank == nil {
		return formatRank(new(big.Int).Add(previousValue, big.NewInt(rankStep))), nil
	}

	nextValue, ok := new(big.Int).SetString(*nextRank, 10)
	if !ok {
		return "", fmt.Errorf("parse next rank %q", *nextRank)
	}
	gap := new(big.Int).Sub(nextValue, previousValue)
	if gap.Cmp(big.NewInt(1)) <= 0 {
		return "", trip.ErrConflict
	}
	return formatRank(new(big.Int).Add(previousValue, new(big.Int).Div(gap, big.NewInt(2)))), nil
}

func formatRank(value *big.Int) string {
	return fmt.Sprintf("%019s", value.String())
}

func indexOrderedItineraryItem(items []orderedItineraryRow, itemID string) int {
	for index, item := range items {
		if item.ID == itemID {
			return index
		}
	}
	return -1
}

func mapDayItineraryItems(rows []db.ListItineraryItemsByTripAndDateRow) []trip.DayItineraryItem {
	items := make([]trip.DayItineraryItem, 0, len(rows))
	for index, row := range rows {
		items = append(items, trip.DayItineraryItem{
			ID:        row.ID,
			ItemOrder: index + 1,
			Version:   int(row.Version),
			IsLodging: boolFromSQL(row.IsLodging),
			Place: trip.TripPlaceSummary{
				ID:        row.TripPlaceID,
				Name:      row.PlaceName,
				PlaceType: row.PlaceType,
				Address:   row.Address,
			},
		})
	}
	return items
}

func tripPlaceSummary(id string, name string, placeType string, address string) trip.TripPlaceSummary {
	return trip.TripPlaceSummary{ID: id, Name: name, PlaceType: placeType, Address: address}
}

func boolFromSQL(value interface{}) bool {
	result, _ := value.(bool)
	return result
}

func dateValue(value time.Time) pgtype.Date {
	return pgtype.Date{Time: value, Valid: true}
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
