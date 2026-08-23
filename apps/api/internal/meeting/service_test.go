package meeting

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

const (
	testUserID    = "00000000-0000-0000-0000-000000000101"
	testMeetingID = "00000000-0000-0000-0000-000000000201"
	testEventID   = "00000000-0000-0000-0000-000000000301"
)

type fakeRepository struct {
	creator      Creator
	creatorFound bool

	createdMeeting       CreateMeetingRecord
	createMeetingCalled  bool
	createMeetingResult  CreateMeetingResult
	listedMeetings       []MeetingListItem
	listedMeetingsUserID string
	savedMeeting         Meeting
	savedMeetingFound    bool
	savedMeetingLookupID string
	savedMeetingUserID   string

	createdEvent        CreateEventRecord
	createEventCalled   bool
	createEventResult   CreateEventResult
	meetingDetail       MeetingDetailResult
	meetingDetailFound  bool
	meetingDetailLookup string
	meetingDetailUserID string
	eventDetail         EventDetailResult
	eventFound          bool
	eventLookupID       string
	eventLookupUserID   string
}

func (r *fakeRepository) GetMeetingCreator(context.Context, string) (Creator, bool, error) {
	return r.creator, r.creatorFound, nil
}

func (r *fakeRepository) CreateMeetingWithOwner(_ context.Context, record CreateMeetingRecord) (CreateMeetingResult, error) {
	r.createdMeeting = record
	r.createMeetingCalled = true
	if r.createMeetingResult.Meeting.ID != "" {
		return r.createMeetingResult, nil
	}
	return CreateMeetingResult{
		Meeting: Meeting{
			ID:         testMeetingID,
			Name:       record.Name,
			Visibility: record.Visibility,
			CreatedBy:  record.CreatedBy,
			CreatedAt:  time.Date(2026, 8, 22, 9, 0, 0, 0, time.UTC),
			UpdatedAt:  time.Date(2026, 8, 22, 9, 0, 0, 0, time.UTC),
		},
		OwnerMember: MeetingMember{
			ID:          "member-1",
			MeetingID:   testMeetingID,
			UserID:      record.CreatedBy,
			Role:        RoleOwner,
			DisplayName: record.OwnerDisplayName,
			JoinedAt:    time.Date(2026, 8, 22, 9, 0, 0, 0, time.UTC),
		},
	}, nil
}

func (r *fakeRepository) ListSavedMeetingsByMemberUser(_ context.Context, userID string) ([]MeetingListItem, error) {
	r.listedMeetingsUserID = userID
	return r.listedMeetings, nil
}

func (r *fakeRepository) GetSavedMeetingForMember(_ context.Context, meetingID string, userID string) (Meeting, bool, error) {
	r.savedMeetingLookupID = meetingID
	r.savedMeetingUserID = userID
	return r.savedMeeting, r.savedMeetingFound, nil
}

func (r *fakeRepository) GetMeetingDetailForMember(_ context.Context, meetingID string, userID string) (MeetingDetailResult, bool, error) {
	r.meetingDetailLookup = meetingID
	r.meetingDetailUserID = userID
	return r.meetingDetail, r.meetingDetailFound, nil
}

func (r *fakeRepository) CreateEventWithMeeting(_ context.Context, record CreateEventRecord) (CreateEventResult, error) {
	r.createdEvent = record
	r.createEventCalled = true
	if r.createEventResult.Event.ID != "" {
		return r.createEventResult, nil
	}
	meetingID := record.ExistingMeetingID
	meetingName := record.NewMeetingName
	meetingVisibility := record.MeetingVisibility
	if meetingID == "" {
		meetingID = testMeetingID
	}
	if meetingName == "" && r.savedMeeting.Name != "" {
		meetingName = r.savedMeeting.Name
	}
	if meetingVisibility == "" && r.savedMeeting.Visibility != "" {
		meetingVisibility = r.savedMeeting.Visibility
	}
	return CreateEventResult{
		Meeting: Meeting{ID: meetingID, Name: meetingName, Visibility: meetingVisibility, CreatedBy: record.CreatedBy},
		Event: Event{
			ID:              testEventID,
			MeetingID:       meetingID,
			EventType:       record.EventType,
			Title:           record.Title,
			StartDate:       record.StartDate.Format(dateLayout),
			EndDate:         record.EndDate.Format(dateLayout),
			DefaultCurrency: record.DefaultCurrency,
			Status:          EventStatusPlanned,
			CreatedBy:       record.CreatedBy,
		},
		OwnerParticipant: EventParticipant{
			ID:          "event-participant-1",
			EventID:     testEventID,
			UserID:      record.CreatedBy,
			Role:        RoleOwner,
			DisplayName: record.OwnerDisplayName,
		},
	}, nil
}

func (r *fakeRepository) GetEventForParticipant(_ context.Context, eventID string, userID string) (EventDetailResult, bool, error) {
	r.eventLookupID = eventID
	r.eventLookupUserID = userID
	return r.eventDetail, r.eventFound, nil
}

