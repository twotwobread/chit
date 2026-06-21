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

func parseDate(value string) (time.Time, error) {
	return time.Parse(dateLayout, value)
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
