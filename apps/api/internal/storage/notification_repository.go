package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/notification"
)

func (s *Store) RegisterPushToken(ctx context.Context, userID string, input notification.RegisterPushTokenInput) (notification.PushToken, error) {
	params := db.DeactivateActivePushTokenDuplicatesParams{
		ExpoPushToken:  input.ExpoPushToken,
		UserID:         mustUUID(userID),
		InstallationID: input.InstallationID,
	}
	if err := s.queries.DeactivateActivePushTokenDuplicates(ctx, params); err != nil {
		return notification.PushToken{}, err
	}
	row, err := s.queries.UpsertPushToken(ctx, db.UpsertPushTokenParams{
		UserID:         mustUUID(userID),
		InstallationID: input.InstallationID,
		ExpoPushToken:  input.ExpoPushToken,
		Platform:       input.Platform,
	})
	if err != nil {
		return notification.PushToken{}, err
	}
	return notification.PushToken{
		InstallationID:   row.InstallationID,
		Platform:         row.Platform,
		Status:           row.Status,
		LastRegisteredAt: row.LastRegisteredAt.Time,
	}, nil
}

func (s *Store) RevokePushToken(ctx context.Context, userID string, installationID string) error {
	return s.queries.RevokePushToken(ctx, db.RevokePushTokenParams{UserID: mustUUID(userID), InstallationID: installationID})
}

func (s *Store) ListNotifications(ctx context.Context, userID string, input notification.ListNotificationsInput) (notification.ListNotificationsResult, error) {
	cursorCreatedAt := pgtype.Timestamptz{}
	cursorID := pgtype.UUID{}
	if input.Cursor != nil {
		createdAt, id, err := decodeNotificationCursor(*input.Cursor)
		if err != nil {
			return notification.ListNotificationsResult{}, notification.ErrValidation
		}
		parsedID, err := notificationUUID(id)
		if err != nil {
			return notification.ListNotificationsResult{}, err
		}
		cursorCreatedAt = pgtype.Timestamptz{Time: createdAt, Valid: true}
		cursorID = parsedID
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.queries.ListUserNotifications(ctx, db.ListUserNotificationsParams{
		UserID:          mustUUID(userID),
		CursorCreatedAt: cursorCreatedAt,
		CursorID:        cursorID,
		LimitCount:      int32(limit + 1),
	})
	if err != nil {
		return notification.ListNotificationsResult{}, err
	}
	var nextCursor *string
	if len(rows) > limit {
		last := rows[limit-1]
		cursor := encodeNotificationCursor(last.CreatedAt.Time, last.UnID)
		nextCursor = &cursor
		rows = rows[:limit]
	}
	notifications := make([]notification.UserNotification, 0, len(rows))
	for _, row := range rows {
		item, err := userNotificationFromListRow(row)
		if err != nil {
			return notification.ListNotificationsResult{}, err
		}
		notifications = append(notifications, item)
	}
	return notification.ListNotificationsResult{Notifications: notifications, NextCursor: nextCursor}, nil
}

func (s *Store) MarkNotificationRead(ctx context.Context, userID string, notificationID string) (notification.UserNotification, error) {
	parsedNotificationID, err := notificationUUID(notificationID)
	if err != nil {
		return notification.UserNotification{}, err
	}
	row, err := s.queries.MarkUserNotificationRead(ctx, db.MarkUserNotificationReadParams{NotificationID: parsedNotificationID, UserID: mustUUID(userID)})
	if err == pgx.ErrNoRows {
		return notification.UserNotification{}, notification.ErrNotFound
	}
	if err != nil {
		return notification.UserNotification{}, err
	}
	return userNotificationFromMarkRow(row)
}

func (s *Store) RecoverStalePushOutbox(ctx context.Context, staleBefore time.Time) error {
	return s.queries.RecoverStaleNotificationPushOutbox(ctx, pgtype.Timestamptz{Time: staleBefore, Valid: true})
}

func (s *Store) ClaimPushOutbox(ctx context.Context, limit int) ([]notification.PushOutboxMessage, error) {
	rows, err := s.queries.ClaimNotificationPushOutbox(ctx, int32(limit))
	if err != nil {
		return nil, err
	}
	messages := make([]notification.PushOutboxMessage, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, notification.PushOutboxMessage{
			ID:            row.NpoID,
			PushTokenID:   row.PushTokenID,
			ExpoPushToken: row.ExpoPushTokenSnapshot,
			Title:         row.Title,
			Body:          row.Body,
			DataJSON:      row.DataJson,
			Attempts:      int(row.Attempts),
		})
	}
	return messages, nil
}