func newTestService(repo *fakeRepository) *Service {
	return NewService(repo)
}

func TestCreateMeetingCreatesSavedOwnerMeeting(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: testUserID, DisplayName: "민수"}, creatorFound: true}

	result, err := newTestService(repo).CreateMeeting(context.Background(), testUserID, CreateMeetingInput{Name: "  동네 친구들  "})
	if err != nil {
		t.Fatalf("CreateMeeting returned error: %v", err)
	}

	want := CreateMeetingRecord{Name: "동네 친구들", Visibility: MeetingVisibilitySaved, CreatedBy: testUserID, OwnerDisplayName: "민수"}
	if !reflect.DeepEqual(repo.createdMeeting, want) {
		t.Fatalf("unexpected create meeting record: got %#v want %#v", repo.createdMeeting, want)
	}
	if result.Meeting.Visibility != MeetingVisibilitySaved || result.OwnerMember.Role != RoleOwner {
		t.Fatalf("expected saved owner meeting, got %#v", result)
	}
}

func TestListMeetingsRequiresAuthAndListsSavedMemberships(t *testing.T) {
	repo := &fakeRepository{listedMeetings: []MeetingListItem{{ID: testMeetingID, Name: "동네 친구들", MemberCount: 3, MyRole: RoleOwner}}}

	meetings, err := newTestService(repo).ListMeetings(context.Background(), testUserID)
	if err != nil {
		t.Fatalf("ListMeetings returned error: %v", err)
	}
	if repo.listedMeetingsUserID != testUserID || len(meetings) != 1 || meetings[0].Name != "동네 친구들" {
		t.Fatalf("unexpected meeting list: user=%q meetings=%#v", repo.listedMeetingsUserID, meetings)
	}

	_, err = newTestService(repo).ListMeetings(context.Background(), " ")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestGetMeetingReturnsSavedMeetingMembersAndEvents(t *testing.T) {
	repo := &fakeRepository{
		meetingDetailFound: true,
		meetingDetail: MeetingDetailResult{
			Meeting: Meeting{ID: testMeetingID, Name: "등산 모임", Visibility: MeetingVisibilitySaved},
			Members: []MeetingMember{{ID: "member-1", MeetingID: testMeetingID, UserID: testUserID, Role: RoleOwner, DisplayName: "민수"}},
			Events:  []Event{{ID: testEventID, MeetingID: testMeetingID, MeetingName: "등산 모임", MeetingVisibility: MeetingVisibilitySaved, EventType: EventTypeTrip, Title: "오사카 3박 4일", StartDate: "2026-07-10", EndDate: "2026-07-13"}},
		},
	}

	detail, err := newTestService(repo).GetMeeting(context.Background(), testUserID, testMeetingID)
	if err != nil {
		t.Fatalf("GetMeeting returned error: %v", err)
	}
	if repo.meetingDetailLookup != testMeetingID || repo.meetingDetailUserID != testUserID {
		t.Fatalf("unexpected repository lookup meeting=%q user=%q", repo.meetingDetailLookup, repo.meetingDetailUserID)
	}
	if detail.Meeting.Name != "등산 모임" || len(detail.Members) != 1 || len(detail.Events) != 1 {
		t.Fatalf("expected meeting detail with members/events, got %#v", detail)
	}

	_, err = newTestService(&fakeRepository{}).GetMeeting(context.Background(), testUserID, testMeetingID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	_, err = newTestService(repo).GetMeeting(context.Background(), " ", testMeetingID)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
	_, err = newTestService(repo).GetMeeting(context.Background(), testUserID, "not-a-uuid")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestCreateEventWithNewSavedMeeting(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: testUserID, DisplayName: "민수"}, creatorFound: true}

	_, err := newTestService(repo).CreateEvent(context.Background(), testUserID, CreateEventInput{
		Title:           "  오사카 여행  ",
		StartDate:       "2026-09-01",
		EndDate:         "2026-09-03",
		EventType:       EventTypeTrip,
		DefaultCurrency: "JPY",
		Meeting: EventMeetingInput{
			Mode: MeetingModeNew,
			Name: "  일본 여행 멤버  ",
		},
	})
	if err != nil {
		t.Fatalf("CreateEvent returned error: %v", err)
	}

	if !repo.createEventCalled {
		t.Fatal("expected repository event creation")
	}
	if repo.createdEvent.Title != "오사카 여행" || repo.createdEvent.NewMeetingName != "일본 여행 멤버" || repo.createdEvent.MeetingVisibility != MeetingVisibilitySaved {
		t.Fatalf("unexpected event record: %#v", repo.createdEvent)
	}
	if repo.createdEvent.MeetingMode != MeetingModeNew || repo.createdEvent.EventType != EventTypeTrip || repo.createdEvent.OwnerDisplayName != "민수" {
		t.Fatalf("unexpected event ownership/type record: %#v", repo.createdEvent)
	}
}

func TestCreateEventWithOneOffMeetingHidesMeetingAndDefaultsName(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: testUserID, DisplayName: "민수"}, creatorFound: true}

	_, err := newTestService(repo).CreateEvent(context.Background(), testUserID, CreateEventInput{
		Title:           "성수 저녁",
		StartDate:       "2026-09-01",
		EndDate:         "2026-09-01",
		EventType:       EventTypeOuting,
		DefaultCurrency: "KRW",
		Meeting:         EventMeetingInput{Mode: MeetingModeOneOff},
	})
	if err != nil {
		t.Fatalf("CreateEvent returned error: %v", err)
	}

	if repo.createdEvent.MeetingMode != MeetingModeOneOff || repo.createdEvent.MeetingVisibility != MeetingVisibilityOneOff {
		t.Fatalf("expected hidden one-off meeting record, got %#v", repo.createdEvent)
	}
	if repo.createdEvent.NewMeetingName != "성수 저녁" {
		t.Fatalf("expected one-off meeting name to default to title, got %q", repo.createdEvent.NewMeetingName)
	}
}

