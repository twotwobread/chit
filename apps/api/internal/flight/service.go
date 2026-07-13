package flight

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	dateLayout                 = "2006-01-02"
	timeLayout                 = "15:04"
	MaxBoardingPassBytes       = 10 * 1024 * 1024
	boardingPassSignedURLTTL   = 5 * time.Minute
	boardingPassObjectKeyBytes = 16
)

type Repository interface {
	GetTripParticipantID(ctx context.Context, tripID string, userID string) (string, error)
	CreateFlightWithPassengers(ctx context.Context, record CreateFlightRecord) (FlightDetail, error)
	ListFlights(ctx context.Context, tripID string, userID string) ([]FlightDetail, error)
	GetFlight(ctx context.Context, tripID string, flightID string, userID string) (FlightDetail, error)
	GetFlightPassengerParticipantID(ctx context.Context, tripID string, flightID string, userID string) (string, error)
	UpsertPersonalDetail(ctx context.Context, record UpsertPersonalDetailRecord) (PersonalDetail, error)
	UpsertBoardingPassMetadata(ctx context.Context, record UpsertBoardingPassMetadataRecord) (PersonalDetail, *BoardingPassObject, error)
	ClearBoardingPassMetadata(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (*BoardingPassObject, error)
	GetBoardingPassObject(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (BoardingPassObject, error)
}

type BoardingPassObjectStore interface {
	UploadBoardingPass(ctx context.Context, objectKey string, contentType string, data []byte) (BoardingPassObject, error)
	DeleteObject(ctx context.Context, object BoardingPassObject) error
	SignedGetURL(ctx context.Context, object BoardingPassObject, ttl time.Duration) (SignedBoardingPassURL, error)
}

type ServiceOption func(*Service)

type Service struct {
	repo        Repository
	objectStore BoardingPassObjectStore
	now         func() time.Time
}

func NewService(repo Repository, options ...ServiceOption) *Service {
	service := &Service{repo: repo, now: func() time.Time { return time.Now().UTC() }}
	for _, option := range options {
		option(service)
	}
	return service
}

func WithBoardingPassObjectStore(store BoardingPassObjectStore) ServiceOption {
	return func(s *Service) { s.objectStore = store }
}

func WithNow(now func() time.Time) ServiceOption {
	return func(s *Service) {
		if now != nil {
			s.now = now
		}
	}
}

func (s *Service) ListFlights(ctx context.Context, userID string, tripID string) ([]FlightDetail, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if tripID == "" || s.repo == nil {
		return nil, ErrValidation
	}
	if _, err := s.repo.GetTripParticipantID(ctx, tripID, userID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrForbidden
		}
		return nil, err
	}
	return s.repo.ListFlights(ctx, tripID, strings.TrimSpace(userID))
}

func (s *Service) GetFlight(ctx context.Context, userID string, tripID string, flightID string) (FlightDetail, error) {
	if strings.TrimSpace(userID) == "" {
		return FlightDetail{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	flightID = strings.TrimSpace(flightID)
	if tripID == "" || flightID == "" || s.repo == nil {
		return FlightDetail{}, ErrValidation
	}
	if _, err := s.repo.GetTripParticipantID(ctx, tripID, userID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return FlightDetail{}, ErrForbidden
		}
		return FlightDetail{}, err
	}
	return s.repo.GetFlight(ctx, tripID, flightID, strings.TrimSpace(userID))
}

func (s *Service) CreateFlight(ctx context.Context, userID string, tripID string, input CreateFlightInput) (FlightDetail, error) {
	if strings.TrimSpace(userID) == "" {
		return FlightDetail{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if tripID == "" || s.repo == nil {
		return FlightDetail{}, ErrValidation
	}
	if _, err := s.repo.GetTripParticipantID(ctx, tripID, userID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return FlightDetail{}, ErrForbidden
		}
		return FlightDetail{}, err
	}

	displayTitle := strings.TrimSpace(input.DisplayTitle)
	if len([]rune(displayTitle)) < 1 || len([]rune(displayTitle)) > 80 {
		return FlightDetail{}, ErrValidation
	}
	flightNumber := normalizeOptionalUpper(input.FlightNumber)
	if flightNumber != nil && len([]rune(*flightNumber)) > 20 {
		return FlightDetail{}, ErrValidation
	}
	passengerIDs, err := normalizePassengerIDs(input.PassengerIDs)
	if err != nil {
		return FlightDetail{}, err
	}
	departure, err := normalizeEndpoint(input.Departure)
	if err != nil {
		return FlightDetail{}, err
	}
	arrival, err := normalizeEndpoint(input.Arrival)
	if err != nil {
		return FlightDetail{}, err
	}
	if !arrival.At.After(departure.At) {
		return FlightDetail{}, ErrValidation
	}

	return s.repo.CreateFlightWithPassengers(ctx, CreateFlightRecord{
		TripID:          tripID,
		CreatedByUserID: strings.TrimSpace(userID),
		DisplayTitle:    displayTitle,
		FlightNumber:    flightNumber,
		Departure:       departure,
		Arrival:         arrival,
		PassengerIDs:    passengerIDs,
	})
}

func (s *Service) UpsertMyPersonalDetail(ctx context.Context, userID string, tripID string, flightID string, input UpsertPersonalDetailInput) (PersonalDetail, error) {
	if strings.TrimSpace(userID) == "" {
		return PersonalDetail{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	flightID = strings.TrimSpace(flightID)
	if tripID == "" || flightID == "" || s.repo == nil {
		return PersonalDetail{}, ErrValidation
	}
	participantID, err := s.repo.GetFlightPassengerParticipantID(ctx, tripID, flightID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return PersonalDetail{}, ErrForbidden
		}
		return PersonalDetail{}, err
	}
	reservationNumber, err := normalizeOptionalText(input.ReservationNumber, 80)
	if err != nil {
		return PersonalDetail{}, err
	}
	seat, err := normalizeOptionalText(input.Seat, 20)
	if err != nil {
		return PersonalDetail{}, err
	}
	checkInURL, err := normalizeOptionalURL(input.CheckInURL)
	if err != nil {
		return PersonalDetail{}, err
	}
	return s.repo.UpsertPersonalDetail(ctx, UpsertPersonalDetailRecord{
		TripID:                 tripID,
		FlightID:               flightID,
		PassengerParticipantID: participantID,
		CreatedByUserID:        strings.TrimSpace(userID),
		ReservationNumber:      reservationNumber,
		Seat:                   seat,
		CheckInURL:             checkInURL,
	})
}

func (s *Service) UploadMyBoardingPass(ctx context.Context, userID string, tripID string, flightID string, contentType string, data []byte) (PersonalDetail, error) {
	if strings.TrimSpace(userID) == "" {
		return PersonalDetail{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	flightID = strings.TrimSpace(flightID)
	if tripID == "" || flightID == "" || s.repo == nil {
		return PersonalDetail{}, ErrValidation
	}
	if err := validateBoardingPassUpload(contentType, data); err != nil {
		return PersonalDetail{}, err
	}
	if s.objectStore == nil {
		return PersonalDetail{}, ErrStorageUnavailable
	}
	participantID, err := s.repo.GetFlightPassengerParticipantID(ctx, tripID, flightID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return PersonalDetail{}, ErrForbidden
		}
		return PersonalDetail{}, err
	}
	objectKey, err := newBoardingPassObjectKey(tripID, flightID, participantID)
	if err != nil {
		return PersonalDetail{}, err
	}
	stored, err := s.objectStore.UploadBoardingPass(ctx, objectKey, strings.TrimSpace(contentType), data)
	if err != nil {
		if errors.Is(err, ErrStorageUnavailable) {
			return PersonalDetail{}, ErrStorageUnavailable
		}
		return PersonalDetail{}, err
	}
	if stored.UploadedAt.IsZero() {
		stored.UploadedAt = s.now().UTC()
	}
	stored.ContentType = strings.TrimSpace(contentType)
	stored.ByteSize = len(data)
	detail, oldObject, err := s.repo.UpsertBoardingPassMetadata(ctx, UpsertBoardingPassMetadataRecord{TripID: tripID, FlightID: flightID, PassengerParticipantID: participantID, CreatedByUserID: strings.TrimSpace(userID), Object: stored})
	if err != nil {
		_ = s.objectStore.DeleteObject(ctx, stored)
		return PersonalDetail{}, err
	}
	if oldObject != nil {
		_ = s.objectStore.DeleteObject(ctx, *oldObject)
	}
	return detail, nil
}

func (s *Service) DeleteMyBoardingPass(ctx context.Context, userID string, tripID string, flightID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	flightID = strings.TrimSpace(flightID)
	if tripID == "" || flightID == "" || s.repo == nil {
		return ErrValidation
	}
	participantID, err := s.repo.GetFlightPassengerParticipantID(ctx, tripID, flightID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return ErrForbidden
		}
		return err
	}
	oldObject, err := s.repo.ClearBoardingPassMetadata(ctx, tripID, flightID, participantID)
	if err != nil {
		return err
	}
	if oldObject != nil && s.objectStore != nil {
		_ = s.objectStore.DeleteObject(ctx, *oldObject)
	}
	return nil
}

func (s *Service) OpenMyBoardingPass(ctx context.Context, userID string, tripID string, flightID string) (SignedBoardingPassURL, error) {
	if strings.TrimSpace(userID) == "" {
		return SignedBoardingPassURL{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	flightID = strings.TrimSpace(flightID)
	if tripID == "" || flightID == "" || s.repo == nil {
		return SignedBoardingPassURL{}, ErrValidation
	}
	if s.objectStore == nil {
		return SignedBoardingPassURL{}, ErrStorageUnavailable
	}
	participantID, err := s.repo.GetFlightPassengerParticipantID(ctx, tripID, flightID, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return SignedBoardingPassURL{}, ErrForbidden
		}
		return SignedBoardingPassURL{}, err
	}
	object, err := s.repo.GetBoardingPassObject(ctx, tripID, flightID, participantID)
	if err != nil {
		return SignedBoardingPassURL{}, err
	}
	result, err := s.objectStore.SignedGetURL(ctx, object, boardingPassSignedURLTTL)
	if err != nil {
		if errors.Is(err, ErrStorageUnavailable) {
			return SignedBoardingPassURL{}, ErrStorageUnavailable
		}
		return SignedBoardingPassURL{}, err
	}
	if result.ContentType == "" {
		result.ContentType = object.ContentType
	}
	if result.ByteSize == 0 {
		result.ByteSize = object.ByteSize
	}
	if result.ExpiresAt.IsZero() || result.ExpiresAt.After(s.now().UTC().Add(boardingPassSignedURLTTL+time.Second)) {
		result.ExpiresAt = s.now().UTC().Add(boardingPassSignedURLTTL)
	}
	return result, nil
}

func normalizeEndpoint(input FlightEndpointInput) (FlightEndpoint, error) {
	airportText := strings.TrimSpace(input.AirportText)
	if len([]rune(airportText)) < 1 || len([]rune(airportText)) > 120 {
		return FlightEndpoint{}, ErrValidation
	}
	airportCode := normalizeOptionalUpper(input.AirportCode)
	if airportCode != nil && len([]rune(*airportCode)) > 8 {
		return FlightEndpoint{}, ErrValidation
	}
	localDate := strings.TrimSpace(input.LocalDate)
	localTime := strings.TrimSpace(input.LocalTime)
	timeZone := strings.TrimSpace(input.TimeZone)
	dateValue, err := time.Parse(dateLayout, localDate)
	if err != nil {
		return FlightEndpoint{}, ErrValidation
	}
	timeValue, err := time.Parse(timeLayout, localTime)
	if err != nil {
		return FlightEndpoint{}, ErrValidation
	}
	location, err := time.LoadLocation(timeZone)
	if err != nil {
		return FlightEndpoint{}, ErrValidation
	}
	instant := time.Date(dateValue.Year(), dateValue.Month(), dateValue.Day(), timeValue.Hour(), timeValue.Minute(), 0, 0, location)
	local := instant.In(location)
	if local.Year() != dateValue.Year() || local.Month() != dateValue.Month() || local.Day() != dateValue.Day() || local.Hour() != timeValue.Hour() || local.Minute() != timeValue.Minute() {
		return FlightEndpoint{}, ErrValidation
	}
	return FlightEndpoint{AirportText: airportText, AirportCode: airportCode, LocalDate: localDate, LocalTime: localTime, TimeZone: timeZone, At: instant.UTC()}, nil
}

func normalizePassengerIDs(values []string) ([]string, error) {
	if len(values) == 0 {
		return nil, ErrValidation
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil, ErrValidation
		}
		if _, ok := seen[trimmed]; ok {
			return nil, ErrValidation
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result, nil
}

func validateBoardingPassUpload(contentType string, data []byte) error {
	contentType = strings.TrimSpace(contentType)
	if len(data) > MaxBoardingPassBytes {
		return ErrUploadTooLarge
	}
	if len(data) == 0 {
		return ErrValidation
	}
	if !isSupportedBoardingPassContentType(contentType) {
		return ErrUnsupportedMediaType
	}
	detected := detectBoardingPassContentType(data)
	if detected != contentType {
		return ErrUnsupportedMediaType
	}
	return nil
}

func isSupportedBoardingPassContentType(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func detectBoardingPassContentType(data []byte) string {
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp"
	}
	return http.DetectContentType(data)
}

func newBoardingPassObjectKey(tripID string, flightID string, participantID string) (string, error) {
	bytes := make([]byte, boardingPassObjectKeyBytes)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return fmt.Sprintf("boarding-passes/trips/%s/flights/%s/participants/%s/%s", tripID, flightID, participantID, hex.EncodeToString(bytes)), nil
}

func normalizeOptionalUpper(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	upper := strings.ToUpper(trimmed)
	return &upper
}

func normalizeOptionalText(value *string, maxRunes int) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if len([]rune(trimmed)) > maxRunes {
		return nil, ErrValidation
	}
	return &trimmed, nil
}

func normalizeOptionalURL(value *string) (*string, error) {
	trimmed, err := normalizeOptionalText(value, 500)
	if err != nil || trimmed == nil {
		return trimmed, err
	}
	parsed, err := url.ParseRequestURI(*trimmed)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, ErrValidation
	}
	return trimmed, nil
}
