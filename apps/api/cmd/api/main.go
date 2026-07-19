package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata" // embed IANA timezone data for minimal Cloud Run runtimes

	"github.com/twotwobread/i-um/apps/api/internal/flight"
	"github.com/twotwobread/i-um/apps/api/internal/objectstorage"
	"github.com/twotwobread/i-um/apps/api/internal/server"
	"github.com/twotwobread/i-um/apps/api/internal/storage"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

type objectStorageEnvConfig struct {
	Provider       string
	Bucket         string
	Endpoint       string
	PublicEndpoint string
	AccessKey      string
	SecretKey      string
	Region         string
	ForcePathStyle bool
}

type gcsObjectStoreEnvConfig struct {
	Bucket            string
	SigningAccessID   string
	SigningPrivateKey string
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func objectStorageConfigFromEnv() objectStorageEnvConfig {
	return objectStorageEnvConfig{
		Provider:       strings.ToLower(firstNonEmpty(os.Getenv("OBJECT_STORAGE_PROVIDER"))),
		Bucket:         firstNonEmpty(os.Getenv("OBJECT_STORAGE_BUCKET"), os.Getenv("GCS_BUCKET")),
		Endpoint:       firstNonEmpty(os.Getenv("OBJECT_STORAGE_ENDPOINT")),
		PublicEndpoint: firstNonEmpty(os.Getenv("OBJECT_STORAGE_PUBLIC_ENDPOINT")),
		AccessKey:      firstNonEmpty(os.Getenv("OBJECT_STORAGE_ACCESS_KEY")),
		SecretKey:      firstNonEmpty(os.Getenv("OBJECT_STORAGE_SECRET_KEY")),
		Region:         firstNonEmpty(os.Getenv("OBJECT_STORAGE_REGION")),
		ForcePathStyle: objectStorageBoolFromEnv("OBJECT_STORAGE_FORCE_PATH_STYLE", true),
	}
}

func objectStorageBoolFromEnv(name string, defaultValue bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(name)))
	if value == "" {
		return defaultValue
	}
	switch value {
	case "1", "true", "t", "yes", "y", "on":
		return true
	case "0", "false", "f", "no", "n", "off":
		return false
	default:
		return defaultValue
	}
}

func objectStorageProvider(config objectStorageEnvConfig) string {
	provider := strings.ToLower(strings.TrimSpace(config.Provider))
	if provider != "" {
		return provider
	}
	if config.Endpoint != "" || config.AccessKey != "" || config.SecretKey != "" {
		return "minio"
	}
	if config.Bucket != "" {
		return "gcs"
	}
	return ""
}

func boardingPassGCSConfigFromEnv() gcsObjectStoreEnvConfig {
	return gcsObjectStoreEnvConfig{
		Bucket:            firstNonEmpty(os.Getenv("BOARDING_PASS_GCS_BUCKET"), os.Getenv("OBJECT_STORAGE_BUCKET"), os.Getenv("GCS_BUCKET")),
		SigningAccessID:   firstNonEmpty(os.Getenv("BOARDING_PASS_GCS_SIGNING_ACCESS_ID"), os.Getenv("GCS_SIGNING_ACCESS_ID")),
		SigningPrivateKey: firstNonEmpty(os.Getenv("BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY"), os.Getenv("GCS_SIGNING_PRIVATE_KEY")),
	}
}

func expenseReceiptGCSConfigFromEnv() gcsObjectStoreEnvConfig {
	return gcsObjectStoreEnvConfig{
		Bucket:            firstNonEmpty(os.Getenv("EXPENSE_RECEIPT_GCS_BUCKET"), os.Getenv("OBJECT_STORAGE_BUCKET"), os.Getenv("GCS_BUCKET")),
		SigningAccessID:   firstNonEmpty(os.Getenv("EXPENSE_RECEIPT_GCS_SIGNING_ACCESS_ID"), os.Getenv("GCS_SIGNING_ACCESS_ID")),
		SigningPrivateKey: firstNonEmpty(os.Getenv("EXPENSE_RECEIPT_GCS_SIGNING_PRIVATE_KEY"), os.Getenv("GCS_SIGNING_PRIVATE_KEY")),
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

	config := server.ConfigFromEnv()
	objectStorage := objectStorageConfigFromEnv()
	switch provider := objectStorageProvider(objectStorage); provider {
	case "", "gcs":
		boardingPassGCS := boardingPassGCSConfigFromEnv()
		if boardingPassGCS.Bucket != "" {
			boardingPassStore, err := flight.NewGCSBoardingPassObjectStore(ctx, boardingPassGCS.Bucket, boardingPassGCS.SigningAccessID, boardingPassGCS.SigningPrivateKey)
			if err != nil {
				return err
			}
			defer boardingPassStore.Close()
			config.BoardingPassObjectStore = boardingPassStore
		}
		expenseReceiptGCS := expenseReceiptGCSConfigFromEnv()
		if expenseReceiptGCS.Bucket != "" {
			receiptStore, err := trip.NewGCSExpenseReceiptObjectStore(ctx, expenseReceiptGCS.Bucket, expenseReceiptGCS.SigningAccessID, expenseReceiptGCS.SigningPrivateKey)
			if err != nil {
				return err
			}
			defer receiptStore.Close()
			config.ExpenseReceiptObjectStore = receiptStore
		}
	case "minio", "s3":
		sharedStore, err := objectstorage.NewS3Store(ctx, objectstorage.S3Config{
			Bucket:         objectStorage.Bucket,
			Endpoint:       objectStorage.Endpoint,
			PublicEndpoint: objectStorage.PublicEndpoint,
			AccessKey:      objectStorage.AccessKey,
			SecretKey:      objectStorage.SecretKey,
			Region:         objectStorage.Region,
			ForcePathStyle: objectStorage.ForcePathStyle,
		})
		if err != nil {
			return err
		}
		defer sharedStore.Close()
		config.BoardingPassObjectStore = flight.NewObjectStorageBoardingPassObjectStore(sharedStore)
		config.ExpenseReceiptObjectStore = trip.NewObjectStorageExpenseReceiptObjectStore(sharedStore)
	default:
		return fmt.Errorf("unsupported OBJECT_STORAGE_PROVIDER %q", provider)
	}

	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	httpServer := &http.Server{
		Addr:    addr,
		Handler: server.NewRouterWithConfig(store, config),
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("i-um API listening on %s", addr)
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	}
}
