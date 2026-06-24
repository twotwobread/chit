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
	"strings"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
	placedomain "github.com/twotwobread/i-um/apps/api/internal/place"
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

func TestLoginWithOAuthRejectsDevCredentialWhenDisabled(t *testing.T) {
	backend := newFakeAuthBackend()
	requestBody := []byte(`{
		"provider":"kakao",
		"credential":{
			"devSubject":"should-fail"
		},
		"device":{"platform":"ios"}
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/auth/oauth/login", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: false}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "INVALID_PROVIDER_TOKEN" {
		t.Fatalf("expected INVALID_PROVIDER_TOKEN, got %q", body.Error.Code)
	}
}

func TestGetMeHandlerMatchesDeprecatedAuthMe(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	requestCurrentProfile := func(path string) (int, string) {
		t.Helper()
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, path, nil)
		request.Header.Set("Authorization", "Bearer "+accessToken)

		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
		return recorder.Code, recorder.Body.String()
	}

	meStatus, meBody := requestCurrentProfile("/me")
	legacyStatus, legacyBody := requestCurrentProfile("/auth/me")

	if meStatus != http.StatusOK {
		t.Fatalf("expected /me status %d, got %d with body %s", http.StatusOK, meStatus, meBody)
	}
	if legacyStatus != http.StatusOK {
		t.Fatalf("expected /auth/me status %d, got %d with body %s", http.StatusOK, legacyStatus, legacyBody)
	}
	if meBody != legacyBody {
		t.Fatalf("expected /me and /auth/me response bodies to match\n/me: %s\n/auth/me: %s", meBody, legacyBody)
	}

	var body struct {
		User struct {
			ID          string  `json:"id"`
			DisplayName string  `json:"displayName"`
			Email       *string `json:"email"`
			AvatarURL   *string `json:"avatarUrl"`
		} `json:"user"`
		LinkedProviders []string `json:"linkedProviders"`
	}
	if err := json.Unmarshal([]byte(meBody), &body); err != nil {
		t.Fatalf("decode /me response: %v", err)
	}
	if body.User.ID != "user-1" || body.User.DisplayName != "민수" {
		t.Fatalf("unexpected user profile: %#v", body.User)
	}
	if body.User.Email == nil || *body.User.Email != "apple-1@example.com" {
		t.Fatalf("expected email apple-1@example.com, got %#v", body.User.Email)
	}
	if body.User.AvatarURL != nil {
		t.Fatalf("expected null avatarUrl, got %#v", body.User.AvatarURL)
	}
	if len(body.LinkedProviders) != 1 || body.LinkedProviders[0] != "apple" {
		t.Fatalf("expected linked provider apple, got %#v", body.LinkedProviders)
	}
}

func TestGetMeHandlerMatchesDeprecatedAuthMeUnauthorized(t *testing.T) {
	backend := newFakeAuthBackend()

	requestCurrentProfile := func(path string) (int, string) {
		t.Helper()
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, path, nil)

		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
		return recorder.Code, recorder.Body.String()
	}

	meStatus, meBody := requestCurrentProfile("/me")
	legacyStatus, legacyBody := requestCurrentProfile("/auth/me")

	if meStatus != http.StatusUnauthorized {
		t.Fatalf("expected /me status %d, got %d with body %s", http.StatusUnauthorized, meStatus, meBody)
	}
	if legacyStatus != http.StatusUnauthorized {
		t.Fatalf("expected /auth/me status %d, got %d with body %s", http.StatusUnauthorized, legacyStatus, legacyBody)
	}
	if meBody != legacyBody {
		t.Fatalf("expected unauthorized bodies to match\n/me: %s\n/auth/me: %s", meBody, legacyBody)
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(meBody), &body); err != nil {
		t.Fatalf("decode /me unauthorized response: %v", err)
	}
	if body.Error.Code != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %q", body.Error.Code)
	}
}

func TestUpdateMeHandlerUpdatesDisplayName(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	patchBody := []byte(`{"displayName":"  지  영  "}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/me", bytes.NewReader(patchBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected update status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		User struct {
			DisplayName string `json:"displayName"`
		} `json:"user"`
		LinkedProviders []string `json:"linkedProviders"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode update response: %v", err)
	}
	if body.User.DisplayName != "지  영" {
		t.Fatalf("expected trimmed display name 지  영, got %q", body.User.DisplayName)
	}
	if len(body.LinkedProviders) != 1 || body.LinkedProviders[0] != "apple" {
		t.Fatalf("expected linked provider apple, got %#v", body.LinkedProviders)
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/me", nil)
	getRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get /me status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var meBody struct {
		User struct {
			DisplayName string `json:"displayName"`
		} `json:"user"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&meBody); err != nil {
		t.Fatalf("decode /me response: %v", err)
	}
	if meBody.User.DisplayName != "지  영" {
		t.Fatalf("expected /me display name 지  영, got %q", meBody.User.DisplayName)
	}
}

func TestUpdateMeHandlerAllowsSameValueNoop(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/me", bytes.NewReader([]byte(`{"displayName":"  민수  "}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected same-value status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var body struct {
		User struct {
			DisplayName string `json:"displayName"`
		} `json:"user"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode same-value response: %v", err)
	}
	if body.User.DisplayName != "민수" {
		t.Fatalf("expected same-value display name 민수, got %q", body.User.DisplayName)
	}
}

func TestUpdateMeHandlerRejectsInvalidDisplayName(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	cases := []struct {
		name string
		body string
	}{
		{name: "empty after trim", body: `{"displayName":"   "}`},
		{name: "over 20 code points", body: fmt.Sprintf(`{"displayName":%q}`, strings.Repeat("가", 21))},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, "/me", bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+accessToken)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected validation status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code    string `json:"code"`
					Details []struct {
						Field   string `json:"field"`
						Message string `json:"message"`
					} `json:"details"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode validation response: %v", err)
			}
			if body.Error.Code != "VALIDATION_ERROR" {
				t.Fatalf("expected VALIDATION_ERROR, got %q", body.Error.Code)
			}
			if len(body.Error.Details) != 1 || body.Error.Details[0].Field != "displayName" || body.Error.Details[0].Message != "이름은 1~20자로 입력해주세요." {
				t.Fatalf("unexpected validation details: %#v", body.Error.Details)
			}
			if backend.users["user-1"].DisplayName != "민수" {
				t.Fatalf("expected previous display name to remain 민수, got %q", backend.users["user-1"].DisplayName)
			}
		})
	}
}

func TestUpdateMeHandlerRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	_ = loginTestUser(t, backend)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/me", bytes.NewReader([]byte(`{"displayName":"지영"}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
	if backend.users["user-1"].DisplayName != "민수" {
		t.Fatalf("expected display name to remain 민수, got %q", backend.users["user-1"].DisplayName)
	}
}

func TestDeleteMeHandlerDeletesAccountAndInvalidatesTokens(t *testing.T) {
	backend := newFakeAuthBackend()
	session := loginTestUserSession(t, backend, "apple-1", "민수")

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/me", nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+session.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(deleteRecorder, deleteRequest)

	if deleteRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected delete status %d, got %d with body %s", http.StatusNoContent, deleteRecorder.Code, deleteRecorder.Body.String())
	}
	if deleteRecorder.Body.String() != "" {
		t.Fatalf("expected empty delete response body, got %q", deleteRecorder.Body.String())
	}

	deletedUser := backend.users[session.UserID]
	if deletedUser.DisplayName != "탈퇴한 사용자" || deletedUser.Email != nil || deletedUser.EmailVerified || deletedUser.AvatarURL != nil {
		t.Fatalf("expected deleted user PII wiped, got %#v", deletedUser)
	}

	meRecorder := httptest.NewRecorder()
	meRequest := httptest.NewRequest(http.MethodGet, "/me", nil)
	meRequest.Header.Set("Authorization", "Bearer "+session.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(meRecorder, meRequest)
	if meRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected old access token status %d, got %d with body %s", http.StatusUnauthorized, meRecorder.Code, meRecorder.Body.String())
	}

	refreshRecorder := httptest.NewRecorder()
	refreshRequest := httptest.NewRequest(http.MethodPost, "/auth/token/refresh", bytes.NewReader([]byte(fmt.Sprintf(`{"refreshToken":%q}`, session.RefreshToken))))
	refreshRequest.Header.Set("Content-Type", "application/json")
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(refreshRecorder, refreshRequest)
	if refreshRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected old refresh token status %d, got %d with body %s", http.StatusUnauthorized, refreshRecorder.Code, refreshRecorder.Body.String())
	}

	relogin := loginTestUserSession(t, backend, "apple-1", "민수")
	if relogin.UserID == session.UserID {
		t.Fatalf("expected same provider relogin to create a new user id, got %q", relogin.UserID)
	}
}

func TestDeleteMeHandlerRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/me", nil)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected delete unauthorized status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
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
			ID:               "trip-2",
			Name:             "도쿄 2박 3일",
			StartDate:        "2026-08-10",
			EndDate:          "2026-08-12",
			DefaultCurrency:  "JPY",
			JoinedAt:         time.Date(2026, 6, 23, 15, 0, 0, 0, time.UTC),
			CreatedAt:        time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
			MyRole:           tripdomain.RoleMember,
			ParticipantCount: 3,
		},
		{
			ID:               "trip-1",
			Name:             "오사카 3박 4일",
			StartDate:        "2026-07-10",
			EndDate:          "2026-07-13",
			DefaultCurrency:  "JPY",
			JoinedAt:         time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			CreatedAt:        time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			MyRole:           tripdomain.RoleOwner,
			ParticipantCount: 1,
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
	if body.Trips[0]["myRole"] != "member" || body.Trips[0]["participantCount"] != float64(3) {
		t.Fatalf("expected role and participant count in first trip body: %#v", body.Trips[0])
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
			ID               string `json:"id"`
			Name             string `json:"name"`
			DefaultCurrency  string `json:"defaultCurrency"`
			JoinedAt         string `json:"joinedAt"`
			MyRole           string `json:"myRole"`
			ParticipantCount int    `json:"participantCount"`
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
	if body.Trips[0].MyRole != tripdomain.RoleOwner || body.Trips[0].ParticipantCount != 1 {
		t.Fatalf("expected owner role and participant count for created trip, got %#v", body.Trips[0])
	}
}

func TestListTripsReturnsCurrentUserRoleAndParticipantCount(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          testUUID(2000),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips", nil)
	request.Header.Set("Authorization", "Bearer "+memberToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Trips []struct {
			ID               string `json:"id"`
			MyRole           string `json:"myRole"`
			ParticipantCount int    `json:"participantCount"`
		} `json:"trips"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Trips) != 1 {
		t.Fatalf("expected one trip, got %#v", body.Trips)
	}
	if body.Trips[0].ID != tripID || body.Trips[0].MyRole != tripdomain.RoleMember || body.Trips[0].ParticipantCount != 2 {
		t.Fatalf("expected member role and accepted participant count, got %#v", body.Trips[0])
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
		Days []struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"days"`
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
	if len(body.Days) != 4 {
		t.Fatalf("expected 4 trip days, got %#v", body.Days)
	}
	for index, day := range body.Days {
		expectedOrder := index + 1
		if day.DayOrder != expectedOrder {
			t.Fatalf("unexpected day %d: %#v", index, day)
		}
	}
	if body.Days[0].Date != "2026-07-10" || body.Days[3].Date != "2026-07-13" {
		t.Fatalf("unexpected day dates: %#v", body.Days)
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

func TestCreateTripInviteHandlerCreatesAndReusesCurrentInvite(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	firstRecorder := httptest.NewRecorder()
	firstRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/invites", nil)
	firstRequest.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, InviteBaseURL: "https://invite.i-um.test"}).ServeHTTP(firstRecorder, firstRequest)
	if firstRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create invite status %d, got %d with body %s", http.StatusCreated, firstRecorder.Code, firstRecorder.Body.String())
	}

	var firstBody struct {
		Created bool `json:"created"`
		Invite  struct {
			Token     string `json:"token"`
			InviteURL string `json:"inviteUrl"`
			TripID    string `json:"tripId"`
		} `json:"invite"`
	}
	if err := json.NewDecoder(firstRecorder.Body).Decode(&firstBody); err != nil {
		t.Fatalf("decode create invite response: %v", err)
	}
	if !firstBody.Created || firstBody.Invite.Token == "" || firstBody.Invite.TripID != tripID {
		t.Fatalf("unexpected create invite body: %#v", firstBody)
	}
	if firstBody.Invite.InviteURL != "https://invite.i-um.test/invite/"+firstBody.Invite.Token {
		t.Fatalf("unexpected invite url %q", firstBody.Invite.InviteURL)
	}

	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/invites", nil)
	secondRequest.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, InviteBaseURL: "https://invite.i-um.test"}).ServeHTTP(secondRecorder, secondRequest)
	if secondRecorder.Code != http.StatusOK {
		t.Fatalf("expected reuse invite status %d, got %d with body %s", http.StatusOK, secondRecorder.Code, secondRecorder.Body.String())
	}
	var secondBody struct {
		Created bool `json:"created"`
		Invite  struct {
			Token string `json:"token"`
		} `json:"invite"`
	}
	if err := json.NewDecoder(secondRecorder.Body).Decode(&secondBody); err != nil {
		t.Fatalf("decode reuse invite response: %v", err)
	}
	if secondBody.Created || secondBody.Invite.Token != firstBody.Invite.Token {
		t.Fatalf("expected active invite reuse, got %#v", secondBody)
	}
}

func TestCreateTripInviteValidationAuthAndAuthorization(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	tripID := createTestTrip(t, backend, ownerToken)
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          testUUID(2002),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 9, 0, 0, 0, time.UTC),
	})

	cases := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "auth required", path: "/trips/" + tripID + "/invites", expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/invites", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/invites", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "member forbidden", path: "/trips/" + tripID + "/invites", token: memberToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, nil)
			if tt.token != "" {
				request.Header.Set("Authorization", "Bearer "+tt.token)
			}
			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestAcceptTripInviteHandlerCreatesAndReusesParticipant(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)

	inviteRecorder := httptest.NewRecorder()
	inviteRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/invites", nil)
	inviteRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, InviteBaseURL: "https://invite.i-um.test"}).ServeHTTP(inviteRecorder, inviteRequest)
	if inviteRecorder.Code != http.StatusCreated {
		t.Fatalf("expected invite create status %d, got %d with body %s", http.StatusCreated, inviteRecorder.Code, inviteRecorder.Body.String())
	}
	var inviteBody struct {
		Invite struct {
			Token string `json:"token"`
		} `json:"invite"`
	}
	if err := json.NewDecoder(inviteRecorder.Body).Decode(&inviteBody); err != nil {
		t.Fatalf("decode invite response: %v", err)
	}

	memberSession := loginTestUserSession(t, backend, "apple-2", " 지영 ")
	acceptRecorder := httptest.NewRecorder()
	acceptRequest := httptest.NewRequest(http.MethodPost, "/invites/"+inviteBody.Invite.Token+"/accept", nil)
	acceptRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(acceptRecorder, acceptRequest)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("expected accept status %d, got %d with body %s", http.StatusOK, acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptBody struct {
		TripID          string `json:"tripId"`
		TripName        string `json:"tripName"`
		Role            string `json:"role"`
		AlreadyAccepted bool   `json:"alreadyAccepted"`
	}
	if err := json.NewDecoder(acceptRecorder.Body).Decode(&acceptBody); err != nil {
		t.Fatalf("decode accept response: %v", err)
	}
	if acceptBody.TripID != tripID || acceptBody.TripName != "오사카 3박 4일" || acceptBody.Role != "member" || acceptBody.AlreadyAccepted {
		t.Fatalf("unexpected accept body: %#v", acceptBody)
	}
	if len(backend.participants[tripID]) != 2 || backend.participants[tripID][1].DisplayName != "지영" {
		t.Fatalf("expected owner plus trimmed member participant, got %#v", backend.participants[tripID])
	}

	reuseRecorder := httptest.NewRecorder()
	reuseRequest := httptest.NewRequest(http.MethodPost, "/invites/"+inviteBody.Invite.Token+"/accept", nil)
	reuseRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(reuseRecorder, reuseRequest)
	if reuseRecorder.Code != http.StatusOK {
		t.Fatalf("expected reuse status %d, got %d with body %s", http.StatusOK, reuseRecorder.Code, reuseRecorder.Body.String())
	}
	var reuseBody struct {
		Role            string `json:"role"`
		AlreadyAccepted bool   `json:"alreadyAccepted"`
	}
	if err := json.NewDecoder(reuseRecorder.Body).Decode(&reuseBody); err != nil {
		t.Fatalf("decode reuse response: %v", err)
	}
	if reuseBody.Role != "member" || !reuseBody.AlreadyAccepted || len(backend.participants[tripID]) != 2 {
		t.Fatalf("expected idempotent member response without duplicate, got body=%#v participants=%#v", reuseBody, backend.participants[tripID])
	}

	ownerRecorder := httptest.NewRecorder()
	ownerRequest := httptest.NewRequest(http.MethodPost, "/invites/"+inviteBody.Invite.Token+"/accept", nil)
	ownerRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(ownerRecorder, ownerRequest)
	if ownerRecorder.Code != http.StatusOK {
		t.Fatalf("expected owner status %d, got %d with body %s", http.StatusOK, ownerRecorder.Code, ownerRecorder.Body.String())
	}
	var ownerBody struct {
		Role            string `json:"role"`
		AlreadyAccepted bool   `json:"alreadyAccepted"`
	}
	if err := json.NewDecoder(ownerRecorder.Body).Decode(&ownerBody); err != nil {
		t.Fatalf("decode owner response: %v", err)
	}
	if ownerBody.Role != "owner" || !ownerBody.AlreadyAccepted {
		t.Fatalf("expected owner already accepted response, got %#v", ownerBody)
	}
}

