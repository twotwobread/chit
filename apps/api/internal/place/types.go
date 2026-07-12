package place

import (
	"context"
	"errors"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	DestinationProviderGoogle      = "google"
	defaultDestinationRadiusMeters = 25000
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
	SetDayLodgingPlace(ctx context.Context, record trip.SetDayLodgingPlaceRecord) (trip.TripPlaceSummary, error)
	CreateGoogleDayLodgingPlace(ctx context.Context, record CreateGoogleDayLodgingPlaceRecord) (trip.TripPlaceSummary, error)
	AppendGooglePlaceScheduleItem(ctx context.Context, record AppendGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error)
	CreateGooglePlaceScheduleItem(ctx context.Context, record CreateGooglePlaceScheduleItemRecord) (trip.ScheduleItem, error)
}

type Provider interface {
	Search(ctx context.Context, input ProviderSearchInput) ([]SearchResult, error)
	SearchDestinations(ctx context.Context, input ProviderDestinationSearchInput) ([]DestinationSearchResult, error)
	Details(ctx context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error)
	Description(ctx context.Context, input ProviderDescriptionInput) (GooglePlaceDescription, error)
	Photo(ctx context.Context, input ProviderPhotoInput) (GooglePlacePhoto, error)
}

type SearchLocationBias struct {
	Latitude     float64
	Longitude    float64
	RadiusMeters float64
}

type ProviderSearchInput struct {
	Query        string
	Limit        int
	LocationBias *SearchLocationBias
}

type ProviderDestinationSearchInput struct {
	Query string
	Limit int
}

type ProviderDetailsInput struct {
	GooglePlaceID string
}

type ProviderDescriptionInput struct {
	GooglePlaceID string
}

type ProviderPhotoInput struct {
	Name       string
	MaxWidthPx int
}

type SearchInput struct {
	Query        string
	Limit        int
	LocationBias *SearchLocationBias
}

type DestinationSearchInput struct {
	Query string
	Limit int
}

type SelectedDetailsInput struct {
	GooglePlaceID string
}

type PhotoInput struct {
	Token      string
	MaxWidthPx int
}

type CreateGoogleDayLodgingPlaceInput struct {
	GooglePlaceID string
}

type CreateGooglePlaceScheduleItemInput struct {
	GooglePlaceID      string
	DuplicateConfirmed bool
	Title              string
	StartTime          *string
	EndTime            *string
	Memo               *string
}

type PhotoAttribution struct {
	DisplayName string
	URI         string
	PhotoURI    string
}

type SearchResultPhoto struct {
	Name               string
	Token              string
	WidthPx            int
	HeightPx           int
	AuthorAttributions []PhotoAttribution
}

type DestinationSearchResult struct {
	CityName        string
	CountryName     string
	CountryCode     string
	DisplayName     string
	Latitude        float64
	Longitude       float64
	RadiusMeters    int
	Provider        string
	ProviderPlaceID string
}

type SearchResult struct {
	GooglePlaceID          string
	DisplayName            string
	FormattedAddress       string
	PrimaryType            string
	PrimaryTypeDisplayName string
	Latitude               float64
	Longitude              float64
	Rating                 *float64
	UserRatingCount        *int
	OpenNow                *bool
	GoogleMapsURI          string
	Photo                  *SearchResultPhoto
}

type GooglePlaceDescription struct {
	GooglePlaceID string
	Description   string
}

type GooglePlacePhoto struct {
	URI string
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

type CreateGoogleDayLodgingPlaceRecord struct {
	TripID            string
	TripDayID         string
	GooglePlaceID     string
	Name              string
	Address           string
	PlaceType         string
	Latitude          float64
	Longitude         float64
	GooglePrimaryType string
	GoogleTypes       []string
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

type CreateGoogleDayLodgingPlaceResult struct {
	Day          trip.TripDay
	LodgingPlace trip.TripPlaceSummary
}

type CreateGooglePlaceScheduleItemResult struct {
	Day  trip.TripDay
	Item trip.ScheduleItem
}
