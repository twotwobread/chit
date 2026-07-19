package storage

import (
	"errors"
	"testing"

	"github.com/twotwobread/i-um/apps/api/internal/notification"
)

func TestNotificationUUIDRejectsInvalidInput(t *testing.T) {
	if _, err := notificationUUID("not-a-uuid"); !errors.Is(err, notification.ErrValidation) {
		t.Fatalf("expected validation error for invalid notification UUID, got %v", err)
	}
}
