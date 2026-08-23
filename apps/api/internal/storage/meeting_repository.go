package storage

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/meeting"
)

func (s *Store) GetMeetingCreator(ctx context.Context, userID string) (meeting.Creator, bool, error) {
	row, err := s.queries.GetMeetingCreator(ctx, mustUUID(userID))
	if err == pgx.ErrNoRows {
		return meeting.Creator{}, false, nil
	}
	if err != nil {
		return meeting.Creator{}, false, err
	}
	return meeting.Creator{ID: row.ID, DisplayName: row.DisplayName}, true, nil
}

func (s *Store) CreateMeetingWithOwner(ctx context.Context, record meeting.CreateMeetingRecord) (meeting.CreateMeetingResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return meeting.CreateMeetingResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	createdMeeting, ownerMember, err := createMeetingWithOwner(ctx, qtx, record)
	if err != nil {
		return meeting.CreateMeetingResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return meeting.CreateMeetingResult{}, err
	}
	return meeting.CreateMeetingResult{Meeting: createdMeeting, OwnerMember: ownerMember}, nil
}

func createMeetingWithOwner(ctx context.Context, qtx *db.Queries, record meeting.CreateMeetingRecord) (meeting.Meeting, meeting.MeetingMember, error) {
	createdMeeting, err := qtx.CreateMeeting(ctx, db.CreateMeetingParams{
		Name:       record.Name,
		Visibility: record.Visibility,
		CreatedBy:  mustUUID(record.CreatedBy),
	})
	if err != nil {
		return meeting.Meeting{}, meeting.MeetingMember{}, err
	}
	owner, err := qtx.CreateMeetingMember(ctx, db.CreateMeetingMemberParams{
		MeetingID:   mustUUID(createdMeeting.ID),
		UserID:      mustUUID(record.CreatedBy),
		Role:        meeting.RoleOwner,
		DisplayName: record.OwnerDisplayName,
	})
	if err != nil {
		return meeting.Meeting{}, meeting.MeetingMember{}, err
	}
	return meetingFromCreateRow(createdMeeting), meetingMemberFromCreateRow(owner), nil
}