func TestAcceptTripInviteHandlerErrors(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	inviteRecorder := httptest.NewRecorder()
	inviteRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/invites", nil)
	inviteRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(inviteRecorder, inviteRequest)
	if inviteRecorder.Code != http.StatusCreated {
		t.Fatalf("expected invite create status %d, got %d with body %s", http.StatusCreated, inviteRecorder.Code, inviteRecorder.Body.String())
	}
	backend.tripInvites[tripID] = tripdomain.TripInvite{
		ID:        backend.tripInvites[tripID].ID,
		TripID:    tripID,
		Token:     backend.tripInvites[tripID].Token,
		ExpiresAt: time.Now().Add(-time.Hour),
		CreatedAt: backend.tripInvites[tripID].CreatedAt,
		CreatedBy: backend.tripInvites[tripID].CreatedBy,
	}
	expiredToken := backend.tripInvites[tripID].Token

	cases := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "auth required", path: "/invites/valid-token-abcdefghijklmnopqrstuvwxyz123456/accept", expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "malformed token", path: "/invites/short/accept", token: memberToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing invite", path: "/invites/missing-token-abcdefghijklmnopqrstuvwxyz1234/accept", token: memberToken, expectCode: http.StatusNotFound, expectErr: "INVITE_NOT_FOUND"},
		{name: "expired invite", path: "/invites/" + expiredToken + "/accept", token: memberToken, expectCode: http.StatusGone, expectErr: "INVITE_EXPIRED"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, nil)
			if tt.token != "" {
				request.Header.Set("Authorization", "Bearer "+tt.token)
			}
			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestInviteFallbackPageLinksToStore(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/invite/test-token", nil)
	request.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")

	NewRouterWithConfig(backend, Config{AppStoreURL: "https://apps.apple.com/app/test", PlayStoreURL: "https://play.google.com/store/apps/details?id=test"}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "https://apps.apple.com/app/test") || strings.Contains(body, "https://play.google.com/store/apps/details?id=test") {
		t.Fatalf("expected iOS store-only fallback body, got %s", body)
	}
	if strings.Contains(body, "accept") {
		t.Fatalf("fallback page must not attempt web invite acceptance, got %s", body)
	}
}

func TestListTripParticipantsHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	_ = memberToken
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          testUUID(2002),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 9, 0, 0, 0, time.UTC),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/participants", nil)
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Participants []map[string]interface{} `json:"participants"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Participants) != 2 {
		t.Fatalf("expected two participants, got %#v", body.Participants)
	}
	if body.Participants[0]["participantId"] == "" || body.Participants[0]["displayName"] != "민수" || body.Participants[0]["role"] != "owner" || body.Participants[0]["joinedAt"] == "" {
		t.Fatalf("unexpected owner participant: %#v", body.Participants[0])
	}
	if body.Participants[1]["displayName"] != "지영" || body.Participants[1]["role"] != "member" {
		t.Fatalf("unexpected member participant: %#v", body.Participants[1])
	}
	for _, participant := range body.Participants {
		if _, ok := participant["userId"]; ok {
			t.Fatalf("participant list response must not include userId: %#v", participant)
		}
		if _, ok := participant["tripId"]; ok {
			t.Fatalf("participant list response must not include tripId: %#v", participant)
		}
	}
}

func TestListTripParticipantsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000001/participants", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestListTripParticipantsValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/not-a-uuid/participants", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
	}
}

func TestListTripParticipantsNotFound(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000404/participants", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestListTripParticipantsForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/participants", nil)
	request.Header.Set("Authorization", "Bearer "+nonParticipantToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, recorder.Code, recorder.Body.String())
	}
}

func TestGetDayItineraryHandlerReturnsEmpty(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-10/itinerary", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Day struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"day"`
		Items []interface{} `json:"items"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-10" || body.Day.DayOrder != 1 {
		t.Fatalf("unexpected day metadata: %#v", body.Day)
	}
	if len(body.Items) != 0 {
		t.Fatalf("expected empty itinerary items, got %#v", body.Items)
	}
}

func TestGetDayItineraryHandlerReturnsItems(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	backend.dayItineraryItems[tripID+":2026-07-11"] = []tripdomain.DayItineraryItem{
		{
			ID:        "item-1",
			ItemOrder: 1,
			Version:   7,
			Place: tripdomain.TripPlaceSummary{
				ID:        "place-1",
				Name:      "우메다 공중정원",
				PlaceType: "sights",
				Address:   "Umeda",
			},
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/itinerary", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Day struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"day"`
		Items []struct {
			ID        string `json:"id"`
			ItemOrder int    `json:"itemOrder"`
			Version   int    `json:"version"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
		} `json:"items"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-11" || body.Day.DayOrder != 2 {
		t.Fatalf("unexpected day metadata: %#v", body.Day)
	}
	if len(body.Items) != 1 || body.Items[0].ItemOrder != 1 || body.Items[0].Version != 7 || body.Items[0].Place.Name != "우메다 공중정원" || body.Items[0].Place.PlaceType != "sights" || body.Items[0].Place.Address != "Umeda" {
		t.Fatalf("unexpected itinerary items: %#v", body.Items)
	}
}

func TestSetClearDayLodgingPlaceHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	first := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"호텔 니코 오사카","address":"Nishi-Shinsaibashi","placeType":"lodging"}`)
	second := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)

	setRecorder := httptest.NewRecorder()
	setRequest := httptest.NewRequest(http.MethodPut, "/trips/"+tripID+"/days/2026-07-11/lodging-place", bytes.NewReader([]byte(fmt.Sprintf(`{"tripPlaceId":%q}`, first.PlaceID))))
	setRequest.Header.Set("Content-Type", "application/json")
	setRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(setRecorder, setRequest)
	if setRecorder.Code != http.StatusOK {
		t.Fatalf("expected set status %d, got %d with body %s", http.StatusOK, setRecorder.Code, setRecorder.Body.String())
	}
	var setBody map[string]interface{}
	if err := json.NewDecoder(setRecorder.Body).Decode(&setBody); err != nil {
		t.Fatalf("decode set response: %v", err)
	}
	if _, ok := setBody["items"]; ok {
		t.Fatalf("set response must not include full itinerary items: %#v", setBody)
	}
	setDay := setBody["day"].(map[string]interface{})
	setLodging := setBody["lodgingPlace"].(map[string]interface{})
	if setDay["date"] != "2026-07-11" || setDay["dayOrder"] != float64(2) || setLodging["id"] != first.PlaceID || setLodging["name"] != "호텔 니코 오사카" {
		t.Fatalf("unexpected set response: %#v", setBody)
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/itinerary", nil)
	getRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var getBody struct {
		Day struct {
			LodgingPlace *struct {
				ID string `json:"id"`
			} `json:"lodgingPlace"`
		} `json:"day"`
		Items []struct {
			Place struct {
				ID string `json:"id"`
			} `json:"place"`
			IsLodging bool `json:"isLodging"`
		} `json:"items"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&getBody); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if getBody.Day.LodgingPlace == nil || getBody.Day.LodgingPlace.ID != first.PlaceID {
		t.Fatalf("expected day lodging summary, got %#v", getBody.Day.LodgingPlace)
	}
	if len(getBody.Items) != 2 || !getBody.Items[0].IsLodging || getBody.Items[1].IsLodging {
		t.Fatalf("expected only first row to be lodging, got %#v", getBody.Items)
	}

	replaceRecorder := httptest.NewRecorder()
	replaceRequest := httptest.NewRequest(http.MethodPut, "/trips/"+tripID+"/days/2026-07-11/lodging-place", bytes.NewReader([]byte(fmt.Sprintf(`{"tripPlaceId":%q}`, second.PlaceID))))
	replaceRequest.Header.Set("Content-Type", "application/json")
	replaceRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(replaceRecorder, replaceRequest)
	if replaceRecorder.Code != http.StatusOK {
		t.Fatalf("expected replace status %d, got %d with body %s", http.StatusOK, replaceRecorder.Code, replaceRecorder.Body.String())
	}

	clearRecorder := httptest.NewRecorder()
	clearRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/days/2026-07-11/lodging-place", nil)
	clearRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(clearRecorder, clearRequest)
	if clearRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected clear status %d, got %d with body %s", http.StatusNoContent, clearRecorder.Code, clearRecorder.Body.String())
	}

	clearedRecorder := httptest.NewRecorder()
	clearedRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/itinerary", nil)
	clearedRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(clearedRecorder, clearedRequest)
	if clearedRecorder.Code != http.StatusOK {
		t.Fatalf("expected cleared get status %d, got %d with body %s", http.StatusOK, clearedRecorder.Code, clearedRecorder.Body.String())
	}
	var clearedBody struct {
		Day struct {
			LodgingPlace *struct{} `json:"lodgingPlace"`
		} `json:"day"`
		Items []struct {
			IsLodging bool `json:"isLodging"`
		} `json:"items"`
	}
	if err := json.NewDecoder(clearedRecorder.Body).Decode(&clearedBody); err != nil {
		t.Fatalf("decode cleared get response: %v", err)
	}
	if clearedBody.Day.LodgingPlace != nil || clearedBody.Items[0].IsLodging || clearedBody.Items[1].IsLodging {
		t.Fatalf("expected clear to remove lodging state, got %#v", clearedBody)
	}
}

func TestSetDayLodgingPlaceValidationNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"호텔","address":"Address","placeType":"lodging"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	otherOwnerToken := loginTestUserWithSubject(t, backend, "apple-3", "현우")
	otherTripID := createTestTrip(t, backend, otherOwnerToken)
	otherPlace := createTestDayItineraryItem(t, backend, otherOwnerToken, otherTripID, "2026-07-11", `{"name":"다른 호텔","address":"Other","placeType":"lodging"}`)

	tests := []struct {
		name       string
		path       string
		token      string
		body       string
		expectCode int
		expectErr  string
	}{
		{name: "missing tripPlaceId", path: "/trips/" + tripID + "/days/2026-07-11/lodging-place", token: ownerToken, body: `{}`, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "unknown field", path: "/trips/" + tripID + "/days/2026-07-11/lodging-place", token: ownerToken, body: `{"tripPlaceId":"` + created.PlaceID + `","memo":"x"}`, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/lodging-place", token: ownerToken, body: `{"tripPlaceId":"` + created.PlaceID + `"}`, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/lodging-place", token: ownerToken, body: `{"tripPlaceId":"` + created.PlaceID + `"}`, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/lodging-place", token: ownerToken, body: `{"tripPlaceId":"` + created.PlaceID + `"}`, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/lodging-place", token: nonParticipantToken, body: `{"tripPlaceId":"` + created.PlaceID + `"}`, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "cross trip place", path: "/trips/" + tripID + "/days/2026-07-11/lodging-place", token: ownerToken, body: `{"tripPlaceId":"` + otherPlace.PlaceID + `"}`, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPut, tt.path, bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tt.token)
			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestSetDayLodgingPlaceRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-11/lodging-place", bytes.NewReader([]byte(`{"tripPlaceId":"00000000-0000-0000-0000-000000008001"}`)))
	request.Header.Set("Content-Type", "application/json")
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestClearDayLodgingPlaceRequiresAuthAndHandlesEmpty(t *testing.T) {
	backend := newFakeAuthBackend()
	unauthRecorder := httptest.NewRecorder()
	unauthRequest := httptest.NewRequest(http.MethodDelete, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-11/lodging-place", nil)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(unauthRecorder, unauthRequest)
	if unauthRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized status %d, got %d with body %s", http.StatusUnauthorized, unauthRecorder.Code, unauthRecorder.Body.String())
	}

	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	clearRecorder := httptest.NewRecorder()
	clearRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/days/2026-07-11/lodging-place", nil)
	clearRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(clearRecorder, clearRequest)
	if clearRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected empty clear status %d, got %d with body %s", http.StatusNoContent, clearRecorder.Code, clearRecorder.Body.String())
	}
}

func TestGetDayItineraryRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/itinerary", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestGetDayItineraryValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	tests := []string{
		"/trips/not-a-uuid/days/2026-07-10/itinerary",
		"/trips/00000000-0000-0000-0000-000000000001/days/not-a-date/itinerary",
	}
	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)
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
		})
	}
}

func TestGetDayItineraryNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-10/itinerary", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/itinerary", token: nonParticipantToken, expectCode: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestCreateManualDayItineraryItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	requestBody := []byte(`{
		"name":"  우메다 공중정원  ",
		"address":"  Umeda  ",
		"placeType":"sights"
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/itinerary-items", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Day struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"day"`
		Item struct {
			ID        string `json:"id"`
			ItemOrder int    `json:"itemOrder"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
		} `json:"item"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-11" || body.Day.DayOrder != 2 {
		t.Fatalf("unexpected day: %#v", body.Day)
	}
	if body.Item.ItemOrder != 1 || body.Item.Place.Name != "우메다 공중정원" || body.Item.Place.Address != "Umeda" || body.Item.Place.PlaceType != "sights" {
		t.Fatalf("unexpected created item: %#v", body.Item)
	}

	duplicateRecorder := httptest.NewRecorder()
	duplicateRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/itinerary-items", bytes.NewReader(requestBody))
	duplicateRequest.Header.Set("Content-Type", "application/json")
	duplicateRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(duplicateRecorder, duplicateRequest)
	if duplicateRecorder.Code != http.StatusCreated {
		t.Fatalf("expected duplicate status %d, got %d with body %s", http.StatusCreated, duplicateRecorder.Code, duplicateRecorder.Body.String())
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/itinerary", nil)
	getRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var getBody struct {
		Items []struct {
			ItemOrder int `json:"itemOrder"`
		} `json:"items"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&getBody); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if len(getBody.Items) != 2 || getBody.Items[0].ItemOrder != 1 || getBody.Items[1].ItemOrder != 2 {
		t.Fatalf("expected duplicate creates to appear as two appended items, got %#v", getBody.Items)
	}
}

func TestCreateManualDayItineraryItemRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/itinerary-items", bytes.NewReader([]byte(`{
		"name":"우메다",
		"address":"Umeda",
		"placeType":"sights"
	}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestCreateManualDayItineraryItemValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-10/itinerary-items", body: `{"name":"우메다","address":"Umeda","placeType":"sights"}`},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/itinerary-items", body: `{"name":"우메다","address":"Umeda","placeType":"sights"}`},
		{name: "blank name", path: "/trips/" + tripID + "/days/2026-07-10/itinerary-items", body: `{"name":" ","address":"Umeda","placeType":"sights"}`},
		{name: "blank address", path: "/trips/" + tripID + "/days/2026-07-10/itinerary-items", body: `{"name":"우메다","address":" ","placeType":"sights"}`},
		{name: "invalid place type", path: "/trips/" + tripID + "/days/2026-07-10/itinerary-items", body: `{"name":"우메다","address":"Umeda","placeType":"museum"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewReader([]byte(tt.body)))
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
		})
	}
}

func TestCreateManualDayItineraryItemNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-10/itinerary-items", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary-items", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/itinerary-items", token: nonParticipantToken, expectCode: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewReader([]byte(`{"name":"우메다","address":"Umeda","placeType":"sights"}`)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestMarkDayItineraryItemArrivedHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	first := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)

	path := "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + first.ID + "/arrive"
	firstRecorder := httptest.NewRecorder()
	firstRequest := httptest.NewRequest(http.MethodPost, path, nil)
	firstRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(firstRecorder, firstRequest)

	if firstRecorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, firstRecorder.Code, firstRecorder.Body.String())
	}

	var firstBody struct {
		Day struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"day"`
		Item struct {
			ID        string  `json:"id"`
			ArrivedAt *string `json:"arrivedAt"`
		} `json:"item"`
		Items []struct {
			ID        string  `json:"id"`
			ArrivedAt *string `json:"arrivedAt"`
		} `json:"items"`
	}
	if err := json.NewDecoder(firstRecorder.Body).Decode(&firstBody); err != nil {
		t.Fatalf("decode first response: %v", err)
	}
	if firstBody.Day.Date != "2026-07-11" || firstBody.Day.DayOrder != 2 {
		t.Fatalf("unexpected day: %#v", firstBody.Day)
	}
	if firstBody.Item.ID != first.ID || firstBody.Item.ArrivedAt == nil {
		t.Fatalf("expected arrived target item, got %#v", firstBody.Item)
	}
	if len(firstBody.Items) != 2 || firstBody.Items[0].ID != first.ID || firstBody.Items[0].ArrivedAt == nil || firstBody.Items[1].ID != second.ID || firstBody.Items[1].ArrivedAt != nil {
		t.Fatalf("expected full latest snapshot with only first arrived, got %#v", firstBody.Items)
	}

	repeatRecorder := httptest.NewRecorder()
	repeatRequest := httptest.NewRequest(http.MethodPost, path, nil)
	repeatRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(repeatRecorder, repeatRequest)
	if repeatRecorder.Code != http.StatusOK {
		t.Fatalf("expected repeat status %d, got %d with body %s", http.StatusOK, repeatRecorder.Code, repeatRecorder.Body.String())
	}
	var repeatBody struct {
		Item struct {
			ArrivedAt *string `json:"arrivedAt"`
		} `json:"item"`
	}
	if err := json.NewDecoder(repeatRecorder.Body).Decode(&repeatBody); err != nil {
		t.Fatalf("decode repeat response: %v", err)
	}
	if repeatBody.Item.ArrivedAt == nil || *repeatBody.Item.ArrivedAt != *firstBody.Item.ArrivedAt {
		t.Fatalf("expected idempotent repeat to preserve arrivedAt, first=%v repeat=%v", firstBody.Item.ArrivedAt, repeatBody.Item.ArrivedAt)
	}
}

func TestMarkDayItineraryItemArrivedRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/itinerary/items/00000000-0000-0000-0000-000000005001/arrive", nil)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestMarkDayItineraryItemArrivedValidationNotFoundForbiddenAndConflict(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)
	otherDay := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-12", `{"name":"교토","address":"Kyoto","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/itinerary/items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/itinerary/items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/not-a-uuid/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/itinerary/items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary/items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + otherDay.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + first.ID + "/arrive", token: nonParticipantToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "later pending conflict", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + second.ID + "/arrive", token: ownerToken, expectCode: http.StatusConflict, expectErr: "CONFLICT"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+tt.token)
			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestUpdateDayItineraryItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{
		"name":"우메다 공중정원",
		"address":"Umeda",
		"placeType":"sights"
	}`)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID+"/days/2026-07-11/itinerary/items/"+created.ID, bytes.NewReader([]byte(`{
		"name":"  우메다 스카이빌딩  ",
		"placeType":"food"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Item struct {
			ID        string `json:"id"`
			ItemOrder int    `json:"itemOrder"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
		} `json:"item"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Item.ID != created.ID || body.Item.ItemOrder != 1 || body.Item.Place.ID != created.PlaceID || body.Item.Place.Name != "우메다 스카이빌딩" || body.Item.Place.Address != "Umeda" || body.Item.Place.PlaceType != "food" {
		t.Fatalf("unexpected updated item: %#v", body.Item)
	}
}

func TestReorderDayItineraryItemsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-11/itinerary-items/order", bytes.NewReader([]byte(`{"moves":[]}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestReorderDayItineraryItemsValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	second := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)},
		{name: "empty moves", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", body: `{"moves":[]}`},
		{name: "both anchors nil", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":null,"afterItemId":null,"clientVersion":1}]}`, first.ID)},
		{name: "invalid client version", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":0}]}`, first.ID, second.ID)},
		{name: "item not in day", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":1}]}`, testUUID(9999), second.ID)},
		{name: "anchor not in day", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", body: fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":1}]}`, first.ID, testUUID(9999))},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, tt.path, bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+ownerToken)

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
				t.Fatalf("decode error response: %v", err)
			}
			if body.Error.Code != "VALIDATION_ERROR" {
				t.Fatalf("expected VALIDATION_ERROR, got %q", body.Error.Code)
			}
		})
	}
}

func TestReorderDayItineraryItemsNotFoundForbiddenAndConflict(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	second := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	validBody := fmt.Sprintf(`{"moves":[{"itemId":%q,"beforeItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)

	tests := []struct {
		name       string
		path       string
		token      string
		setup      func()
		expectCode int
		expectErr  string
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/itinerary-items/order", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary-items/order", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", token: nonParticipantToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "conflict", path: "/trips/" + tripID + "/days/2026-07-11/itinerary-items/order", token: ownerToken, setup: func() { backend.reorderErr = tripdomain.ErrConflict }, expectCode: http.StatusConflict, expectErr: "CONFLICT"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backend.reorderErr = nil
			if tt.setup != nil {
				tt.setup()
			}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, tt.path, bytes.NewReader([]byte(validBody)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error code %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestUpdateDayItineraryItemValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/itinerary/items/" + created.ID, body: `{"name":"도톤보리"}`},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/itinerary/items/" + created.ID, body: `{"name":"도톤보리"}`},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/not-a-uuid", body: `{"name":"도톤보리"}`},
		{name: "empty patch", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, body: `{}`},
		{name: "unknown field", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, body: `{"memo":"x"}`},
		{name: "blank name", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, body: `{"name":" "}`},
		{name: "invalid place type", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, body: `{"placeType":"museum"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, tt.path, bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+accessToken)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestUpdateDayItineraryItemNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-12/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, token: nonParticipantToken, expectCode: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, tt.path, bytes.NewReader([]byte(`{"name":"도톤보리"}`)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestDeleteDayItineraryItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestDayItineraryItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/days/2026-07-11/itinerary/items/"+created.ID, nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNoContent, recorder.Code, recorder.Body.String())
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("expected empty body, got %q", recorder.Body.String())
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/itinerary", nil)
	getRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var getBody struct {
		Items []interface{} `json:"items"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&getBody); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if len(getBody.Items) != 0 {
		t.Fatalf("expected item to be removed, got %#v", getBody.Items)
	}
}

func TestDeleteDayItineraryItemRequiresAuthBeforeValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/not-a-uuid/days/2026-07-10/itinerary/items/not-a-uuid", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestDeleteDayItineraryItemValidationNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestDayItineraryItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/not-a-uuid", token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-12/itinerary/items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/itinerary/items/" + created.ID, token: nonParticipantToken, expectCode: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodDelete, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestSearchGooglePlacesHandlerReturnsResults(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{results: []placedomain.SearchResult{
		{GooglePlaceID: "google-1", DisplayName: "도톤보리", FormattedAddress: "Osaka", PrimaryType: "tourist_attraction"},
	}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/places/google/search?query=%20%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%20&limit=3", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if provider.input.Query != "도톤보리" || provider.input.Limit != 3 {
		t.Fatalf("expected provider input to be trimmed with limit, got %#v", provider.input)
	}

	var body struct {
		Results []struct {
			GooglePlaceID    string `json:"googlePlaceId"`
			DisplayName      string `json:"displayName"`
			FormattedAddress string `json:"formattedAddress"`
			PrimaryType      string `json:"primaryType"`
		} `json:"results"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Results) != 1 || body.Results[0].GooglePlaceID != "google-1" || body.Results[0].DisplayName != "도톤보리" || body.Results[0].FormattedAddress != "Osaka" || body.Results[0].PrimaryType != "tourist_attraction" {
		t.Fatalf("unexpected search results: %#v", body.Results)
	}
	if len(backend.dayItineraryItems) != 0 {
		t.Fatalf("expected search not to persist itinerary items, got %#v", backend.dayItineraryItems)
	}
}

func TestSearchGooglePlacesRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: &fakePlaceProvider{}}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestSearchGooglePlacesValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	tests := []string{
		"/trips/not-a-uuid/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC",
		"/trips/" + tripID + "/days/not-a-date/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC",
		"/trips/" + tripID + "/days/2026-07-10/places/google/search?query=%EB%8F%84",
		"/trips/" + tripID + "/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC&limit=11",
	}
	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			provider := &fakePlaceProvider{}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)
			request.Header.Set("Authorization", "Bearer "+accessToken)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
			}
			if provider.called {
				t.Fatal("expected invalid request not to call provider")
			}
		})
	}
}

func TestSearchGooglePlacesNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC", token: nonParticipantToken, expectCode: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &fakePlaceProvider{}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			if provider.called {
				t.Fatal("expected auth/range failure not to call provider")
			}
		})
	}
}

func TestSearchGooglePlacesProviderErrors(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	tests := []struct {
		name       string
		err        error
		expectCode int
		expectBody string
	}{
		{name: "unavailable", err: placedomain.ErrProviderUnavailable, expectCode: http.StatusBadGateway, expectBody: "PLACE_PROVIDER_UNAVAILABLE"},
		{name: "rate limited", err: placedomain.ErrProviderRateLimited, expectCode: http.StatusTooManyRequests, expectBody: "PLACE_PROVIDER_RATE_LIMITED"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-10/places/google/search?query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC", nil)
			request.Header.Set("Authorization", "Bearer "+accessToken)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: &fakePlaceProvider{err: tt.err}}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Error.Code != tt.expectBody {
				t.Fatalf("expected error code %q, got %q", tt.expectBody, body.Error.Code)
			}
		})
	}
}

func TestCreateGooglePlaceDayItineraryItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{details: placedomain.GooglePlaceDetails{
		GooglePlaceID:    "google-1",
		DisplayName:      "도톤보리",
		FormattedAddress: "Osaka",
		Latitude:         34.6687,
		Longitude:        135.5013,
		PrimaryType:      "tourist_attraction",
		Types:            []string{"tourist_attraction", "point_of_interest"},
	}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/places/google/itinerary-items", bytes.NewReader([]byte(`{"googlePlaceId":"google-1","duplicateConfirmed":false}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if !provider.detailsCalled || provider.detailsInput.GooglePlaceID != "google-1" {
		t.Fatalf("expected provider details call, got called=%v input=%#v", provider.detailsCalled, provider.detailsInput)
	}

	var body struct {
		Day struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"day"`
		Item struct {
			ItemOrder int `json:"itemOrder"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
		} `json:"item"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-11" || body.Day.DayOrder != 2 || body.Item.ItemOrder != 1 || body.Item.Place.Name != "도톤보리" || body.Item.Place.PlaceType != "sights" {
		t.Fatalf("unexpected response %#v", body)
	}
	if len(backend.dayItineraryItems[tripID+":2026-07-11"]) != 1 {
		t.Fatalf("expected created itinerary item, got %#v", backend.dayItineraryItems)
	}

	provider.detailsCalled = false
	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-12/places/google/itinerary-items", bytes.NewReader([]byte(`{"googlePlaceId":"google-1","duplicateConfirmed":false}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected reuse status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if provider.detailsCalled {
		t.Fatal("expected existing trip Google place to be reused without provider details call")
	}
	if len(backend.tripPlaces) != 1 {
		t.Fatalf("expected one trip place reused across days, got %#v", backend.tripPlaces)
	}
}

func TestCreateGooglePlaceDayItineraryItemDuplicateConfirmation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{details: placedomain.GooglePlaceDetails{
		GooglePlaceID:    "google-dup",
		DisplayName:      "도톤보리",
		FormattedAddress: "Osaka",
		Latitude:         34.6687,
		Longitude:        135.5013,
		PrimaryType:      "tourist_attraction",
		Types:            []string{"tourist_attraction"},
	}}

	create := func(body string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/places/google/itinerary-items", bytes.NewReader([]byte(body)))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+accessToken)
		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)
		return recorder
	}

	if recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":false}`); recorder.Code != http.StatusCreated {
		t.Fatalf("expected first create status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":false}`)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected duplicate status %d, got %d with body %s", http.StatusConflict, recorder.Code, recorder.Body.String())
	}
	var errorBody struct {
		Error struct {
			Code    string                   `json:"code"`
			Details []map[string]interface{} `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&errorBody); err != nil {
		t.Fatalf("decode duplicate error: %v", err)
	}
	if errorBody.Error.Code != "DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED" || len(errorBody.Error.Details) != 1 || errorBody.Error.Details[0]["googlePlaceId"] != "google-dup" || errorBody.Error.Details[0]["tripPlaceId"] == "" {
		t.Fatalf("unexpected duplicate error %#v", errorBody)
	}

	if recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":true}`); recorder.Code != http.StatusCreated {
		t.Fatalf("expected confirmed duplicate status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if len(backend.dayItineraryItems[tripID+":2026-07-11"]) != 2 {
		t.Fatalf("expected confirmed duplicate to create second item, got %#v", backend.dayItineraryItems[tripID+":2026-07-11"])
	}
}

func TestCreateGooglePlaceDayItineraryItemValidationAuthAndProviderErrors(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	tests := []struct {
		name       string
		path       string
		token      string
		body       string
		provider   *fakePlaceProvider
		expectCode int
		expectErr  string
	}{
		{name: "requires auth", path: "/trips/" + tripID + "/days/2026-07-10/places/google/itinerary-items", token: "", body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{}, expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-10/places/google/itinerary-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{}, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "blank google place id", path: "/trips/" + tripID + "/days/2026-07-10/places/google/itinerary-items", token: accessToken, body: `{"googlePlaceId":" ","duplicateConfirmed":false}`, provider: &fakePlaceProvider{}, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/places/google/itinerary-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{}, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/places/google/itinerary-items", token: nonParticipantToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{}, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "provider unavailable", path: "/trips/" + tripID + "/days/2026-07-10/places/google/itinerary-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{detailsErr: placedomain.ErrProviderUnavailable}, expectCode: http.StatusBadGateway, expectErr: "PLACE_PROVIDER_UNAVAILABLE"},
		{name: "provider rate limited", path: "/trips/" + tripID + "/days/2026-07-10/places/google/itinerary-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false}`, provider: &fakePlaceProvider{detailsErr: placedomain.ErrProviderRateLimited}, expectCode: http.StatusTooManyRequests, expectErr: "PLACE_PROVIDER_RATE_LIMITED"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			if tt.token != "" {
				request.Header.Set("Authorization", "Bearer "+tt.token)
			}

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: tt.provider}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Error.Code != tt.expectErr {
				t.Fatalf("expected error code %q, got %q", tt.expectErr, body.Error.Code)
			}
		})
	}
}

func TestUpdateTripHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	requestBody := []byte(`{
		"name":"  오사카 4박 5일  ",
		"endDate":"2026-07-14",
		"defaultCurrency":"USD"
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID, bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
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
			UpdatedAt       string `json:"updatedAt"`
		} `json:"trip"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Trip.ID != tripID || body.Trip.Name != "오사카 4박 5일" {
		t.Fatalf("unexpected updated trip: %#v", body.Trip)
	}
	if body.Trip.StartDate != "2026-07-10" || body.Trip.EndDate != "2026-07-14" || body.Trip.DefaultCurrency != "USD" {
		t.Fatalf("unexpected merged update: %#v", body.Trip)
	}
	if body.Trip.UpdatedAt == "" {
		t.Fatalf("expected updatedAt in response: %#v", body.Trip)
	}
}

func TestUpdateTripAllowsPastDates(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID, bytes.NewReader([]byte(`{
		"startDate":"2026-06-01",
		"endDate":"2026-06-03"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
}

func TestUpdateTripDateRangeUpdatesVirtualDays(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID, bytes.NewReader([]byte(`{
		"startDate":"2026-07-11",
		"endDate":"2026-07-12"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID, nil)
	detailRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(detailRecorder, detailRequest)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected detail status %d, got %d with body %s", http.StatusOK, detailRecorder.Code, detailRecorder.Body.String())
	}
	var body struct {
		Days []struct {
			Date     string `json:"date"`
			DayOrder int    `json:"dayOrder"`
		} `json:"days"`
	}
	if err := json.NewDecoder(detailRecorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	if len(body.Days) != 2 {
		t.Fatalf("expected 2 synced days, got %#v", body.Days)
	}
	if body.Days[0].Date != "2026-07-11" || body.Days[0].DayOrder != 1 || body.Days[1].Date != "2026-07-12" || body.Days[1].DayOrder != 2 {
		t.Fatalf("unexpected synced days: %#v", body.Days)
	}
}

func TestUpdateTripRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/00000000-0000-0000-0000-000000000001", bytes.NewReader([]byte(`{"name":"도쿄"}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestUpdateTripValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid id", path: "/trips/not-a-uuid", body: `{"name":"도쿄"}`},
		{name: "empty patch", path: "/trips/" + tripID, body: `{}`},
		{name: "invalid name", path: "/trips/" + tripID, body: `{"name":" "}`},
		{name: "merged date range", path: "/trips/" + tripID, body: `{"startDate":"2026-07-14"}`},
		{name: "invalid currency", path: "/trips/" + tripID, body: `{"defaultCurrency":"GBP"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPatch, tt.path, bytes.NewReader([]byte(tt.body)))
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
		})
	}
}

func TestUpdateTripNotFound(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/00000000-0000-0000-0000-000000000404", bytes.NewReader([]byte(`{"name":"도쿄"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestUpdateTripForbiddenDoesNotChangeTrip(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          testUUID(2000),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        "member",
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID, bytes.NewReader([]byte(`{"name":"도쿄"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+memberToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, recorder.Code, recorder.Body.String())
	}
	if backend.trips[tripID].Name != "오사카 3박 4일" {
		t.Fatalf("expected forbidden update not to mutate trip, got %#v", backend.trips[tripID])
	}
}

func TestDeleteTripHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID, nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNoContent, recorder.Code, recorder.Body.String())
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("expected empty body, got %q", recorder.Body.String())
	}
	if _, ok := backend.trips[tripID]; ok {
		t.Fatalf("expected trip %s to be deleted", tripID)
	}
	if _, ok := backend.participants[tripID]; ok {
		t.Fatalf("expected participants for %s to be deleted", tripID)
	}

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/trips", nil)
	listRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected list status %d, got %d with body %s", http.StatusOK, listRecorder.Code, listRecorder.Body.String())
	}
	var listBody struct {
		Trips []interface{} `json:"trips"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listBody.Trips) != 0 {
		t.Fatalf("expected deleted trip to be removed from list, got %#v", listBody.Trips)
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID, nil)
	detailRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected deleted detail status %d, got %d with body %s", http.StatusNotFound, detailRecorder.Code, detailRecorder.Body.String())
	}
}

func TestDeleteTripRequiresAuthBeforeValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/not-a-uuid", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestDeleteTripValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/not-a-uuid", nil)
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

func TestDeleteTripNotFound(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/00000000-0000-0000-0000-000000000404", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestDeleteTripForbiddenDoesNotDeleteTrip(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          testUUID(2000),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        "member",
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID, nil)
	request.Header.Set("Authorization", "Bearer "+memberToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusForbidden, recorder.Code, recorder.Body.String())
	}
	if _, ok := backend.trips[tripID]; !ok {
		t.Fatalf("expected forbidden delete not to remove trip %s", tripID)
	}
	if len(backend.participants[tripID]) != 2 {
		t.Fatalf("expected forbidden delete not to remove participants, got %#v", backend.participants[tripID])
	}
}

