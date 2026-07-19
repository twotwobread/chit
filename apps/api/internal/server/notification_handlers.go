package server

import (
	"errors"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/notification"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

func (s apiServer) RegisterPushToken(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.notifications == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "notifications are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.RegisterPushTokenJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.notifications.RegisterPushToken(r.Context(), authContext.UserID, notification.RegisterPushTokenInput{
		InstallationID: body.InstallationId,
		ExpoPushToken:  body.ExpoPushToken,
		Platform:       string(body.Platform),
	})
	if err != nil {
		writeNotificationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, pushTokenToOpenAPI(result))
}

func (s apiServer) RevokePushToken(w http.ResponseWriter, r *http.Request, installationId string) {
	if s.auth == nil || s.notifications == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "notifications are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.notifications.RevokePushToken(r.Context(), authContext.UserID, installationId); err != nil {
		writeNotificationError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) ListNotifications(w http.ResponseWriter, r *http.Request, params openapi.ListNotificationsParams) {
	if s.auth == nil || s.notifications == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "notifications are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	limit := 0
	if params.Limit != nil {
		limit = *params.Limit
	}
	result, err := s.notifications.ListNotifications(r.Context(), authContext.UserID, notification.ListNotificationsInput{Limit: limit, Cursor: params.Cursor})
	if err != nil {
		writeNotificationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, listNotificationsToOpenAPI(result))
}

func (s apiServer) MarkNotificationRead(w http.ResponseWriter, r *http.Request, notificationId openapi_types.UUID) {
	if s.auth == nil || s.notifications == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "notifications are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.notifications.MarkNotificationRead(r.Context(), authContext.UserID, notificationId.String())
	if err != nil {
		writeNotificationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.MarkNotificationReadResponse{Notification: userNotificationToOpenAPI(result)})
}

func writeNotificationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, notification.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid notification request", nil)
	case errors.Is(err, notification.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "notification not found", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func pushTokenToOpenAPI(token notification.PushToken) openapi.PushTokenResponse {
	return openapi.PushTokenResponse{
		InstallationId:   token.InstallationID,
		LastRegisteredAt: token.LastRegisteredAt,
		Platform:         openapi.PushPlatform(token.Platform),
		Status:           openapi.PushTokenStatus(token.Status),
	}
}

func listNotificationsToOpenAPI(result notification.ListNotificationsResult) openapi.ListNotificationsResponse {
	items := make([]openapi.UserNotificationListItem, 0, len(result.Notifications))
	for _, item := range result.Notifications {
		items = append(items, userNotificationToOpenAPI(item))
	}
	return openapi.ListNotificationsResponse{Notifications: items, NextCursor: result.NextCursor}
}

func userNotificationToOpenAPI(item notification.UserNotification) openapi.UserNotificationListItem {
	return openapi.UserNotificationListItem{
		ActionPath: item.ActionPath,
		Body:       item.Body,
		CreatedAt:  item.CreatedAt,
		EventType:  openapi.NotificationEventType(item.EventType),
		Id:         item.ID,
		ReadAt:     item.ReadAt,
		Snapshot: openapi.NotificationSnapshot{
			ActorDisplayName: item.Snapshot.ActorDisplayName,
			AmountMinor:      item.Snapshot.AmountMinor,
			Currency:         openapi.SupportedCurrency(item.Snapshot.Currency),
			ExpenseId:        item.Snapshot.ExpenseID,
			ExpenseTitle:     item.Snapshot.ExpenseTitle,
			TripId:           item.Snapshot.TripID,
		},
		Title: item.Title,
	}
}
