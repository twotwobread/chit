package notification

import (
	"context"
	"errors"
	"time"
)

const (
	PushPlatformIOS     = "ios"
	PushPlatformAndroid = "android"

	PushTokenStatusActive  = "active"
	PushTokenStatusRevoked = "revoked"
	PushTokenStatusInvalid = "invalid"
)

var (
	ErrValidation = errors.New("validation error")
	ErrNotFound   = errors.New("not found")
)

type RegisterPushTokenInput struct {
	InstallationID string
	ExpoPushToken  string
	Platform       string
}

type PushToken struct {
	InstallationID   string
	Platform         string
	Status           string
	LastRegisteredAt time.Time
}

type ListNotificationsInput struct {
	Limit  int
	Cursor *string
}

type ListNotificationsResult struct {
	Notifications []UserNotification
	NextCursor    *string
}

type UserNotification struct {
	ID         string
	EventType  string
	Title      string
	Body       string
	ActionPath string
	Snapshot   NotificationSnapshot
	CreatedAt  time.Time
	ReadAt     *time.Time
}

type Repository interface {
	RegisterPushToken(ctx context.Context, userID string, input RegisterPushTokenInput) (PushToken, error)
	RevokePushToken(ctx context.Context, userID string, installationID string) error
	ListNotifications(ctx context.Context, userID string, input ListNotificationsInput) (ListNotificationsResult, error)
	MarkNotificationRead(ctx context.Context, userID string, notificationID string) (UserNotification, error)
}
