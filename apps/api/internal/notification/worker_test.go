package notification

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeOutboxRepository struct {
	claimed          []PushOutboxMessage
	succeeded        []string
	failed           []string
	dead             []string
	skipped          []string
	invalidatedToken []string
	recoveredBefore  time.Time
}

func (f *fakeOutboxRepository) RecoverStalePushOutbox(_ context.Context, staleBefore time.Time) error {
	f.recoveredBefore = staleBefore
	return nil
}

func (f *fakeOutboxRepository) ClaimPushOutbox(context.Context, int) ([]PushOutboxMessage, error) {
	claimed := f.claimed
	f.claimed = nil
	return claimed, nil
}

func (f *fakeOutboxRepository) MarkPushOutboxSucceeded(_ context.Context, outboxID string, providerMessageID *string) error {
	f.succeeded = append(f.succeeded, outboxID)
	return nil
}

func (f *fakeOutboxRepository) MarkPushOutboxFailed(_ context.Context, outboxID string, lastError string) error {
	f.failed = append(f.failed, outboxID+":"+lastError)
	return nil
}

func (f *fakeOutboxRepository) MarkPushOutboxDead(_ context.Context, outboxID string, lastError string) error {
	f.dead = append(f.dead, outboxID+":"+lastError)
	return nil
}

func (f *fakeOutboxRepository) MarkPushOutboxSkipped(_ context.Context, outboxID string, lastError string) error {
	f.skipped = append(f.skipped, outboxID+":"+lastError)
	return nil
}

func (f *fakeOutboxRepository) MarkPushTokenInvalid(_ context.Context, pushTokenID string) error {
	f.invalidatedToken = append(f.invalidatedToken, pushTokenID)
	return nil
}

type fakePushProvider struct {
	result PushSendResult
	err    error
	sent   []PushOutboxMessage
}

func (f *fakePushProvider) Send(_ context.Context, message PushOutboxMessage) (PushSendResult, error) {
	f.sent = append(f.sent, message)
	return f.result, f.err
}

func TestWorkerRunOnceMarksSucceededRows(t *testing.T) {
	repo := &fakeOutboxRepository{claimed: []PushOutboxMessage{{ID: "outbox-1", PushTokenID: "token-1", ExpoPushToken: "ExpoPushToken[one]", Title: "title", Body: "body", Attempts: 1}}}
	provider := &fakePushProvider{result: PushSendResult{ProviderMessageID: "expo-ticket-1"}}
	worker := NewWorker(repo, provider, WorkerConfig{BatchSize: 10, MaxAttempts: 8, StaleRunningTimeout: time.Minute})

	result, err := worker.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce returned error: %v", err)
	}
	if result.Processed != 1 || len(provider.sent) != 1 || provider.sent[0].ID != "outbox-1" {
		t.Fatalf("expected one sent message, result=%#v sent=%#v", result, provider.sent)
	}
	if len(repo.succeeded) != 1 || repo.succeeded[0] != "outbox-1" {
		t.Fatalf("expected succeeded mark, got %#v", repo.succeeded)
	}
}

func TestWorkerRunOnceRetriesThenDeadLettersRetryableErrors(t *testing.T) {
	retryRepo := &fakeOutboxRepository{claimed: []PushOutboxMessage{{ID: "outbox-retry", PushTokenID: "token-1", Attempts: 2}}}
	retryWorker := NewWorker(retryRepo, &fakePushProvider{err: errors.New("provider unavailable")}, WorkerConfig{BatchSize: 10, MaxAttempts: 3, StaleRunningTimeout: time.Minute})
	if _, err := retryWorker.RunOnce(context.Background()); err != nil {
		t.Fatalf("retry RunOnce returned error: %v", err)
	}
	if len(retryRepo.failed) != 1 || retryRepo.failed[0] != "outbox-retry:provider unavailable" {
		t.Fatalf("expected retry failure mark, got %#v", retryRepo.failed)
	}

	deadRepo := &fakeOutboxRepository{claimed: []PushOutboxMessage{{ID: "outbox-dead", PushTokenID: "token-1", Attempts: 3}}}
	deadWorker := NewWorker(deadRepo, &fakePushProvider{err: errors.New("provider unavailable")}, WorkerConfig{BatchSize: 10, MaxAttempts: 3, StaleRunningTimeout: time.Minute})
	if _, err := deadWorker.RunOnce(context.Background()); err != nil {
		t.Fatalf("dead RunOnce returned error: %v", err)
	}
	if len(deadRepo.dead) != 1 || deadRepo.dead[0] != "outbox-dead:provider unavailable" {
		t.Fatalf("expected dead mark, got %#v", deadRepo.dead)
	}
}

func TestWorkerRunOnceInvalidatesPermanentTokenFailures(t *testing.T) {
	repo := &fakeOutboxRepository{claimed: []PushOutboxMessage{{ID: "outbox-1", PushTokenID: "token-1", Attempts: 1}}}
	provider := &fakePushProvider{result: PushSendResult{InvalidToken: true, ErrorMessage: "DeviceNotRegistered"}}
	worker := NewWorker(repo, provider, WorkerConfig{BatchSize: 10, MaxAttempts: 8, StaleRunningTimeout: time.Minute})

	if _, err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce returned error: %v", err)
	}
	if len(repo.invalidatedToken) != 1 || repo.invalidatedToken[0] != "token-1" {
		t.Fatalf("expected token invalidation, got %#v", repo.invalidatedToken)
	}
	if len(repo.skipped) != 1 || repo.skipped[0] != "outbox-1:DeviceNotRegistered" {
		t.Fatalf("expected skipped outbox, got %#v", repo.skipped)
	}
}
