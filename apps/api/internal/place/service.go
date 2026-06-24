package place

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	dateLayout          = "2006-01-02"
	defaultLimit        = 5
	maxLimit            = 10
	maxQueryLen         = 120
	maxGooglePlaceIDLen = 255
	maxNameLen          = 120
	maxAddressLen       = 240
)

type Service struct {
	repo     Repository
	provider Provider
}

func NewService(repo Repository, provider Provider) *Service {
	return &Service{repo: repo, provider: provider}
}

func (s *Service) SearchGoogle(ctx context.Context, userID string, tripID string, date string, input SearchInput) ([]SearchResult, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return nil, ErrProviderUnavailable
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if _, err := uuid.Parse(tripID); err != nil {
		return nil, ErrValidation
	}

	selectedDate, err := time.Parse(dateLayout, date)
	if err != nil {
		return nil, ErrValidation
	}

	query := strings.TrimSpace(input.Query)
	queryLen := len([]rune(query))
	if queryLen < 2 || queryLen > maxQueryLen {
		return nil, ErrValidation
	}

	limit := input.Limit
	if limit == 0 {
		limit = defaultLimit
	}
	if limit < 1 || limit > maxLimit {
		return nil, ErrValidation
	}

	if _, _, err := s.validateTripDayParticipant(ctx, userID, tripID, selectedDate); err != nil {
		return nil, err
	}

	if s.provider == nil {
		return nil, ErrProviderUnavailable
	}

	return s.provider.Search(ctx, ProviderSearchInput{Query: query, Limit: limit})
}

func (s *Service) CreateGooglePlaceDayItineraryItem(ctx context.Context, userID string, tripID string, date string, input CreateGooglePlaceDayItineraryItemInput) (CreateGooglePlaceDayItineraryItemResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateGooglePlaceDayItineraryItemResult{}, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return CreateGooglePlaceDayItineraryItemResult{}, ErrProviderUnavailable
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if _, err := uuid.Parse(tripID); err != nil {
		return CreateGooglePlaceDayItineraryItemResult{}, ErrValidation
	}

	selectedDate, err := time.Parse(dateLayout, date)
	if err != nil {
		return CreateGooglePlaceDayItineraryItemResult{}, ErrValidation
	}

	googlePlaceID := strings.TrimSpace(input.GooglePlaceID)
	if len([]rune(googlePlaceID)) < 1 || len([]rune(googlePlaceID)) > maxGooglePlaceIDLen {
		return CreateGooglePlaceDayItineraryItemResult{}, ErrValidation
	}

	_, dayOrder, err := s.validateTripDayParticipant(ctx, userID, tripID, selectedDate)
	if err != nil {
		return CreateGooglePlaceDayItineraryItemResult{}, err
	}

	dateText := selectedDate.Format(dateLayout)
	var item trip.DayItineraryItem
	if existingPlace, ok, err := s.repo.GetGoogleTripPlaceByGooglePlaceID(ctx, tripID, googlePlaceID); err != nil {
		return CreateGooglePlaceDayItineraryItemResult{}, err
	} else if ok {
		item, err = s.repo.AppendGooglePlaceDayItineraryItem(ctx, AppendGooglePlaceDayItineraryItemRecord{
			TripID:             tripID,
			ScheduledDate:      dateText,
			TripPlaceID:        existingPlace.ID,
			DuplicateConfirmed: input.DuplicateConfirmed,
		})
		if err != nil {
			return CreateGooglePlaceDayItineraryItemResult{}, err
		}
	} else {
		if s.provider == nil {
			return CreateGooglePlaceDayItineraryItemResult{}, ErrProviderUnavailable
		}
		details, err := s.provider.Details(ctx, ProviderDetailsInput{GooglePlaceID: googlePlaceID})
		if err != nil {
			return CreateGooglePlaceDayItineraryItemResult{}, err
		}
		snapshot, err := buildGooglePlaceSnapshot(googlePlaceID, details)
		if err != nil {
			return CreateGooglePlaceDayItineraryItemResult{}, err
		}
		item, err = s.repo.CreateGooglePlaceDayItineraryItem(ctx, CreateGooglePlaceDayItineraryItemRecord{
			TripID:             tripID,
			ScheduledDate:      dateText,
			GooglePlaceID:      snapshot.GooglePlaceID,
			Name:               snapshot.DisplayName,
			Address:            snapshot.FormattedAddress,
			PlaceType:          mapGooglePlaceType(snapshot.PrimaryType, snapshot.Types),
			Latitude:           snapshot.Latitude,
			Longitude:          snapshot.Longitude,
			GooglePrimaryType:  snapshot.PrimaryType,
			GoogleTypes:        snapshot.Types,
			DuplicateConfirmed: input.DuplicateConfirmed,
		})
		if err != nil {
			return CreateGooglePlaceDayItineraryItemResult{}, err
		}
	}

	lodgingPlace, hasLodgingPlace, err := s.repo.GetDayLodgingPlaceByTripAndDate(ctx, tripID, dateText)
	if err != nil {
		return CreateGooglePlaceDayItineraryItemResult{}, err
	}

	return CreateGooglePlaceDayItineraryItemResult{
		Day: trip.TripDay{
			Date:         dateText,
			DayOrder:     dayOrder,
			LodgingPlace: optionalTripPlaceSummary(lodgingPlace, hasLodgingPlace),
		},
		Item: item,
	}, nil
}

