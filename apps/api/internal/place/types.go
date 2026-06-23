package place

import (
	"context"
	"errors"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

var (
	ErrValidation          = errors.New("validation error")
	ErrUnauthorized        = errors.New("unauthorized")
	ErrForbidden           = errors.New("forbidden")
	ErrNotFound            = errors.New("not found")
	ErrProviderUnavailable = errors.New("place provider unavailable")
	ErrProviderRateLimited = errors.New("place provider rate limited")
)

type Repository interface {
	GetTripByID(ctx context.Context, tripID string) (trip.Trip, bool, error)
	IsTripParticipant(ctx context.Context, tripID string, userID string) (bool, error)
}

type Provider interface {
	Search(ctx context.Context, input ProviderSearchInput) ([]SearchResult, error)
}

type ProviderSearchInput struct {
	Query string
	Limit int
}

type SearchInput struct {
	Query string
	Limit int
}

type SearchResult struct {
	GooglePlaceID    string
	DisplayName      string
	FormattedAddress string
	PrimaryType      string
}
