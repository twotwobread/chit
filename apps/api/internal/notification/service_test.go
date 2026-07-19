package notification

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeRepository struct {
	registeredInput RegisterPushTokenInput
	registeredUser  string
	pushToken       PushToken
	listResult      ListNotificationsResult
	markResult      UserNotification
}

func (f *fakeRepository) RegisterPushToken(_ context.Context, userID string, input RegisterPushTokenInput) (PushToken, error) {
	f.registeredUser = userID
	f.registeredInput = input
	if f.pushToken.InstallationID == "" {
		return PushToken{InstallationID: input.InstallationID, Platform: input.Platform, Status: PushTokenStatusActive, LastRegisteredAt: time.Unix(10, 0).UTC()}, nil
	}
	return f.pushToken, nil
}

func (f *fakeRepository) RevokePushToken(context.Context, string, string) error { return nil }
func (f *fakeRepository) ListNotifications(context.Context, string, ListNotificationsInput) (ListNotificationsResult, error) {
	return f.listResult, nil
}
func (f *fakeRepository) MarkNotificationRead(context.Context, string, string) (UserNotification, error) {
	if f.markResult.ID == "" {
		return UserNotification{}, ErrNotFound
	}
	return f.markResult, nil
}

func TestServiceRegisterPushTokenValidatesAndTrimsInput(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo)

	result, err := service.RegisterPushToken(context.Background(), " user-1 ", RegisterPushTokenInput{
		InstallationID: " installation-123 ",
		ExpoPushToken:  " ExpoPushToken[xxxxxxxxxxxxxxxxxxxx] ",
		Platform:       " ios ",
	})
	if err != nil {
		t.Fatalf("RegisterPushToken returned error: %v", err)
	}
	if repo.registeredUser != "user-1" {
		t.Fatalf("expected trimmed user id, got %q", repo.registeredUser)
	}
	if repo.registeredInput.InstallationID != "installation-123" || repo.registeredInput.ExpoPushToken != "ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]" || repo.registeredInput.Platform != PushPlatformIOS {
		t.Fatalf("expected normalized input, got %#v", repo.registeredInput)
	}
	if result.Status != PushTokenStatusActive || result.InstallationID != "installation-123" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestServiceRegisterPushTokenRejectsInvalidInput(t *testing.T) {
	service := NewService(&fakeRepository{})

	cases := []RegisterPushTokenInput{
		{InstallationID: "short", ExpoPushToken: "ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]", Platform: PushPlatformIOS},
		{InstallationID: "installation-123", ExpoPushToken: "short", Platform: PushPlatformIOS},
		{InstallationID: "installation-123", ExpoPushToken: "ExpoPushToken[xxxxxxxxxxxxxxxxxxxx]", Platform: "web"},
	}
	for _, input := range cases {
		_, err := service.RegisterPushToken(context.Background(), "user-1", input)
		if !errors.Is(err, ErrValidation) {
			t.Fatalf("expected ErrValidation for %#v, got %v", input, err)
		}
	}
}

func TestServiceListNotificationsDefaultsLimit(t *testing.T) {
	repo := &fakeRepository{listResult: ListNotificationsResult{Notifications: []UserNotification{{ID: "notification-1"}}}}
	service := NewService(repo)

	result, err := service.ListNotifications(context.Background(), "user-1", ListNotificationsInput{})
	if err != nil {
		t.Fatalf("ListNotifications returned error: %v", err)
	}
	if len(result.Notifications) != 1 || result.Notifications[0].ID != "notification-1" {
		t.Fatalf("unexpected notifications: %#v", result.Notifications)
	}
}
