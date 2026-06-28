package route

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	dateLayout  = "2006-01-02"
	transitMode = "transit"
)

type Service struct {
	repo     Repository
	provider Provider
	now      func() time.Time
}

type Option func(*Service)

func WithClock(now func() time.Time) Option {
	return func(s *Service) {
		if now != nil {
			s.now = now
		}
	}
}

func NewService(repo Repository, provider Provider, options ...Option) *Service {
	service := &Service{
		repo:     repo,
		provider: provider,
		now:      func() time.Time { return time.Now().UTC() },
	}
	for _, option := range options {
		option(service)
	}
	return service
}

func (s *Service) CreatePreview(ctx context.Context, userID string, tripID string, tripDayID string, itemID string, input PreviewInput) (PreviewResult, error) {
	if strings.TrimSpace(userID) == "" {
		return PreviewResult{}, ErrUnauthorized
	}
	if s == nil || s.repo == nil || s.provider == nil {
		return PreviewResult{}, ErrProviderDown
	}

	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	itemID = strings.TrimSpace(itemID)
	if !isUUID(tripID) || !isUUID(itemID) || !validGeoPoint(input.Origin) {
		return PreviewResult{}, ErrValidation
	}
	if !isUUID(tripDayID) {
		if _, err := time.Parse(dateLayout, tripDayID); err != nil {
			return PreviewResult{}, ErrValidation
		}
	}

	if err := s.validateTripDayParticipant(ctx, userID, tripID, tripDayID); err != nil {
		return PreviewResult{}, err
	}

	items, err := s.repo.ListScheduleItemsByTripDay(ctx, tripID, tripDayID)
	if err != nil {
		return PreviewResult{}, err
	}

	found := false
	var firstPending *trip.ScheduleItem
	for index := range items {
		item := items[index]
		if item.ID == itemID {
			found = true
		}
		if item.ArrivedAt == nil && firstPending == nil {
			firstPending = &items[index]
		}
	}
	if !found {
		return PreviewResult{}, ErrNotFound
	}
	if firstPending == nil || firstPending.ID != itemID {
		return PreviewResult{}, ErrStaleItem
	}
	if firstPending.Place.RoutablePlace == nil {
		return PreviewResult{}, ErrUnsupportedPlace
	}

	destination := GeoPoint{
		Latitude:  firstPending.Place.RoutablePlace.Latitude,
		Longitude: firstPending.Place.RoutablePlace.Longitude,
	}
	if !validGeoPoint(destination) {
		return PreviewResult{}, ErrUnsupportedPlace
	}

	providerResult, err := s.provider.Preview(ctx, ProviderPreviewInput{
		Origin:      input.Origin,
		Destination: destination,
		Mode:        transitMode,
	})
	if err != nil {
		return PreviewResult{}, err
	}
	if providerResult.DurationSeconds < 0 || providerResult.DistanceMeters < 0 {
		return PreviewResult{}, ErrProviderDown
	}

	result := PreviewResult{
		ItemID: itemID,
		Mode:   transitMode,
		Summary: PreviewSummary{
			DurationSeconds: providerResult.DurationSeconds,
			DistanceMeters:  providerResult.DistanceMeters,
			SummaryText:     routeSummaryText(providerResult.TransferCount),
			TransferCount:   providerResult.TransferCount,
		},
		GeneratedAt: s.now(),
	}
	if providerResult.EncodedPolyline != "" && providerResult.Bounds != nil {
		result.Map = &PreviewMap{
			EncodedPolyline: providerResult.EncodedPolyline,
			Origin:          input.Origin,
			Destination:     destination,
			Bounds:          *providerResult.Bounds,
		}
	}
	return result, nil
}

func (s *Service) validateTripDayParticipant(ctx context.Context, userID string, tripID string, tripDayID string) error {
	tripRecord, found, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return err
	}
	if !found {
		return ErrNotFound
	}
	participant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return err
	}
	if !participant {
		return ErrForbidden
	}
	if !isUUID(tripDayID) {
		selectedDate, err := time.Parse(dateLayout, tripDayID)
		if err != nil {
			return ErrValidation
		}
		startDate, err := time.Parse(dateLayout, tripRecord.StartDate)
		if err != nil {
			return err
		}
		endDate, err := time.Parse(dateLayout, tripRecord.EndDate)
		if err != nil {
			return err
		}
		if selectedDate.Before(startDate) || selectedDate.After(endDate) {
			return ErrNotFound
		}
		return nil
	}
	if _, found, err := s.repo.GetActiveTripDayByTripAndID(ctx, tripID, tripDayID); err != nil {
		return err
	} else if !found {
		return ErrNotFound
	}
	return nil
}

func routeSummaryText(transferCount *int) string {
	if transferCount == nil {
		return "환승 정보 없음"
	}
	return fmt.Sprintf("환승 %d회", *transferCount)
}

func validGeoPoint(point GeoPoint) bool {
	return point.Latitude >= -90 && point.Latitude <= 90 && point.Longitude >= -180 && point.Longitude <= 180 && !math.IsNaN(point.Latitude) && !math.IsNaN(point.Longitude) && !math.IsInf(point.Latitude, 0) && !math.IsInf(point.Longitude, 0)
}

func isUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, char := range value {
		switch index {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
				return false
			}
		}
	}
	return true
}
