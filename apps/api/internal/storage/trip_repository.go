package storage

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
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
			ID:              row.ID,
			Name:            row.Name,
			StartDate:       dateString(row.StartDate),
			EndDate:         dateString(row.EndDate),
			DefaultCurrency: row.DefaultCurrency,
			JoinedAt:        row.JoinedAt.Time,
			CreatedAt:       row.CreatedAt.Time,
		})
	}
	return trips, nil
}

func dateValue(value time.Time) pgtype.Date {
	return pgtype.Date{Time: value, Valid: true}
}

func dateString(value pgtype.Date) string {
	return value.Time.Format("2006-01-02")
}
