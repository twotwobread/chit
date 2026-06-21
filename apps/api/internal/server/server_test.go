package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
	tripdomain "github.com/twotwobread/i-um/apps/api/internal/trip"
)

type fakeReadiness struct {
	schema string
	err    error
}

func (f fakeReadiness) CheckReady(context.Context) (string, error) {
	return f.schema, f.err
}

func TestHealth(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)

	NewRouter(nil).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	contentType := recorder.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Fatalf("expected content type application/json, got %q", contentType)
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status ok, got %q", body.Status)
	}
}

func TestReady(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)

	NewRouter(fakeReadiness{schema: "initialized"}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	var body struct {
		Status string `json:"status"`
		Checks struct {
			Database struct {
				Status string `json:"status"`
			} `json:"database"`
			Metadata struct {
				Status string `json:"status"`
				Schema string `json:"schema"`
			} `json:"metadata"`
		} `json:"checks"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status ok, got %q", body.Status)
	}
	if body.Checks.Database.Status != "ok" {
		t.Fatalf("expected database status ok, got %q", body.Checks.Database.Status)
	}
	if body.Checks.Metadata.Status != "ok" {
		t.Fatalf("expected metadata status ok, got %q", body.Checks.Metadata.Status)
	}
	if body.Checks.Metadata.Schema != "initialized" {
		t.Fatalf("expected schema initialized, got %q", body.Checks.Metadata.Schema)
	}
}

func TestLoginWithOAuthHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	requestBody := []byte(`{
		"provider":"apple",
		"credential":{
			"devSubject":"apple-1",
			"email":"minsu@example.com",
			"emailVerified":true,
			"displayName":"민수"
		},
		"device":{"platform":"ios"}
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/auth/oauth/login", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Result string `json:"result"`
		User   struct {
			DisplayName string `json:"displayName"`
		} `json:"user"`
		Tokens struct {
			AccessToken  string `json:"accessToken"`
			RefreshToken string `json:"refreshToken"`
		} `json:"tokens"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Result != "login_success" {
		t.Fatalf("expected login_success, got %q", body.Result)
	}
	if body.User.DisplayName != "민수" {
		t.Fatalf("expected display name 민수, got %q", body.User.DisplayName)
	}
	if body.Tokens.AccessToken == "" || body.Tokens.RefreshToken == "" {
		t.Fatalf("expected tokens, got %#v", body.Tokens)
	}
}

func TestCreateTripHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	requestBody := []byte(`{
		"name":"  오사카 3박 4일  ",
		"startDate":"2026-07-10",
		"endDate":"2026-07-13",
		"defaultCurrency":"JPY"
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trip struct {
			Name            string `json:"name"`
			StartDate       string `json:"startDate"`
			EndDate         string `json:"endDate"`
			DefaultCurrency string `json:"defaultCurrency"`
			CreatedBy       string `json:"createdBy"`
		} `json:"trip"`
		OwnerParticipant struct {
			Role        string `json:"role"`
			DisplayName string `json:"displayName"`
			UserID      string `json:"userId"`
		} `json:"ownerParticipant"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("expected trimmed name, got %q", body.Trip.Name)
	}
	if body.Trip.StartDate != "2026-07-10" || body.Trip.EndDate != "2026-07-13" {
		t.Fatalf("unexpected dates: %#v", body.Trip)
	}
	if body.Trip.DefaultCurrency != "JPY" {
		t.Fatalf("expected JPY, got %q", body.Trip.DefaultCurrency)
	}
	if body.Trip.CreatedBy != "user-1" {
		t.Fatalf("expected createdBy user-1, got %q", body.Trip.CreatedBy)
	}
	if body.OwnerParticipant.Role != "owner" {
		t.Fatalf("expected owner role, got %q", body.OwnerParticipant.Role)
	}
	if body.OwnerParticipant.DisplayName != "민수" {
		t.Fatalf("expected display name snapshot 민수, got %q", body.OwnerParticipant.DisplayName)
	}
	if body.OwnerParticipant.UserID != "user-1" {
		t.Fatalf("expected owner user user-1, got %q", body.OwnerParticipant.UserID)
	}
}

func TestCreateTripRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips", bytes.NewReader([]byte(`{
		"name":"오사카",
		"startDate":"2026-07-10",
		"endDate":"2026-07-13",
		"defaultCurrency":"JPY"
	}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestCreateTripValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips", bytes.NewReader([]byte(`{
		"name":"오사카",
		"startDate":"2026-07-13",
		"endDate":"2026-07-10",
		"defaultCurrency":"JPY"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %q", body.Error.Code)
	}
}

func TestReadyReturnsServiceUnavailable(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)

	NewRouter(fakeReadiness{err: errors.New("db down")}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}

	var body struct {
		Error struct {
			Code    string        `json:"code"`
			Message string        `json:"message"`
			Details []interface{} `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "SERVICE_UNAVAILABLE" {
		t.Fatalf("expected SERVICE_UNAVAILABLE, got %q", body.Error.Code)
	}
	if body.Error.Message != "database is not ready" {
		t.Fatalf("expected database is not ready, got %q", body.Error.Message)
	}
	if len(body.Error.Details) != 0 {
		t.Fatalf("expected empty details, got %#v", body.Error.Details)
	}
}

type fakeAuthBackend struct {
	fakeReadiness
	users        map[string]auth.User
	identityUser map[string]string
	sessions     map[string]auth.Session
	nextUser     int
	nextSession  int
}

func loginTestUser(t *testing.T, backend *fakeAuthBackend) string {
	t.Helper()

	requestBody := []byte(`{
		"provider":"apple",
		"credential":{
			"devSubject":"apple-1",
			"email":"minsu@example.com",
			"emailVerified":true,
			"displayName":"민수"
		},
		"device":{"platform":"ios"}
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/auth/oauth/login", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected login status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Tokens struct {
			AccessToken string `json:"accessToken"`
		} `json:"tokens"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if body.Tokens.AccessToken == "" {
		t.Fatal("expected access token")
	}
	return body.Tokens.AccessToken
}

func newFakeAuthBackend() *fakeAuthBackend {
	return &fakeAuthBackend{
		fakeReadiness: fakeReadiness{schema: "initialized"},
		users:         map[string]auth.User{},
		identityUser:  map[string]string{},
		sessions:      map[string]auth.Session{},
	}
}

func (b *fakeAuthBackend) FindUserByIdentity(_ context.Context, provider auth.Provider, providerSubject string) (auth.User, bool, error) {
	userID, ok := b.identityUser[string(provider)+":"+providerSubject]
	if !ok {
		return auth.User{}, false, nil
	}
	return b.users[userID], true, nil
}

func (b *fakeAuthBackend) FindUserByVerifiedEmail(context.Context, string) (auth.User, bool, error) {
	return auth.User{}, false, nil
}

func (b *fakeAuthBackend) CreateUserWithIdentity(_ context.Context, user auth.User, identity auth.Identity) (auth.User, error) {
	b.nextUser++
	user.ID = "user-1"
	b.users[user.ID] = user
	b.identityUser[string(identity.Provider)+":"+identity.ProviderSubject] = user.ID
	return user, nil
}

func (b *fakeAuthBackend) CreateIdentity(_ context.Context, userID string, identity auth.Identity) (auth.Identity, error) {
	identity.UserID = userID
	return identity, nil
}

func (b *fakeAuthBackend) CreateSession(_ context.Context, userID string, refreshTokenHash string, refreshTokenExpiresAt time.Time, _ auth.Device) (auth.Session, error) {
	b.nextSession++
	session := auth.Session{ID: "session-1", UserID: userID, RefreshTokenHash: refreshTokenHash, RefreshTokenExpiresAt: refreshTokenExpiresAt}
	b.sessions[session.ID] = session
	return session, nil
}

func (b *fakeAuthBackend) FindSessionByRefreshTokenHash(_ context.Context, refreshTokenHash string) (auth.Session, bool, error) {
	for _, session := range b.sessions {
		if session.RefreshTokenHash == refreshTokenHash {
			return session, true, nil
		}
	}
	return auth.Session{}, false, nil
}

func (b *fakeAuthBackend) GetSession(_ context.Context, sessionID string) (auth.Session, bool, error) {
	session, ok := b.sessions[sessionID]
	return session, ok, nil
}

func (b *fakeAuthBackend) RotateSessionRefreshToken(_ context.Context, sessionID string, refreshTokenHash string, refreshTokenExpiresAt time.Time) (auth.Session, error) {
	session := b.sessions[sessionID]
	session.RefreshTokenHash = refreshTokenHash
	session.RefreshTokenExpiresAt = refreshTokenExpiresAt
	b.sessions[sessionID] = session
	return session, nil
}

func (b *fakeAuthBackend) RevokeSession(_ context.Context, sessionID string) error {
	session := b.sessions[sessionID]
	now := time.Now()
	session.RevokedAt = &now
	b.sessions[sessionID] = session
	return nil
}

func (b *fakeAuthBackend) GetUser(_ context.Context, userID string) (auth.User, bool, error) {
	user, ok := b.users[userID]
	return user, ok, nil
}

func (b *fakeAuthBackend) ListProviders(context.Context, string) ([]auth.Provider, error) {
	return []auth.Provider{auth.ProviderApple}, nil
}

func (b *fakeAuthBackend) GetCreator(_ context.Context, userID string) (tripdomain.Creator, bool, error) {
	user, ok := b.users[userID]
	if !ok {
		return tripdomain.Creator{}, false, nil
	}
	return tripdomain.Creator{ID: user.ID, DisplayName: user.DisplayName}, true, nil
}

func (b *fakeAuthBackend) CreateTripWithOwner(_ context.Context, record tripdomain.CreateRecord) (tripdomain.CreateResult, error) {
	now := time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC)
	return tripdomain.CreateResult{
		Trip: tripdomain.Trip{
			ID:              "trip-1",
			Name:            record.Name,
			StartDate:       record.StartDate.Format("2006-01-02"),
			EndDate:         record.EndDate.Format("2006-01-02"),
			DefaultCurrency: record.DefaultCurrency,
			CreatedBy:       record.CreatedBy,
			CreatedAt:       now,
			UpdatedAt:       now,
		},
		OwnerParticipant: tripdomain.Participant{
			ID:          "participant-1",
			TripID:      "trip-1",
			UserID:      record.CreatedBy,
			Role:        tripdomain.RoleOwner,
			DisplayName: record.OwnerDisplayName,
			JoinedAt:    now,
		},
	}, nil
}
