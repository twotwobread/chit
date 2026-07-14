package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // embed IANA timezone data for minimal Cloud Run runtimes

	"github.com/twotwobread/i-um/apps/api/internal/flight"
	"github.com/twotwobread/i-um/apps/api/internal/server"
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

	config := server.ConfigFromEnv()
	if bucket := os.Getenv("BOARDING_PASS_GCS_BUCKET"); bucket != "" {
		boardingPassStore, err := flight.NewGCSBoardingPassObjectStore(ctx, bucket, os.Getenv("BOARDING_PASS_GCS_SIGNING_ACCESS_ID"), os.Getenv("BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY"))
		if err != nil {
			return err
		}
		defer boardingPassStore.Close()
		config.BoardingPassObjectStore = boardingPassStore
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
