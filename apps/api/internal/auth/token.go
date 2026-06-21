package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAccessTokenTTL  = 15 * time.Minute
	defaultRefreshTokenTTL = 30 * 24 * time.Hour
)

type TokenManager struct {
	secret          []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
	now             func() time.Time
}

type AccessClaims struct {
	Subject   string `json:"sub"`
	SessionID string `json:"sid"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func NewTokenManager(secret string) *TokenManager {
	if secret == "" {
		secret = "dev-secret-change-me"
	}
	return &TokenManager{
		secret:          []byte(secret),
		accessTokenTTL:  defaultAccessTokenTTL,
		refreshTokenTTL: defaultRefreshTokenTTL,
		now:             time.Now,
	}
}

func (m *TokenManager) IssueAccessToken(userID string, sessionID string) (string, time.Time, error) {
	now := m.now().UTC()
	expiresAt := now.Add(m.accessTokenTTL)
	claims := AccessClaims{
		Subject:   userID,
		SessionID: sessionID,
		IssuedAt:  now.Unix(),
		ExpiresAt: expiresAt.Unix(),
	}

	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", time.Time{}, err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", time.Time{}, err
	}

	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)
	encodedClaims := base64.RawURLEncoding.EncodeToString(claimsJSON)
	unsigned := encodedHeader + "." + encodedClaims
	sig := m.sign(unsigned)

	return unsigned + "." + sig, expiresAt, nil
}

func (m *TokenManager) ParseAccessToken(token string) (AccessClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return AccessClaims{}, ErrUnauthorized
	}

	unsigned := parts[0] + "." + parts[1]
	expected := m.sign(unsigned)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return AccessClaims{}, ErrUnauthorized
	}

	var header struct {
		Alg string `json:"alg"`
	}
	if err := decodeSegment(parts[0], &header); err != nil {
		return AccessClaims{}, ErrUnauthorized
	}
	if header.Alg != "HS256" {
		return AccessClaims{}, ErrUnauthorized
	}

	var claims AccessClaims
	if err := decodeSegment(parts[1], &claims); err != nil {
		return AccessClaims{}, ErrUnauthorized
	}
	if claims.Subject == "" || claims.SessionID == "" || claims.ExpiresAt == 0 {
		return AccessClaims{}, ErrUnauthorized
	}
	if !m.now().UTC().Before(time.Unix(claims.ExpiresAt, 0)) {
		return AccessClaims{}, ErrUnauthorized
	}

	return claims, nil
}

func (m *TokenManager) NewRefreshToken() (string, string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", time.Time{}, err
	}

	refreshToken := base64.RawURLEncoding.EncodeToString(raw)
	hash := HashRefreshToken(refreshToken)
	expiresAt := m.now().UTC().Add(m.refreshTokenTTL)
	return refreshToken, hash, expiresAt, nil
}

func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func (m *TokenManager) sign(unsigned string) string {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(unsigned))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func decodeSegment(segment string, out interface{}) error {
	data, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, out)
}

func parseBoolClaim(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		parsed, err := strconv.ParseBool(v)
		return err == nil && parsed
	default:
		return false
	}
}

func validateTokenManagerSecret(secret string) error {
	if strings.TrimSpace(secret) == "" {
		return errors.New("auth token secret is empty")
	}
	if secret == "dev-secret-change-me" {
		return fmt.Errorf("auth token secret uses development default")
	}
	return nil
}