func (s *Store) MarkPushOutboxSucceeded(ctx context.Context, outboxID string, providerMessageID *string) error {
	return s.queries.MarkNotificationPushOutboxSucceeded(ctx, db.MarkNotificationPushOutboxSucceededParams{ProviderMessageID: textPtrToSQL(providerMessageID), OutboxID: mustUUID(outboxID)})
}

func (s *Store) MarkPushOutboxFailed(ctx context.Context, outboxID string, lastError string) error {
	return s.queries.MarkNotificationPushOutboxFailed(ctx, db.MarkNotificationPushOutboxFailedParams{LastError: textValue(lastError), OutboxID: mustUUID(outboxID)})
}

func (s *Store) MarkPushOutboxDead(ctx context.Context, outboxID string, lastError string) error {
	return s.queries.MarkNotificationPushOutboxDead(ctx, db.MarkNotificationPushOutboxDeadParams{LastError: textValue(lastError), OutboxID: mustUUID(outboxID)})
}

func (s *Store) MarkPushOutboxSkipped(ctx context.Context, outboxID string, lastError string) error {
	return s.queries.MarkNotificationPushOutboxSkipped(ctx, db.MarkNotificationPushOutboxSkippedParams{LastError: textValue(lastError), OutboxID: mustUUID(outboxID)})
}

func (s *Store) MarkPushTokenInvalid(ctx context.Context, pushTokenID string) error {
	return s.queries.MarkPushTokenInvalid(ctx, mustUUID(pushTokenID))
}

func userNotificationFromListRow(row db.ListUserNotificationsRow) (notification.UserNotification, error) {
	snapshot, err := unmarshalNotificationSnapshot(row.SnapshotJson)
	if err != nil {
		return notification.UserNotification{}, err
	}
	return notification.UserNotification{
		ID:         row.UnID,
		EventType:  row.EventType,
		Title:      row.Title,
		Body:       row.Body,
		ActionPath: row.ActionPath,
		Snapshot:   snapshot,
		CreatedAt:  row.CreatedAt.Time,
		ReadAt:     timestamptzPtr(row.ReadAt),
	}, nil
}

func userNotificationFromMarkRow(row db.MarkUserNotificationReadRow) (notification.UserNotification, error) {
	snapshot, err := unmarshalNotificationSnapshot(row.SnapshotJson)
	if err != nil {
		return notification.UserNotification{}, err
	}
	return notification.UserNotification{
		ID:         row.UserNotificationsID,
		EventType:  row.EventType,
		Title:      row.Title,
		Body:       row.Body,
		ActionPath: row.ActionPath,
		Snapshot:   snapshot,
		CreatedAt:  row.CreatedAt.Time,
		ReadAt:     timestamptzPtr(row.ReadAt),
	}, nil
}

func unmarshalNotificationSnapshot(data []byte) (notification.NotificationSnapshot, error) {
	var snapshot notification.NotificationSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return notification.NotificationSnapshot{}, err
	}
	return snapshot, nil
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	out := value.Time
	return &out
}

func notificationUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(strings.TrimSpace(value)); err != nil || !id.Valid {
		return pgtype.UUID{}, notification.ErrValidation
	}
	return id, nil
}

func encodeNotificationCursor(createdAt time.Time, id string) string {
	payload := fmt.Sprintf("%s|%s", createdAt.UTC().Format(time.RFC3339Nano), id)
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeNotificationCursor(value string) (time.Time, string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, "", err
	}
	parts := strings.SplitN(string(decoded), "|", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return time.Time{}, "", notification.ErrValidation
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", err
	}
	return createdAt, strings.TrimSpace(parts[1]), nil
}
