package meeting

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"regexp"
	"strings"
	"time"
)

const (
	dateLayout             = "2006-01-02"
	defaultInviteBaseURL   = "http://localhost:8080"
	inviteExpiryDuration   = 7 * 24 * time.Hour
	inviteTokenRandomBytes = 32
)

var (
	uuidPattern        = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	inviteTokenPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{32,128}$`)
)

type Service struct {
	repo                Repository
	now                 func() time.Time
	generateInviteToken func() (string, error)
	inviteBaseURL       string
}

type ServiceOption func(*Service)

func WithInviteBaseURL(value string) ServiceOption {
	return func(s *Service) {
		if strings.TrimSpace(value) != "" {
			s.inviteBaseURL = strings.TrimRight(strings.TrimSpace(value), "/")
		}
	}
}

func NewService(repo Repository, options ...ServiceOption) *Service {
	service := &Service{repo: repo, now: time.Now, generateInviteToken: generateInviteToken, inviteBaseURL: defaultInviteBaseURL}
	for _, option := range options {
		option(service)
	}
	return service
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

func (s *Service) CreateInvite(ctx context.Context, userID string, meetingID string) (CreateMeetingInviteResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateMeetingInviteResult{}, ErrUnauthorized
	}
	meetingID = strings.TrimSpace(meetingID)
	if !isUUID(meetingID) {
		return CreateMeetingInviteResult{}, ErrValidation
	}
	detail, err := s.GetMeeting(ctx, userID, meetingID)
	if err != nil {
		return CreateMeetingInviteResult{}, err
	}
	currentMember := findMemberByUserID(detail.Members, userID)
	if currentMember == nil || currentMember.Role != RoleOwner {
		return CreateMeetingInviteResult{}, ErrForbidden
	}

	now := s.now().UTC()
	for attempt := 0; attempt < 3; attempt++ {
		token, err := s.generateInviteToken()
		if err != nil {
			return CreateMeetingInviteResult{}, err
		}
		result, err := s.repo.CreateOrReturnMeetingInvite(ctx, CreateMeetingInviteRecord{
			MeetingID: meetingID,
			CreatedBy: userID,
			Token:     token,
			Now:       now,
			ExpiresAt: now.Add(inviteExpiryDuration),
		})
		if err == ErrConflict {
			continue
		}
		if err != nil {
			return CreateMeetingInviteResult{}, err
		}
		result.Invite.InviteURL = s.inviteURL(result.Invite.Token)
		return result, nil
	}
	return CreateMeetingInviteResult{}, ErrConflict
}

func (s *Service) AcceptInvite(ctx context.Context, userID string, token string) (AcceptMeetingInviteResult, error) {
	if strings.TrimSpace(userID) == "" {
		return AcceptMeetingInviteResult{}, ErrUnauthorized
	}
	token = strings.TrimSpace(token)
	if !isInviteToken(token) {
		return AcceptMeetingInviteResult{}, ErrValidation
	}
	return s.repo.AcceptMeetingInvite(ctx, AcceptMeetingInviteRecord{Token: token, UserID: userID, Now: s.now().UTC()})
}

func (s *Service) RemoveMember(ctx context.Context, userID string, meetingID string, memberID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}
	meetingID = strings.TrimSpace(meetingID)
	memberID = strings.TrimSpace(memberID)
	if !isUUID(meetingID) || !isUUID(memberID) {
		return ErrValidation
	}
	detail, err := s.GetMeeting(ctx, userID, meetingID)
	if err != nil {
		return err
	}
	currentMember := findMemberByUserID(detail.Members, userID)
	if currentMember == nil || currentMember.Role != RoleOwner {
		return ErrForbidden
	}
	target := findMemberByID(detail.Members, memberID)
	if target == nil {
		return ErrNotFound
	}
	if target.Role == RoleOwner {
		return ErrConflict
	}
	deleted, err := s.repo.DeleteMeetingMember(ctx, meetingID, memberID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

func (s *Service) LeaveMeeting(ctx context.Context, userID string, meetingID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}
	meetingID = strings.TrimSpace(meetingID)
	if !isUUID(meetingID) {
		return ErrValidation
	}
	detail, err := s.GetMeeting(ctx, userID, meetingID)
	if err != nil {
		return err
	}
	currentMember := findMemberByUserID(detail.Members, userID)
	if currentMember == nil {
		return ErrNotFound
	}
	if currentMember.Role == RoleOwner {
		return ErrConflict
	}
	deleted, err := s.repo.DeleteMeetingMember(ctx, meetingID, currentMember.ID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

func (s *Service) inviteURL(token string) string {
	return strings.TrimRight(s.inviteBaseURL, "/") + "/invite/" + token
}

func generateInviteToken() (string, error) {
	buffer := make([]byte, inviteTokenRandomBytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
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

func isInviteToken(value string) bool {
	return inviteTokenPattern.MatchString(value)
}

func findMemberByUserID(members []MeetingMember, userID string) *MeetingMember {
	for index := range members {
		if members[index].UserID == userID {
			return &members[index]
		}
	}
	return nil
}

func findMemberByID(members []MeetingMember, memberID string) *MeetingMember {
	for index := range members {
		if members[index].ID == memberID {
			return &members[index]
		}
	}
	return nil
}