func (s *Service) validateTripDayParticipant(ctx context.Context, userID string, tripID string, selectedDate time.Time) (trip.Trip, int, error) {
	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return trip.Trip{}, 0, err
	}
	if !ok {
		return trip.Trip{}, 0, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return trip.Trip{}, 0, err
	}
	if !isParticipant {
		return trip.Trip{}, 0, ErrForbidden
	}

	dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
	if err != nil {
		return trip.Trip{}, 0, ErrValidation
	}
	if dayOrder == 0 {
		return trip.Trip{}, 0, ErrNotFound
	}

	return foundTrip, dayOrder, nil
}

func buildGooglePlaceSnapshot(expectedGooglePlaceID string, details GooglePlaceDetails) (GooglePlaceDetails, error) {
	details.GooglePlaceID = strings.TrimSpace(details.GooglePlaceID)
	if details.GooglePlaceID == "" {
		details.GooglePlaceID = expectedGooglePlaceID
	}
	if details.GooglePlaceID != expectedGooglePlaceID {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	details.DisplayName = strings.TrimSpace(details.DisplayName)
	if len([]rune(details.DisplayName)) < 1 || len([]rune(details.DisplayName)) > maxNameLen {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	details.FormattedAddress = strings.TrimSpace(details.FormattedAddress)
	if len([]rune(details.FormattedAddress)) < 1 || len([]rune(details.FormattedAddress)) > maxAddressLen {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	details.PrimaryType = strings.TrimSpace(details.PrimaryType)
	if details.PrimaryType == "" {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	details.Types = normalizeGoogleTypes(details.Types)
	if len(details.Types) == 0 {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	if details.Latitude < -90 || details.Latitude > 90 || details.Longitude < -180 || details.Longitude > 180 {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	return details, nil
}

func normalizeGoogleTypes(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		normalized := strings.TrimSpace(value)
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true
		result = append(result, normalized)
	}
	return result
}

func mapGooglePlaceType(primaryType string, rawTypes []string) string {
	if mapped, ok := internalPlaceTypeForGoogleType(strings.TrimSpace(primaryType)); ok {
		return mapped
	}
	for _, value := range rawTypes {
		if mapped, ok := internalPlaceTypeForGoogleType(strings.TrimSpace(value)); ok {
			return mapped
		}
	}
	return "etc"
}

func internalPlaceTypeForGoogleType(value string) (string, bool) {
	switch value {
	case "lodging", "hotel", "motel", "resort_hotel", "guest_house", "hostel", "bed_and_breakfast":
		return "lodging", true
	case "cafe", "coffee_shop":
		return "cafe", true
	case "restaurant", "meal_takeaway", "meal_delivery", "bakery", "bar", "food":
		return "food", true
	case "shopping_mall", "store", "department_store", "clothing_store", "supermarket", "convenience_store":
		return "shopping", true
	case "tourist_attraction", "museum", "park", "art_gallery", "amusement_park", "zoo", "aquarium", "landmark", "historical_landmark", "place_of_worship":
		return "sights", true
	default:
		return "", false
	}
}

func dateInTripRange(start string, end string, selected time.Time) (bool, error) {
	_, dayOrder, err := tripRange(start, end, selected)
	return dayOrder > 0, err
}

func dayOrderInRange(start string, end string, selected time.Time) (int, error) {
	_, dayOrder, err := tripRange(start, end, selected)
	return dayOrder, err
}

func tripRange(start string, end string, selected time.Time) (time.Time, int, error) {
	startDate, err := time.Parse(dateLayout, strings.TrimSpace(start))
	if err != nil {
		return time.Time{}, 0, err
	}
	endDate, err := time.Parse(dateLayout, strings.TrimSpace(end))
	if err != nil {
		return time.Time{}, 0, err
	}
	selected = dateOnly(selected)
	startDate = dateOnly(startDate)
	endDate = dateOnly(endDate)
	if selected.Before(startDate) || selected.After(endDate) {
		return startDate, 0, nil
	}
	return startDate, int(selected.Sub(startDate).Hours()/24) + 1, nil
}

func optionalTripPlaceSummary(value trip.TripPlaceSummary, ok bool) *trip.TripPlaceSummary {
	if !ok {
		return nil
	}
	return &value
}

func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}
