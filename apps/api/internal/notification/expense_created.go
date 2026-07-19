package notification

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	EventTypeExpenseCreated = "expense.created"
	EntityTypeExpense       = "expense"

	RecipientReasonCreator               = "creator"
	RecipientReasonPayer                 = "payer"
	RecipientReasonSplitParticipant      = "split_participant"
	RecipientReasonPayerSplitParticipant = "payer_split_participant"
)

type ExpenseCreatedParticipant struct {
	ParticipantID string
	UserID        string
	DisplayName   string
}

type ExpenseCreatedInput struct {
	TripID           string
	ExpenseID        string
	CreatorUserID    string
	ActorDisplayName string
	ExpenseTitle     string
	AmountMinor      int64
	Currency         string
	Payer            ExpenseCreatedParticipant
	Splits           []ExpenseCreatedParticipant
}

type ExpenseCreatedRecipient struct {
	UserID     string
	Reason     string
	ShouldPush bool
}

type NotificationSnapshot struct {
	TripID           string `json:"tripId"`
	ExpenseID        string `json:"expenseId"`
	ActorDisplayName string `json:"actorDisplayName"`
	ExpenseTitle     string `json:"expenseTitle"`
	AmountMinor      int64  `json:"amountMinor"`
	Currency         string `json:"currency"`
}

type ExpenseCreatedNotificationPlan struct {
	EventType      string
	EntityType     string
	IdempotencyKey string
	Title          string
	Body           string
	ActionPath     string
	Snapshot       NotificationSnapshot
	Recipients     []ExpenseCreatedRecipient
}

type recipientAccumulator struct {
	isPayer bool
	isSplit bool
}

func BuildExpenseCreatedNotificationPlan(input ExpenseCreatedInput) (ExpenseCreatedNotificationPlan, error) {
	creatorUserID := strings.TrimSpace(input.CreatorUserID)
	recipientOrder := make([]string, 0, 1+len(input.Splits))
	recipientsByUser := make(map[string]*recipientAccumulator)
	ensureRecipient := func(userID string) *recipientAccumulator {
		userID = strings.TrimSpace(userID)
		if userID == "" {
			return nil
		}
		if _, ok := recipientsByUser[userID]; !ok {
			recipientsByUser[userID] = &recipientAccumulator{}
			recipientOrder = append(recipientOrder, userID)
		}
		return recipientsByUser[userID]
	}

	if creator := ensureRecipient(creatorUserID); creator != nil {
		_ = creator
	}
	if payer := ensureRecipient(input.Payer.UserID); payer != nil {
		payer.isPayer = true
	}
	for _, split := range input.Splits {
		if recipient := ensureRecipient(split.UserID); recipient != nil {
			recipient.isSplit = true
		}
	}

	recipients := make([]ExpenseCreatedRecipient, 0, len(recipientOrder))
	for _, userID := range recipientOrder {
		accumulator := recipientsByUser[userID]
		reason := recipientReason(accumulator.isPayer, accumulator.isSplit)
		if userID == creatorUserID {
			reason = RecipientReasonCreator
		}
		recipients = append(recipients, ExpenseCreatedRecipient{
			UserID:     userID,
			Reason:     reason,
			ShouldPush: userID != creatorUserID,
		})
	}

	actorDisplayName := normalizeDisplayText(input.ActorDisplayName, "여행자")
	expenseTitle := normalizeDisplayText(input.ExpenseTitle, "지출")
	currency := strings.TrimSpace(input.Currency)
	amountLabel := FormatMoney(input.AmountMinor, currency)

	tripID := strings.TrimSpace(input.TripID)
	expenseID := strings.TrimSpace(input.ExpenseID)
	return ExpenseCreatedNotificationPlan{
		EventType:      EventTypeExpenseCreated,
		EntityType:     EntityTypeExpense,
		IdempotencyKey: fmt.Sprintf("%s:%s", EventTypeExpenseCreated, expenseID),
		Title:          fmt.Sprintf("%s님이 지출을 등록했어요", actorDisplayName),
		Body:           fmt.Sprintf("%s %s", expenseTitle, amountLabel),
		ActionPath:     fmt.Sprintf("/trips/%s/settle?expenseId=%s", tripID, expenseID),
		Snapshot: NotificationSnapshot{
			TripID:           tripID,
			ExpenseID:        expenseID,
			ActorDisplayName: actorDisplayName,
			ExpenseTitle:     expenseTitle,
			AmountMinor:      input.AmountMinor,
			Currency:         currency,
		},
		Recipients: recipients,
	}, nil
}

func recipientReason(isPayer bool, isSplit bool) string {
	if isPayer && isSplit {
		return RecipientReasonPayerSplitParticipant
	}
	if isPayer {
		return RecipientReasonPayer
	}
	return RecipientReasonSplitParticipant
}

func normalizeDisplayText(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func FormatMoney(amountMinor int64, currency string) string {
	switch strings.TrimSpace(currency) {
	case "KRW":
		return fmt.Sprintf("%s원", formatIntegerWithCommas(amountMinor))
	case "JPY":
		return fmt.Sprintf("%s엔", formatIntegerWithCommas(amountMinor))
	case "USD":
		return formatDecimalMoney("$", amountMinor)
	case "EUR":
		return formatDecimalMoney("€", amountMinor)
	default:
		return fmt.Sprintf("%s %s", formatIntegerWithCommas(amountMinor), strings.TrimSpace(currency))
	}
}

func formatDecimalMoney(prefix string, amountMinor int64) string {
	whole := amountMinor / 100
	fraction := amountMinor % 100
	if fraction < 0 {
		fraction = -fraction
	}
	return fmt.Sprintf("%s%s.%02d", prefix, formatIntegerWithCommas(whole), fraction)
}

func formatIntegerWithCommas(value int64) string {
	negative := value < 0
	if negative {
		value = -value
	}
	digits := strconv.FormatInt(value, 10)
	var builder strings.Builder
	if negative {
		builder.WriteByte('-')
	}
	for index, char := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 {
			builder.WriteByte(',')
		}
		builder.WriteRune(char)
	}
	return builder.String()
}