func TestCreateEventWithExistingMeetingRequiresMembership(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: testUserID, DisplayName: "민수"}, creatorFound: true, savedMeetingFound: false}

	_, err := newTestService(repo).CreateEvent(context.Background(), testUserID, CreateEventInput{
		Title:           "오사카 여행",
		StartDate:       "2026-09-01",
		EndDate:         "2026-09-03",
		EventType:       EventTypeTrip,
		DefaultCurrency: "JPY",
		Meeting:         EventMeetingInput{Mode: MeetingModeExisting, MeetingID: testMeetingID},
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
	if repo.createEventCalled {
		t.Fatal("should not create event when current user is not a meeting member")
	}

	repo.savedMeetingFound = true
	repo.savedMeeting = Meeting{ID: testMeetingID, Name: "일본 여행 멤버", Visibility: MeetingVisibilitySaved}
	_, err = newTestService(repo).CreateEvent(context.Background(), testUserID, CreateEventInput{
		Title:           "오사카 여행",
		StartDate:       "2026-09-01",
		EndDate:         "2026-09-03",
		EventType:       EventTypeTrip,
		DefaultCurrency: "JPY",
		Meeting:         EventMeetingInput{Mode: MeetingModeExisting, MeetingID: testMeetingID},
	})
	if err != nil {
		t.Fatalf("CreateEvent with member existing meeting returned error: %v", err)
	}
	if repo.createdEvent.ExistingMeetingID != testMeetingID || repo.createdEvent.NewMeetingName != "" {
		t.Fatalf("unexpected existing meeting event record: %#v", repo.createdEvent)
	}
}

func TestCreateEventValidation(t *testing.T) {
	repo := &fakeRepository{creator: Creator{ID: testUserID, DisplayName: "민수"}, creatorFound: true}
	valid := func() CreateEventInput {
		return CreateEventInput{Title: "오사카 여행", StartDate: "2026-09-01", EndDate: "2026-09-03", EventType: EventTypeTrip, DefaultCurrency: "JPY", Meeting: EventMeetingInput{Mode: MeetingModeNew, Name: "일본 여행 멤버"}}
	}

	cases := []struct {
		name  string
		patch func(*CreateEventInput)
	}{
		{name: "missing title", patch: func(input *CreateEventInput) { input.Title = " " }},
		{name: "invalid date", patch: func(input *CreateEventInput) { input.StartDate = "2026-99-01" }},
		{name: "reversed date", patch: func(input *CreateEventInput) { input.StartDate = "2026-09-04" }},
		{name: "unsupported event type", patch: func(input *CreateEventInput) { input.EventType = "dinner" }},
		{name: "unsupported currency", patch: func(input *CreateEventInput) { input.DefaultCurrency = "GBP" }},
		{name: "missing new meeting name", patch: func(input *CreateEventInput) { input.Meeting = EventMeetingInput{Mode: MeetingModeNew, Name: " "} }},
		{name: "missing existing meeting id", patch: func(input *CreateEventInput) { input.Meeting = EventMeetingInput{Mode: MeetingModeExisting} }},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			input := valid()
			tt.patch(&input)
			_, err := newTestService(repo).CreateEvent(context.Background(), testUserID, input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestGetEventRequiresParticipant(t *testing.T) {
	repo := &fakeRepository{eventFound: false}

	_, err := newTestService(repo).GetEvent(context.Background(), testUserID, testEventID)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound for non-participant event, got %v", err)
	}

	repo.eventFound = true
	repo.eventDetail = EventDetailResult{Event: Event{ID: testEventID, MeetingID: testMeetingID, MeetingVisibility: MeetingVisibilityOneOff, Title: "성수 저녁"}}
	result, err := newTestService(repo).GetEvent(context.Background(), testUserID, testEventID)
	if err != nil {
		t.Fatalf("GetEvent returned error: %v", err)
	}
	if result.Event.MeetingVisibility != MeetingVisibilityOneOff || repo.eventLookupUserID != testUserID {
		t.Fatalf("unexpected event lookup/result: lookup=%q result=%#v", repo.eventLookupUserID, result)
	}
}
