package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
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

func TestListTripsHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	backend.listedTrips = []tripdomain.ListItem{
		{
			ID:              "trip-2",
			Name:            "도쿄 2박 3일",
			StartDate:       "2026-08-10",
			EndDate:         "2026-08-12",
			DefaultCurrency: "JPY",
			JoinedAt:        time.Date(2026, 6, 23, 15, 0, 0, 0, time.UTC),
			CreatedAt:       time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
		},
		{
			ID:              "trip-1",
			Name:            "오사카 3박 4일",
			StartDate:       "2026-07-10",
			EndDate:         "2026-07-13",
			DefaultCurrency: "JPY",
			JoinedAt:        time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			CreatedAt:       time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if backend.listTripsUserID != "user-1" {
		t.Fatalf("expected list user user-1, got %q", backend.listTripsUserID)
	}

	var body struct {
		Trips []map[string]interface{} `json:"trips"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Trips) != 2 {
		t.Fatalf("expected two trips, got %#v", body.Trips)
	}
	if body.Trips[0]["id"] != "trip-2" || body.Trips[1]["id"] != "trip-1" {
		t.Fatalf("unexpected trip order: %#v", body.Trips)
	}
	if body.Trips[0]["name"] != "도쿄 2박 3일" || body.Trips[0]["startDate"] != "2026-08-10" || body.Trips[0]["endDate"] != "2026-08-12" {
		t.Fatalf("unexpected first trip body: %#v", body.Trips[0])
	}
	if body.Trips[0]["defaultCurrency"] != "JPY" || body.Trips[0]["joinedAt"] == "" || body.Trips[0]["createdAt"] == "" {
		t.Fatalf("expected currency, joinedAt, and createdAt in first trip body: %#v", body.Trips[0])
	}
	if _, ok := body.Trips[0]["updatedAt"]; ok {
		t.Fatalf("list response must not include updatedAt: %#v", body.Trips[0])
	}
	if _, ok := body.Trips[0]["createdBy"]; ok {
		t.Fatalf("list response must not include createdBy: %#v", body.Trips[0])
	}
}

func TestListTripsReturnsEmpty(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trips []interface{} `json:"trips"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Trips) != 0 {
		t.Fatalf("expected empty trips, got %#v", body.Trips)
	}
}

func TestCreateTripThenListTripsShowsCreatedTrip(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trips []struct {
			ID              string `json:"id"`
			Name            string `json:"name"`
			DefaultCurrency string `json:"defaultCurrency"`
			JoinedAt        string `json:"joinedAt"`
		} `json:"trips"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Trips) != 1 {
		t.Fatalf("expected one trip, got %#v", body.Trips)
	}
	if body.Trips[0].ID != tripID || body.Trips[0].Name != "오사카 3박 4일" || body.Trips[0].DefaultCurrency != "JPY" || body.Trips[0].JoinedAt == "" {
		t.Fatalf("unexpected created trip in list: %#v", body.Trips[0])
	}
}

func TestListTripsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestGetTripDetailHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID, nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trip struct {
			ID              string `json:"id"`
			Name            string `json:"name"`
			StartDate       string `json:"startDate"`
			EndDate         string `json:"endDate"`
			DefaultCurrency string `json:"defaultCurrency"`
		} `json:"trip"`
		ParticipantSummary struct {
			TotalCount    int      `json:"totalCount"`
			PreviewNames  []string `json:"previewNames"`
			OverflowCount int      `json:"overflowCount"`
		} `json:"participantSummary"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Trip.ID != tripID || body.Trip.Name != "오사카 3박 4일" {
		t.Fatalf("unexpected trip: %#v", body.Trip)
	}
	if body.Trip.StartDate != "2026-07-10" || body.Trip.EndDate != "2026-07-13" || body.Trip.DefaultCurrency != "JPY" {
		t.Fatalf("unexpected trip detail: %#v", body.Trip)
	}
	if body.ParticipantSummary.TotalCount != 1 || body.ParticipantSummary.OverflowCount != 0 {
		t.Fatalf("unexpected participant summary: %#v", body.ParticipantSummary)
	}
	if len(body.ParticipantSummary.PreviewNames) != 1 || body.ParticipantSummary.PreviewNames[0] != "민수" {
		t.Fatalf("unexpected preview names: %#v", body.ParticipantSummary.PreviewNames)
	}
}

func TestGetTripDetailRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000001", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestGetTripDetailValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/not-a-uuid", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
	}
}

func TestGetTripDetailNotFound(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000404", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestGetTripDetailForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID, nil)
	request.Header.Set("Authorization", "Bearer "+nonParticipantToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, recorder.Code, recorder.Body.String())
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
	users           map[string]auth.User
	identityUser    map[string]string
	sessions        map[string]auth.Session
	trips           map[string]tripdomain.Trip
	participants    map[string][]tripdomain.Participant
	listedTrips     []tripdomain.ListItem
	listTripsUserID string
	nextUser        int
	nextSession     int
	nextTrip        int
}

