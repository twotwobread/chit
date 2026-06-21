package trip

import (
	"context"
	"errors"
	"time"
)

const (
	RoleOwner = "owner"
)

var (
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")
)

type Creator struct {
	ID          string
	DisplayName string
}

type CreateInput struct {
	Name            string
	StartDate       string
	EndDate         string
	DefaultCurrency string
}

type CreateRecord struct {
	Name             string
	StartDate        time.Time
	EndDate          time.Time
	DefaultCurrency  string
	CreatedBy        string
	OwnerDisplayName string
}

type Trip struct {
	ID              string
	Name            string
	StartDate       string
	EndDate         string
	DefaultCurrency string
	CreatedBy       string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Participant struct {
	ID          string
	TripID      string
	UserID      string
	Role        string
	DisplayName string
	JoinedAt    time.Time
}

type CreateResult struct {
	Trip             Trip
	OwnerParticipant Participant
}

type Repository interface {
	GetCreator(ctx context.Context, userID string) (Creator, bool, error)
	CreateTripWithOwner(ctx context.Context, record CreateRecord) (CreateResult, error)
}
