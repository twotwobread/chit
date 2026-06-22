package trip

import (
	"context"
	"strings"
	"time"
)

const dateLayout = "2006-01-02"

type Service struct {
	repo  Repository
	today func() time.Time
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, today: time.Now}
}

func (s *Service) Create(ctx context.Context, userID string, input CreateInput) (CreateResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateResult{}, ErrUnauthorized
	}

	name := strings.TrimSpace(input.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 80 {
		return CreateResult{}, ErrValidation
	}

	startDate, err := parseDate(input.StartDate)
	if err != nil {
		return CreateResult{}, ErrValidation
	}
	endDate, err := parseDate(input.EndDate)
	if err != nil {
		return CreateResult{}, ErrValidation
	}
	if startDate.After(endDate) {
		return CreateResult{}, ErrValidation
	}
	if startDate.Before(dateOnly(s.today())) || endDate.Before(dateOnly(s.today())) {
		return CreateResult{}, ErrValidation
	}

	if !isSupportedCurrency(input.DefaultCurrency) {
		return CreateResult{}, ErrValidation
	}

	creator, ok, err := s.repo.GetCreator(ctx, userID)
	if err != nil {
		return CreateResult{}, err
	}
	if !ok {
		return CreateResult{}, ErrUnauthorized
	}

	return s.repo.CreateTripWithOwner(ctx, CreateRecord{
		Name:             name,
		StartDate:        startDate,
		EndDate:          endDate,
		DefaultCurrency:  input.DefaultCurrency,
		CreatedBy:        creator.ID,
		OwnerDisplayName: creator.DisplayName,
	})
}

func (s *Service) List(ctx context.Context, userID string) ([]ListItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}

	return s.repo.ListTripsByParticipantUser(ctx, userID)
}

func (s *Service) Update(ctx context.Context, userID string, tripID string, input UpdateInput) (UpdateResult, error) {
	if strings.TrimSpace(userID) == "" {
		return UpdateResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) || isEmptyUpdate(input) {
		return UpdateResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return UpdateResult{}, err
	}
	if !ok {
		return UpdateResult{}, ErrNotFound
	}

	isOwner, err := s.repo.IsTripOwner(ctx, tripID, userID)
	if err != nil {
		return UpdateResult{}, err
	}
	if !isOwner {
		return UpdateResult{}, ErrForbidden
	}

	merged, err := mergeUpdateInput(foundTrip, input)
	if err != nil {
		return UpdateResult{}, err
	}

	updatedTrip, err := s.repo.UpdateTripBasicInfo(ctx, merged)
	if err != nil {
		return UpdateResult{}, err
	}

	return UpdateResult{Trip: updatedTrip}, nil
}

func (s *Service) Delete(ctx context.Context, userID string, tripID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotFound
	}

	isOwner, err := s.repo.IsTripOwner(ctx, tripID, userID)
	if err != nil {
		return err
	}
	if !isOwner {
		_, ok, err := s.repo.GetTripByID(ctx, tripID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrNotFound
		}
		return ErrForbidden
	}

	deleted, err := s.repo.DeleteTripByID(ctx, tripID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}

	return nil
}

func (s *Service) GetDetail(ctx context.Context, userID string, tripID string) (GetDetailResult, error) {
	if strings.TrimSpace(userID) == "" {
		return GetDetailResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return GetDetailResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}
	if !ok {
		return GetDetailResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return GetDetailResult{}, err
	}
	if !isParticipant {
		return GetDetailResult{}, ErrForbidden
	}

	totalCount, err := s.repo.CountTripParticipants(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}

	previewNames, err := s.repo.ListTripParticipantPreviewNames(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}
	for index, name := range previewNames {
		previewNames[index] = participantDisplayName(name)
	}

	days, err := tripDaysForRange(foundTrip.StartDate, foundTrip.EndDate)
	if err != nil {
		return GetDetailResult{}, err
	}

	overflowCount := totalCount - len(previewNames)
	if overflowCount < 0 {
		overflowCount = 0
	}

	return GetDetailResult{
		Trip: foundTrip,
		ParticipantSummary: ParticipantSummary{
			TotalCount:    totalCount,
			PreviewNames:  previewNames,
			OverflowCount: overflowCount,
		},
		Days: days,
	}, nil
}

func mergeUpdateInput(foundTrip Trip, input UpdateInput) (UpdateRecord, error) {
	name := foundTrip.Name
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	if len([]rune(name)) < 1 || len([]rune(name)) > 80 {
		return UpdateRecord{}, ErrValidation
	}

	startDateText := foundTrip.StartDate
	if input.StartDate != nil {
		startDateText = *input.StartDate
	}
	startDate, err := parseDate(startDateText)
	if err != nil {
		return UpdateRecord{}, ErrValidation
	}

	endDateText := foundTrip.EndDate
	if input.EndDate != nil {
		endDateText = *input.EndDate
	}
	endDate, err := parseDate(endDateText)
	if err != nil {
		return UpdateRecord{}, ErrValidation
	}
	if startDate.After(endDate) {
		return UpdateRecord{}, ErrValidation
	}

	defaultCurrency := foundTrip.DefaultCurrency
	if input.DefaultCurrency != nil {
		defaultCurrency = *input.DefaultCurrency
	}
	if !isSupportedCurrency(defaultCurrency) {
		return UpdateRecord{}, ErrValidation
	}

	return UpdateRecord{
		ID:              foundTrip.ID,
		Name:            name,
		StartDate:       startDate,
		EndDate:         endDate,
		DefaultCurrency: defaultCurrency,
	}, nil
}

func isEmptyUpdate(input UpdateInput) bool {
	return input.Name == nil && input.StartDate == nil && input.EndDate == nil && input.DefaultCurrency == nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse(dateLayout, value)
}

func tripDaysForRange(startDateText string, endDateText string) ([]TripDay, error) {
	startDate, err := parseDate(startDateText)
	if err != nil {
		return nil, err
	}
	endDate, err := parseDate(endDateText)
	if err != nil {
		return nil, err
	}

	days := []TripDay{}
	for current, order := startDate, 1; !current.After(endDate); current, order = current.AddDate(0, 0, 1), order+1 {
		days = append(days, TripDay{
			Date:     current.Format(dateLayout),
			DayOrder: order,
		})
	}
	return days, nil
}

func dateOnly(value time.Time) time.Time {
	parsed, err := parseDate(value.Format(dateLayout))
	if err != nil {
		return time.Time{}
	}
	return parsed
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
	if len(value) != 36 {
		return false
	}
	for index, char := range value {
		switch index {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			if !isHex(char) {
				return false
			}
		}
	}
	return true
}

func isHex(char rune) bool {
	return (char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')
}

func participantDisplayName(value string) string {
	name := strings.TrimSpace(value)
	if name == "" {
		return "여행자"
	}
	return name
}
