package place

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

const (
	dateLayout          = "2006-01-02"
	defaultLimit        = 10
	maxLimit            = 10
	maxQueryLen         = 120
	maxGooglePlaceIDLen = 255
	maxNameLen          = 120
	maxAddressLen       = 240
	maxTitleLen         = 120
	maxMemoLen          = 1000
)

type Service struct {
	repo             Repository
	provider         Provider
	photoTokenSecret []byte
	now              func() time.Time
}

type Option func(*Service)

func WithPhotoTokenSecret(secret string) Option {
	return func(s *Service) {
		trimmed := strings.TrimSpace(secret)
		if trimmed != "" {
			s.photoTokenSecret = []byte(trimmed)
		}
	}
}

func NewService(repo Repository, provider Provider, options ...Option) *Service {
	service := &Service{
		repo:             repo,
		provider:         provider,
		photoTokenSecret: []byte("i-um-place-photo-token-dev-secret"),
		now:              time.Now,
	}
	for _, option := range options {
		option(service)
	}
	return service
}

func (s *Service) SearchDestinations(ctx context.Context, userID string, input DestinationSearchInput) ([]DestinationSearchResult, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
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
	if s == nil || s.provider == nil {
		return nil, ErrProviderUnavailable
	}
	results, err := s.provider.SearchDestinations(ctx, ProviderDestinationSearchInput{Query: query, Limit: limit})
	if err != nil {
		return nil, err
	}
	return normalizeDestinationResults(results), nil
}

func normalizeDestinationResults(results []DestinationSearchResult) []DestinationSearchResult {
	normalized := make([]DestinationSearchResult, 0, len(results))
	seen := map[string]struct{}{}
	for _, result := range results {
		result.CityName = strings.TrimSpace(result.CityName)
		result.CountryName = strings.TrimSpace(result.CountryName)
		result.CountryCode = strings.ToUpper(strings.TrimSpace(result.CountryCode))
		result.DisplayName = strings.TrimSpace(result.DisplayName)
		result.Provider = strings.TrimSpace(result.Provider)
		result.ProviderPlaceID = strings.TrimSpace(result.ProviderPlaceID)
		if len([]rune(result.CityName)) < 1 || len([]rune(result.CityName)) > maxNameLen || len([]rune(result.CountryName)) < 1 || len([]rune(result.CountryName)) > maxNameLen || len([]rune(result.DisplayName)) < 1 || len([]rune(result.DisplayName)) > 160 {
			continue
		}
		if !validCountryCode(result.CountryCode) || result.Provider != DestinationProviderGoogle || len([]rune(result.ProviderPlaceID)) < 1 || len([]rune(result.ProviderPlaceID)) > maxGooglePlaceIDLen {
			continue
		}
		if result.Latitude < -90 || result.Latitude > 90 || result.Longitude < -180 || result.Longitude > 180 || result.RadiusMeters < 1 || result.RadiusMeters > 500000 {
			continue
		}
		key := result.Provider + ":" + result.ProviderPlaceID
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, result)
	}
	return normalized
}

func validCountryCode(value string) bool {
	if len(value) != 2 {
		return false
	}
	for _, char := range value {
		if char < 'A' || char > 'Z' {
			return false
		}
	}
	return true
}

func SearchDestinationDisplayName(cityName string, countryName string) string {
	cityName = strings.TrimSpace(cityName)
	countryName = strings.TrimSpace(countryName)
	if cityName == "" {
		return countryName
	}
	if countryName == "" || cityName == countryName {
		return cityName
	}
	return cityName + ", " + countryName
}

func (s *Service) SearchGoogle(ctx context.Context, userID string, tripID string, tripDayID string, input SearchInput) ([]SearchResult, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return nil, ErrProviderUnavailable
	}

	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	if _, err := uuid.Parse(tripID); err != nil {
		return nil, ErrValidation
	}
	if _, err := uuid.Parse(tripDayID); err != nil {
		if _, parseErr := time.Parse(dateLayout, tripDayID); parseErr != nil {
			return nil, ErrValidation
		}
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
	if input.LocationBias != nil && !validLocationBias(*input.LocationBias) {
		return nil, ErrValidation
	}

	if _, err := s.validateTripDayParticipant(ctx, userID, tripID, tripDayID); err != nil {
		return nil, err
	}

	if s.provider == nil {
		return nil, ErrProviderUnavailable
	}

	results, err := s.provider.Search(ctx, ProviderSearchInput{Query: query, Limit: limit, LocationBias: input.LocationBias})
	if err != nil {
		return nil, err
	}
	for index := range results {
		if results[index].Photo == nil || strings.TrimSpace(results[index].Photo.Name) == "" {
			continue
		}
		results[index].Photo.Token = s.signPhotoToken(tripID, tripDayID, results[index].Photo.Name)
	}
	return results, nil
}

