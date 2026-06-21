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

func dateValue(value time.Time) pgtype.Date {
	return pgtype.Date{Time: value, Valid: true}
}

func dateString(value pgtype.Date) string {
	return value.Time.Format("2006-01-02")
}
