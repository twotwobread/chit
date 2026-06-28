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
	Name                        *string
	StartDate                   *string
	EndDate                     *string
	DefaultCurrency             *string
	ConfirmOutOfRangeDayArchive *bool
}

type CreateManualScheduleItemInput struct {
	Name      string
	Address   string
	PlaceType string
}

type SetDayLodgingPlaceInput struct {
	TripPlaceID string
}

type CreateQuickExpenseInput struct {
	ScheduleItemID     string
	AmountMinor        int64
	PayerParticipantID string
	ParticipantIDs     []string
}

type UpdateScheduleItemInput struct {
	Name      *string
	Address   *string
	PlaceType *string
}

type ReorderDayScheduleMoveInput struct {
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

type CreateManualScheduleItemRecord struct {
	TripID    string
	TripDayID string
	Name      string
	Address   string
	PlaceType string
}

type UpdateScheduleItemRecord struct {
	TripID    string
	TripDayID string
	ItemID    string
	Name      string
	Address   string
	PlaceType string
}

type ReorderDayScheduleMoveRecord struct {
	ItemID        string
	BeforeItemID  *string
	AfterItemID   *string
	ClientVersion int
}

type ReorderScheduleItemsRecord struct {
	TripID    string
	TripDayID string
	Moves     []ReorderDayScheduleMoveRecord
}

type MarkScheduleItemArrivedRecord struct {
	TripID    string
	TripDayID string
	ItemID    string
}

type MarkScheduleItemSkippedRecord struct {
	TripID    string
	TripDayID string
	ItemID    string
}

type RestoreScheduleItemRecord struct {
	TripID    string
	TripDayID string
	ItemID    string
}

type SetDayLodgingPlaceRecord struct {
	TripID      string
	TripDayID   string
	TripPlaceID string
}

type CreateQuickExpenseRecord struct {
	TripID             string
	TripDayID          string
	ScheduleItemID     string
	AmountMinor        int64
	PayerParticipantID string
	ParticipantIDs     []string
	CreatedBy          string
}

type ExpenseSplitParticipant struct {
	ParticipantID string
	DisplayName   string
	JoinedAt      time.Time
}

type CreateExpenseSplitRecord struct {
	ParticipantID          string
	ParticipantDisplayName string
	AmountMinor            int64
	SplitOrder             int
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
	ID           string
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

type RoutablePlace struct {
	Provider      string
	GooglePlaceID string
	Latitude      float64
	Longitude     float64
}

type TripPlaceSummary struct {
	ID            string
	Name          string
	PlaceType     string
	Address       string
	RoutablePlace *RoutablePlace
}

type ScheduleItem struct {
	ID        string
	ItemOrder int
	Version   int
	IsLodging bool
	ArrivedAt *time.Time
	SkippedAt *time.Time
	Place     TripPlaceSummary
}

type GetDayScheduleItemsResult struct {
	Day   TripDay
	Items []ScheduleItem
}

type SetDayLodgingPlaceResult struct {
	Day          TripDay
	LodgingPlace TripPlaceSummary
}

type CreateManualScheduleItemResult struct {
	Day  TripDay
	Item ScheduleItem
}

type UpdateScheduleItemResult struct {
	Item ScheduleItem
}

type ReorderScheduleItemsResult struct {
	Day   TripDay
	Items []ScheduleItem
}

type MarkScheduleItemArrivedMutationResult struct {
	Item  ScheduleItem
	Items []ScheduleItem
}

type MarkScheduleItemSkippedMutationResult struct {
	Item  ScheduleItem
	Items []ScheduleItem
}

type RestoreScheduleItemMutationResult struct {
	Item  ScheduleItem
	Items []ScheduleItem
}

type MarkScheduleItemArrivedResult struct {
	Day   TripDay
	Item  ScheduleItem
	Items []ScheduleItem
}

type MarkScheduleItemSkippedResult struct {
	Day   TripDay
	Item  ScheduleItem
	Items []ScheduleItem
}

type RestoreScheduleItemResult struct {
	Day   TripDay
	Item  ScheduleItem
	Items []ScheduleItem
}

const (
	ExpenseDisplaySourceLive     = "live"
	ExpenseDisplaySourceFallback = "fallback"
	ExpenseSplitPolicyEqual      = "equal"
)

type ExpensePlaceDisplay struct {
	TripPlaceID *string
	Name        string
	Address     *string
	PlaceType   *string
	Source      string
}

type ExpenseParticipantDisplay struct {
	ParticipantID *string
	DisplayName   string
	Source        string
}

type ExpenseSplit struct {
	Participant ExpenseParticipantDisplay
	AmountMinor int64
}

type Expense struct {
	ID             string
	TripID         string
	AnchorType     string
	TripDayID      *string
	ScheduleItemID *string
	ExpenseDate    string
	DisplayTitle   string
	Place          *ExpensePlaceDisplay
	AmountMinor    int64
	Currency       string
	Payer          ExpenseParticipantDisplay
	SplitPolicy    string
	Splits         []ExpenseSplit
	CreatedAt      time.Time
}

type CreateQuickExpenseResult struct {
	Expense Expense
}

type DayExpenseSplitListItem struct {
	SplitOrder  int
	Participant ExpenseParticipantDisplay
	AmountMinor int64
}

type DayExpenseListItem struct {
	ID             string
	AnchorType     string
	TripDayID      *string
	ScheduleItemID *string
	ExpenseDate    string
	DisplayTitle   string
	Place          *ExpensePlaceDisplay
	AmountMinor    int64
	Currency       string
	Payer          ExpenseParticipantDisplay
	SplitPolicy    string
	Splits         []DayExpenseSplitListItem
	CreatedAt      time.Time
}

type ListDayExpensesResult struct {
	Expenses []DayExpenseListItem
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
	ListActiveTripDaysByTrip(ctx context.Context, tripID string) ([]TripDay, error)
	GetActiveTripDayByTripAndID(ctx context.Context, tripID string, tripDayID string) (TripDay, bool, error)
	GetTripPlaceSummaryByTripAndPlace(ctx context.Context, tripID string, tripPlaceID string) (TripPlaceSummary, bool, error)
	SetDayLodgingPlace(ctx context.Context, record SetDayLodgingPlaceRecord) (TripPlaceSummary, error)
	DeleteDayLodgingPlace(ctx context.Context, tripID string, tripDayID string) error
	ListScheduleItemsByTripDay(ctx context.Context, tripID string, tripDayID string) ([]ScheduleItem, error)
	ListDayExpensesByTripDay(ctx context.Context, tripID string, tripDayID string) ([]DayExpenseListItem, error)
	CreateQuickExpense(ctx context.Context, record CreateQuickExpenseRecord) (CreateQuickExpenseResult, error)
	CreateManualScheduleItem(ctx context.Context, record CreateManualScheduleItemRecord) (ScheduleItem, error)
	GetScheduleItemByTripDayAndID(ctx context.Context, tripID string, tripDayID string, itemID string) (ScheduleItem, bool, error)
	ReorderScheduleItems(ctx context.Context, record ReorderScheduleItemsRecord) ([]ScheduleItem, error)
	MarkScheduleItemArrived(ctx context.Context, record MarkScheduleItemArrivedRecord) (MarkScheduleItemArrivedMutationResult, error)
	MarkScheduleItemSkipped(ctx context.Context, record MarkScheduleItemSkippedRecord) (MarkScheduleItemSkippedMutationResult, error)
	RestoreScheduleItem(ctx context.Context, record RestoreScheduleItemRecord) (RestoreScheduleItemMutationResult, error)
	UpdateScheduleItemPlace(ctx context.Context, record UpdateScheduleItemRecord) (ScheduleItem, error)
	DeleteScheduleItem(ctx context.Context, tripID string, tripDayID string, itemID string) (bool, error)
}
