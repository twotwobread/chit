package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/db"
)

const pgUniqueViolation = "23505"

func (s *Store) FindUserByIdentity(ctx context.Context, provider auth.Provider, providerSubject string) (auth.User, bool, error) {
	row, err := s.queries.FindIdentityByProviderSubject(ctx, db.FindIdentityByProviderSubjectParams{
		Provider:        string(provider),
		ProviderSubject: providerSubject,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, false, nil
	}
	if err != nil {
		return auth.User{}, false, err
	}
	return auth.User{
		ID:            row.UserID,
		DisplayName:   row.DisplayName,
		Email:         textPtr(row.Email),
		EmailVerified: row.EmailVerified,
		AvatarURL:     textPtr(row.AvatarUrl),
	}, true, nil
}

func (s *Store) FindUserByVerifiedEmail(ctx context.Context, emailNormalized string) (auth.User, bool, error) {
	row, err := s.queries.FindUserByVerifiedIdentityEmail(ctx, textValue(emailNormalized))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, false, nil
	}
	if err != nil {
		return auth.User{}, false, err
	}
	return auth.User{
		ID:            row.UID,
		DisplayName:   row.DisplayName,
		Email:         textPtr(row.Email),
		EmailVerified: row.EmailVerified,
		AvatarURL:     textPtr(row.AvatarUrl),
	}, true, nil
}

func (s *Store) CreateUserWithIdentity(ctx context.Context, user auth.User, identity auth.Identity) (auth.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return auth.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	created, err := qtx.CreateUser(ctx, db.CreateUserParams{
		DisplayName:     user.DisplayName,
		Email:           nullableText(user.Email),
		EmailNormalized: nullableNormalizedEmail(user.Email),
		EmailVerified:   user.EmailVerified,
		AvatarUrl:       nullableText(user.AvatarURL),
	})
	if err != nil {
		return auth.User{}, err
	}

	_, err = qtx.CreateIdentity(ctx, db.CreateIdentityParams{
		Column1:         mustUUID(created.ID),
		Provider:        string(identity.Provider),
		ProviderSubject: identity.ProviderSubject,
		Email:           nullableText(identity.Email),
		EmailNormalized: nullableNormalizedEmail(identity.Email),
		EmailVerified:   identity.EmailVerified,
		DisplayName:     nullableText(identity.DisplayName),
		AvatarUrl:       nullableText(identity.AvatarURL),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return auth.User{}, auth.ErrProviderAlreadyLinked
		}
		return auth.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return auth.User{}, err
	}
	return userFromCreateRow(created), nil
}

func (s *Store) CreateIdentity(ctx context.Context, userID string, identity auth.Identity) (auth.Identity, error) {
	row, err := s.queries.CreateIdentity(ctx, db.CreateIdentityParams{
		Column1:         mustUUID(userID),
		Provider:        string(identity.Provider),
		ProviderSubject: identity.ProviderSubject,
		Email:           nullableText(identity.Email),
		EmailNormalized: nullableNormalizedEmail(identity.Email),
		EmailVerified:   identity.EmailVerified,
		DisplayName:     nullableText(identity.DisplayName),
		AvatarUrl:       nullableText(identity.AvatarURL),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return auth.Identity{}, auth.ErrProviderAlreadyLinked
		}
		return auth.Identity{}, err
	}
	return auth.Identity{
		UserID:          row.UserID,
		Provider:        auth.Provider(row.Provider),
		ProviderSubject: row.ProviderSubject,
		Email:           textPtr(row.Email),
		EmailVerified:   row.EmailVerified,
		DisplayName:     textPtr(row.DisplayName),
		AvatarURL:       textPtr(row.AvatarUrl),
	}, nil
}

func (s *Store) CreateSession(ctx context.Context, userID string, refreshTokenHash string, refreshTokenExpiresAt time.Time, device auth.Device) (auth.Session, error) {
	row, err := s.queries.CreateSession(ctx, db.CreateSessionParams{
		Column1:               mustUUID(userID),
		RefreshTokenHash:      refreshTokenHash,
		RefreshTokenExpiresAt: timestamptzValue(refreshTokenExpiresAt),
		DeviceName:            nullableText(device.DeviceName),
		Platform:              nullableText(device.Platform),
		UserAgent:             nullableText(device.UserAgent),
	})
	if err != nil {
		return auth.Session{}, err
	}
	return sessionFromCreateRow(row), nil
}

