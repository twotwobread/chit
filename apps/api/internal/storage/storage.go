package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/twotwobread/i-um/apps/api/internal/db"
)

const (
	readinessTimeout = 5 * time.Second
	maxOpenConns     = int32(4)
)

type Store struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	config.MaxConns = maxOpenConns

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	return &Store{
		pool:    pool,
		queries: db.New(pool),
	}, nil
}

func (s *Store) Close() {
	if s != nil && s.pool != nil {
		s.pool.Close()
	}
}

func (s *Store) CheckReady(ctx context.Context) (string, error) {
	if s == nil || s.pool == nil || s.queries == nil {
		return "", errors.New("database is not configured")
	}

	checkCtx, cancel := context.WithTimeout(ctx, readinessTimeout)
	defer cancel()

	if err := s.pool.Ping(checkCtx); err != nil {
		return "", err
	}

	schema, err := s.queries.GetAppMetadataValue(checkCtx, "schema")
	if err != nil {
		return "", err
	}
	if schema != "initialized" {
		return "", fmt.Errorf("unexpected schema metadata %q", schema)
	}

	return schema, nil
}
