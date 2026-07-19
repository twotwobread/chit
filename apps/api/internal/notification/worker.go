package notification

import (
	"context"
	"time"
)

type PushOutboxMessage struct {
	ID            string
	PushTokenID   string
	ExpoPushToken string
	Title         string
	Body          string
	DataJSON      []byte
	Attempts      int
}

type PushSendResult struct {
	ProviderMessageID string
	InvalidToken      bool
	ErrorMessage      string
}

type PushProvider interface {
	Send(ctx context.Context, message PushOutboxMessage) (PushSendResult, error)
}

type PushOutboxRepository interface {
	RecoverStalePushOutbox(ctx context.Context, staleBefore time.Time) error
	ClaimPushOutbox(ctx context.Context, limit int) ([]PushOutboxMessage, error)
	MarkPushOutboxSucceeded(ctx context.Context, outboxID string, providerMessageID *string) error
	MarkPushOutboxFailed(ctx context.Context, outboxID string, lastError string) error
	MarkPushOutboxDead(ctx context.Context, outboxID string, lastError string) error
	MarkPushOutboxSkipped(ctx context.Context, outboxID string, lastError string) error
	MarkPushTokenInvalid(ctx context.Context, pushTokenID string) error
}

type WorkerConfig struct {
	BatchSize           int
	MaxAttempts         int
	StaleRunningTimeout time.Duration
}

type WorkerRunResult struct {
	Processed int
}

type Worker struct {
	repo     PushOutboxRepository
	provider PushProvider
	config   WorkerConfig
	now      func() time.Time
}

func NewWorker(repo PushOutboxRepository, provider PushProvider, config WorkerConfig) *Worker {
	if config.BatchSize <= 0 {
		config.BatchSize = 10
	}
	if config.MaxAttempts <= 0 {
		config.MaxAttempts = 8
	}
	if config.StaleRunningTimeout <= 0 {
		config.StaleRunningTimeout = 10 * time.Minute
	}
	return &Worker{repo: repo, provider: provider, config: config, now: time.Now}
}

func (w *Worker) RunOnce(ctx context.Context) (WorkerRunResult, error) {
	if err := w.repo.RecoverStalePushOutbox(ctx, w.now().Add(-w.config.StaleRunningTimeout)); err != nil {
		return WorkerRunResult{}, err
	}
	messages, err := w.repo.ClaimPushOutbox(ctx, w.config.BatchSize)
	if err != nil {
		return WorkerRunResult{}, err
	}
	result := WorkerRunResult{}
	for _, message := range messages {
		if err := w.processMessage(ctx, message); err != nil {
			return result, err
		}
		result.Processed++
	}
	return result, nil
}

func (w *Worker) processMessage(ctx context.Context, message PushOutboxMessage) error {
	result, err := w.provider.Send(ctx, message)
	if result.InvalidToken {
		if message.PushTokenID != "" {
			if markErr := w.repo.MarkPushTokenInvalid(ctx, message.PushTokenID); markErr != nil {
				return markErr
			}
		}
		lastError := result.ErrorMessage
		if lastError == "" {
			lastError = "invalid push token"
		}
		return w.repo.MarkPushOutboxSkipped(ctx, message.ID, lastError)
	}
	if err != nil {
		lastError := err.Error()
		if message.Attempts >= w.config.MaxAttempts {
			return w.repo.MarkPushOutboxDead(ctx, message.ID, lastError)
		}
		return w.repo.MarkPushOutboxFailed(ctx, message.ID, lastError)
	}
	providerMessageID := result.ProviderMessageID
	var providerMessageIDPtr *string
	if providerMessageID != "" {
		providerMessageIDPtr = &providerMessageID
	}
	return w.repo.MarkPushOutboxSucceeded(ctx, message.ID, providerMessageIDPtr)
}