func TestDeleteTripRetryAfterSuccessReturnsNotFound(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	firstRecorder := httptest.NewRecorder()
	firstRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID, nil)
	firstRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(firstRecorder, firstRequest)
	if firstRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected first delete status %d, got %d with body %s", http.StatusNoContent, firstRecorder.Code, firstRecorder.Body.String())
	}

	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID, nil)
	secondRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(secondRecorder, secondRequest)
	if secondRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected retry status %d, got %d with body %s", http.StatusNotFound, secondRecorder.Code, secondRecorder.Body.String())
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
	users             map[string]auth.User
	identityUser      map[string]string
	sessions          map[string]auth.Session
	deletedUsers      map[string]bool
	trips             map[string]tripdomain.Trip
	participants      map[string][]tripdomain.Participant
	tripPlaces        map[string]tripdomain.TripPlaceSummary
	googleTripPlaces  map[string]string
	dayLodgingPlaces  map[string]tripdomain.TripPlaceSummary
	dayItineraryItems map[string][]tripdomain.DayItineraryItem
	tripInvites       map[string]tripdomain.TripInvite
	reorderErr        error
	arrivalErr        error
	listedTrips       []tripdomain.ListItem
	listTripsUserID   string
	nextUser          int
	nextSession       int
	nextTrip          int
	nextInvite        int
	nextPlace         int
	nextItineraryItem int
}

func loginTestUser(t *testing.T, backend *fakeAuthBackend) string {
	t.Helper()
	return loginTestUserWithSubject(t, backend, "apple-1", "민수")
}

type testUserSession struct {
	AccessToken  string
	RefreshToken string
	UserID       string
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

func loginTestUserSession(t *testing.T, backend *fakeAuthBackend, subject string, displayName string) testUserSession {
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
		User struct {
			ID string `json:"id"`
		} `json:"user"`
		Tokens struct {
			AccessToken  string `json:"accessToken"`
			RefreshToken string `json:"refreshToken"`
		} `json:"tokens"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if body.Tokens.AccessToken == "" || body.Tokens.RefreshToken == "" || body.User.ID == "" {
		t.Fatalf("expected user and tokens, got %#v", body)
	}
	return testUserSession{AccessToken: body.Tokens.AccessToken, RefreshToken: body.Tokens.RefreshToken, UserID: body.User.ID}
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

type createdDayItineraryItem struct {
	ID      string
	PlaceID string
}

func createTestDayItineraryItem(t *testing.T, backend *fakeAuthBackend, accessToken string, tripID string, date string, body string) createdDayItineraryItem {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/"+date+"/itinerary-items", bytes.NewReader([]byte(body)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected create itinerary item status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var response struct {
		Item struct {
			ID    string `json:"id"`
			Place struct {
				ID string `json:"id"`
			} `json:"place"`
		} `json:"item"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode create itinerary item response: %v", err)
	}
	return createdDayItineraryItem{ID: response.Item.ID, PlaceID: response.Item.Place.ID}
}

func newFakeAuthBackend() *fakeAuthBackend {
	return &fakeAuthBackend{
		fakeReadiness:     fakeReadiness{schema: "initialized"},
		users:             map[string]auth.User{},
		identityUser:      map[string]string{},
		sessions:          map[string]auth.Session{},
		deletedUsers:      map[string]bool{},
		trips:             map[string]tripdomain.Trip{},
		participants:      map[string][]tripdomain.Participant{},
		tripPlaces:        map[string]tripdomain.TripPlaceSummary{},
		googleTripPlaces:  map[string]string{},
		dayLodgingPlaces:  map[string]tripdomain.TripPlaceSummary{},
		dayItineraryItems: map[string][]tripdomain.DayItineraryItem{},
		tripInvites:       map[string]tripdomain.TripInvite{},
	}
}

func (b *fakeAuthBackend) FindUserByIdentity(_ context.Context, provider auth.Provider, providerSubject string) (auth.User, bool, error) {
	userID, ok := b.identityUser[string(provider)+":"+providerSubject]
	if !ok || b.deletedUsers[userID] {
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
		if session.RefreshTokenHash == refreshTokenHash && !b.deletedUsers[session.UserID] {
			return session, true, nil
		}
	}
	return auth.Session{}, false, nil
}

