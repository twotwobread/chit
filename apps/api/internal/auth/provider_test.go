package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPProviderVerifierRejectsUnsupportedProvider(t *testing.T) {
	verifier := NewHTTPProviderVerifier(ProviderConfig{AllowDevOAuth: true})
	devSubject := "dev-user"

	_, err := verifier.Verify(context.Background(), Provider("google"), Credential{DevSubject: &devSubject})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation for unsupported provider, got %v", err)
	}
}

func TestHTTPProviderVerifierVerifiesAppleIdentityToken(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	privateKey := mustGenerateRSAKey(t)
	jwksServer := newAppleJWKSServer(t, privateKey, "apple-key")
	defer jwksServer.Close()

	token := signAppleJWT(t, privateKey, "apple-key", map[string]interface{}{
		"iss":            appleIssuer,
		"aud":            "com.twotwobread.ium.staging",
		"sub":            "apple-subject-1",
		"exp":            now.Add(time.Hour).Unix(),
		"email":          "minsu@example.com",
		"email_verified": "true",
	})
	displayName := "민수"

	verifier := NewHTTPProviderVerifier(ProviderConfig{AppleAudience: "com.twotwobread.ium.staging"})
	verifier.appleJWKSURL = jwksServer.URL
	verifier.now = func() time.Time { return now }

	profile, err := verifier.Verify(context.Background(), ProviderApple, Credential{
		IdentityToken: &token,
		DisplayName:   &displayName,
	})
	if err != nil {
		t.Fatalf("verify apple token: %v", err)
	}

	if profile.Provider != ProviderApple || profile.ProviderSubject != "apple-subject-1" {
		t.Fatalf("expected apple subject profile, got %#v", profile)
	}
	if profile.Email == nil || *profile.Email != "minsu@example.com" || !profile.EmailVerified {
		t.Fatalf("expected verified email from Apple claims, got %#v", profile)
	}
	if profile.DisplayName == nil || *profile.DisplayName != "민수" {
		t.Fatalf("expected optional display name snapshot, got %#v", profile.DisplayName)
	}
}

func TestHTTPProviderVerifierRejectsInvalidAppleIdentityTokens(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	privateKey := mustGenerateRSAKey(t)
	otherPrivateKey := mustGenerateRSAKey(t)
	jwksServer := newAppleJWKSServer(t, privateKey, "apple-key")
	defer jwksServer.Close()

	baseClaims := map[string]interface{}{
		"iss": appleIssuer,
		"aud": "com.twotwobread.ium.staging",
		"sub": "apple-subject-1",
		"exp": now.Add(time.Hour).Unix(),
	}

	tests := []struct {
		name           string
		appleAudience  string
		identityToken  *string
		signingKey     *rsa.PrivateKey
		claimsOverride map[string]interface{}
	}{
		{name: "missing token", appleAudience: "com.twotwobread.ium.staging", identityToken: nil},
		{name: "missing audience config", appleAudience: "", signingKey: privateKey},
		{name: "bad audience", appleAudience: "com.twotwobread.ium.staging", signingKey: privateKey, claimsOverride: map[string]interface{}{"aud": "wrong-audience"}},
		{name: "expired", appleAudience: "com.twotwobread.ium.staging", signingKey: privateKey, claimsOverride: map[string]interface{}{"exp": now.Add(-time.Minute).Unix()}},
		{name: "missing subject", appleAudience: "com.twotwobread.ium.staging", signingKey: privateKey, claimsOverride: map[string]interface{}{"sub": ""}},
		{name: "bad signature", appleAudience: "com.twotwobread.ium.staging", signingKey: otherPrivateKey},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			identityToken := tt.identityToken
			if tt.signingKey != nil {
				claims := cloneClaims(baseClaims)
				for key, value := range tt.claimsOverride {
					claims[key] = value
				}
				token := signAppleJWT(t, tt.signingKey, "apple-key", claims)
				identityToken = &token
			}

			verifier := NewHTTPProviderVerifier(ProviderConfig{AppleAudience: tt.appleAudience})
			verifier.appleJWKSURL = jwksServer.URL
			verifier.now = func() time.Time { return now }

			_, err := verifier.Verify(context.Background(), ProviderApple, Credential{IdentityToken: identityToken})
			if !errors.Is(err, ErrInvalidProviderToken) {
				t.Fatalf("expected ErrInvalidProviderToken, got %v", err)
			}
		})
	}
}

func TestHTTPProviderVerifierVerifiesKakaoThroughRegistry(t *testing.T) {
	var authorization string
	kakaoServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":12345,"kakao_account":{"email":"minsu@example.com","is_email_verified":true,"profile":{"nickname":"민수","profile_image_url":"https://example.com/avatar.png"}}}`))
	}))
	defer kakaoServer.Close()

	accessToken := "kakao-access-token"
	verifier := NewHTTPProviderVerifier(ProviderConfig{})
	verifier.kakaoUserInfoURL = kakaoServer.URL

	profile, err := verifier.Verify(context.Background(), ProviderKakao, Credential{AccessToken: &accessToken})
	if err != nil {
		t.Fatalf("verify kakao token: %v", err)
	}
	if authorization != "Bearer kakao-access-token" {
		t.Fatalf("expected bearer token to be sent to Kakao, got %q", authorization)
	}
	if profile.Provider != ProviderKakao || profile.ProviderSubject != "12345" {
		t.Fatalf("expected kakao profile, got %#v", profile)
	}
}

func mustGenerateRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	return key
}

func newAppleJWKSServer(t *testing.T, key *rsa.PrivateKey, kid string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"keys":[{"kid":"` + kid + `","kty":"RSA","alg":"RS256","use":"sig","n":"` + base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes()) + `","e":"` + base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.PublicKey.E)).Bytes()) + `"}]}`))
	}))
}

func signAppleJWT(t *testing.T, key *rsa.PrivateKey, kid string, claims map[string]interface{}) string {
	t.Helper()
	header := map[string]interface{}{"alg": "RS256", "kid": kid, "typ": "JWT"}
	unsigned := encodeJWTPart(t, header) + "." + encodeJWTPart(t, claims)
	hash := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		t.Fatalf("sign jwt: %v", err)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func encodeJWTPart(t *testing.T, value interface{}) string {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal jwt part: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func cloneClaims(claims map[string]interface{}) map[string]interface{} {
	cloned := make(map[string]interface{}, len(claims))
	for key, value := range claims {
		cloned[key] = value
	}
	return cloned
}