func (s *Service) GetGooglePlaceDetails(ctx context.Context, userID string, tripID string, tripDayID string, input SelectedDetailsInput) (GooglePlaceDescription, error) {
	if strings.TrimSpace(userID) == "" {
		return GooglePlaceDescription{}, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}
	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	if _, err := uuid.Parse(tripID); err != nil {
		return GooglePlaceDescription{}, ErrValidation
	}
	if _, err := uuid.Parse(tripDayID); err != nil {
		if _, parseErr := time.Parse(dateLayout, tripDayID); parseErr != nil {
			return GooglePlaceDescription{}, ErrValidation
		}
	}
	googlePlaceID := strings.TrimSpace(input.GooglePlaceID)
	if len([]rune(googlePlaceID)) < 1 || len([]rune(googlePlaceID)) > maxGooglePlaceIDLen {
		return GooglePlaceDescription{}, ErrValidation
	}
	if _, err := s.validateTripDayParticipant(ctx, userID, tripID, tripDayID); err != nil {
		return GooglePlaceDescription{}, err
	}
	if s.provider == nil {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}
	return s.provider.Description(ctx, ProviderDescriptionInput{GooglePlaceID: googlePlaceID})
}

func (s *Service) GetGooglePlacePhoto(ctx context.Context, userID string, tripID string, tripDayID string, input PhotoInput) (GooglePlacePhoto, error) {
	if strings.TrimSpace(userID) == "" {
		return GooglePlacePhoto{}, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}
	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	if _, err := uuid.Parse(tripID); err != nil {
		return GooglePlacePhoto{}, ErrValidation
	}
	if _, err := uuid.Parse(tripDayID); err != nil {
		if _, parseErr := time.Parse(dateLayout, tripDayID); parseErr != nil {
			return GooglePlacePhoto{}, ErrValidation
		}
	}
	name, err := s.verifyPhotoToken(tripID, tripDayID, input.Token)
	if err != nil || input.MaxWidthPx < 1 || input.MaxWidthPx > 640 {
		return GooglePlacePhoto{}, ErrValidation
	}
	if _, err := s.validateTripDayParticipant(ctx, userID, tripID, tripDayID); err != nil {
		return GooglePlacePhoto{}, err
	}
	if s.provider == nil {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}
	return s.provider.Photo(ctx, ProviderPhotoInput{Name: name, MaxWidthPx: input.MaxWidthPx})
}

func (s *Service) CreateGooglePlaceScheduleItem(ctx context.Context, userID string, tripID string, tripDayID string, input CreateGooglePlaceScheduleItemInput) (CreateGooglePlaceScheduleItemResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateGooglePlaceScheduleItemResult{}, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return CreateGooglePlaceScheduleItemResult{}, ErrProviderUnavailable
	}

	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	if _, err := uuid.Parse(tripID); err != nil {
		return CreateGooglePlaceScheduleItemResult{}, ErrValidation
	}
	if _, err := uuid.Parse(tripDayID); err != nil {
		if _, parseErr := time.Parse(dateLayout, tripDayID); parseErr != nil {
			return CreateGooglePlaceScheduleItemResult{}, ErrValidation
		}
	}

	googlePlaceID := strings.TrimSpace(input.GooglePlaceID)
	if len([]rune(googlePlaceID)) < 1 || len([]rune(googlePlaceID)) > maxGooglePlaceIDLen {
		return CreateGooglePlaceScheduleItemResult{}, ErrValidation
	}
	title, startTime, endTime, memo, err := normalizePlaceScheduleDetails(input)
	if err != nil {
		return CreateGooglePlaceScheduleItemResult{}, err
	}

	day, err := s.validateTripDayParticipant(ctx, userID, tripID, tripDayID)
	if err != nil {
		return CreateGooglePlaceScheduleItemResult{}, err
	}

	var item trip.ScheduleItem
	if existingPlace, ok, err := s.repo.GetGoogleTripPlaceByGooglePlaceID(ctx, tripID, googlePlaceID); err != nil {
		return CreateGooglePlaceScheduleItemResult{}, err
	} else if ok {
		item, err = s.repo.AppendGooglePlaceScheduleItem(ctx, AppendGooglePlaceScheduleItemRecord{
			TripID:             tripID,
			TripDayID:          tripDayID,
			TripPlaceID:        existingPlace.ID,
			DuplicateConfirmed: input.DuplicateConfirmed,
			Title:              title,
			StartTime:          startTime,
			EndTime:            endTime,
			Memo:               memo,
		})
		if err != nil {
			return CreateGooglePlaceScheduleItemResult{}, err
		}
	} else {
		if s.provider == nil {
			return CreateGooglePlaceScheduleItemResult{}, ErrProviderUnavailable
		}
		details, err := s.provider.Details(ctx, ProviderDetailsInput{GooglePlaceID: googlePlaceID})
		if err != nil {
			return CreateGooglePlaceScheduleItemResult{}, err
		}
		snapshot, err := buildGooglePlaceSnapshot(googlePlaceID, details)
		if err != nil {
			return CreateGooglePlaceScheduleItemResult{}, err
		}
		item, err = s.repo.CreateGooglePlaceScheduleItem(ctx, CreateGooglePlaceScheduleItemRecord{
			TripID:             tripID,
			TripDayID:          tripDayID,
			GooglePlaceID:      snapshot.GooglePlaceID,
			Name:               snapshot.DisplayName,
			Address:            snapshot.FormattedAddress,
			PlaceType:          mapGooglePlaceType(snapshot.PrimaryType, snapshot.Types),
			Latitude:           snapshot.Latitude,
			Longitude:          snapshot.Longitude,
			GooglePrimaryType:  snapshot.PrimaryType,
			GoogleTypes:        snapshot.Types,
			DuplicateConfirmed: input.DuplicateConfirmed,
			Title:              title,
			StartTime:          startTime,
			EndTime:            endTime,
			Memo:               memo,
		})
		if err != nil {
			return CreateGooglePlaceScheduleItemResult{}, err
		}
	}

	return CreateGooglePlaceScheduleItemResult{Day: day, Item: item}, nil
}

