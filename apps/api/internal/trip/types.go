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
	ErrValidation     = errors.New("validation error")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrForbidden      = errors.New("forbidden")
	ErrNotFound       = errors.New("not found")
	ErrConflict       = errors.New("conflict")
	ErrInviteNotFound = errors.New("invite not found")
	ErrInviteExpired  = errors.New("invite expired")
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

type SetDayLodgingPlaceInput struct {
	TripPlaceID string
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

type MarkDayItineraryItemArrivedRecord struct {
	TripID        string
	ScheduledDate string
	ItemID        string
}

type SetDayLodgingPlaceRecord struct {
	TripID        string
	ScheduledDate string
	TripPlaceID   string
}

type CreateTripInviteRecord struct {
	TripID    string
	CreatedBy string
	Token     string
	Now       time.Time
	ExpiresAt time.Time
}

type AcceptTripInviteRecord struct {
	Token  string
	UserID string
	Now    time.Time
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

type ParticipantListItem struct {
	ParticipantID string
	DisplayName   string
	Role          string
	JoinedAt      time.Time
}

type TripDay struct {
	Date         string
	DayOrder     int
	LodgingPlace *TripPlaceSummary
}

type CreateResult struct {
	Trip             Trip
	OwnerParticipant Participant
}

type UpdateResult struct {
	Trip Trip
}

type TripInvite struct {
	ID        string
	TripID    string
	Token     string
	InviteURL string
	ExpiresAt time.Time
	CreatedAt time.Time
	CreatedBy string
}

type CreateTripInviteResult struct {
	Invite  TripInvite
	Created bool
}

type AcceptTripInviteResult struct {
	TripID          string
	TripName        string
	Role            string
	AlreadyAccepted bool
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
	IsLodging bool
	ArrivedAt *time.Time
	Place     TripPlaceSummary
}

type GetDayItineraryResult struct {
	Day   TripDay
	Items []DayItineraryItem
}

type SetDayLodgingPlaceResult struct {
	Day          TripDay
	LodgingPlace TripPlaceSummary
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

type MarkDayItineraryItemArrivedMutationResult struct {
	Item  DayItineraryItem
	Items []DayItineraryItem
}

type MarkDayItineraryItemArrivedResult struct {
	Day   TripDay
	Item  DayItineraryItem
	Items []DayItineraryItem
}

type DayLodgingPlace struct {
	Date  string
	Place TripPlaceSummary
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
	DeleteTripMemberParticipant(ctx context.Context, tripID string, participantID string) (bool, error)
	CreateOrReturnTripInvite(ctx context.Context, record CreateTripInviteRecord) (CreateTripInviteResult, error)
	AcceptTripInvite(ctx context.Context, record AcceptTripInviteRecord) (AcceptTripInviteResult, error)
	CountTripParticipants(ctx context.Context, tripID string) (int, error)
	ListTripParticipantPreviewNames(ctx context.Context, tripID string) ([]string, error)
	ListTripParticipants(ctx context.Context, tripID string) ([]ParticipantListItem, error)
	ListTripsByParticipantUser(ctx context.Context, userID string) ([]ListItem, error)
	ListDayLodgingPlacesByTrip(ctx context.Context, tripID string) ([]DayLodgingPlace, error)
	GetDayLodgingPlaceByTripAndDate(ctx context.Context, tripID string, date string) (TripPlaceSummary, bool, error)
	GetTripPlaceSummaryByTripAndPlace(ctx context.Context, tripID string, tripPlaceID string) (TripPlaceSummary, bool, error)
	SetDayLodgingPlace(ctx context.Context, record SetDayLodgingPlaceRecord) (TripPlaceSummary, error)
	DeleteDayLodgingPlace(ctx context.Context, tripID string, date string) error
	ListItineraryItemsByTripAndDate(ctx context.Context, tripID string, date string) ([]DayItineraryItem, error)
	CreateManualDayItineraryItem(ctx context.Context, record CreateManualDayItineraryItemRecord) (DayItineraryItem, error)
	GetItineraryItemByTripDateAndID(ctx context.Context, tripID string, date string, itemID string) (DayItineraryItem, bool, error)
	ReorderDayItineraryItems(ctx context.Context, record ReorderDayItineraryItemsRecord) ([]DayItineraryItem, error)
	MarkDayItineraryItemArrived(ctx context.Context, record MarkDayItineraryItemArrivedRecord) (MarkDayItineraryItemArrivedMutationResult, error)
	UpdateDayItineraryItemPlace(ctx context.Context, record UpdateDayItineraryItemRecord) (DayItineraryItem, error)
	DeleteDayItineraryItem(ctx context.Context, tripID string, date string, itemID string) (bool, error)
}