func (s *Store) FindSessionByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (auth.Session, bool, error) {
	row, err := s.queries.FindSessionByRefreshTokenHash(ctx, refreshTokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.Session{}, false, nil
	}
	if err != nil {
		return auth.Session{}, false, err
	}
	return sessionFromFindRow(row), true, nil
}

func (s *Store) GetSession(ctx context.Context, sessionID string) (auth.Session, bool, error) {
	row, err := s.queries.GetSessionByID(ctx, mustUUID(sessionID))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.Session{}, false, nil
	}
	if err != nil {
		return auth.Session{}, false, err
	}
	return sessionFromGetRow(row), true, nil
}

func (s *Store) RotateSessionRefreshToken(ctx context.Context, sessionID string, refreshTokenHash string, refreshTokenExpiresAt time.Time) (auth.Session, error) {
	row, err := s.queries.RotateSessionRefreshToken(ctx, db.RotateSessionRefreshTokenParams{
		Column1:               mustUUID(sessionID),
		RefreshTokenHash:      refreshTokenHash,
		RefreshTokenExpiresAt: timestamptzValue(refreshTokenExpiresAt),
	})
	if err != nil {
		return auth.Session{}, err
	}
	return sessionFromRotateRow(row), nil
}

func (s *Store) RevokeSession(ctx context.Context, sessionID string) error {
	return s.queries.RevokeSession(ctx, mustUUID(sessionID))
}

func (s *Store) GetUser(ctx context.Context, userID string) (auth.User, bool, error) {
	row, err := s.queries.GetUserByID(ctx, mustUUID(userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, false, nil
	}
	if err != nil {
		return auth.User{}, false, err
	}
	return auth.User{
		ID:            row.ID,
		DisplayName:   row.DisplayName,
		Email:         textPtr(row.Email),
		EmailVerified: row.EmailVerified,
		AvatarURL:     textPtr(row.AvatarUrl),
	}, true, nil
}

func (s *Store) ListProviders(ctx context.Context, userID string) ([]auth.Provider, error) {
	rows, err := s.queries.ListProvidersByUserID(ctx, mustUUID(userID))
	if err != nil {
		return nil, err
	}
	providers := make([]auth.Provider, 0, len(rows))
	for _, provider := range rows {
		providers = append(providers, auth.Provider(provider))
	}
	return providers, nil
}

func userFromCreateRow(row db.CreateUserRow) auth.User {
	return auth.User{
		ID:            row.ID,
		DisplayName:   row.DisplayName,
		Email:         textPtr(row.Email),
		EmailVerified: row.EmailVerified,
		AvatarURL:     textPtr(row.AvatarUrl),
	}
}

func sessionFromCreateRow(row db.CreateSessionRow) auth.Session {
	return auth.Session{ID: row.ID, UserID: row.UserID, RefreshTokenHash: row.RefreshTokenHash, RefreshTokenExpiresAt: row.RefreshTokenExpiresAt.Time, RevokedAt: timePtr(row.RevokedAt)}
}

func sessionFromFindRow(row db.FindSessionByRefreshTokenHashRow) auth.Session {
	return auth.Session{ID: row.ID, UserID: row.UserID, RefreshTokenHash: row.RefreshTokenHash, RefreshTokenExpiresAt: row.RefreshTokenExpiresAt.Time, RevokedAt: timePtr(row.RevokedAt)}
}

func sessionFromGetRow(row db.GetSessionByIDRow) auth.Session {
	return auth.Session{ID: row.ID, UserID: row.UserID, RefreshTokenHash: row.RefreshTokenHash, RefreshTokenExpiresAt: row.RefreshTokenExpiresAt.Time, RevokedAt: timePtr(row.RevokedAt)}
}

func sessionFromRotateRow(row db.RotateSessionRefreshTokenRow) auth.Session {
	return auth.Session{ID: row.ID, UserID: row.UserID, RefreshTokenHash: row.RefreshTokenHash, RefreshTokenExpiresAt: row.RefreshTokenExpiresAt.Time, RevokedAt: timePtr(row.RevokedAt)}
}

func nullableText(value *string) pgtype.Text {
	if value == nil || *value == "" {
		return pgtype.Text{}
	}
	return textValue(*value)
}

func nullableNormalizedEmail(value *string) pgtype.Text {
	if value == nil || *value == "" {
		return pgtype.Text{}
	}
	return textValue(normalizeEmail(*value))
}

func textValue(value string) pgtype.Text {
	return pgtype.Text{String: value, Valid: true}
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	v := value.String
	return &v
}

func timestamptzValue(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time
	return &v
}

func mustUUID(value string) pgtype.UUID {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		panic(err)
	}
	return id
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