func (s *Store) ListSavedMeetingsByMemberUser(ctx context.Context, userID string) ([]meeting.MeetingListItem, error) {
	rows, err := s.queries.ListSavedMeetingsByMemberUser(ctx, mustUUID(userID))
	if err != nil {
		return nil, err
	}
	items := make([]meeting.MeetingListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, meeting.MeetingListItem{
			ID:          row.ID,
			Name:        row.Name,
			Visibility:  row.Visibility,
			MemberCount: int(row.MemberCount),
			MyRole:      row.MyRole,
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	return items, nil
}

func (s *Store) GetSavedMeetingForMember(ctx context.Context, meetingID string, userID string) (meeting.Meeting, bool, error) {
	row, err := s.queries.GetSavedMeetingForMember(ctx, db.GetSavedMeetingForMemberParams{
		MeetingID: mustUUID(meetingID),
		UserID:    mustUUID(userID),
	})
	if err == pgx.ErrNoRows {
		return meeting.Meeting{}, false, nil
	}
	if err != nil {
		return meeting.Meeting{}, false, err
	}
	return meetingFromSavedRow(row), true, nil
}

func (s *Store) GetMeetingDetailForMember(ctx context.Context, meetingID string, userID string) (meeting.MeetingDetailResult, bool, error) {
	row, err := s.queries.GetSavedMeetingForMember(ctx, db.GetSavedMeetingForMemberParams{
		MeetingID: mustUUID(meetingID),
		UserID:    mustUUID(userID),
	})
	if err == pgx.ErrNoRows {
		return meeting.MeetingDetailResult{}, false, nil
	}
	if err != nil {
		return meeting.MeetingDetailResult{}, false, err
	}
	members, err := s.queries.ListMeetingMembersForSavedMeetingByMemberUser(ctx, db.ListMeetingMembersForSavedMeetingByMemberUserParams{
		MeetingID: mustUUID(meetingID),
		UserID:    mustUUID(userID),
	})
	if err != nil {
		return meeting.MeetingDetailResult{}, false, err
	}
	events, err := s.queries.ListEventsForSavedMeetingByMemberUser(ctx, db.ListEventsForSavedMeetingByMemberUserParams{
		MeetingID: mustUUID(meetingID),
		UserID:    mustUUID(userID),
	})
	if err != nil {
		return meeting.MeetingDetailResult{}, false, err
	}
	return meeting.MeetingDetailResult{
		Meeting: meetingFromSavedRow(row),
		Members: meetingMembersFromSavedRows(members),
		Events:  eventsFromSavedMeetingRows(events),
	}, true, nil
}

func (s *Store) CreateEventWithMeeting(ctx context.Context, record meeting.CreateEventRecord) (meeting.CreateEventResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return meeting.CreateEventResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	var eventMeeting meeting.Meeting
	var meetingMemberID string
	if strings.TrimSpace(record.ExistingMeetingID) == "" {
		created, owner, err := createMeetingWithOwner(ctx, qtx, meeting.CreateMeetingRecord{
			Name:             record.NewMeetingName,
			Visibility:       record.MeetingVisibility,
			CreatedBy:        record.CreatedBy,
			OwnerDisplayName: record.OwnerDisplayName,
		})
		if err != nil {
			return meeting.CreateEventResult{}, err
		}
		eventMeeting = created
		meetingMemberID = owner.ID
	} else {
		row, err := qtx.GetSavedMeetingForMember(ctx, db.GetSavedMeetingForMemberParams{MeetingID: mustUUID(record.ExistingMeetingID), UserID: mustUUID(record.CreatedBy)})
		if err != nil {
			return meeting.CreateEventResult{}, err
		}
		eventMeeting = meetingFromSavedRow(row)
		member, err := qtx.GetMeetingMemberForUser(ctx, db.GetMeetingMemberForUserParams{MeetingID: mustUUID(record.ExistingMeetingID), UserID: mustUUID(record.CreatedBy)})
		if err != nil {
			return meeting.CreateEventResult{}, err
		}
		meetingMemberID = member.ID
	}

	createdEvent, err := qtx.CreateEvent(ctx, db.CreateEventParams{
		MeetingID:       mustUUID(eventMeeting.ID),
		EventType:       record.EventType,
		Title:           record.Title,
		StartDate:       dateValue(record.StartDate),
		EndDate:         dateValue(record.EndDate),
		DefaultCurrency: record.DefaultCurrency,
		Status:          record.Status,
		TripID:          optionalUUID(""),
		CreatedBy:       mustUUID(record.CreatedBy),
	})
	if err != nil {
		return meeting.CreateEventResult{}, err
	}
	ownerParticipant, err := qtx.CreateEventParticipant(ctx, db.CreateEventParticipantParams{
		EventID:         mustUUID(createdEvent.ID),
		MeetingMemberID: optionalUUID(meetingMemberID),
		UserID:          mustUUID(record.CreatedBy),
		Role:            meeting.RoleOwner,
		DisplayName:     record.OwnerDisplayName,
	})
	if err != nil {
		return meeting.CreateEventResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return meeting.CreateEventResult{}, err
	}

	event := eventFromCreateRow(createdEvent, eventMeeting)
	return meeting.CreateEventResult{Meeting: eventMeeting, Event: event, OwnerParticipant: eventParticipantFromCreateRow(ownerParticipant)}, nil
}

func (s *Store) GetEventForParticipant(ctx context.Context, eventID string, userID string) (meeting.EventDetailResult, bool, error) {
	row, err := s.queries.GetEventForParticipant(ctx, db.GetEventForParticipantParams{EventID: mustUUID(eventID), UserID: mustUUID(userID)})
	if err == pgx.ErrNoRows {
		return meeting.EventDetailResult{}, false, nil
	}
	if err != nil {
		return meeting.EventDetailResult{}, false, err
	}
	resultMeeting := meeting.Meeting{
		ID:         row.ResultMeetingID,
		Name:       row.ResultMeetingName,
		Visibility: row.ResultMeetingVisibility,
		CreatedBy:  row.ResultMeetingCreatedBy,
		CreatedAt:  row.ResultMeetingCreatedAt.Time,
		UpdatedAt:  row.ResultMeetingUpdatedAt.Time,
	}
	return meeting.EventDetailResult{Meeting: resultMeeting, Event: eventFromDetailRow(row)}, true, nil
}

func meetingFromCreateRow(row db.CreateMeetingRow) meeting.Meeting {
	return meeting.Meeting{ID: row.ID, Name: row.Name, Visibility: row.Visibility, CreatedBy: row.CreatedBy, CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time}
}

func meetingFromSavedRow(row db.GetSavedMeetingForMemberRow) meeting.Meeting {
	return meeting.Meeting{ID: row.MID, Name: row.Name, Visibility: row.Visibility, CreatedBy: row.MCreatedBy, CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time}
}

func meetingMemberFromCreateRow(row db.CreateMeetingMemberRow) meeting.MeetingMember {
	return meeting.MeetingMember{ID: row.ID, MeetingID: row.MeetingID, UserID: row.UserID, Role: row.Role, DisplayName: row.DisplayName, JoinedAt: row.JoinedAt.Time}
}

func eventFromCreateRow(row db.CreateEventRow, eventMeeting meeting.Meeting) meeting.Event {
	return meeting.Event{
		ID:                row.ID,
		MeetingID:         row.MeetingID,
		MeetingName:       eventMeeting.Name,
		MeetingVisibility: eventMeeting.Visibility,
		EventType:         row.EventType,
		Title:             row.Title,
		StartDate:         dateString(row.StartDate),
		EndDate:           dateString(row.EndDate),
		DefaultCurrency:   row.DefaultCurrency,
		Status:            row.Status,
		TripID:            optionalStringPointer(row.TripID),
		CreatedBy:         row.CreatedBy,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

func eventsFromSavedMeetingRows(rows []db.ListEventsForSavedMeetingByMemberUserRow) []meeting.Event {
	events := make([]meeting.Event, 0, len(rows))
	for _, row := range rows {
		events = append(events, meeting.Event{
			ID:                row.ID,
			MeetingID:         row.MeetingID,
			MeetingName:       row.MeetingName,
			MeetingVisibility: row.MeetingVisibility,
			EventType:         row.EventType,
			Title:             row.Title,
			StartDate:         dateString(row.StartDate),
			EndDate:           dateString(row.EndDate),
			DefaultCurrency:   row.DefaultCurrency,
			Status:            row.Status,
			TripID:            optionalStringPointer(row.TripID),
			CreatedBy:         row.CreatedBy,
			CreatedAt:         row.CreatedAt.Time,
			UpdatedAt:         row.UpdatedAt.Time,
		})
	}
	return events
}

func eventFromDetailRow(row db.GetEventForParticipantRow) meeting.Event {
	return meeting.Event{
		ID:                row.ID,
		MeetingID:         row.MeetingID,
		MeetingName:       row.MeetingName,
		MeetingVisibility: row.MeetingVisibility,
		EventType:         row.EventType,
		Title:             row.Title,
		StartDate:         dateString(row.StartDate),
		EndDate:           dateString(row.EndDate),
		DefaultCurrency:   row.DefaultCurrency,
		Status:            row.Status,
		TripID:            optionalStringPointer(row.TripID),
		CreatedBy:         row.CreatedBy,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

func eventParticipantFromCreateRow(row db.CreateEventParticipantRow) meeting.EventParticipant {
	return meeting.EventParticipant{
		ID:              row.ID,
		EventID:         row.EventID,
		MeetingMemberID: optionalStringPointer(row.MeetingMemberID),
		UserID:          row.UserID,
		Role:            row.Role,
		DisplayName:     row.DisplayName,
		JoinedAt:        row.JoinedAt.Time,
	}
}

func optionalUUID(value string) pgtype.UUID {
	if strings.TrimSpace(value) == "" {
		return pgtype.UUID{}
	}
	return mustUUID(value)
}

func optionalStringPointer(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}