func normalizePlaceScheduleDetails(input CreateGooglePlaceScheduleItemInput) (string, *string, *string, *string, error) {
	title := strings.TrimSpace(input.Title)
	if len([]rune(title)) < 1 || len([]rune(title)) > maxTitleLen {
		return "", nil, nil, nil, ErrValidation
	}
	startTime, err := normalizeOptionalScheduleTime(input.StartTime)
	if err != nil {
		return "", nil, nil, nil, err
	}
	endTime, err := normalizeOptionalScheduleTime(input.EndTime)
	if err != nil {
		return "", nil, nil, nil, err
	}
	if endTime != nil && startTime == nil {
		return "", nil, nil, nil, ErrValidation
	}
	if startTime != nil && endTime != nil && *endTime <= *startTime {
		return "", nil, nil, nil, ErrValidation
	}
	memo, err := normalizeOptionalMemo(input.Memo)
	if err != nil {
		return "", nil, nil, nil, err
	}
	return title, startTime, endTime, memo, nil
}

func normalizeOptionalScheduleTime(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if len(trimmed) != 5 || trimmed[2] != ':' {
		return nil, ErrValidation
	}
	if _, err := time.Parse("15:04", trimmed); err != nil {
		return nil, ErrValidation
	}
	return &trimmed, nil
}

func normalizeOptionalMemo(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if len([]rune(trimmed)) > maxMemoLen {
		return nil, ErrValidation
	}
	return &trimmed, nil
}

func (s *Service) validateTripDayParticipant(ctx context.Context, userID string, tripID string, tripDayID string) (trip.TripDay, error) {
	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return trip.TripDay{}, err
	}
	if !ok {
		return trip.TripDay{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return trip.TripDay{}, err
	}
	if !isParticipant {
		return trip.TripDay{}, ErrForbidden
	}

	if _, err := uuid.Parse(tripDayID); err != nil {
		selectedDate, parseErr := time.Parse(dateLayout, tripDayID)
		if parseErr != nil {
			return trip.TripDay{}, ErrValidation
		}
		dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
		if err != nil {
			return trip.TripDay{}, ErrValidation
		}
		if dayOrder == 0 {
			return trip.TripDay{}, ErrNotFound
		}
		return trip.TripDay{ID: tripDayID, Date: selectedDate.Format(dateLayout), DayOrder: dayOrder}, nil
	}
	day, ok, err := s.repo.GetActiveTripDayByTripAndID(ctx, tripID, tripDayID)
	if err != nil {
		return trip.TripDay{}, err
	}
	if !ok {
		return trip.TripDay{}, ErrNotFound
	}
	return day, nil
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

type photoTokenPayload struct {
	TripID    string `json:"tripId"`
	TripDayID string `json:"tripDayId"`
	PhotoName string `json:"photoName"`
	ExpiresAt int64  `json:"expiresAt"`
}

func (s *Service) signPhotoToken(tripID string, tripDayID string, photoName string) string {
	payload := photoTokenPayload{
		TripID:    tripID,
		TripDayID: tripDayID,
		PhotoName: strings.TrimSpace(photoName),
		ExpiresAt: s.now().Add(15 * time.Minute).Unix(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	encodedBody := base64.RawURLEncoding.EncodeToString(body)
	signature := hmacSignature([]byte(encodedBody), s.photoTokenSecret)
	return encodedBody + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func (s *Service) verifyPhotoToken(tripID string, tripDayID string, token string) (string, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", ErrValidation
	}
	actualSignature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ErrValidation
	}
	expectedSignature := hmacSignature([]byte(parts[0]), s.photoTokenSecret)
	if !hmac.Equal(actualSignature, expectedSignature) {
		return "", ErrValidation
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", ErrValidation
	}
	var payload photoTokenPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return "", ErrValidation
	}
	if payload.TripID != tripID || payload.TripDayID != tripDayID || strings.TrimSpace(payload.PhotoName) == "" || s.now().Unix() > payload.ExpiresAt {
		return "", ErrValidation
	}
	return payload.PhotoName, nil
}

func hmacSignature(value []byte, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(value)
	return mac.Sum(nil)
}

func validLocationBias(value SearchLocationBias) bool {
	return value.Latitude >= -90 && value.Latitude <= 90 && value.Longitude >= -180 && value.Longitude <= 180 && value.RadiusMeters >= 1 && value.RadiusMeters <= 50000
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
