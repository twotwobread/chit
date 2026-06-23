package place

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	dateLayout   = "2006-01-02"
	defaultLimit = 5
	maxLimit     = 10
	maxQueryLen  = 120
)

type Service struct {
	repo     Repository
	provider Provider
}

func NewService(repo Repository, provider Provider) *Service {
	return &Service{repo: repo, provider: provider}
}

func (s *Service) SearchGoogle(ctx context.Context, userID string, tripID string, date string, input SearchInput) ([]SearchResult, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}
	if s == nil || s.repo == nil {
		return nil, ErrProviderUnavailable
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if _, err := uuid.Parse(tripID); err != nil {
		return nil, ErrValidation
	}

	selectedDate, err := time.Parse(dateLayout, date)
	if err != nil {
		return nil, ErrValidation
	}

	query := strings.TrimSpace(input.Query)
	queryLen := len([]rune(query))
	if queryLen < 2 || queryLen > maxQueryLen {
		return nil, ErrValidation
	}

	limit := input.Limit
	if limit == 0 {
		limit = defaultLimit
	}
	if limit < 1 || limit > maxLimit {
		return nil, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return nil, err
	}
	if !isParticipant {
		return nil, ErrForbidden
	}

	inRange, err := dateInTripRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
	if err != nil {
		return nil, ErrValidation
	}
	if !inRange {
		return nil, ErrNotFound
	}

	if s.provider == nil {
		return nil, ErrProviderUnavailable
	}

	return s.provider.Search(ctx, ProviderSearchInput{Query: query, Limit: limit})
}

func dateInTripRange(start string, end string, selected time.Time) (bool, error) {
	startDate, err := time.Parse(dateLayout, strings.TrimSpace(start))
	if err != nil {
		return false, err
	}
	endDate, err := time.Parse(dateLayout, strings.TrimSpace(end))
	if err != nil {
		return false, err
	}
	selected = dateOnly(selected)
	return !selected.Before(dateOnly(startDate)) && !selected.After(dateOnly(endDate)), nil
}

func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}
