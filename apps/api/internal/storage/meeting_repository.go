package storage

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
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

func (s *Store) CreateOrReturnMeetingInvite(ctx context.Context, record meeting.CreateMeetingInviteRecord) (meeting.CreateMeetingInviteResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return meeting.CreateMeetingInviteResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	if _, err := qtx.LockSavedMeetingForInviteByOwner(ctx, db.LockSavedMeetingForInviteByOwnerParams{MeetingID: mustUUID(record.MeetingID), UserID: mustUUID(record.CreatedBy)}); err == pgx.ErrNoRows {
		return meeting.CreateMeetingInviteResult{}, meeting.ErrNotFound
	} else if err != nil {
		return meeting.CreateMeetingInviteResult{}, err
	}

	current, err := qtx.GetCurrentMeetingInviteForUpdate(ctx, mustUUID(record.MeetingID))
	if err != nil && err != pgx.ErrNoRows {
		return meeting.CreateMeetingInviteResult{}, err
	}
	if err == nil {
		invite := meetingInviteFromRow(current.ID, current.MeetingID, current.Token, current.ExpiresAt, current.CreatedAt, current.CreatedBy)
		if invite.ExpiresAt.After(record.Now) {
			if err := tx.Commit(ctx); err != nil {
				return meeting.CreateMeetingInviteResult{}, err
			}
			return meeting.CreateMeetingInviteResult{Invite: invite, Created: false}, nil
		}
		if err := qtx.DeactivateMeetingInvite(ctx, db.DeactivateMeetingInviteParams{InviteID: mustUUID(current.ID), DeactivatedAt: timestamptzValue(record.Now)}); err != nil {
			return meeting.CreateMeetingInviteResult{}, err
		}
	}

	exists, err := qtx.InviteTokenExists(ctx, record.Token)
	if err != nil {
		return meeting.CreateMeetingInviteResult{}, err
	}
	if exists {
		return meeting.CreateMeetingInviteResult{}, meeting.ErrConflict
	}
	created, err := qtx.CreateMeetingInvite(ctx, db.CreateMeetingInviteParams{
		MeetingID: mustUUID(record.MeetingID),
		Token:     record.Token,
		CreatedBy: mustUUID(record.CreatedBy),
		ExpiresAt: timestamptzValue(record.ExpiresAt),
		CreatedAt: timestamptzValue(record.Now),
	})
	if isUniqueConstraintViolation(err, "meeting_invites_token_unique") || isUniqueConstraintViolation(err, "meeting_invites_one_current_per_meeting") {
		return meeting.CreateMeetingInviteResult{}, meeting.ErrConflict
	}
	if err != nil {
		return meeting.CreateMeetingInviteResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return meeting.CreateMeetingInviteResult{}, err
	}
	return meeting.CreateMeetingInviteResult{Invite: meetingInviteFromRow(created.ID, created.MeetingID, created.Token, created.ExpiresAt, created.CreatedAt, created.CreatedBy), Created: true}, nil
}

func (s *Store) AcceptMeetingInvite(ctx context.Context, record meeting.AcceptMeetingInviteRecord) (meeting.AcceptMeetingInviteResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return meeting.AcceptMeetingInviteResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	invite, err := qtx.GetMeetingInviteForAccept(ctx, record.Token)
	if err == pgx.ErrNoRows {
		return meeting.AcceptMeetingInviteResult{}, meeting.ErrInviteNotFound
	}
	if err != nil {
		return meeting.AcceptMeetingInviteResult{}, err
	}
	if invite.DeactivatedAt.Valid || !invite.ExpiresAt.Time.After(record.Now) {
		return meeting.AcceptMeetingInviteResult{}, meeting.ErrInviteExpired
	}

	member, err := qtx.GetMeetingMemberForUser(ctx, db.GetMeetingMemberForUserParams{MeetingID: mustUUID(invite.MiMeetingID), UserID: mustUUID(record.UserID)})
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return meeting.AcceptMeetingInviteResult{}, err
		}
		return meeting.AcceptMeetingInviteResult{MeetingID: invite.MiMeetingID, MeetingName: invite.MeetingName, Role: member.Role, AlreadyAccepted: true}, nil
	}
	if err != pgx.ErrNoRows {
		return meeting.AcceptMeetingInviteResult{}, err
	}

	user, err := qtx.GetUserByID(ctx, mustUUID(record.UserID))
	if err == pgx.ErrNoRows {
		return meeting.AcceptMeetingInviteResult{}, meeting.ErrUnauthorized
	}
	if err != nil {
		return meeting.AcceptMeetingInviteResult{}, err
	}
	displayName := trip.NormalizeParticipantDisplayName(user.DisplayName)
	created, err := qtx.CreateMeetingMember(ctx, db.CreateMeetingMemberParams{MeetingID: mustUUID(invite.MiMeetingID), UserID: mustUUID(record.UserID), Role: meeting.RoleMember, DisplayName: displayName})
	if isUniqueConstraintViolation(err, "meeting_members_meeting_user_unique") {
		member, err := qtx.GetMeetingMemberForUser(ctx, db.GetMeetingMemberForUserParams{MeetingID: mustUUID(invite.MiMeetingID), UserID: mustUUID(record.UserID)})
		if err != nil {
			return meeting.AcceptMeetingInviteResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return meeting.AcceptMeetingInviteResult{}, err
		}
		return meeting.AcceptMeetingInviteResult{MeetingID: invite.MiMeetingID, MeetingName: invite.MeetingName, Role: member.Role, AlreadyAccepted: true}, nil
	}
	if err != nil {
		return meeting.AcceptMeetingInviteResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return meeting.AcceptMeetingInviteResult{}, err
	}
	return meeting.AcceptMeetingInviteResult{MeetingID: invite.MiMeetingID, MeetingName: invite.MeetingName, Role: created.Role, AlreadyAccepted: false}, nil
}

func (s *Store) DeleteMeetingMember(ctx context.Context, meetingID string, memberID string) (bool, error) {
	_, err := s.queries.DeleteMeetingMemberByID(ctx, db.DeleteMeetingMemberByIDParams{MeetingID: mustUUID(meetingID), MemberID: mustUUID(memberID)})
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
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

func meetingInviteFromRow(id string, meetingID string, token string, expiresAt pgtype.Timestamptz, createdAt pgtype.Timestamptz, createdBy string) meeting.MeetingInvite {
	return meeting.MeetingInvite{ID: id, MeetingID: meetingID, Token: token, ExpiresAt: expiresAt.Time, CreatedAt: createdAt.Time, CreatedBy: createdBy}
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
