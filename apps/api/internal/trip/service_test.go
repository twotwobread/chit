package trip

import (
	"context"
	"errors"
	"testing"
	"time"
)

const testTripID = "00000000-0000-0000-0000-000000000001"

type fakeRepository struct {
	creator          Creator
	creatorFound     bool
	created          CreateRecord
	trip             Trip
	tripFound        bool
	isParticipant    bool
	participantCount int
	previewNames     []string
	listed           []ListItem
	listedUserID     string
}

func (r *fakeRepository) GetCreator(context.Context, string) (Creator, bool, error) {
	return r.creator, r.creatorFound, nil
}

func (r *fakeRepository) CreateTripWithOwner(_ context.Context, record CreateRecord) (CreateResult, error) {
	r.created = record
	return CreateResult{
		Trip: Trip{
			ID:              testTripID,
			Name:            record.Name,
			StartDate:       record.StartDate.Format(dateLayout),
			EndDate:         record.EndDate.Format(dateLayout),
			DefaultCurrency: record.DefaultCurrency,
			CreatedBy:       record.CreatedBy,
			CreatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			UpdatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
		OwnerParticipant: Participant{
			ID:          "participant-1",
			TripID:      testTripID,
			UserID:      record.CreatedBy,
			Role:        RoleOwner,
			DisplayName: record.OwnerDisplayName,
			JoinedAt:    time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
	}, nil
}

func (r *fakeRepository) GetTripByID(context.Context, string) (Trip, bool, error) {
	return r.trip, r.tripFound, nil
}

func (r *fakeRepository) IsTripParticipant(context.Context, string, string) (bool, error) {
	return r.isParticipant, nil
}

func (r *fakeRepository) CountTripParticipants(context.Context, string) (int, error) {
	return r.participantCount, nil
}

func (r *fakeRepository) ListTripParticipantPreviewNames(context.Context, string) ([]string, error) {
	return r.previewNames, nil
}

func (r *fakeRepository) ListTripsByParticipantUser(_ context.Context, userID string) ([]ListItem, error) {
	r.listedUserID = userID
	return r.listed, nil
}

func TestServiceCreate(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: "user-1", DisplayName: "민수"}, creatorFound: true}
	service := newTestService(repo)

	result, err := service.Create(context.Background(), "user-1", CreateInput{
		Name:            "  오사카 3박 4일  ",
		StartDate:       "2026-07-10",
		EndDate:         "2026-07-13",
		DefaultCurrency: "JPY",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if result.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("expected trimmed trip name, got %q", result.Trip.Name)
	}
	if result.Trip.CreatedBy != "user-1" {
		t.Fatalf("expected created by user-1, got %q", result.Trip.CreatedBy)
	}
	if result.OwnerParticipant.Role != RoleOwner {
		t.Fatalf("expected owner role, got %q", result.OwnerParticipant.Role)
	}
	if result.OwnerParticipant.DisplayName != "민수" {
		t.Fatalf("expected display name snapshot 민수, got %q", result.OwnerParticipant.DisplayName)
	}
	if repo.created.Name != "오사카 3박 4일" {
		t.Fatalf("expected repository to receive trimmed name, got %q", repo.created.Name)
	}
}

func TestServiceCreateValidation(t *testing.T) {
	service := newTestService(&fakeRepository{creator: Creator{ID: "user-1", DisplayName: "민수"}, creatorFound: true})

	tests := []struct {
		name  string
		input CreateInput
	}{
		{name: "empty name", input: CreateInput{Name: " ", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "invalid start date", input: CreateInput{Name: "오사카", StartDate: "2026/07/10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "end before start", input: CreateInput{Name: "오사카", StartDate: "2026-07-13", EndDate: "2026-07-10", DefaultCurrency: "JPY"}},
		{name: "past start date", input: CreateInput{Name: "오사카", StartDate: "2026-06-20", EndDate: "2026-07-13", DefaultCurrency: "JPY"}},
		{name: "unsupported currency", input: CreateInput{Name: "오사카", StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "GBP"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.Create(context.Background(), "user-1", tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestServiceCreateRequiresCreator(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.Create(context.Background(), "user-1", CreateInput{
		Name:            "오사카",
		StartDate:       "2026-07-10",
		EndDate:         "2026-07-13",
		DefaultCurrency: "JPY",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceList(t *testing.T) {
	repo := &fakeRepository{listed: []ListItem{{ID: testTripID, Name: "오사카"}}}
	service := newTestService(repo)

	trips, err := service.List(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if repo.listedUserID != "user-1" {
		t.Fatalf("expected repository to receive user-1, got %q", repo.listedUserID)
	}
	if len(trips) != 1 || trips[0].ID != testTripID {
		t.Fatalf("unexpected trips: %#v", trips)
	}
}

func TestServiceListRequiresAuth(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.List(context.Background(), " ")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestServiceGetDetail(t *testing.T) {
	repo := &fakeRepository{
		trip: Trip{
			ID:              testTripID,
			Name:            "오사카 3박 4일",
			StartDate:       "2026-07-10",
			EndDate:         "2026-07-13",
			DefaultCurrency: "JPY",
			CreatedBy:       "user-1",
		},
		tripFound:        true,
		isParticipant:    true,
		participantCount: 4,
		previewNames:     []string{" 민수 ", "지영", ""},
	}
	service := newTestService(repo)

	result, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if err != nil {
		t.Fatalf("GetDetail returned error: %v", err)
	}

	if result.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("expected trip detail, got %#v", result.Trip)
	}
	if result.ParticipantSummary.TotalCount != 4 {
		t.Fatalf("expected total count 4, got %d", result.ParticipantSummary.TotalCount)
	}
	if result.ParticipantSummary.OverflowCount != 1 {
		t.Fatalf("expected overflow count 1, got %d", result.ParticipantSummary.OverflowCount)
	}
	expectedNames := []string{"민수", "지영", "여행자"}
	for index, expected := range expectedNames {
		if result.ParticipantSummary.PreviewNames[index] != expected {
			t.Fatalf("expected preview name %d to be %q, got %q", index, expected, result.ParticipantSummary.PreviewNames[index])
		}
	}
}

func TestServiceGetDetailValidation(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDetail(context.Background(), "user-1", "not-a-uuid")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestServiceGetDetailNotFound(t *testing.T) {
	service := newTestService(&fakeRepository{})

	_, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceGetDetailForbidden(t *testing.T) {
	service := newTestService(&fakeRepository{trip: Trip{ID: testTripID}, tripFound: true})

	_, err := service.GetDetail(context.Background(), "user-1", testTripID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func newTestService(repo Repository) *Service {
	service := NewService(repo)
	service.today = func() time.Time { return time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC) }
	return service
}
