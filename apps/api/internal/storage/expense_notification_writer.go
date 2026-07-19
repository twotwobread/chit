package storage

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/notification"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

type expenseCreatedNotificationInput struct {
	TripID           string
	ExpenseID        string
	CreatorUserID    string
	ActorDisplayName string
	ExpenseTitle     string
	AmountMinor      int64
	Currency         string
	Payer            notification.ExpenseCreatedParticipant
	Splits           []notification.ExpenseCreatedParticipant
}

func createExpenseCreatedNotifications(ctx context.Context, tx pgx.Tx, qtx *db.Queries, input expenseCreatedNotificationInput) error {
	exists, err := notificationTablesExist(ctx, tx)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}

	plan, err := notification.BuildExpenseCreatedNotificationPlan(notification.ExpenseCreatedInput{
		TripID:           input.TripID,
		ExpenseID:        input.ExpenseID,
		CreatorUserID:    input.CreatorUserID,
		ActorDisplayName: input.ActorDisplayName,
		ExpenseTitle:     input.ExpenseTitle,
		AmountMinor:      input.AmountMinor,
		Currency:         input.Currency,
		Payer:            input.Payer,
		Splits:           input.Splits,
	})
	if err != nil {
		return err
	}
	snapshotJSON, err := json.Marshal(plan.Snapshot)
	if err != nil {
		return err
	}
	payloadJSON, err := json.Marshal(map[string]interface{}{
		"eventType":  plan.EventType,
		"actionPath": plan.ActionPath,
		"snapshot":   plan.Snapshot,
	})
	if err != nil {
		return err
	}
	eventRow, err := qtx.CreateNotificationEvent(ctx, db.CreateNotificationEventParams{
		EventType:      plan.EventType,
		TripID:         mustUUID(input.TripID),
		ActorUserID:    mustUUID(input.CreatorUserID),
		EntityType:     plan.EntityType,
		EntityID:       mustUUID(input.ExpenseID),
		IdempotencyKey: plan.IdempotencyKey,
		PayloadJson:    payloadJSON,
	})
	if err != nil {
		return err
	}

	pushUserIDs := make([]pgtype.UUID, 0, len(plan.Recipients))
	pushUserIDSet := make(map[string]bool)
	createdNotificationsByUser := make(map[string]string, len(plan.Recipients))
	for _, recipient := range plan.Recipients {
		row, err := qtx.CreateUserNotification(ctx, db.CreateUserNotificationParams{
			EventID:         mustUUID(eventRow.ID),
			UserID:          mustUUID(recipient.UserID),
			TripID:          mustUUID(input.TripID),
			RecipientReason: recipient.Reason,
			Title:           plan.Title,
			Body:            plan.Body,
			ActionPath:      plan.ActionPath,
			SnapshotJson:    snapshotJSON,
		})
		if err != nil {
			return err
		}
		createdNotificationsByUser[recipient.UserID] = row.ID
		if recipient.ShouldPush && !pushUserIDSet[recipient.UserID] {
			pushUserIDs = append(pushUserIDs, mustUUID(recipient.UserID))
			pushUserIDSet[recipient.UserID] = true
		}
	}
	if len(pushUserIDs) == 0 {
		return nil
	}
	tokenRows, err := qtx.ListActivePushTokensForUsers(ctx, pushUserIDs)
	if err != nil {
		return err
	}
	for _, tokenRow := range tokenRows {
		notificationID := createdNotificationsByUser[tokenRow.UserID]
		if notificationID == "" {
			continue
		}
		pushDataJSON, err := json.Marshal(map[string]interface{}{
			"eventType":      plan.EventType,
			"actionPath":     plan.ActionPath,
			"notificationId": notificationID,
			"snapshot":       plan.Snapshot,
		})
		if err != nil {
			return err
		}
		if _, err := qtx.CreateNotificationPushOutbox(ctx, db.CreateNotificationPushOutboxParams{
			NotificationID:        mustUUID(notificationID),
			PushTokenID:           mustUUID(tokenRow.ID),
			UserID:                mustUUID(tokenRow.UserID),
			ExpoPushTokenSnapshot: tokenRow.ExpoPushToken,
			Title:                 plan.Title,
			Body:                  plan.Body,
			DataJson:              pushDataJSON,
		}); err != nil {
			return err
		}
	}
	return nil
}

func notificationTablesExist(ctx context.Context, tx pgx.Tx) (bool, error) {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('public.notification_events') IS NOT NULL AND to_regclass('public.user_notifications') IS NOT NULL AND to_regclass('public.notification_push_outbox') IS NOT NULL`).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func notificationParticipantFromSplitParticipant(participant trip.ExpenseSplitParticipant) notification.ExpenseCreatedParticipant {
	return notification.ExpenseCreatedParticipant{
		ParticipantID: participant.ParticipantID,
		UserID:        participant.UserID,
		DisplayName:   participant.DisplayName,
	}
}

func notificationParticipantsFromSplitRecords(records []trip.CreateExpenseSplitRecord) []notification.ExpenseCreatedParticipant {
	participants := make([]notification.ExpenseCreatedParticipant, 0, len(records))
	for _, record := range records {
		participants = append(participants, notification.ExpenseCreatedParticipant{
			ParticipantID: record.ParticipantID,
			UserID:        record.UserID,
			DisplayName:   record.ParticipantDisplayName,
		})
	}
	return participants
}

func notificationParticipantsFromTripParticipants(participants []trip.ExpenseSplitParticipant) []notification.ExpenseCreatedParticipant {
	out := make([]notification.ExpenseCreatedParticipant, 0, len(participants))
	for _, participant := range participants {
		out = append(out, notificationParticipantFromSplitParticipant(participant))
	}
	return out
}

func notificationActorDisplayName(createdBy string, participants []notification.ExpenseCreatedParticipant) string {
	for _, participant := range participants {
		if participant.UserID == createdBy {
			return participant.DisplayName
		}
	}
	return ""
}
