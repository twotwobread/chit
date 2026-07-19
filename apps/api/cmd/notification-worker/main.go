package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/notification"
	"github.com/twotwobread/i-um/apps/api/internal/storage"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := storage.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer store.Close()

	provider := notification.NewExpoPushProvider(notification.ExpoProviderConfig{
		Endpoint:    os.Getenv("EXPO_PUSH_ENDPOINT"),
		AccessToken: os.Getenv("EXPO_PUSH_ACCESS_TOKEN"),
	})
	worker := notification.NewWorker(store, provider, notification.WorkerConfig{
		BatchSize:           intFromEnv("NOTIFICATION_WORKER_BATCH_SIZE", 50),
		MaxAttempts:         intFromEnv("NOTIFICATION_WORKER_MAX_ATTEMPTS", 8),
		StaleRunningTimeout: durationFromEnvMinutes("NOTIFICATION_WORKER_STALE_RUNNING_MINUTES", 10),
	})

	maxBatches := intFromEnv("NOTIFICATION_WORKER_MAX_BATCHES", 20)
	for batch := 0; batch < maxBatches; batch++ {
		result, err := worker.RunOnce(ctx)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) {
				return ctx.Err()
			}
			return err
		}
		if result.Processed == 0 {
			log.Printf("notification worker drained outbox after %d batch(es)", batch+1)
			return nil
		}
		log.Printf("notification worker processed %d push outbox row(s)", result.Processed)
	}
	log.Printf("notification worker reached max batches %d", maxBatches)
	return nil
}

func intFromEnv(name string, fallback int) int {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func durationFromEnvMinutes(name string, fallbackMinutes int) time.Duration {
	return time.Duration(intFromEnv(name, fallbackMinutes)) * time.Minute
}
