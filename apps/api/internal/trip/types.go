package trip

import (
	"context"
	"errors"
	"time"
)

const (
	RoleOwner  = "owner"
	RoleMember = "member"

	DestinationProviderGoogle = "google"

	ScheduleItemTypePlace = "place"
)

var (
	ErrValidation                   = errors.New("validation error")
	ErrUnauthorized                 = errors.New("unauthorized")
	ErrForbidden                    = errors.New("forbidden")
	ErrNotFound                     = errors.New("not found")
	ErrConflict                     = errors.New("conflict")
	ErrSettlementDataInconsistent   = errors.New("settlement data inconsistent")
	ErrSettlementSummaryUnavailable = errors.New("settlement summary unavailable")
	ErrInviteNotFound               = errors.New("invite not found")
	ErrInviteExpired                = errors.New("invite expired")
	ErrUploadTooLarge               = errors.New("upload too large")
	ErrUnsupportedMediaType         = errors.New("unsupported media type")
	ErrStorageUnavailable           = errors.New("storage unavailable")
	ErrReceiptProviderUnavailable   = errors.New("receipt provider unavailable")
	ErrReceiptProviderRateLimited   = errors.New("receipt provider rate limited")
	ErrReceiptExtractionInvalid     = errors.New("receipt extraction invalid")
	ErrReceiptTextUnreadable        = errors.New("receipt text unreadable")
	ErrUnsupportedReceiptLanguage   = errors.New("unsupported receipt language")
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
	Destinations    []CreateDestinationInput
}

