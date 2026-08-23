package meeting

import (
	"context"
	"errors"
	"time"
)

const (
	RoleOwner  = "owner"
	RoleMember = "member"

	MeetingVisibilitySaved  = "saved"
	MeetingVisibilityOneOff = "one_off"

	MeetingModeExisting = "existing"
	MeetingModeNew      = "new"
	MeetingModeOneOff   = "one_off"

	EventTypeTrip   = "trip"
	EventTypeOuting = "outing"

	EventStatusPlanned   = "planned"
	EventStatusCompleted = "completed"
	EventStatusCancelled = "cancelled"
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

type CreateMeetingInput struct {
	Name string
}

type EventMeetingInput struct {
	Mode      string
	MeetingID string
	Name      string
}

type CreateEventInput struct {
	Title           string
	StartDate       string
	EndDate         string
	EventType       string
	DefaultCurrency string
	Meeting         EventMeetingInput
}

type CreateMeetingRecord struct {
	Name             string
	Visibility       string
	CreatedBy        string
	OwnerDisplayName string
}

type CreateEventRecord struct {
	Title             string
	StartDate         time.Time
	EndDate           time.Time
	EventType         string
	DefaultCurrency   string
	Status            string
	CreatedBy         string
	OwnerDisplayName  string
	MeetingMode       string
	ExistingMeetingID string
	NewMeetingName    string
	MeetingVisibility string
}

type Meeting struct {
	ID         string
	Name       string
	Visibility string
	CreatedBy  string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type MeetingMember struct {
	ID          string
	MeetingID   string
	UserID      string
	Role        string
	DisplayName string
	JoinedAt    time.Time
}

type MeetingListItem struct {
	ID          string
	Name        string
	Visibility  string
	MemberCount int
	MyRole      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Event struct {
	ID                string
	MeetingID         string
	MeetingName       string
	MeetingVisibility string
	EventType         string
	Title             string
	StartDate         string
	EndDate           string
	DefaultCurrency   string
	Status            string
	TripID            *string
	CreatedBy         string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type EventParticipant struct {
	ID              string
	EventID         string
	MeetingMemberID *string
	UserID          string
	Role            string
	DisplayName     string
	JoinedAt        time.Time
}

type MeetingInvite struct {
	ID        string
	MeetingID string
	Token     string
	InviteURL string
	ExpiresAt time.Time
	CreatedAt time.Time
	CreatedBy string
}

type CreateMeetingInviteRecord struct {
	MeetingID string
	CreatedBy string
	Token     string
	Now       time.Time
	ExpiresAt time.Time
}

type CreateMeetingInviteResult struct {
	Invite  MeetingInvite
	Created bool
}

type AcceptMeetingInviteRecord struct {
	Token  string
	UserID string
	Now    time.Time
}

type AcceptMeetingInviteResult struct {
	MeetingID       string
	MeetingName     string
	Role            string
	AlreadyAccepted bool
}

type CreateMeetingResult struct {
	Meeting     Meeting
	OwnerMember MeetingMember
}

type CreateEventResult struct {
	Meeting          Meeting
	Event            Event
	OwnerParticipant EventParticipant
}

type MeetingDetailResult struct {
	Meeting Meeting
	Members []MeetingMember
	Events  []Event
}

type EventDetailResult struct {
	Meeting Meeting
	Event   Event
}

type Repository interface {
	GetMeetingCreator(ctx context.Context, userID string) (Creator, bool, error)
	CreateMeetingWithOwner(ctx context.Context, record CreateMeetingRecord) (CreateMeetingResult, error)
	ListSavedMeetingsByMemberUser(ctx context.Context, userID string) ([]MeetingListItem, error)
	GetSavedMeetingForMember(ctx context.Context, meetingID string, userID string) (Meeting, bool, error)
	GetMeetingDetailForMember(ctx context.Context, meetingID string, userID string) (MeetingDetailResult, bool, error)
	CreateOrReturnMeetingInvite(ctx context.Context, record CreateMeetingInviteRecord) (CreateMeetingInviteResult, error)
	AcceptMeetingInvite(ctx context.Context, record AcceptMeetingInviteRecord) (AcceptMeetingInviteResult, error)
	DeleteMeetingMember(ctx context.Context, meetingID string, memberID string) (bool, error)
	CreateEventWithMeeting(ctx context.Context, record CreateEventRecord) (CreateEventResult, error)
	GetEventForParticipant(ctx context.Context, eventID string, userID string) (EventDetailResult, bool, error)
}
