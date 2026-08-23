package meeting

import (
	"context"
	"regexp"
	"strings"
	"time"
)

const dateLayout = "2006-01-02"

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateMeeting(ctx context.Context, userID string, input CreateMeetingInput) (CreateMeetingResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateMeetingResult{}, ErrUnauthorized
	}
	name, err := normalizeName(input.Name)
	if err != nil {
		return CreateMeetingResult{}, err
	}
	creator, ok, err := s.repo.GetMeetingCreator(ctx, userID)
	if err != nil {
		return CreateMeetingResult{}, err
	}
	if !ok {
		return CreateMeetingResult{}, ErrUnauthorized
	}
	return s.repo.CreateMeetingWithOwner(ctx, CreateMeetingRecord{
		Name:             name,
		Visibility:       MeetingVisibilitySaved,
		CreatedBy:        creator.ID,
		OwnerDisplayName: creator.DisplayName,
	})
}

func (s *Service) ListMeetings(ctx context.Context, userID string) ([]MeetingListItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}
	return s.repo.ListSavedMeetingsByMemberUser(ctx, userID)
}

func (s *Service) GetMeeting(ctx context.Context, userID string, meetingID string) (MeetingDetailResult, error) {
	if strings.TrimSpace(userID) == "" {
		return MeetingDetailResult{}, ErrUnauthorized
	}
	meetingID = strings.TrimSpace(meetingID)
	if !isUUID(meetingID) {
		return MeetingDetailResult{}, ErrValidation
	}
	detail, ok, err := s.repo.GetMeetingDetailForMember(ctx, meetingID, userID)
	if err != nil {
		return MeetingDetailResult{}, err
	}
	if !ok {
		return MeetingDetailResult{}, ErrNotFound
	}
	return detail, nil
}

func (s *Service) CreateEvent(ctx context.Context, userID string, input CreateEventInput) (CreateEventResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateEventResult{}, ErrUnauthorized
	}

	title, err := normalizeName(input.Title)
	if err != nil {
		return CreateEventResult{}, err
	}
	startDate, err := parseDate(input.StartDate)
	if err != nil {
		return CreateEventResult{}, ErrValidation
	}
	endDate, err := parseDate(input.EndDate)
	if err != nil {
		return CreateEventResult{}, ErrValidation
	}
	if startDate.After(endDate) {
		return CreateEventResult{}, ErrValidation
	}
	if !isSupportedEventType(input.EventType) || !isSupportedCurrency(input.DefaultCurrency) {
		return CreateEventResult{}, ErrValidation
	}

	creator, ok, err := s.repo.GetMeetingCreator(ctx, userID)
	if err != nil {
		return CreateEventResult{}, err
	}
	if !ok {
		return CreateEventResult{}, ErrUnauthorized
	}

	record := CreateEventRecord{
		Title:            title,
		StartDate:        startDate,
		EndDate:          endDate,
		EventType:        input.EventType,
		DefaultCurrency:  input.DefaultCurrency,
		Status:           EventStatusPlanned,
		CreatedBy:        creator.ID,
		OwnerDisplayName: creator.DisplayName,
		MeetingMode:      input.Meeting.Mode,
	}

	switch input.Meeting.Mode {
	case MeetingModeExisting:
		meetingID := strings.TrimSpace(input.Meeting.MeetingID)
		if !isUUID(meetingID) {
			return CreateEventResult{}, ErrValidation
		}
		meeting, ok, err := s.repo.GetSavedMeetingForMember(ctx, meetingID, userID)
		if err != nil {
			return CreateEventResult{}, err
		}
		if !ok || meeting.Visibility != MeetingVisibilitySaved {
			return CreateEventResult{}, ErrForbidden
		}
		record.ExistingMeetingID = meetingID
		record.MeetingVisibility = MeetingVisibilitySaved
	case MeetingModeNew:
		meetingName, err := normalizeName(input.Meeting.Name)
		if err != nil {
			return CreateEventResult{}, err
		}
		record.NewMeetingName = meetingName
		record.MeetingVisibility = MeetingVisibilitySaved
	case MeetingModeOneOff:
		meetingName := strings.TrimSpace(input.Meeting.Name)
		if meetingName == "" {
			meetingName = title
		}
		meetingName, err := normalizeName(meetingName)
		if err != nil {
			return CreateEventResult{}, err
		}
		record.NewMeetingName = meetingName
		record.MeetingVisibility = MeetingVisibilityOneOff
	default:
		return CreateEventResult{}, ErrValidation
	}

	return s.repo.CreateEventWithMeeting(ctx, record)
}

func (s *Service) GetEvent(ctx context.Context, userID string, eventID string) (EventDetailResult, error) {
	if strings.TrimSpace(userID) == "" {
		return EventDetailResult{}, ErrUnauthorized
	}
	eventID = strings.TrimSpace(eventID)
	if !isUUID(eventID) {
		return EventDetailResult{}, ErrValidation
	}
	result, ok, err := s.repo.GetEventForParticipant(ctx, eventID, userID)
	if err != nil {
		return EventDetailResult{}, err
	}
	if !ok {
		return EventDetailResult{}, ErrNotFound
	}
	return result, nil
}

func normalizeName(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if len([]rune(trimmed)) < 1 || len([]rune(trimmed)) > 80 {
		return "", ErrValidation
	}
	return trimmed, nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse(dateLayout, strings.TrimSpace(value))
}

func isSupportedEventType(value string) bool {
	switch value {
	case EventTypeTrip, EventTypeOuting:
		return true
	default:
		return false
	}
}

func isSupportedCurrency(value string) bool {
	switch value {
	case "KRW", "JPY", "USD", "EUR":
		return true
	default:
		return false
	}
}

func isUUID(value string) bool {
	return uuidPattern.MatchString(value)
}
