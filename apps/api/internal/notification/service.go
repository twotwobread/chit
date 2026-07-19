package notification

import (
	"context"
	"strings"
)

const (
	defaultNotificationListLimit = 20
	maxNotificationListLimit     = 50
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) RegisterPushToken(ctx context.Context, userID string, input RegisterPushTokenInput) (PushToken, error) {
	if s == nil || s.repo == nil {
		return PushToken{}, ErrValidation
	}
	userID = strings.TrimSpace(userID)
	input = RegisterPushTokenInput{
		InstallationID: strings.TrimSpace(input.InstallationID),
		ExpoPushToken:  strings.TrimSpace(input.ExpoPushToken),
		Platform:       strings.TrimSpace(input.Platform),
	}
	if userID == "" || len(input.InstallationID) < 8 || len(input.InstallationID) > 120 || len(input.ExpoPushToken) < 20 || len(input.ExpoPushToken) > 255 || !validPushPlatform(input.Platform) {
		return PushToken{}, ErrValidation
	}
	return s.repo.RegisterPushToken(ctx, userID, input)
}

func (s *Service) RevokePushToken(ctx context.Context, userID string, installationID string) error {
	if s == nil || s.repo == nil {
		return ErrValidation
	}
	userID = strings.TrimSpace(userID)
	installationID = strings.TrimSpace(installationID)
	if userID == "" || len(installationID) < 8 || len(installationID) > 120 {
		return ErrValidation
	}
	return s.repo.RevokePushToken(ctx, userID, installationID)
}

func (s *Service) ListNotifications(ctx context.Context, userID string, input ListNotificationsInput) (ListNotificationsResult, error) {
	if s == nil || s.repo == nil {
		return ListNotificationsResult{}, ErrValidation
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return ListNotificationsResult{}, ErrValidation
	}
	if input.Limit == 0 {
		input.Limit = defaultNotificationListLimit
	}
	if input.Limit < 1 || input.Limit > maxNotificationListLimit {
		return ListNotificationsResult{}, ErrValidation
	}
	if input.Cursor != nil {
		trimmed := strings.TrimSpace(*input.Cursor)
		if trimmed == "" || len(trimmed) > 200 {
			return ListNotificationsResult{}, ErrValidation
		}
		input.Cursor = &trimmed
	}
	return s.repo.ListNotifications(ctx, userID, input)
}

func (s *Service) MarkNotificationRead(ctx context.Context, userID string, notificationID string) (UserNotification, error) {
	if s == nil || s.repo == nil {
		return UserNotification{}, ErrValidation
	}
	userID = strings.TrimSpace(userID)
	notificationID = strings.TrimSpace(notificationID)
	if userID == "" || notificationID == "" {
		return UserNotification{}, ErrValidation
	}
	return s.repo.MarkNotificationRead(ctx, userID, notificationID)
}

func validPushPlatform(value string) bool {
	return value == PushPlatformIOS || value == PushPlatformAndroid
}
