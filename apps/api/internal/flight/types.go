package flight

import (
	"errors"
	"time"
)

var (
	ErrValidation           = errors.New("validation error")
	ErrUnauthorized         = errors.New("unauthorized")
	ErrForbidden            = errors.New("forbidden")
	ErrNotFound             = errors.New("not found")
	ErrUploadTooLarge       = errors.New("upload too large")
	ErrUnsupportedMediaType = errors.New("unsupported media type")
	ErrStorageUnavailable   = errors.New("storage unavailable")
)

type FlightEndpointInput struct {
	AirportText string
	AirportCode *string
	LocalDate   string
	LocalTime   string
	TimeZone    string
}

type CreateFlightInput struct {
	DisplayTitle string
	FlightNumber *string
	Departure    FlightEndpointInput
	Arrival      FlightEndpointInput
	PassengerIDs []string
}

type UpsertPersonalDetailInput struct {
	ReservationNumber *string
	Seat              *string
	CheckInURL        *string
}

type FlightEndpoint struct {
	AirportText string
	AirportCode *string
	LocalDate   string
	LocalTime   string
	TimeZone    string
	At          time.Time
}

type Flight struct {
	ID              string
	TripID          string
	DisplayTitle    string
	FlightNumber    *string
	Departure       FlightEndpoint
	Arrival         FlightEndpoint
	CreatedByUserID string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Passenger struct {
	ParticipantID string
	DisplayName   string
}

type FlightDetail struct {
	Flight
	Passengers       []Passenger
	MyPersonalDetail *PersonalDetail
}

type PersonalDetail struct {
	ID                     string
	FlightID               string
	TripID                 string
	PassengerParticipantID string
	CreatedByUserID        string
	ReservationNumber      *string
	Seat                   *string
	CheckInURL             *string
	BoardingPass           BoardingPassSummary
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type BoardingPassSummary struct {
	Exists      bool
	ContentType *string
	ByteSize    *int
	UploadedAt  *time.Time
}

type BoardingPassObject struct {
	Bucket      string
	ObjectKey   string
	Generation  *string
	ContentType string
	ByteSize    int
	UploadedAt  time.Time
}

type SignedBoardingPassURL struct {
	URL         string
	ExpiresAt   time.Time
	ContentType string
	ByteSize    int
}

type CreateFlightRecord struct {
	TripID          string
	CreatedByUserID string
	DisplayTitle    string
	FlightNumber    *string
	Departure       FlightEndpoint
	Arrival         FlightEndpoint
	PassengerIDs    []string
}

type UpsertPersonalDetailRecord struct {
	TripID                 string
	FlightID               string
	PassengerParticipantID string
	CreatedByUserID        string
	ReservationNumber      *string
	Seat                   *string
	CheckInURL             *string
}

type UpsertBoardingPassMetadataRecord struct {
	TripID                 string
	FlightID               string
	PassengerParticipantID string
	CreatedByUserID        string
	Object                 BoardingPassObject
}
