package storage

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

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

func (s *Store) ListItineraryItemsByTripAndDate(ctx context.Context, tripID string, date string) ([]trip.DayItineraryItem, error) {
	rows, err := s.queries.ListItineraryItemsByTripAndDate(ctx, db.ListItineraryItemsByTripAndDateParams{
		Column1:       mustUUID(tripID),
		ScheduledDate: dateTextValue(date),
	})
	if err != nil {
		return nil, err
	}

	items := make([]trip.DayItineraryItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, trip.DayItineraryItem{
			ID:        row.ID,
			ItemOrder: int(row.ItemOrder),
			Place: trip.TripPlaceSummary{
				ID:        row.TripPlaceID,
				Name:      row.PlaceName,
				PlaceType: row.PlaceType,
				Address:   row.Address,
			},
		})
	}
	return items, nil
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
		if isUniqueConstraintViolation(err, "itinerary_items_trip_date_order_unique") {
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
		Place: trip.TripPlaceSummary{
			ID:        row.TripPlaceID,
			Name:      row.PlaceName,
			PlaceType: row.PlaceType,
			Address:   row.Address,
		},
	}, true, nil
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
		if err := qtx.DeleteTripPlaceByID(ctx, db.DeleteTripPlaceByIDParams{
			TripID:      mustUUID(tripID),
			TripPlaceID: mustUUID(placeID),
		}); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
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

func isUniqueConstraintViolation(err error, constraintName string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraintName
}