func loginTestUser(t *testing.T, backend *fakeAuthBackend) string {
	t.Helper()
	return loginTestUserWithSubject(t, backend, "apple-1", "민수")
}

func loginTestUserWithSubject(t *testing.T, backend *fakeAuthBackend, subject string, displayName string) string {
	t.Helper()

	requestBody := []byte(fmt.Sprintf(`{
		"provider":"apple",
		"credential":{
			"devSubject":%q,
			"email":%q,
			"emailVerified":true,
			"displayName":%q
		},
		"device":{"platform":"ios"}
	}`, subject, subject+"@example.com", displayName))
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

func createTestTrip(t *testing.T, backend *fakeAuthBackend, accessToken string) string {
	t.Helper()

	requestBody := []byte(`{
		"name":"오사카 3박 4일",
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
		t.Fatalf("expected create trip status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trip struct {
			ID string `json:"id"`
		} `json:"trip"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode create trip response: %v", err)
	}
	if body.Trip.ID == "" {
		t.Fatal("expected trip id")
	}
	return body.Trip.ID
}

func newFakeAuthBackend() *fakeAuthBackend {
	return &fakeAuthBackend{
		fakeReadiness: fakeReadiness{schema: "initialized"},
		users:         map[string]auth.User{},
		identityUser:  map[string]string{},
		sessions:      map[string]auth.Session{},
		trips:         map[string]tripdomain.Trip{},
		participants:  map[string][]tripdomain.Participant{},
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
	user.ID = fmt.Sprintf("user-%d", b.nextUser)
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
	session := auth.Session{ID: fmt.Sprintf("session-%d", b.nextSession), UserID: userID, RefreshTokenHash: refreshTokenHash, RefreshTokenExpiresAt: refreshTokenExpiresAt}
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
	b.nextTrip++
	now := time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC)
	tripID := testUUID(b.nextTrip)
	participantID := testUUID(1000 + b.nextTrip)
	createdTrip := tripdomain.Trip{
		ID:              tripID,
		Name:            record.Name,
		StartDate:       record.StartDate.Format("2006-01-02"),
		EndDate:         record.EndDate.Format("2006-01-02"),
		DefaultCurrency: record.DefaultCurrency,
		CreatedBy:       record.CreatedBy,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	owner := tripdomain.Participant{
		ID:          participantID,
		TripID:      tripID,
		UserID:      record.CreatedBy,
		Role:        tripdomain.RoleOwner,
		DisplayName: record.OwnerDisplayName,
		JoinedAt:    now,
	}
	b.trips[tripID] = createdTrip
	b.participants[tripID] = []tripdomain.Participant{owner}

	return tripdomain.CreateResult{
		Trip:             createdTrip,
		OwnerParticipant: owner,
	}, nil
}

func (b *fakeAuthBackend) GetTripByID(_ context.Context, tripID string) (tripdomain.Trip, bool, error) {
	foundTrip, ok := b.trips[tripID]
	return foundTrip, ok, nil
}

func (b *fakeAuthBackend) IsTripParticipant(_ context.Context, tripID string, userID string) (bool, error) {
	for _, participant := range b.participants[tripID] {
		if participant.UserID == userID {
			return true, nil
		}
	}
	return false, nil
}

func (b *fakeAuthBackend) CountTripParticipants(_ context.Context, tripID string) (int, error) {
	return len(b.participants[tripID]), nil
}

func (b *fakeAuthBackend) ListTripParticipantPreviewNames(_ context.Context, tripID string) ([]string, error) {
	participants := b.participants[tripID]
	limit := len(participants)
	if limit > 3 {
		limit = 3
	}
	previewNames := make([]string, 0, limit)
	for _, participant := range participants[:limit] {
		previewNames = append(previewNames, participant.DisplayName)
	}
	return previewNames, nil
}

func (b *fakeAuthBackend) ListTripsByParticipantUser(_ context.Context, userID string) ([]tripdomain.ListItem, error) {
	b.listTripsUserID = userID
	if b.listedTrips != nil {
		return b.listedTrips, nil
	}

	trips := []tripdomain.ListItem{}
	for tripID, participants := range b.participants {
		for _, participant := range participants {
			if participant.UserID != userID {
				continue
			}
			foundTrip := b.trips[tripID]
			trips = append(trips, tripdomain.ListItem{
				ID:              foundTrip.ID,
				Name:            foundTrip.Name,
				StartDate:       foundTrip.StartDate,
				EndDate:         foundTrip.EndDate,
				DefaultCurrency: foundTrip.DefaultCurrency,
				JoinedAt:        participant.JoinedAt,
				CreatedAt:       foundTrip.CreatedAt,
			})
		}
	}
	sort.Slice(trips, func(i, j int) bool {
		if !trips[i].JoinedAt.Equal(trips[j].JoinedAt) {
			return trips[i].JoinedAt.After(trips[j].JoinedAt)
		}
		if !trips[i].CreatedAt.Equal(trips[j].CreatedAt) {
			return trips[i].CreatedAt.After(trips[j].CreatedAt)
		}
		return trips[i].ID > trips[j].ID
	})
	return trips, nil
}

func testUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}
