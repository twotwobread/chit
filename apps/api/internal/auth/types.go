package auth

import (
	"context"
	"errors"
	"time"
)

type Provider string

const (
	ProviderApple Provider = "apple"
	ProviderKakao Provider = "kakao"
)

var (
	ErrValidation            = errors.New("validation error")
	ErrInvalidProviderToken  = errors.New("invalid provider token")
	ErrAccountLinkRequired   = errors.New("account link required")
	ErrProviderAlreadyLinked = errors.New("provider already linked")
	ErrInvalidRefreshToken   = errors.New("invalid refresh token")
	ErrUnauthorized          = errors.New("unauthorized")
)

type User struct {
	ID            string
	DisplayName   string
	Email         *string
	EmailVerified bool
	AvatarURL     *string
}

type Identity struct {
	UserID          string
	Provider        Provider
	ProviderSubject string
	Email           *string
	EmailVerified   bool
	DisplayName     *string
	AvatarURL       *string
}

type ProviderProfile struct {
	Provider        Provider
	ProviderSubject string
	Email           *string
	EmailVerified   bool
	DisplayName     *string
	AvatarURL       *string
}

type Credential struct {
	IdentityToken     *string
	AuthorizationCode *string
	Nonce             *string
	AccessToken       *string
	DevSubject        *string
	Email             *string
	EmailVerified     *bool
	DisplayName       *string
	AvatarURL         *string
}

type Device struct {
	DeviceName *string
	Platform   *string
	UserAgent  *string
}

type Session struct {
	ID                    string
	UserID                string
	RefreshTokenHash      string
	RefreshTokenExpiresAt time.Time
	RevokedAt             *time.Time
}

type TokenPair struct {
	AccessToken           string
	AccessTokenExpiresAt  time.Time
	RefreshToken          string
	RefreshTokenExpiresAt time.Time
}

type AuthContext struct {
	UserID    string
	SessionID string
}

type Repository interface {
	FindUserByIdentity(ctx context.Context, provider Provider, providerSubject string) (User, bool, error)
	FindUserByVerifiedEmail(ctx context.Context, emailNormalized string) (User, bool, error)
	CreateUserWithIdentity(ctx context.Context, user User, identity Identity) (User, error)
	CreateIdentity(ctx context.Context, userID string, identity Identity) (Identity, error)
	CreateSession(ctx context.Context, userID string, refreshTokenHash string, refreshTokenExpiresAt time.Time, device Device) (Session, error)
	FindSessionByRefreshTokenHash(ctx context.Context, refreshTokenHash string) (Session, bool, error)
	GetSession(ctx context.Context, sessionID string) (Session, bool, error)
	RotateSessionRefreshToken(ctx context.Context, sessionID string, refreshTokenHash string, refreshTokenExpiresAt time.Time) (Session, error)
	RevokeSession(ctx context.Context, sessionID string) error
	UpdateUserDisplayName(ctx context.Context, userID string, displayName string) (User, bool, error)
	GetUser(ctx context.Context, userID string) (User, bool, error)
	ListProviders(ctx context.Context, userID string) ([]Provider, error)
	DeleteAccount(ctx context.Context, userID string, now time.Time) error
}

type ProviderVerifier interface {
	Verify(ctx context.Context, provider Provider, credential Credential) (ProviderProfile, error)
}
