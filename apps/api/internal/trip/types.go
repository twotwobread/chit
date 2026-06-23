package trip

import (
	"context"
	"errors"
	"time"
)

const (
	RoleOwner  = "owner"
	RoleMember = "member"
)

var (
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
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

type UpdateInput struct {
	Name            *string
	StartDate       *string
	EndDate         *string
	DefaultCurrency *string
}

type CreateManualDayItineraryItemInput struct {
	Name      string
	Address   string
	PlaceType string
}

type UpdateDayItineraryItemInput struct {
	Name      *string
	Address   *string
	PlaceType *string
}

type ReorderDayItineraryMoveInput struct {
	ItemID        string
	BeforeItemID  *string
	AfterItemID   *string
	ClientVersion int
}

type CreateRecord struct {
	Name             string
	StartDate        time.Time
	EndDate          time.Time
	DefaultCurrency  string
	CreatedBy        string
	OwnerDisplayName string
}

type UpdateRecord struct {
	ID              string
	Name            string
	StartDate       time.Time
	EndDate         time.Time
	DefaultCurrency string
}

type CreateManualDayItineraryItemRecord struct {
	TripID        string
	ScheduledDate string
	Name          string
	Address       string
	PlaceType     string
}

type UpdateDayItineraryItemRecord struct {
	TripID        string
	ScheduledDate string
	ItemID        string
	Name          string
	Address       string
	PlaceType     string
}

type ReorderDayItineraryMoveRecord struct {
	ItemID        string
	BeforeItemID  *string
	AfterItemID   *string
	ClientVersion int
}

type ReorderDayItineraryItemsRecord struct {
	TripID        string
	ScheduledDate string
	Moves         []ReorderDayItineraryMoveRecord
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

type TripDay struct {
	Date     string
	DayOrder int
}

type CreateResult struct {
	Trip             Trip
	OwnerParticipant Participant
}

type UpdateResult struct {
	Trip Trip
}

type ParticipantSummary struct {
	TotalCount    int
	PreviewNames  []string
	OverflowCount int
}

type GetDetailResult struct {
	Trip               Trip
	ParticipantSummary ParticipantSummary
	Days               []TripDay
}

type TripPlaceSummary struct {
	ID        string
	Name      string
	PlaceType string
	Address   string
}

type DayItineraryItem struct {
	ID        string
	ItemOrder int
	Version   int
	Place     TripPlaceSummary
}

type GetDayItineraryResult struct {
	Day   TripDay
	Items []DayItineraryItem
}

type CreateManualDayItineraryItemResult struct {
	Day  TripDay
	Item DayItineraryItem
}

type UpdateDayItineraryItemResult struct {
	Item DayItineraryItem
}

type ReorderDayItineraryItemsResult struct {
	Day   TripDay
	Items []DayItineraryItem
}

type ListItem struct {
	ID               string
	Name             string
	StartDate        string
	EndDate          string
	DefaultCurrency  string
	JoinedAt         time.Time
	CreatedAt        time.Time
	MyRole           string
	ParticipantCount int
}

type Repository interface {
	GetCreator(ctx context.Context, userID string) (Creator, bool, error)
	CreateTripWithOwner(ctx context.Context, record CreateRecord) (CreateResult, error)
	GetTripByID(ctx context.Context, tripID string) (Trip, bool, error)
	IsTripParticipant(ctx context.Context, tripID string, userID string) (bool, error)
	IsTripOwner(ctx context.Context, tripID string, userID string) (bool, error)
	UpdateTripBasicInfo(ctx context.Context, record UpdateRecord) (Trip, error)
	DeleteTripByID(ctx context.Context, tripID string) (bool, error)
	CountTripParticipants(ctx context.Context, tripID string) (int, error)
	ListTripParticipantPreviewNames(ctx context.Context, tripID string) ([]string, error)
	ListTripsByParticipantUser(ctx context.Context, userID string) ([]ListItem, error)
	ListItineraryItemsByTripAndDate(ctx context.Context, tripID string, date string) ([]DayItineraryItem, error)
	CreateManualDayItineraryItem(ctx context.Context, record CreateManualDayItineraryItemRecord) (DayItineraryItem, error)
	GetItineraryItemByTripDateAndID(ctx context.Context, tripID string, date string, itemID string) (DayItineraryItem, bool, error)
	ReorderDayItineraryItems(ctx context.Context, record ReorderDayItineraryItemsRecord) ([]DayItineraryItem, error)
	UpdateDayItineraryItemPlace(ctx context.Context, record UpdateDayItineraryItemRecord) (DayItineraryItem, error)
	DeleteDayItineraryItem(ctx context.Context, tripID string, date string, itemID string) (bool, error)
}
