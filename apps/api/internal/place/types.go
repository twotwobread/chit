package place

import (
	"context"
	"errors"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

var (
	ErrValidation                          = errors.New("validation error")
	ErrUnauthorized                        = errors.New("unauthorized")
	ErrForbidden                           = errors.New("forbidden")
	ErrNotFound                            = errors.New("not found")
	ErrConflict                            = errors.New("conflict")
	ErrDuplicateDayPlaceConfirmationNeeded = errors.New("duplicate day place confirmation required")
	ErrProviderUnavailable                 = errors.New("place provider unavailable")
	ErrProviderRateLimited                 = errors.New("place provider rate limited")
)

type DuplicateDayPlaceConfirmationError struct {
	TripPlaceID string
}

func (e DuplicateDayPlaceConfirmationError) Error() string {
	return ErrDuplicateDayPlaceConfirmationNeeded.Error()
}

func (e DuplicateDayPlaceConfirmationError) Unwrap() error {
	return ErrDuplicateDayPlaceConfirmationNeeded
}

type Repository interface {
	GetTripByID(ctx context.Context, tripID string) (trip.Trip, bool, error)
	IsTripParticipant(ctx context.Context, tripID string, userID string) (bool, error)
	GetActiveTripDayByTripAndID(ctx context.Context, tripID string, tripDayID string) (trip.TripDay, bool, error)
	GetGoogleTripPlaceByGooglePlaceID(ctx context.Context, tripID string, googlePlaceID string) (trip.TripPlaceSummary, bool, error)
	AppendGooglePlaceScheduleItem(ctx context.Context, record AppendGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error)
	CreateGooglePlaceScheduleItem(ctx context.Context, record CreateGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error)
}

type Provider interface {
	Search(ctx context.Context, input ProviderSearchInput) ([]SearchResult, error)
	Details(ctx context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error)
}

type ProviderSearchInput struct {
	Query string
	Limit int
}

type ProviderDetailsInput struct {
	GooglePlaceID string
}

type SearchInput struct {
	Query string
	Limit int
}

type CreateGooglePlaceScheduleItemInput struct {
	GooglePlaceID      string
	DuplicateConfirmed bool
	Title              string
	StartTime          *string
	EndTime            *string
	Memo               *string
}

type SearchResult struct {
	GooglePlaceID    string
	DisplayName      string
	FormattedAddress string
	PrimaryType      string
}

type GooglePlaceDetails struct {
	GooglePlaceID    string
	DisplayName      string
	FormattedAddress string
	Latitude         float64
	Longitude        float64
	PrimaryType      string
	Types            []string
}

type AppendGooglePlaceScheduleItemRecord struct {
	TripID             string
	TripDayID          string
	TripPlaceID        string
	DuplicateConfirmed bool
	Title              string
	StartTime          *string
	EndTime            *string
	Memo               *string
}

type CreateGooglePlaceScheduleItemRecord struct {
	TripID             string
	TripDayID          string
	GooglePlaceID      string
	Name               string
	Address            string
	PlaceType          string
	Latitude           float64
	Longitude          float64
	GooglePrimaryType  string
	GoogleTypes        []string
	DuplicateConfirmed bool
	Title              string
	StartTime          *string
	EndTime            *string
	Memo               *string
}

type CreateGooglePlaceScheduleItemResult struct {
	Day  trip.TripDay
	Item trip.ScheduleItem
}