type CreateDestinationInput struct {
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

type CreateManualDayLodgingPlaceInput struct {
	Name    string
	Address string
}

type CreateQuickExpenseInput struct {
	ScheduleItemID      string
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	IncludeInSettlement *bool
	ReceiptDraftID      *string
}

type CreateTripExpenseInput struct {
	Title               *string
	ExpenseDate         string
	TripDayID           *string
	ScheduleItemID      *string
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	Memo                *string
	IncludeInSettlement *bool
	ReceiptDraftID      *string
}

type UpdateExpenseInput struct {
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	Memo                *string
	Title               *string
	ScheduleItemID      *string
	IncludeInSettlement *bool
}

type ManualExpenseSplitInput struct {
	ParticipantID string
	AmountMinor   int64
}

type UpdateScheduleItemInput struct {
	Name      *string
	Address   *string
	PlaceType *string
	StartTime *string
	EndTime   *string
	Memo      *string
}

type ReorderDayScheduleMoveInput struct {
	ItemID        string
	BeforeItemID  *string
	AfterItemID   *string
	ClientVersion int
}

type ReorderScheduleItemTimeUpdateInput struct {
	ItemID            string
	ExpectedStartTime *string
	ExpectedEndTime   *string
	StartTime         *string
	EndTime           *string
}

type CreateRecord struct {
	Name             string
	StartDate        time.Time
	EndDate          time.Time
	DefaultCurrency  string
	CreatedBy        string
	OwnerDisplayName string
	Destinations     []CreateDestinationRecord
}

type CreateDestinationRecord struct {
	CityName        string
	CountryName     string
	CountryCode     string
	DisplayName     string
	Latitude        float64
	Longitude       float64
	RadiusMeters    int
	Provider        string
	ProviderPlaceID string
	SortOrder       int
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
	StartTime *string
	EndTime   *string
	Memo      *string
}

type ReorderDayScheduleMoveRecord struct {
	ItemID        string
	BeforeItemID  *string
	AfterItemID   *string
	ClientVersion int
}

type ReorderScheduleItemTimeUpdateRecord struct {
	ItemID            string
	ExpectedStartTime *string
	ExpectedEndTime   *string
	StartTime         *string
	EndTime           *string
}

type ReorderScheduleItemsRecord struct {
	TripID      string
	TripDayID   string
	Moves       []ReorderDayScheduleMoveRecord
	TimeUpdates []ReorderScheduleItemTimeUpdateRecord
}

type MoveScheduleItemToDayInput struct {
	TargetTripDayID string
	ClientVersion   int
}

type MoveScheduleItemToDayRecord struct {
	TripID          string
	SourceTripDayID string
	TargetTripDayID string
	ScheduleItemID  string
	ClientVersion   int
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

type CreateManualDayLodgingPlaceRecord struct {
	TripID    string
	TripDayID string
	Name      string
	Address   string
}

type CreateQuickExpenseRecord struct {
	TripID              string
	TripDayID           string
	ScheduleItemID      string
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	IncludeInSettlement bool
	ReceiptDraftID      *string
	CreatedBy           string
}

type CreateTripExpenseRecord struct {
	TripID              string
	Title               *string
	ExpenseDate         time.Time
	TripDayID           *string
	ScheduleItemID      *string
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	Memo                *string
	IncludeInSettlement bool
	ReceiptDraftID      *string
	CreatedBy           string
}

type UpdateExpenseRecord struct {
	TripID              string
	TripDayID           string
	ExpenseID           string
	AmountMinor         int64
	Currency            *string
	ExpenseCategory     *string
	PayerParticipantID  string
	SplitPolicy         string
	ParticipantIDs      []string
	ManualSplits        []ManualExpenseSplitInput
	Memo                *string
	Title               *string
	ScheduleItemID      *string
	IncludeInSettlement *bool
}

type ExpenseSplitParticipant struct {
	ParticipantID string
	UserID        string
	DisplayName   string
	JoinedAt      time.Time
}

type CreateExpenseSplitRecord struct {
	ParticipantID          string
	UserID                 string
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
	Destinations    []TripDestination
}

type TripDestination struct {
	ID              string
	TripID          string
	CityName        string
	CountryName     string
	CountryCode     string
	DisplayName     string
	Latitude        float64
	Longitude       float64
	RadiusMeters    int
	Provider        string
	ProviderPlaceID string
	SortOrder       int
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

type PlaceScheduleItemDetails struct {
	Title string
	Memo  *string
}

type ScheduleItem struct {
	ID            string
	ItemOrder     int
	Version       int
	ItemType      string
	IsLodging     bool
	StartTime     *string
	EndTime       *string
	ArrivedAt     *time.Time
	SkippedAt     *time.Time
	Place         TripPlaceSummary
	PlaceSchedule *PlaceScheduleItemDetails
}

type GetDayScheduleItemsResult struct {
	Day   TripDay
	Items []ScheduleItem
}

type TripScheduleItemsDayListItem struct {
	TripDayID string
	Items     []ScheduleItem
}

type ListTripScheduleItemsResult struct {
	Days []TripScheduleItemsDayListItem
}

type SetDayLodgingPlaceResult struct {
	Day          TripDay
	LodgingPlace TripPlaceSummary
}

type ListTripPlacesResult struct {
	Places []TripPlaceSummary
}

type CreateManualDayLodgingPlaceResult struct {
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

type MoveScheduleItemToDayMutationResult struct {
	MovedItem   ScheduleItem
	SourceItems []ScheduleItem
	TargetItems []ScheduleItem
}

type MoveScheduleItemToDayResult struct {
	SourceDay   TripDay
	SourceItems []ScheduleItem
	TargetDay   TripDay
	TargetItems []ScheduleItem
	MovedItem   ScheduleItem
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
	ExpenseSplitPolicyManual     = "manual"

	ExpenseCategoryCafe      = "cafe"
	ExpenseCategoryEtc       = "etc"
	ExpenseCategoryFood      = "food"
	ExpenseCategoryLodging   = "lodging"
	ExpenseCategoryShopping  = "shopping"
	ExpenseCategorySights    = "sights"
	ExpenseCategoryTransport = "transport"

	ExpenseReceiptConfidenceHigh   = "high"
	ExpenseReceiptConfidenceMedium = "medium"
	ExpenseReceiptConfidenceLow    = "low"

	ReceiptCaptureModeSingle = "single"
	ReceiptCaptureModeSplit  = "split"

	ReceiptImageRoleSingle = "single"
	ReceiptImageRoleHeader = "header"
	ReceiptImageRoleTotal  = "total"

	ReceiptOCRLanguageKorean = "ko"
)

type ExpenseReceiptLineItemDraft struct {
	Name        string   `json:"name"`
	AmountMinor *int64   `json:"amountMinor"`
	Quantity    *float64 `json:"quantity"`
}

type ExpenseReceiptExtraction struct {
	MerchantName       *string                       `json:"merchantName"`
	ExpenseTitle       *string                       `json:"expenseTitle"`
	ExpenseDate        *string                       `json:"expenseDate"`
	ExpenseTime        *string                       `json:"expenseTime"`
	Currency           *string                       `json:"currency"`
	TotalAmountMinor   *int64                        `json:"totalAmountMinor"`
	TaxAmountMinor     *int64                        `json:"taxAmountMinor"`
	ServiceChargeMinor *int64                        `json:"serviceChargeMinor"`
	LineItems          []ExpenseReceiptLineItemDraft `json:"lineItems"`
	Confidence         string                        `json:"confidence"`
	Warnings           []string                      `json:"warnings"`
}

type ReceiptCaptureMode string

type ReceiptImageRole string

type ReceiptOCRLanguage string

type ExpenseReceiptOCRTextPart struct {
	Role ReceiptImageRole
	Text string
}

type ExpenseReceiptImageUpload struct {
	Role        ReceiptImageRole
	ContentType string
	Data        []byte
}

type ExpenseReceiptObject struct {
	Role        ReceiptImageRole
	Bucket      string
	ObjectKey   string
	Generation  string
	ContentType string
	ByteSize    int
	UploadedAt  time.Time
}

type SignedExpenseReceiptURL struct {
	URL         string
	ExpiresAt   time.Time
	ContentType string
	ByteSize    int
}

type ExpenseReceiptSummary struct {
	Exists      bool
	ContentType *string
	ByteSize    *int
	UploadedAt  *time.Time
}

type ExpenseReceiptDraft struct {
	ID          string
	TripID      string
	CaptureMode ReceiptCaptureMode
	ImageCount  int
	ContentType string
	ByteSize    int
	Extraction  ExpenseReceiptExtraction
	ExpiresAt   time.Time
	CreatedAt   time.Time
}

type CreateExpenseReceiptDraftInput struct {
	CaptureMode  ReceiptCaptureMode
	OCRLanguage  ReceiptOCRLanguage
	OCRTextParts []ExpenseReceiptOCRTextPart
	Images       []ExpenseReceiptImageUpload
}

type CreateExpenseReceiptDraftRecord struct {
	TripID          string
	CreatedByUserID string
	CaptureMode     ReceiptCaptureMode
	Objects         []ExpenseReceiptObject
	Extraction      ExpenseReceiptExtraction
	ExpiresAt       time.Time
}

type CreateExpenseReceiptDraftResult struct {
	Draft ExpenseReceiptDraft
}

type UpsertExpenseReceiptRecord struct {
	TripID           string
	ExpenseID        string
	UploadedByUserID string
	Object           ExpenseReceiptObject
}

type UpsertExpenseReceiptResult struct {
	Receipt    ExpenseReceiptSummary
	OldObjects []ExpenseReceiptObject
}

type ExpenseReceiptObjectStore interface {
	UploadExpenseReceipt(ctx context.Context, objectKey string, contentType string, data []byte) (ExpenseReceiptObject, error)
	DeleteObject(ctx context.Context, object ExpenseReceiptObject) error
	SignedGetURL(ctx context.Context, object ExpenseReceiptObject, ttl time.Duration) (SignedExpenseReceiptURL, error)
}

type ReceiptModelProvider interface {
	ExtractExpenseReceiptDraft(ctx context.Context, ocrText string) (ExpenseReceiptExtraction, error)
}

type ExpenseReceiptDraftRepository interface {
	CreateExpenseReceiptDraft(ctx context.Context, record CreateExpenseReceiptDraftRecord) (CreateExpenseReceiptDraftResult, error)
}

type ExpenseReceiptRepository interface {
	CancelExpenseReceiptDraft(ctx context.Context, tripID string, userID string, receiptDraftID string) ([]ExpenseReceiptObject, error)
	UpsertExpenseReceipt(ctx context.Context, record UpsertExpenseReceiptRecord) (UpsertExpenseReceiptResult, error)
	ClearExpenseReceipt(ctx context.Context, tripID string, expenseID string) ([]ExpenseReceiptObject, error)
	GetExpenseReceiptObject(ctx context.Context, tripID string, expenseID string) (ExpenseReceiptObject, error)
}

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
	ID                  string
	TripID              string
	AnchorType          string
	TripDayID           *string
	ScheduleItemID      *string
	ExpenseDate         string
	Title               *string
	DisplayTitle        string
	Place               *ExpensePlaceDisplay
	AmountMinor         int64
	Currency            string
	ExpenseCategory     string
	Payer               ExpenseParticipantDisplay
	Memo                *string
	SplitPolicy         string
	Splits              []ExpenseSplit
	IncludeInSettlement bool
	Receipt             ExpenseReceiptSummary
	CreatedAt           time.Time
}

type GetExpenseResult struct {
	Expense Expense
}

type UpdateExpenseResult struct {
	Expense Expense
}

type CreateQuickExpenseResult struct {
	Expense Expense
}

type CreateTripExpenseResult struct {
	Expense Expense
}

type DayExpenseSplitListItem struct {
	SplitOrder  int
	Participant ExpenseParticipantDisplay
	AmountMinor int64
}

type DayExpenseListItem struct {
	ID                  string
	AnchorType          string
	TripDayID           *string
	ScheduleItemID      *string
	ExpenseDate         string
	DisplayTitle        string
	Place               *ExpensePlaceDisplay
	AmountMinor         int64
	Currency            string
	ExpenseCategory     string
	Payer               ExpenseParticipantDisplay
	SplitPolicy         string
	Splits              []DayExpenseSplitListItem
	IncludeInSettlement bool
	Receipt             ExpenseReceiptSummary
	CreatedAt           time.Time
}

type ListDayExpensesResult struct {
	Expenses []DayExpenseListItem
}

type TripExpenseDayListItem struct {
	TripDayID string
	Expenses  []DayExpenseListItem
}

type ListTripExpensesResult struct {
	TripExpenses []DayExpenseListItem
	Days         []TripExpenseDayListItem
}

type DayLodgingPlace struct {
	Date  string
	Place TripPlaceSummary
}

const (
	SettlementParticipantStatusCurrent = "current"
	SettlementParticipantStatusRemoved = "removed"
)

type SettlementParticipantSnapshot struct {
	ParticipantID     *string
	DisplayName       string
	ParticipantStatus string
}

type SettlementBalance struct {
	Participant SettlementParticipantSnapshot
	PaidMinor   int64
	ShareMinor  int64
	NetMinor    int64
}

type SettlementTransfer struct {
	FromParticipant SettlementParticipantSnapshot
	ToParticipant   SettlementParticipantSnapshot
	AmountMinor     int64
}

type SettlementCurrencySummary struct {
	Currency           string
	TotalPaidMinor     int64
	TotalShareMinor    int64
	Balances           []SettlementBalance
	SuggestedTransfers []SettlementTransfer
}

type GetTripSettlementResult struct {
	TripID            string
	DefaultCurrency   string
	CurrencySummaries []SettlementCurrencySummary
}

type MySettlementDirection string

const (
	MySettlementDirectionSend    MySettlementDirection = "send"
	MySettlementDirectionReceive MySettlementDirection = "receive"
)

type MySettlementCurrencySummary struct {
	Currency  string
	Direction MySettlementDirection
	NetMinor  int64
}

type MySettlementTripSummary struct {
	TripID            string
	TripName          string
	StartDate         string
	EndDate           string
	DefaultCurrency   string
	CurrencySummaries []MySettlementCurrencySummary
}

type GetMySettlementSummaryResult struct {
	Trips []MySettlementTripSummary
}

type SettlementInput struct {
	Participants []SettlementParticipantInput
	Expenses     []SettlementExpenseInput
}

type SettlementParticipantInput struct {
	ParticipantID string
	DisplayName   string
	JoinedAt      time.Time
}

type SettlementExpenseInput struct {
	ExpenseID             string
	Currency              string
	AmountMinor           int64
	PayerParticipantID    *string
	PayerDisplayName      string
	PayerParticipantLive  bool
	PayerParticipantOrder int
	Splits                []SettlementSplitInput
}

type SettlementSplitInput struct {
	ParticipantID   *string
	DisplayName     string
	ParticipantLive bool
	AmountMinor     int64
	SplitOrder      int
}

type ListItem struct {
	ID               string
	ParticipantID    string
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
	ListTripPlaces(ctx context.Context, tripID string) ([]TripPlaceSummary, error)
	SetDayLodgingPlace(ctx context.Context, record SetDayLodgingPlaceRecord) (TripPlaceSummary, error)
	CreateManualDayLodgingPlace(ctx context.Context, record CreateManualDayLodgingPlaceRecord) (TripPlaceSummary, error)
	DeleteDayLodgingPlace(ctx context.Context, tripID string, tripDayID string) error
	ListScheduleItemsByTripDay(ctx context.Context, tripID string, tripDayID string) ([]ScheduleItem, error)
	ListTripScheduleItems(ctx context.Context, tripID string) ([]TripScheduleItemsDayListItem, error)
	ListDayExpensesByTripDay(ctx context.Context, tripID string, tripDayID string) ([]DayExpenseListItem, error)
	ListTripExpenses(ctx context.Context, tripID string) (ListTripExpensesResult, error)
	GetTripSettlementInput(ctx context.Context, tripID string) (SettlementInput, error)
	GetExpenseByTripDayAndID(ctx context.Context, tripID string, tripDayID string, expenseID string) (Expense, bool, error)
	GetTripExpenseByID(ctx context.Context, tripID string, expenseID string) (Expense, bool, error)
	UpdateExpense(ctx context.Context, record UpdateExpenseRecord) (Expense, error)
	UpdateTripExpense(ctx context.Context, record UpdateExpenseRecord) (Expense, error)
	DeleteExpenseByTripDayAndID(ctx context.Context, tripID string, tripDayID string, expenseID string) (bool, error)
	DeleteTripExpenseByID(ctx context.Context, tripID string, expenseID string) (bool, error)
	CreateQuickExpense(ctx context.Context, record CreateQuickExpenseRecord) (CreateQuickExpenseResult, error)
	CreateTripExpense(ctx context.Context, record CreateTripExpenseRecord) (CreateTripExpenseResult, error)
	CreateManualScheduleItem(ctx context.Context, record CreateManualScheduleItemRecord) (ScheduleItem, error)
	GetScheduleItemByTripDayAndID(ctx context.Context, tripID string, tripDayID string, itemID string) (ScheduleItem, bool, error)
	ReorderScheduleItems(ctx context.Context, record ReorderScheduleItemsRecord) ([]ScheduleItem, error)
	MoveScheduleItemToDay(ctx context.Context, record MoveScheduleItemToDayRecord) (MoveScheduleItemToDayMutationResult, error)
	MarkScheduleItemArrived(ctx context.Context, record MarkScheduleItemArrivedRecord) (MarkScheduleItemArrivedMutationResult, error)
	MarkScheduleItemSkipped(ctx context.Context, record MarkScheduleItemSkippedRecord) (MarkScheduleItemSkippedMutationResult, error)
	RestoreScheduleItem(ctx context.Context, record RestoreScheduleItemRecord) (RestoreScheduleItemMutationResult, error)
	UpdateScheduleItemPlace(ctx context.Context, record UpdateScheduleItemRecord) (ScheduleItem, error)
	DeleteScheduleItem(ctx context.Context, tripID string, tripDayID string, itemID string) (bool, error)
}
