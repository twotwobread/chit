package route

import (
	"context"
	"errors"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

var (
	ErrValidation       = errors.New("validation error")
	ErrUnauthorized     = errors.New("unauthorized")
	ErrForbidden        = errors.New("forbidden")
	ErrNotFound         = errors.New("not found")
	ErrStaleItem        = errors.New("route preview stale item")
	ErrUnsupportedPlace = errors.New("route preview unsupported place")
	ErrProviderNoRoute  = errors.New("route provider no route")
	ErrProviderLimited  = errors.New("route provider rate limited")
	ErrProviderDown     = errors.New("route provider unavailable")
)

type Repository interface {
	GetTripByID(ctx context.Context, tripID string) (trip.Trip, bool, error)
	IsTripParticipant(ctx context.Context, tripID string, userID string) (bool, error)
	ListItineraryItemsByTripAndDate(ctx context.Context, tripID string, date string) ([]trip.DayItineraryItem, error)
}

type Provider interface {
	Preview(ctx context.Context, input ProviderPreviewInput) (ProviderPreviewResult, error)
}

type GeoPoint struct {
	Latitude  float64
	Longitude float64
}

type GeoBounds struct {
	Northeast GeoPoint
	Southwest GeoPoint
}

type ProviderPreviewInput struct {
	Origin      GeoPoint
	Destination GeoPoint
	Mode        string
}

type ProviderPreviewResult struct {
	DurationSeconds int
	DistanceMeters  int
	EncodedPolyline string
	Bounds          *GeoBounds
	TransferCount   *int
}

type PreviewInput struct {
	Origin GeoPoint
}

type PreviewSummary struct {
	DurationSeconds int
	DistanceMeters  int
	SummaryText     string
	TransferCount   *int
}

type PreviewMap struct {
	EncodedPolyline string
	Origin          GeoPoint
	Destination     GeoPoint
	Bounds          GeoBounds
}

type PreviewResult struct {
	ItemID      string
	Mode        string
	Summary     PreviewSummary
	Map         *PreviewMap
	GeneratedAt time.Time
}
