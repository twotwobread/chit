package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

const (
	appleIssuer        = "https://appleid.apple.com"
	appleJWKSURL       = "https://appleid.apple.com/auth/keys"
	kakaoUserInfoURL   = "https://kapi.kakao.com/v2/user/me"
	defaultHTTPTimeout = 5 * time.Second
)

type ProviderConfig struct {
	AppleAudience string
	AllowDevOAuth bool
}

type HTTPProviderVerifier struct {
	config ProviderConfig
	client *http.Client
	now    func() time.Time
}

func NewHTTPProviderVerifier(config ProviderConfig) *HTTPProviderVerifier {
	return &HTTPProviderVerifier{
		config: config,
		client: &http.Client{Timeout: defaultHTTPTimeout},
		now:    time.Now,
	}
}

func (v *HTTPProviderVerifier) Verify(ctx context.Context, provider Provider, credential Credential) (ProviderProfile, error) {
	if v.config.AllowDevOAuth && credential.DevSubject != nil && *credential.DevSubject != "" {
		return devProfile(provider, credential), nil
	}

	switch provider {
	case ProviderApple:
		return v.verifyApple(ctx, credential)
	case ProviderKakao:
		return v.verifyKakao(ctx, credential)
	default:
		return ProviderProfile{}, ErrValidation
	}
}

func devProfile(provider Provider, credential Credential) ProviderProfile {
	emailVerified := false
	if credential.EmailVerified != nil {
		emailVerified = *credential.EmailVerified
	}
	return ProviderProfile{
		Provider:        provider,
		ProviderSubject: strings.TrimSpace(*credential.DevSubject),
		Email:           trimStringPtr(credential.Email),
		EmailVerified:   emailVerified,
		DisplayName:     trimStringPtr(credential.DisplayName),
		AvatarURL:       trimStringPtr(credential.AvatarURL),
	}
}

func (v *HTTPProviderVerifier) verifyApple(ctx context.Context, credential Credential) (ProviderProfile, error) {
	if credential.IdentityToken == nil || strings.TrimSpace(*credential.IdentityToken) == "" {
		return ProviderProfile{}, ErrInvalidProviderToken
	}
	if strings.TrimSpace(v.config.AppleAudience) == "" {
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	claims, err := v.verifyAppleIdentityToken(ctx, strings.TrimSpace(*credential.IdentityToken))
	if err != nil {
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	issuer, _ := claims["iss"].(string)
	audience, _ := claims["aud"].(string)
	subject, _ := claims["sub"].(string)
	exp, _ := claims["exp"].(float64)
	if issuer != appleIssuer || audience != v.config.AppleAudience || subject == "" {
		return ProviderProfile{}, ErrInvalidProviderToken
	}
	if exp == 0 || !v.now().UTC().Before(time.Unix(int64(exp), 0)) {
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	email, _ := claims["email"].(string)
	profile := ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: subject,
		Email:           optionalString(email),
		EmailVerified:   parseBoolClaim(claims["email_verified"]),
		DisplayName:     nil,
		AvatarURL:       nil,
	}
	return profile, nil
}

func (v *HTTPProviderVerifier) verifyAppleIdentityToken(ctx context.Context, token string) (map[string]interface{}, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid apple jwt")
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := decodeSegment(parts[0], &header); err != nil {
		return nil, err
	}
	if header.Alg != "RS256" || header.Kid == "" {
		return nil, errors.New("unsupported apple jwt")
	}

	key, err := v.fetchAppleKey(ctx, header.Kid)
	if err != nil {
		return nil, err
	}

	unsigned := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, err
	}
	if err := verifyRS256(key, []byte(unsigned), signature); err != nil {
		return nil, err
	}

	var claims map[string]interface{}
	if err := decodeSegment(parts[1], &claims); err != nil {
		return nil, err
	}
	return claims, nil
}

func (v *HTTPProviderVerifier) fetchAppleKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, appleJWKSURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("apple jwks status %d", resp.StatusCode)
	}

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, err
	}
	for _, key := range jwks.Keys {
		if key.Kid == kid {
			return jwkToRSAPublicKey(key.N, key.E)
		}
	}
	return nil, errors.New("apple key not found")
}

func verifyRS256(key *rsa.PublicKey, unsigned []byte, signature []byte) error {
	hash := sha256.Sum256(unsigned)
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], signature)
}

func jwkToRSAPublicKey(n string, e string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(n)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(e)
	if err != nil {
		return nil, err
	}
	exponent := 0
	for _, b := range eBytes {
		exponent = exponent<<8 + int(b)
	}
	if exponent == 0 {
		return nil, errors.New("invalid exponent")
	}
	return &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: exponent}, nil
}

func (v *HTTPProviderVerifier) verifyKakao(ctx context.Context, credential Credential) (ProviderProfile, error) {
	if credential.AccessToken == nil || strings.TrimSpace(*credential.AccessToken) == "" {
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, kakaoUserInfoURL, nil)
	if err != nil {
		return ProviderProfile{}, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(*credential.AccessToken))
	resp, err := v.client.Do(req)
	if err != nil {
		return ProviderProfile{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	var body struct {
		ID           int64 `json:"id"`
		KakaoAccount struct {
			Email           string `json:"email"`
			IsEmailVerified bool   `json:"is_email_verified"`
			Profile         struct {
				Nickname        string `json:"nickname"`
				ProfileImageURL string `json:"profile_image_url"`
			} `json:"profile"`
		} `json:"kakao_account"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return ProviderProfile{}, err
	}
	if body.ID == 0 {
		return ProviderProfile{}, ErrInvalidProviderToken
	}

	return ProviderProfile{
		Provider:        ProviderKakao,
		ProviderSubject: fmt.Sprintf("%d", body.ID),
		Email:           optionalString(body.KakaoAccount.Email),
		EmailVerified:   body.KakaoAccount.IsEmailVerified,
		DisplayName:     optionalString(body.KakaoAccount.Profile.Nickname),
		AvatarURL:       optionalString(body.KakaoAccount.Profile.ProfileImageURL),
	}, nil
}

func trimStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	return optionalString(*value)
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