func (b *fakeAuthBackend) GetSession(_ context.Context, sessionID string) (auth.Session, bool, error) {
	session, ok := b.sessions[sessionID]
	if !ok || b.deletedUsers[session.UserID] {
		return auth.Session{}, false, nil
	}
	return session, true, nil
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

func (b *fakeAuthBackend) UpdateUserDisplayName(_ context.Context, userID string, displayName string) (auth.User, bool, error) {
	user, ok := b.users[userID]
	if !ok || b.deletedUsers[userID] {
		return auth.User{}, false, nil
	}
	user.DisplayName = displayName
	b.users[userID] = user
	return user, true, nil
}

func (b *fakeAuthBackend) GetUser(_ context.Context, userID string) (auth.User, bool, error) {
	user, ok := b.users[userID]
	if !ok || b.deletedUsers[userID] {
		return auth.User{}, false, nil
	}
	return user, true, nil
}

func (b *fakeAuthBackend) ListProviders(_ context.Context, userID string) ([]auth.Provider, error) {
	if b.deletedUsers[userID] {
		return nil, nil
	}
	return []auth.Provider{auth.ProviderApple}, nil
}

func (b *fakeAuthBackend) DeleteAccount(_ context.Context, userID string, _ time.Time) error {
	user, ok := b.users[userID]
	if !ok || b.deletedUsers[userID] {
		return auth.ErrUnauthorized
	}

	for key, identityUserID := range b.identityUser {
		if identityUserID == userID {
			delete(b.identityUser, key)
		}
	}
	for sessionID, session := range b.sessions {
		if session.UserID == userID {
			delete(b.sessions, sessionID)
		}
	}
	user.DisplayName = "탈퇴한 사용자"
	user.Email = nil
	user.EmailVerified = false
	user.AvatarURL = nil
	b.users[userID] = user
	b.deletedUsers[userID] = true
	return nil
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

func (b *fakeAuthBackend) IsTripOwner(_ context.Context, tripID string, userID string) (bool, error) {
	for _, participant := range b.participants[tripID] {
		if participant.UserID == userID && participant.Role == tripdomain.RoleOwner {
			return true, nil
		}
	}
	return false, nil
}

func (b *fakeAuthBackend) UpdateTripBasicInfo(_ context.Context, record tripdomain.UpdateRecord) (tripdomain.Trip, error) {
	updatedTrip := b.trips[record.ID]
	updatedTrip.Name = record.Name
	updatedTrip.StartDate = record.StartDate.Format("2006-01-02")
	updatedTrip.EndDate = record.EndDate.Format("2006-01-02")
	updatedTrip.DefaultCurrency = record.DefaultCurrency
	updatedTrip.UpdatedAt = updatedTrip.UpdatedAt.Add(time.Hour)
	b.trips[record.ID] = updatedTrip
	return updatedTrip, nil
}

func (b *fakeAuthBackend) DeleteTripByID(_ context.Context, tripID string) (bool, error) {
	if _, ok := b.trips[tripID]; !ok {
		return false, nil
	}
	delete(b.trips, tripID)
	delete(b.participants, tripID)
	delete(b.tripInvites, tripID)
	return true, nil
}

func (b *fakeAuthBackend) CreateOrReturnTripInvite(_ context.Context, record tripdomain.CreateTripInviteRecord) (tripdomain.CreateTripInviteResult, error) {
	if _, ok := b.trips[record.TripID]; !ok {
		return tripdomain.CreateTripInviteResult{}, tripdomain.ErrNotFound
	}
	if current, ok := b.tripInvites[record.TripID]; ok && current.ExpiresAt.After(record.Now) {
		return tripdomain.CreateTripInviteResult{Invite: current, Created: false}, nil
	}
	b.nextInvite++
	invite := tripdomain.TripInvite{
		ID:        testUUID(4000 + b.nextInvite),
		TripID:    record.TripID,
		Token:     record.Token,
		ExpiresAt: record.ExpiresAt,
		CreatedAt: record.Now,
		CreatedBy: record.CreatedBy,
	}
	b.tripInvites[record.TripID] = invite
	return tripdomain.CreateTripInviteResult{Invite: invite, Created: true}, nil
}

func (b *fakeAuthBackend) AcceptTripInvite(_ context.Context, record tripdomain.AcceptTripInviteRecord) (tripdomain.AcceptTripInviteResult, error) {
	var foundInvite tripdomain.TripInvite
	for _, invite := range b.tripInvites {
		if invite.Token == record.Token {
			foundInvite = invite
			break
		}
	}
	if foundInvite.ID == "" {
		return tripdomain.AcceptTripInviteResult{}, tripdomain.ErrInviteNotFound
	}
	if !foundInvite.ExpiresAt.After(record.Now) {
		return tripdomain.AcceptTripInviteResult{}, tripdomain.ErrInviteExpired
	}
	foundTrip, ok := b.trips[foundInvite.TripID]
	if !ok {
		return tripdomain.AcceptTripInviteResult{}, tripdomain.ErrInviteNotFound
	}
	for _, participant := range b.participants[foundInvite.TripID] {
		if participant.UserID == record.UserID {
			return tripdomain.AcceptTripInviteResult{TripID: foundInvite.TripID, TripName: foundTrip.Name, Role: participant.Role, AlreadyAccepted: true}, nil
		}
	}
	user, ok := b.users[record.UserID]
	if !ok {
		return tripdomain.AcceptTripInviteResult{}, tripdomain.ErrUnauthorized
	}
	b.nextInvite++
	b.participants[foundInvite.TripID] = append(b.participants[foundInvite.TripID], tripdomain.Participant{
		ID:          testUUID(7000 + b.nextInvite),
		TripID:      foundInvite.TripID,
		UserID:      record.UserID,
		Role:        tripdomain.RoleMember,
		DisplayName: tripdomain.NormalizeParticipantDisplayName(user.DisplayName),
		JoinedAt:    record.Now,
	})
	return tripdomain.AcceptTripInviteResult{TripID: foundInvite.TripID, TripName: foundTrip.Name, Role: tripdomain.RoleMember, AlreadyAccepted: false}, nil
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

func (b *fakeAuthBackend) ListDayLodgingPlacesByTrip(_ context.Context, tripID string) ([]tripdomain.DayLodgingPlace, error) {
	lodgingPlaces := []tripdomain.DayLodgingPlace{}
	for key, place := range b.dayLodgingPlaces {
		if !strings.HasPrefix(key, tripID+":") {
			continue
		}
		lodgingPlaces = append(lodgingPlaces, tripdomain.DayLodgingPlace{Date: strings.TrimPrefix(key, tripID+":"), Place: place})
	}
	sort.Slice(lodgingPlaces, func(i, j int) bool { return lodgingPlaces[i].Date < lodgingPlaces[j].Date })
	return lodgingPlaces, nil
}

func (b *fakeAuthBackend) GetDayLodgingPlaceByTripAndDate(_ context.Context, tripID string, date string) (tripdomain.TripPlaceSummary, bool, error) {
	place, ok := b.dayLodgingPlaces[tripID+":"+date]
	return place, ok, nil
}

func (b *fakeAuthBackend) GetTripPlaceSummaryByTripAndPlace(_ context.Context, tripID string, tripPlaceID string) (tripdomain.TripPlaceSummary, bool, error) {
	place, ok := b.tripPlaces[tripID+":"+tripPlaceID]
	return place, ok, nil
}

func (b *fakeAuthBackend) GetGoogleTripPlaceByGooglePlaceID(_ context.Context, tripID string, googlePlaceID string) (tripdomain.TripPlaceSummary, bool, error) {
	placeID, ok := b.googleTripPlaces[tripID+":"+googlePlaceID]
	if !ok {
		return tripdomain.TripPlaceSummary{}, false, nil
	}
	place, ok := b.tripPlaces[tripID+":"+placeID]
	return place, ok, nil
}

func (b *fakeAuthBackend) SetDayLodgingPlace(_ context.Context, record tripdomain.SetDayLodgingPlaceRecord) (tripdomain.TripPlaceSummary, error) {
	place, ok := b.tripPlaces[record.TripID+":"+record.TripPlaceID]
	if !ok {
		return tripdomain.TripPlaceSummary{}, tripdomain.ErrNotFound
	}
	b.dayLodgingPlaces[record.TripID+":"+record.ScheduledDate] = place
	b.markDayItineraryLodging(record.TripID, record.ScheduledDate)
	return place, nil
}

func (b *fakeAuthBackend) DeleteDayLodgingPlace(_ context.Context, tripID string, date string) error {
	delete(b.dayLodgingPlaces, tripID+":"+date)
	b.markDayItineraryLodging(tripID, date)
	return nil
}

func (b *fakeAuthBackend) ListItineraryItemsByTripAndDate(_ context.Context, tripID string, date string) ([]tripdomain.DayItineraryItem, error) {
	b.markDayItineraryLodging(tripID, date)
	return b.dayItineraryItems[tripID+":"+date], nil
}

func (b *fakeAuthBackend) CreateManualDayItineraryItem(_ context.Context, record tripdomain.CreateManualDayItineraryItemRecord) (tripdomain.DayItineraryItem, error) {
	b.nextPlace++
	b.nextItineraryItem++
	key := record.TripID + ":" + record.ScheduledDate
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		PlaceType: record.PlaceType,
		Address:   record.Address,
	}
	item := tripdomain.DayItineraryItem{
		ID:        testUUID(5000 + b.nextItineraryItem),
		ItemOrder: len(b.dayItineraryItems[key]) + 1,
		Version:   1,
		Place:     place,
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.dayItineraryItems[key] = append(b.dayItineraryItems[key], item)
	b.markDayItineraryLodging(record.TripID, record.ScheduledDate)
	return item, nil
}

func (b *fakeAuthBackend) AppendGooglePlaceDayItineraryItem(_ context.Context, record placedomain.AppendGooglePlaceDayItineraryItemRecord) (tripdomain.DayItineraryItem, error) {
	place, ok := b.tripPlaces[record.TripID+":"+record.TripPlaceID]
	if !ok {
		return tripdomain.DayItineraryItem{}, placedomain.ErrNotFound
	}
	key := record.TripID + ":" + record.ScheduledDate
	if !record.DuplicateConfirmed {
		for _, item := range b.dayItineraryItems[key] {
			if item.Place.ID == record.TripPlaceID {
				return tripdomain.DayItineraryItem{}, placedomain.DuplicateDayPlaceConfirmationError{TripPlaceID: record.TripPlaceID}
			}
		}
	}
	b.nextItineraryItem++
	item := tripdomain.DayItineraryItem{
		ID:        testUUID(5000 + b.nextItineraryItem),
		ItemOrder: len(b.dayItineraryItems[key]) + 1,
		Version:   1,
		Place:     place,
	}
	b.dayItineraryItems[key] = append(b.dayItineraryItems[key], item)
	b.markDayItineraryLodging(record.TripID, record.ScheduledDate)
	return item, nil
}

func (b *fakeAuthBackend) CreateGooglePlaceDayItineraryItem(ctx context.Context, record placedomain.CreateGooglePlaceDayItineraryItemRecord) (tripdomain.DayItineraryItem, error) {
	if placeID, ok := b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID]; ok {
		return b.AppendGooglePlaceDayItineraryItem(ctx, placedomain.AppendGooglePlaceDayItineraryItemRecord{
			TripID:             record.TripID,
			ScheduledDate:      record.ScheduledDate,
			TripPlaceID:        placeID,
			DuplicateConfirmed: record.DuplicateConfirmed,
		})
	}

	b.nextPlace++
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		PlaceType: record.PlaceType,
		Address:   record.Address,
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID] = place.ID
	return b.AppendGooglePlaceDayItineraryItem(ctx, placedomain.AppendGooglePlaceDayItineraryItemRecord{
		TripID:             record.TripID,
		ScheduledDate:      record.ScheduledDate,
		TripPlaceID:        place.ID,
		DuplicateConfirmed: record.DuplicateConfirmed,
	})
}

func (b *fakeAuthBackend) GetItineraryItemByTripDateAndID(_ context.Context, tripID string, date string, itemID string) (tripdomain.DayItineraryItem, bool, error) {
	for _, item := range b.dayItineraryItems[tripID+":"+date] {
		if item.ID == itemID {
			return item, true, nil
		}
	}
	return tripdomain.DayItineraryItem{}, false, nil
}

func (b *fakeAuthBackend) ReorderDayItineraryItems(_ context.Context, record tripdomain.ReorderDayItineraryItemsRecord) ([]tripdomain.DayItineraryItem, error) {
	if b.reorderErr != nil {
		return nil, b.reorderErr
	}
	return b.dayItineraryItems[record.TripID+":"+record.ScheduledDate], nil
}

func (b *fakeAuthBackend) MarkDayItineraryItemArrived(_ context.Context, record tripdomain.MarkDayItineraryItemArrivedRecord) (tripdomain.MarkDayItineraryItemArrivedMutationResult, error) {
	if b.arrivalErr != nil {
		return tripdomain.MarkDayItineraryItemArrivedMutationResult{}, b.arrivalErr
	}

	key := record.TripID + ":" + record.ScheduledDate
	items := b.dayItineraryItems[key]
	targetIndex := -1
	firstPendingIndex := -1
	for index, item := range items {
		if targetIndex < 0 && item.ID == record.ItemID {
			targetIndex = index
		}
		if firstPendingIndex < 0 && item.ArrivedAt == nil {
			firstPendingIndex = index
		}
	}
	if targetIndex < 0 {
		return tripdomain.MarkDayItineraryItemArrivedMutationResult{}, tripdomain.ErrNotFound
	}

	if items[targetIndex].ArrivedAt == nil {
		if firstPendingIndex < 0 || firstPendingIndex != targetIndex {
			return tripdomain.MarkDayItineraryItemArrivedMutationResult{}, tripdomain.ErrConflict
		}
		arrivedAt := time.Date(2026, 7, 10, 9, 30, 0, 0, time.UTC)
		items[targetIndex].ArrivedAt = &arrivedAt
		b.dayItineraryItems[key] = items
	}

	b.markDayItineraryLodging(record.TripID, record.ScheduledDate)
	items = b.dayItineraryItems[key]
	return tripdomain.MarkDayItineraryItemArrivedMutationResult{Item: items[targetIndex], Items: items}, nil
}

func (b *fakeAuthBackend) UpdateDayItineraryItemPlace(_ context.Context, record tripdomain.UpdateDayItineraryItemRecord) (tripdomain.DayItineraryItem, error) {
	var updated tripdomain.DayItineraryItem
	for key, items := range b.dayItineraryItems {
		if !strings.HasPrefix(key, record.TripID+":") {
			continue
		}
		for index, item := range items {
			if key == record.TripID+":"+record.ScheduledDate && item.ID == record.ItemID {
				item.Place.Name = record.Name
				item.Place.Address = record.Address
				item.Place.PlaceType = record.PlaceType
				updated = item
				items[index] = item
				b.dayItineraryItems[key] = items
				break
			}
		}
	}
	if updated.ID == "" {
		return tripdomain.DayItineraryItem{}, tripdomain.ErrNotFound
	}
	b.tripPlaces[record.TripID+":"+updated.Place.ID] = updated.Place
	for lodgingKey, lodgingPlace := range b.dayLodgingPlaces {
		if strings.HasPrefix(lodgingKey, record.TripID+":") && lodgingPlace.ID == updated.Place.ID {
			b.dayLodgingPlaces[lodgingKey] = updated.Place
		}
	}
	for key, items := range b.dayItineraryItems {
		if !strings.HasPrefix(key, record.TripID+":") {
			continue
		}
		for index, item := range items {
			if item.Place.ID == updated.Place.ID {
				item.Place = updated.Place
				items[index] = item
			}
		}
		b.dayItineraryItems[key] = items
	}
	return updated, nil
}

func (b *fakeAuthBackend) DeleteDayItineraryItem(_ context.Context, tripID string, date string, itemID string) (bool, error) {
	key := tripID + ":" + date
	items := b.dayItineraryItems[key]
	for index, item := range items {
		if item.ID != itemID {
			continue
		}
		placeID := item.Place.ID
		b.dayItineraryItems[key] = append(items[:index], items[index+1:]...)
		if !b.hasItineraryPlace(tripID, placeID) && !b.hasDayLodgingPlace(tripID, placeID) {
			delete(b.tripPlaces, tripID+":"+placeID)
			for lodgingKey, lodgingPlace := range b.dayLodgingPlaces {
				if strings.HasPrefix(lodgingKey, tripID+":") && lodgingPlace.ID == placeID {
					delete(b.dayLodgingPlaces, lodgingKey)
				}
			}
		}
		b.markDayItineraryLodging(tripID, date)
		return true, nil
	}
	return false, nil
}

func (b *fakeAuthBackend) ListTripParticipants(_ context.Context, tripID string) ([]tripdomain.ParticipantListItem, error) {
	participants := append([]tripdomain.Participant(nil), b.participants[tripID]...)
	sort.Slice(participants, func(i, j int) bool {
		leftRoleRank := 1
		if participants[i].Role == tripdomain.RoleOwner {
			leftRoleRank = 0
		}
		rightRoleRank := 1
		if participants[j].Role == tripdomain.RoleOwner {
			rightRoleRank = 0
		}
		if leftRoleRank != rightRoleRank {
			return leftRoleRank < rightRoleRank
		}
		if !participants[i].JoinedAt.Equal(participants[j].JoinedAt) {
			return participants[i].JoinedAt.Before(participants[j].JoinedAt)
		}
		return participants[i].ID < participants[j].ID
	})

	items := make([]tripdomain.ParticipantListItem, 0, len(participants))
	for _, participant := range participants {
		items = append(items, tripdomain.ParticipantListItem{
			ParticipantID: participant.ID,
			DisplayName:   participant.DisplayName,
			Role:          participant.Role,
			JoinedAt:      participant.JoinedAt,
		})
	}
	return items, nil
}

func (b *fakeAuthBackend) markDayItineraryLodging(tripID string, date string) {
	key := tripID + ":" + date
	lodgingPlace, ok := b.dayLodgingPlaces[key]
	items := b.dayItineraryItems[key]
	for index, item := range items {
		item.IsLodging = ok && item.Place.ID == lodgingPlace.ID
		items[index] = item
	}
	b.dayItineraryItems[key] = items
}

func (b *fakeAuthBackend) hasItineraryPlace(tripID string, placeID string) bool {
	for key, items := range b.dayItineraryItems {
		if !strings.HasPrefix(key, tripID+":") {
			continue
		}
		for _, item := range items {
			if item.Place.ID == placeID {
				return true
			}
		}
	}
	return false
}

func (b *fakeAuthBackend) hasDayLodgingPlace(tripID string, placeID string) bool {
	for key, place := range b.dayLodgingPlaces {
		if strings.HasPrefix(key, tripID+":") && place.ID == placeID {
			return true
		}
	}
	return false
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
				ID:               foundTrip.ID,
				Name:             foundTrip.Name,
				StartDate:        foundTrip.StartDate,
				EndDate:          foundTrip.EndDate,
				DefaultCurrency:  foundTrip.DefaultCurrency,
				JoinedAt:         participant.JoinedAt,
				CreatedAt:        foundTrip.CreatedAt,
				MyRole:           participant.Role,
				ParticipantCount: len(participants),
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

type fakePlaceProvider struct {
	called        bool
	input         placedomain.ProviderSearchInput
	results       []placedomain.SearchResult
	err           error
	detailsCalled bool
	detailsInput  placedomain.ProviderDetailsInput
	details       placedomain.GooglePlaceDetails
	detailsErr    error
}

func (p *fakePlaceProvider) Search(_ context.Context, input placedomain.ProviderSearchInput) ([]placedomain.SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}

func (p *fakePlaceProvider) Details(_ context.Context, input placedomain.ProviderDetailsInput) (placedomain.GooglePlaceDetails, error) {
	p.detailsCalled = true
	p.detailsInput = input
	return p.details, p.detailsErr
}

func testUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}
