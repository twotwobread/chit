package notification

import "testing"

func TestBuildExpenseCreatedNotificationPlanDedupeRecipientsAndExcludesCreatorPush(t *testing.T) {
	plan, err := BuildExpenseCreatedNotificationPlan(ExpenseCreatedInput{
		TripID:           "trip-1",
		ExpenseID:        "expense-1",
		CreatorUserID:    "user-creator",
		ActorDisplayName: " 민수 ",
		ExpenseTitle:     " 도톤보리 식사 ",
		AmountMinor:      18500,
		Currency:         "KRW",
		Payer: ExpenseCreatedParticipant{
			ParticipantID: "participant-payer",
			UserID:        "user-payer",
			DisplayName:   "지영",
		},
		Splits: []ExpenseCreatedParticipant{
			{ParticipantID: "participant-creator", UserID: "user-creator", DisplayName: "민수"},
			{ParticipantID: "participant-payer", UserID: "user-payer", DisplayName: "지영"},
			{ParticipantID: "participant-payer-duplicate", UserID: "user-payer", DisplayName: "지영"},
		},
	})
	if err != nil {
		t.Fatalf("BuildExpenseCreatedNotificationPlan returned error: %v", err)
	}

	if plan.EventType != EventTypeExpenseCreated {
		t.Fatalf("expected event type %q, got %q", EventTypeExpenseCreated, plan.EventType)
	}
	if plan.EntityType != EntityTypeExpense {
		t.Fatalf("expected entity type %q, got %q", EntityTypeExpense, plan.EntityType)
	}
	if plan.IdempotencyKey != "expense.created:expense-1" {
		t.Fatalf("unexpected idempotency key %q", plan.IdempotencyKey)
	}
	if plan.Title != "민수님이 지출을 등록했어요" {
		t.Fatalf("unexpected title %q", plan.Title)
	}
	if plan.Body != "도톤보리 식사 18,500원" {
		t.Fatalf("unexpected body %q", plan.Body)
	}
	if plan.ActionPath != "/trips/trip-1/settle?expenseId=expense-1" {
		t.Fatalf("unexpected action path %q", plan.ActionPath)
	}

	if len(plan.Recipients) != 2 {
		t.Fatalf("expected creator + payer recipients, got %#v", plan.Recipients)
	}
	creator := plan.Recipients[0]
	if creator.UserID != "user-creator" || creator.Reason != RecipientReasonCreator || creator.ShouldPush {
		t.Fatalf("expected creator in-app only recipient first, got %#v", creator)
	}
	payer := plan.Recipients[1]
	if payer.UserID != "user-payer" || payer.Reason != RecipientReasonPayerSplitParticipant || !payer.ShouldPush {
		t.Fatalf("expected payer+split push recipient, got %#v", payer)
	}
}

func TestBuildExpenseCreatedNotificationPlanUsesMinimalPrivacyCopy(t *testing.T) {
	plan, err := BuildExpenseCreatedNotificationPlan(ExpenseCreatedInput{
		TripID:           "trip-1",
		ExpenseID:        "expense-1",
		CreatorUserID:    "user-creator",
		ActorDisplayName: "",
		ExpenseTitle:     "",
		AmountMinor:      320000,
		Currency:         "JPY",
		Payer:            ExpenseCreatedParticipant{ParticipantID: "participant-payer", UserID: "user-payer"},
		Splits:           []ExpenseCreatedParticipant{{ParticipantID: "participant-split", UserID: "user-split"}},
	})
	if err != nil {
		t.Fatalf("BuildExpenseCreatedNotificationPlan returned error: %v", err)
	}

	if plan.Title != "여행자님이 지출을 등록했어요" {
		t.Fatalf("expected actor fallback title, got %q", plan.Title)
	}
	if plan.Body != "지출 320,000엔" {
		t.Fatalf("expected title fallback body, got %q", plan.Body)
	}
	if containsAny(plan.Title+" "+plan.Body, []string{"메모", "영수증", "OCR", "분담", "split"}) {
		t.Fatalf("notification copy should not include sensitive detail words: %q / %q", plan.Title, plan.Body)
	}
}

func containsAny(value string, needles []string) bool {
	for _, needle := range needles {
		for i := 0; i+len(needle) <= len(value); i++ {
			if value[i:i+len(needle)] == needle {
				return true
			}
		}
	}
	return false
}
