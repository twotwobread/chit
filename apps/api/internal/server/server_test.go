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
	routedomain "github.com/twotwobread/i-um/apps/api/internal/route"
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
		"defaultCurrency":"JPY",
		"destinations":[{
			"cityName":"오사카",
			"countryName":"일본",
			"countryCode":"JP",
			"displayName":"오사카, 일본",
			"latitude":34.6937,
			"longitude":135.5023,
			"radiusMeters":25000,
			"provider":"google",
			"providerPlaceId":"google-city-osaka"
		}]
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
			Destinations    []struct {
				DisplayName     string `json:"displayName"`
				ProviderPlaceID string `json:"providerPlaceId"`
				SortOrder       int    `json:"sortOrder"`
			} `json:"destinations"`
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
	if len(body.Trip.Destinations) != 1 || body.Trip.Destinations[0].DisplayName != "오사카, 일본" || body.Trip.Destinations[0].ProviderPlaceID != "google-city-osaka" || body.Trip.Destinations[0].SortOrder != 0 {
		t.Fatalf("expected created trip destination in response, got %#v", body.Trip.Destinations)
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

func TestGetMySettlementSummaryHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	currentParticipant := backend.participants[tripID][0]
	friendParticipant := tripdomain.Participant{ID: testUUID(9002), TripID: tripID, UserID: "friend-1", Role: tripdomain.RoleMember, DisplayName: "지영", JoinedAt: currentParticipant.JoinedAt.Add(time.Hour)}
	backend.participants[tripID] = append(backend.participants[tripID], friendParticipant)
	backend.dayExpenses[tripID+":2026-07-10"] = []tripdomain.DayExpenseListItem{
		{
			ID:           testUUID(9101),
			AnchorType:   "trip_day",
			TripDayID:    testStringPtr("2026-07-10"),
			ExpenseDate:  "2026-07-10",
			DisplayTitle: "점심",
			AmountMinor:  1000,
			Currency:     "JPY",
			Payer:        tripdomain.ExpenseParticipantDisplay{ParticipantID: &friendParticipant.ID, DisplayName: friendParticipant.DisplayName, Source: tripdomain.ExpenseDisplaySourceLive},
			SplitPolicy:  "equal",
			CreatedAt:    time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
			Splits: []tripdomain.DayExpenseSplitListItem{
				{SplitOrder: 0, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &currentParticipant.ID, DisplayName: currentParticipant.DisplayName, Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 500},
				{SplitOrder: 1, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &friendParticipant.ID, DisplayName: friendParticipant.DisplayName, Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 500},
			},
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/me/settlement-summary", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if backend.listTripsUserID != "user-1" {
		t.Fatalf("expected list user user-1, got %q", backend.listTripsUserID)
	}

	var body struct {
		Trips []struct {
			TripID            string `json:"tripId"`
			TripName          string `json:"tripName"`
			StartDate         string `json:"startDate"`
			EndDate           string `json:"endDate"`
			DefaultCurrency   string `json:"defaultCurrency"`
			CurrencySummaries []struct {
				Currency  string `json:"currency"`
				Direction string `json:"direction"`
				NetMinor  int64  `json:"netMinor"`
			} `json:"currencySummaries"`
		} `json:"trips"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Trips) != 1 {
		t.Fatalf("expected one settlement trip, got %#v", body.Trips)
	}
	tripSummary := body.Trips[0]
	if tripSummary.TripID != tripID || tripSummary.TripName == "" || tripSummary.StartDate != "2026-07-10" || tripSummary.EndDate != "2026-07-13" || tripSummary.DefaultCurrency != "JPY" {
		t.Fatalf("unexpected trip summary metadata: %#v", tripSummary)
	}
	if len(tripSummary.CurrencySummaries) != 1 || tripSummary.CurrencySummaries[0].Currency != "JPY" || tripSummary.CurrencySummaries[0].Direction != "send" || tripSummary.CurrencySummaries[0].NetMinor != 500 {
		t.Fatalf("unexpected currency summaries: %#v", tripSummary.CurrencySummaries)
	}
}

func TestGetMySettlementSummaryRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/me/settlement-summary", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestGetMySettlementSummaryDataInconsistent(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	currentParticipant := backend.participants[tripID][0]
	backend.dayExpenses[tripID+":2026-07-10"] = []tripdomain.DayExpenseListItem{
		{
			ID:           testUUID(9201),
			AnchorType:   "trip_day",
			TripDayID:    testStringPtr("2026-07-10"),
			ExpenseDate:  "2026-07-10",
			DisplayTitle: "점심",
			AmountMinor:  1000,
			Currency:     "JPY",
			Payer:        tripdomain.ExpenseParticipantDisplay{ParticipantID: &currentParticipant.ID, DisplayName: currentParticipant.DisplayName, Source: tripdomain.ExpenseDisplaySourceLive},
			SplitPolicy:  "manual",
			CreatedAt:    time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
			Splits:       []tripdomain.DayExpenseSplitListItem{{SplitOrder: 0, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &currentParticipant.ID, DisplayName: currentParticipant.DisplayName, Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 900}},
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/me/settlement-summary", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusConflict, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "SETTLEMENT_SUMMARY_UNAVAILABLE" {
		t.Fatalf("expected SETTLEMENT_SUMMARY_UNAVAILABLE, got %q", body.Error.Code)
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

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/trips", nil)
	listRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected member list status %d, got %d with body %s", http.StatusOK, listRecorder.Code, listRecorder.Body.String())
	}
	var listBody struct {
		Trips []struct {
			ID               string `json:"id"`
			Name             string `json:"name"`
			MyRole           string `json:"myRole"`
			ParticipantCount int    `json:"participantCount"`
		} `json:"trips"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode member list response: %v", err)
	}
	if len(listBody.Trips) != 1 {
		t.Fatalf("expected accepted trip in member list, got %#v", listBody.Trips)
	}
	if listBody.Trips[0].ID != tripID || listBody.Trips[0].Name != "오사카 3박 4일" || listBody.Trips[0].MyRole != "member" || listBody.Trips[0].ParticipantCount != 2 {
		t.Fatalf("expected accepted trip to be listed as member, got %#v", listBody.Trips[0])
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

func TestGetTripSettlementHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	ownerParticipant := backend.participants[tripID][0]
	memberParticipantID := testUUID(2202)
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          memberParticipantID,
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    ownerParticipant.JoinedAt.Add(time.Hour),
	})

	ownerID := ownerParticipant.ID
	backend.dayExpenses[tripID+":2026-07-10"] = []tripdomain.DayExpenseListItem{
		{
			ID:          testUUID(3301),
			AmountMinor: 1000,
			Currency:    "JPY",
			Payer:       tripdomain.ExpenseParticipantDisplay{ParticipantID: &ownerID, DisplayName: "민수", Source: tripdomain.ExpenseDisplaySourceLive},
			Splits: []tripdomain.DayExpenseSplitListItem{
				{SplitOrder: 1, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &ownerID, DisplayName: "민수", Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 500},
				{SplitOrder: 2, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &memberParticipantID, DisplayName: "지영", Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 500},
			},
			CreatedAt: time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/settlement", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var body struct {
		TripID            string `json:"tripId"`
		DefaultCurrency   string `json:"defaultCurrency"`
		CurrencySummaries []struct {
			Currency        string `json:"currency"`
			TotalPaidMinor  int64  `json:"totalPaidMinor"`
			TotalShareMinor int64  `json:"totalShareMinor"`
			Balances        []struct {
				Participant struct {
					ParticipantID     *string `json:"participantId"`
					DisplayName       string  `json:"displayName"`
					ParticipantStatus string  `json:"participantStatus"`
				} `json:"participant"`
				PaidMinor  int64 `json:"paidMinor"`
				ShareMinor int64 `json:"shareMinor"`
				NetMinor   int64 `json:"netMinor"`
			} `json:"balances"`
			SuggestedTransfers []struct {
				AmountMinor     int64 `json:"amountMinor"`
				FromParticipant struct {
					ParticipantID *string `json:"participantId"`
					DisplayName   string  `json:"displayName"`
				} `json:"fromParticipant"`
				ToParticipant struct {
					ParticipantID *string `json:"participantId"`
					DisplayName   string  `json:"displayName"`
				} `json:"toParticipant"`
			} `json:"suggestedTransfers"`
		} `json:"currencySummaries"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode settlement response: %v", err)
	}
	if body.TripID != tripID || body.DefaultCurrency != "JPY" || len(body.CurrencySummaries) != 1 {
		t.Fatalf("unexpected settlement body: %#v", body)
	}
	summary := body.CurrencySummaries[0]
	if summary.Currency != "JPY" || summary.TotalPaidMinor != 1000 || summary.TotalShareMinor != 1000 || len(summary.Balances) != 2 || len(summary.SuggestedTransfers) != 1 {
		t.Fatalf("unexpected settlement summary: %#v", summary)
	}
	if summary.SuggestedTransfers[0].FromParticipant.DisplayName != "지영" || summary.SuggestedTransfers[0].ToParticipant.DisplayName != "민수" || summary.SuggestedTransfers[0].AmountMinor != 500 {
		t.Fatalf("unexpected transfer: %#v", summary.SuggestedTransfers[0])
	}
}

func TestGetTripSettlementDataInconsistent(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	ownerParticipant := backend.participants[tripID][0]
	ownerID := ownerParticipant.ID
	backend.dayExpenses[tripID+":2026-07-10"] = []tripdomain.DayExpenseListItem{
		{
			ID:          testUUID(3301),
			AmountMinor: 1000,
			Currency:    "JPY",
			Payer:       tripdomain.ExpenseParticipantDisplay{ParticipantID: &ownerID, DisplayName: "민수", Source: tripdomain.ExpenseDisplaySourceLive},
			Splits: []tripdomain.DayExpenseSplitListItem{
				{SplitOrder: 1, Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &ownerID, DisplayName: "민수", Source: tripdomain.ExpenseDisplaySourceLive}, AmountMinor: 999},
			},
			CreatedAt: time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC),
		},
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/settlement", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusConflict, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if body.Error.Code != "SETTLEMENT_DATA_INCONSISTENT" {
		t.Fatalf("unexpected error body: %#v", body)
	}
}

func TestRemoveTripParticipantHandlerRemovesMemberAndAllowsReinvite(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberSession := loginTestUserSession(t, backend, "apple-2", "지영")
	memberParticipantID := testUUID(2002)
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          memberParticipantID,
		TripID:      tripID,
		UserID:      memberSession.UserID,
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 9, 0, 0, 0, time.UTC),
	})

	inviteRecorder := httptest.NewRecorder()
	inviteRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/invites", nil)
	inviteRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(inviteRecorder, inviteRequest)
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

	removeRecorder := httptest.NewRecorder()
	removeRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/participants/"+memberParticipantID, nil)
	removeRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(removeRecorder, removeRequest)
	if removeRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected remove status %d, got %d with body %s", http.StatusNoContent, removeRecorder.Code, removeRecorder.Body.String())
	}
	if removeRecorder.Body.Len() != 0 {
		t.Fatalf("expected empty remove body, got %q", removeRecorder.Body.String())
	}
	if len(backend.participants[tripID]) != 1 || backend.participants[tripID][0].Role != tripdomain.RoleOwner {
		t.Fatalf("expected only owner participant after removal, got %#v", backend.participants[tripID])
	}

	retryRecorder := httptest.NewRecorder()
	retryRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/participants/"+memberParticipantID, nil)
	retryRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(retryRecorder, retryRequest)
	if retryRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected retry after successful removal status %d, got %d with body %s", http.StatusNotFound, retryRecorder.Code, retryRecorder.Body.String())
	}

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/trips", nil)
	listRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected member list status %d, got %d with body %s", http.StatusOK, listRecorder.Code, listRecorder.Body.String())
	}
	var listBody struct {
		Trips []interface{} `json:"trips"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode member list response: %v", err)
	}
	if len(listBody.Trips) != 0 {
		t.Fatalf("expected removed member trip list to be empty, got %#v", listBody.Trips)
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID, nil)
	detailRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected removed member detail status %d, got %d with body %s", http.StatusForbidden, detailRecorder.Code, detailRecorder.Body.String())
	}

	acceptRecorder := httptest.NewRecorder()
	acceptRequest := httptest.NewRequest(http.MethodPost, "/invites/"+inviteBody.Invite.Token+"/accept", nil)
	acceptRequest.Header.Set("Authorization", "Bearer "+memberSession.AccessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(acceptRecorder, acceptRequest)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("expected re-accept status %d, got %d with body %s", http.StatusOK, acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptBody struct {
		Role            string `json:"role"`
		AlreadyAccepted bool   `json:"alreadyAccepted"`
	}
	if err := json.NewDecoder(acceptRecorder.Body).Decode(&acceptBody); err != nil {
		t.Fatalf("decode re-accept response: %v", err)
	}
	if acceptBody.Role != "member" || acceptBody.AlreadyAccepted || len(backend.participants[tripID]) != 2 {
		t.Fatalf("expected removed member to rejoin as a new member, got body=%#v participants=%#v", acceptBody, backend.participants[tripID])
	}
}

func TestRemoveTripParticipantErrors(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	memberToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	memberParticipantID := testUUID(2002)
	backend.participants[tripID] = append(backend.participants[tripID], tripdomain.Participant{
		ID:          memberParticipantID,
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 9, 0, 0, 0, time.UTC),
	})
	otherTripID := createTestTrip(t, backend, ownerToken)
	wrongTripParticipantID := testUUID(2003)
	backend.participants[otherTripID] = append(backend.participants[otherTripID], tripdomain.Participant{
		ID:          wrongTripParticipantID,
		TripID:      otherTripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 23, 9, 0, 0, 0, time.UTC),
	})
	ownerParticipantID := backend.participants[tripID][0].ID

	cases := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "auth required", path: "/trips/" + tripID + "/participants/" + memberParticipantID, expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/participants/" + memberParticipantID, token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid participant id", path: "/trips/" + tripID + "/participants/not-a-uuid", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/participants/" + memberParticipantID, token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "member forbidden", path: "/trips/" + tripID + "/participants/" + memberParticipantID, token: memberToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "owner target not removable", path: "/trips/" + tripID + "/participants/" + ownerParticipantID, token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "missing participant", path: "/trips/" + tripID + "/participants/00000000-0000-0000-0000-000000000999", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "wrong trip participant", path: "/trips/" + tripID + "/participants/" + wrongTripParticipantID, token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodDelete, tt.path, nil)
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
	if len(backend.participants[tripID]) != 2 {
		t.Fatalf("expected failed removals not to mutate participants, got %#v", backend.participants[tripID])
	}
}

func TestGetDayScheduleItemsHandlerReturnsEmpty(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-10/schedule-items", nil)
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
		Items []interface{} `json:"scheduleItems"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-10" || body.Day.DayOrder != 1 {
		t.Fatalf("unexpected day metadata: %#v", body.Day)
	}
	if len(body.Items) != 0 {
		t.Fatalf("expected empty schedule items, got %#v", body.Items)
	}
}

func TestGetDayScheduleItemsHandlerReturnsItems(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	backend.dayScheduleItems[tripID+":2026-07-11"] = []tripdomain.ScheduleItem{
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
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/schedule-items", nil)
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
		} `json:"scheduleItems"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-11" || body.Day.DayOrder != 2 {
		t.Fatalf("unexpected day metadata: %#v", body.Day)
	}
	if len(body.Items) != 1 || body.Items[0].ItemOrder != 1 || body.Items[0].Version != 7 || body.Items[0].Place.Name != "우메다 공중정원" || body.Items[0].Place.PlaceType != "sights" || body.Items[0].Place.Address != "Umeda" {
		t.Fatalf("unexpected schedule items: %#v", body.Items)
	}
}

func TestSetClearDayLodgingPlaceHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	first := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"호텔 니코 오사카","address":"Nishi-Shinsaibashi","placeType":"lodging"}`)
	second := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)

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
		t.Fatalf("set response must not include full schedule items: %#v", setBody)
	}
	setDay := setBody["day"].(map[string]interface{})
	setLodging := setBody["lodgingPlace"].(map[string]interface{})
	if setDay["date"] != "2026-07-11" || setDay["dayOrder"] != float64(2) || setLodging["id"] != first.PlaceID || setLodging["name"] != "호텔 니코 오사카" {
		t.Fatalf("unexpected set response: %#v", setBody)
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/schedule-items", nil)
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
		} `json:"scheduleItems"`
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
	clearedRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/schedule-items", nil)
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
		} `json:"scheduleItems"`
	}
	if err := json.NewDecoder(clearedRecorder.Body).Decode(&clearedBody); err != nil {
		t.Fatalf("decode cleared get response: %v", err)
	}
	if clearedBody.Day.LodgingPlace != nil || clearedBody.Items[0].IsLodging || clearedBody.Items[1].IsLodging {
		t.Fatalf("expected clear to remove lodging state, got %#v", clearedBody)
	}
}

func TestListTripPlacesAndCreateManualDayLodgingPlaceHandlers(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/places", nil)
	listRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected list status %d, got %d with body %s", http.StatusOK, listRecorder.Code, listRecorder.Body.String())
	}
	var listBody struct {
		Places []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"places"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listBody.Places) != 1 || listBody.Places[0].ID != created.PlaceID || listBody.Places[0].Name != "우메다" {
		t.Fatalf("expected existing trip place list, got %#v", listBody.Places)
	}

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-12/lodging-place/manual", bytes.NewReader([]byte(`{"name":" 호텔 니코 오사카 ","address":" Nishi-Shinsaibashi "}`)))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create status %d, got %d with body %s", http.StatusCreated, createRecorder.Code, createRecorder.Body.String())
	}
	var createBody struct {
		Day struct {
			LodgingPlace *struct {
				ID string `json:"id"`
			} `json:"lodgingPlace"`
		} `json:"day"`
		LodgingPlace struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Address   string `json:"address"`
			PlaceType string `json:"placeType"`
		} `json:"lodgingPlace"`
	}
	if err := json.NewDecoder(createRecorder.Body).Decode(&createBody); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if createBody.Day.LodgingPlace == nil || createBody.Day.LodgingPlace.ID != createBody.LodgingPlace.ID || createBody.LodgingPlace.Name != "호텔 니코 오사카" || createBody.LodgingPlace.Address != "Nishi-Shinsaibashi" || createBody.LodgingPlace.PlaceType != "lodging" {
		t.Fatalf("expected manual lodging place set on day, got %#v", createBody)
	}
	if items := backend.dayScheduleItems[tripID+":"+"2026-07-12"]; len(items) != 0 {
		t.Fatalf("expected manual lodging registration not to create schedule items, got %#v", items)
	}
}

func TestCreateGoogleDayLodgingPlaceHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{details: placedomain.GooglePlaceDetails{
		GooglePlaceID:    "google-hotel-1",
		DisplayName:      "호텔 니코 오사카",
		FormattedAddress: "Nishi-Shinsaibashi",
		Latitude:         34.6721,
		Longitude:        135.5019,
		PrimaryType:      "lodging",
		Types:            []string{"lodging", "point_of_interest"},
	}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-12/lodging-place/google", bytes.NewReader([]byte(`{"googlePlaceId":" google-hotel-1 "}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if !provider.detailsCalled || provider.detailsInput.GooglePlaceID != "google-hotel-1" {
		t.Fatalf("expected provider details call for trimmed google id, got called=%v input=%#v", provider.detailsCalled, provider.detailsInput)
	}
	var body struct {
		Day struct {
			Date         string `json:"date"`
			LodgingPlace *struct {
				ID string `json:"id"`
			} `json:"lodgingPlace"`
		} `json:"day"`
		LodgingPlace struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			Address       string `json:"address"`
			PlaceType     string `json:"placeType"`
			RoutablePlace *struct {
				Provider      string  `json:"provider"`
				GooglePlaceID string  `json:"googlePlaceId"`
				Latitude      float64 `json:"latitude"`
				Longitude     float64 `json:"longitude"`
			} `json:"routablePlace"`
		} `json:"lodgingPlace"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-12" || body.Day.LodgingPlace == nil || body.Day.LodgingPlace.ID != body.LodgingPlace.ID {
		t.Fatalf("expected lodging place set on day, got %#v", body)
	}
	if body.LodgingPlace.Name != "호텔 니코 오사카" || body.LodgingPlace.PlaceType != "lodging" || body.LodgingPlace.RoutablePlace == nil || body.LodgingPlace.RoutablePlace.GooglePlaceID != "google-hotel-1" {
		t.Fatalf("expected Google-backed lodging place in response, got %#v", body.LodgingPlace)
	}
	if items := backend.dayScheduleItems[tripID+":"+"2026-07-12"]; len(items) != 0 {
		t.Fatalf("expected Google lodging registration not to create schedule items, got %#v", items)
	}

	provider.detailsCalled = false
	reuseRecorder := httptest.NewRecorder()
	reuseRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/lodging-place/google", bytes.NewReader([]byte(`{"googlePlaceId":"google-hotel-1"}`)))
	reuseRequest.Header.Set("Content-Type", "application/json")
	reuseRequest.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(reuseRecorder, reuseRequest)

	if reuseRecorder.Code != http.StatusCreated {
		t.Fatalf("expected reuse status %d, got %d with body %s", http.StatusCreated, reuseRecorder.Code, reuseRecorder.Body.String())
	}
	if provider.detailsCalled {
		t.Fatal("expected existing Google-backed trip place to be reused without provider refresh")
	}
	if len(backend.tripPlaces) != 1 {
		t.Fatalf("expected one trip place reused across days, got %#v", backend.tripPlaces)
	}
}

func TestSetDayLodgingPlaceValidationNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"호텔","address":"Address","placeType":"lodging"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	otherOwnerToken := loginTestUserWithSubject(t, backend, "apple-3", "현우")
	otherTripID := createTestTrip(t, backend, otherOwnerToken)
	otherPlace := createTestScheduleItem(t, backend, otherOwnerToken, otherTripID, "2026-07-11", `{"name":"다른 호텔","address":"Other","placeType":"lodging"}`)

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

func TestGetDayScheduleItemsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/schedule-items", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestGetDayScheduleItemsValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)

	tests := []string{
		"/trips/not-a-uuid/days/2026-07-10/schedule-items",
		"/trips/00000000-0000-0000-0000-000000000001/days/not-a-date/schedule-items",
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

func TestGetDayScheduleItemsNotFoundAndForbidden(t *testing.T) {
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
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-10/schedule-items", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/schedule-items", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/schedule-items", token: nonParticipantToken, expectCode: http.StatusForbidden},
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

func TestCreateManualScheduleItemHandlerDisabled(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/schedule-items/manual", bytes.NewReader([]byte(`{
		"name":"우메다 공중정원",
		"address":"Umeda",
		"placeType":"sights"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusGone {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusGone, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "MANUAL_PLACE_CREATION_DISABLED" {
		t.Fatalf("expected MANUAL_PLACE_CREATION_DISABLED, got %q", body.Error.Code)
	}
}

func TestCreateManualScheduleItemRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/schedule-items/manual", bytes.NewReader([]byte(`{
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

func TestCreateNonPlaceScheduleItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/schedule-items/non-place", bytes.NewReader([]byte(`{
		"category":"transport",
		"title":"공항 이동",
		"startTime":"08:00",
		"endTime":"09:30",
		"transportMode":"bus",
		"referenceNumber":"BUS-12",
		"originText":"난바",
		"destinationText":"간사이공항"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	var body struct {
		ScheduleItem struct {
			ID       string          `json:"id"`
			ItemType string          `json:"itemType"`
			Place    json.RawMessage `json:"place"`
			NonPlace struct {
				Category        string `json:"category"`
				Title           string `json:"title"`
				TransportMode   string `json:"transportMode"`
				ReferenceNumber string `json:"referenceNumber"`
				OriginText      string `json:"originText"`
				DestinationText string `json:"destinationText"`
			} `json:"nonPlace"`
			StartTime string `json:"startTime"`
			EndTime   string `json:"endTime"`
		} `json:"scheduleItem"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.ScheduleItem.ID == "" || body.ScheduleItem.ItemType != "non_place" || string(body.ScheduleItem.Place) != "null" || body.ScheduleItem.NonPlace.Category != "transport" || body.ScheduleItem.NonPlace.Title != "공항 이동" || body.ScheduleItem.NonPlace.TransportMode != "bus" || body.ScheduleItem.NonPlace.ReferenceNumber != "BUS-12" || body.ScheduleItem.NonPlace.OriginText != "난바" || body.ScheduleItem.NonPlace.DestinationText != "간사이공항" || body.ScheduleItem.StartTime != "08:00" || body.ScheduleItem.EndTime != "09:30" {
		t.Fatalf("unexpected response body: %#v place=%s", body, string(body.ScheduleItem.Place))
	}
}

func TestCreateNonPlaceScheduleItemValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)

	tests := []struct {
		name string
		body string
	}{
		{name: "blank title", body: `{"category":"memo","title":" "}`},
		{name: "transport missing mode", body: `{"category":"transport","title":"공항 이동"}`},
		{name: "non transport rejects transport fields", body: `{"category":"memo","title":"메모","transportMode":"bus"}`},
		{name: "unknown field", body: `{"category":"memo","title":"메모","placeId":"x"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/schedule-items/non-place", bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+accessToken)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestListDayExpensesHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	item := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	_ = loginTestUserWithSubject(t, backend, "apple-2", "지영")
	member := tripdomain.Participant{
		ID:          testUUID(2222),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	}
	backend.participants[tripID] = append(backend.participants[tripID], member)
	payerID := backend.participants[tripID][0].ID

	createExpense := func(amountMinor int64) {
		t.Helper()
		requestBody := []byte(fmt.Sprintf(`{"scheduleItemId":%q,"amountMinor":%d,"payerParticipantId":%q,"splitPolicy":"equal","participantIds":[%q,%q]}`, item.ID, amountMinor, payerID, payerID, member.ID))
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/expenses/quick", bytes.NewReader(requestBody))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+ownerToken)

		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
		if recorder.Code != http.StatusCreated {
			t.Fatalf("expected create expense status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
		}
	}
	createExpense(1001)
	createExpense(2000)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/expenses", nil)
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	responseBody := recorder.Body.Bytes()
	var body struct {
		Expenses []struct {
			ID             string `json:"id"`
			AnchorType     string `json:"anchorType"`
			DisplayTitle   string `json:"displayTitle"`
			ScheduleItemID string `json:"scheduleItemId"`
			AmountMinor    int64  `json:"amountMinor"`
			Currency       string `json:"currency"`
			SplitPolicy    string `json:"splitPolicy"`
			Payer          struct {
				ParticipantID string `json:"participantId"`
				DisplayName   string `json:"displayName"`
				Source        string `json:"source"`
			} `json:"payer"`
			Place struct {
				TripPlaceID string `json:"tripPlaceId"`
				Name        string `json:"name"`
				Address     string `json:"address"`
				PlaceType   string `json:"placeType"`
				Source      string `json:"source"`
			} `json:"place"`
			Splits []struct {
				SplitOrder  int `json:"splitOrder"`
				Participant struct {
					ParticipantID string `json:"participantId"`
					DisplayName   string `json:"displayName"`
					Source        string `json:"source"`
				} `json:"participant"`
				AmountMinor int64 `json:"amountMinor"`
			} `json:"splits"`
			CreatedAt string `json:"createdAt"`
		} `json:"expenses"`
	}
	if err := json.NewDecoder(bytes.NewReader(responseBody)).Decode(&body); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(body.Expenses) != 2 {
		t.Fatalf("expected two expenses, got %#v", body.Expenses)
	}
	if body.Expenses[0].AmountMinor != 2000 || body.Expenses[1].AmountMinor != 1001 {
		t.Fatalf("expected newest-first expenses, got %#v", body.Expenses)
	}
	if body.Expenses[0].Place.Name != "도톤보리" || body.Expenses[0].Place.Source != "live" || body.Expenses[0].DisplayTitle != "도톤보리" || body.Expenses[0].Currency != "JPY" || body.Expenses[0].Payer.DisplayName != "민수" || body.Expenses[0].Payer.Source != "live" || body.Expenses[0].SplitPolicy != "equal" {
		t.Fatalf("unexpected canonical display: %#v", body.Expenses[0])
	}
	if len(body.Expenses[0].Splits) != 2 || body.Expenses[0].Splits[0].SplitOrder != 1 || body.Expenses[0].Splits[0].Participant.DisplayName != "민수" || body.Expenses[0].Splits[1].SplitOrder != 2 || body.Expenses[0].Splits[1].Participant.DisplayName != "지영" {
		t.Fatalf("unexpected split rows: %#v", body.Expenses[0].Splits)
	}

	var rawBody struct {
		Expenses []map[string]any `json:"expenses"`
	}
	if err := json.Unmarshal(responseBody, &rawBody); err != nil {
		t.Fatalf("decode raw list response: %v", err)
	}
	for _, field := range []string{"tripPlaceId", "payerParticipantId", "payerDisplayName"} {
		if _, ok := rawBody.Expenses[0][field]; ok {
			t.Fatalf("expected list item not to expose nullable source field %q: %#v", field, rawBody.Expenses[0])
		}
	}
}

func TestListDayExpensesEmpty(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/expenses", nil)
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Expenses []struct{} `json:"expenses"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if body.Expenses == nil || len(body.Expenses) != 0 {
		t.Fatalf("expected empty non-nil expenses, got %#v", body.Expenses)
	}
}

func TestListDayExpensesErrors(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "requires auth", path: "/trips/" + tripID + "/days/2026-07-11/expenses", expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/expenses", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/expenses", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/expenses", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/expenses", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/expenses", token: nonParticipantToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
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

func TestCreateQuickExpenseHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	item := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	_ = loginTestUserWithSubject(t, backend, "apple-2", "지영")
	member := tripdomain.Participant{
		ID:          testUUID(2222),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	}
	backend.participants[tripID] = append(backend.participants[tripID], member)
	payerID := backend.participants[tripID][0].ID

	requestBody := []byte(fmt.Sprintf(`{"scheduleItemId":%q,"amountMinor":1001,"payerParticipantId":%q,"splitPolicy":"equal","participantIds":[%q]}`, item.ID, payerID, member.ID))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/expenses/quick", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Expense struct {
			TripID         string `json:"tripId"`
			TripDayID      string `json:"tripDayId"`
			ScheduleItemID string `json:"scheduleItemId"`
			DisplayTitle   string `json:"displayTitle"`
			AmountMinor    int64  `json:"amountMinor"`
			Currency       string `json:"currency"`
			SplitPolicy    string `json:"splitPolicy"`
			Payer          struct {
				ParticipantID string `json:"participantId"`
				DisplayName   string `json:"displayName"`
				Source        string `json:"source"`
			} `json:"payer"`
			Place struct {
				TripPlaceID string `json:"tripPlaceId"`
				Name        string `json:"name"`
				Address     string `json:"address"`
				PlaceType   string `json:"placeType"`
				Source      string `json:"source"`
			} `json:"place"`
			Splits []struct {
				Participant struct {
					ParticipantID string `json:"participantId"`
					DisplayName   string `json:"displayName"`
					Source        string `json:"source"`
				} `json:"participant"`
				AmountMinor int64 `json:"amountMinor"`
			} `json:"splits"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Expense.TripID != tripID || body.Expense.TripDayID != "2026-07-11" || body.Expense.ScheduleItemID != item.ID || body.Expense.Place.TripPlaceID != item.PlaceID {
		t.Fatalf("unexpected linked expense ids: %#v", body.Expense)
	}
	if body.Expense.AmountMinor != 1001 || body.Expense.Currency != "JPY" || body.Expense.SplitPolicy != "equal" || body.Expense.Payer.ParticipantID != payerID || body.Expense.Payer.DisplayName != "민수" || body.Expense.Payer.Source != "live" {
		t.Fatalf("unexpected money/payer display: %#v", body.Expense)
	}
	if body.Expense.DisplayTitle != "도톤보리" || body.Expense.Place.Name != "도톤보리" || body.Expense.Place.Address != "Dotonbori" || body.Expense.Place.PlaceType != "food" || body.Expense.Place.Source != "live" {
		t.Fatalf("unexpected place display: %#v", body.Expense.Place)
	}
	if len(body.Expense.Splits) != 1 || body.Expense.Splits[0].Participant.ParticipantID != member.ID || body.Expense.Splits[0].Participant.DisplayName != "지영" || body.Expense.Splits[0].AmountMinor != 1001 {
		t.Fatalf("unexpected payer-excluded one-person split: %#v", body.Expense.Splits)
	}
}

func TestCreateQuickExpenseHandlerManualSplit(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	item := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	member := tripdomain.Participant{
		ID:          testUUID(2222),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	}
	backend.participants[tripID] = append(backend.participants[tripID], member)
	payerID := backend.participants[tripID][0].ID

	requestBody := []byte(fmt.Sprintf(`{"scheduleItemId":%q,"amountMinor":1000,"payerParticipantId":%q,"splitPolicy":"manual","splits":[{"participantId":%q,"amountMinor":300},{"participantId":%q,"amountMinor":700}]}`, item.ID, payerID, payerID, member.ID))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/expenses/quick", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Expense struct {
			SplitPolicy string `json:"splitPolicy"`
			Splits      []struct {
				Participant struct {
					ParticipantID string `json:"participantId"`
				} `json:"participant"`
				AmountMinor int64 `json:"amountMinor"`
			} `json:"splits"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Expense.SplitPolicy != "manual" {
		t.Fatalf("expected manual split policy, got %#v", body.Expense)
	}
	if len(body.Expense.Splits) != 2 || body.Expense.Splits[0].Participant.ParticipantID != payerID || body.Expense.Splits[0].AmountMinor != 300 || body.Expense.Splits[1].Participant.ParticipantID != member.ID || body.Expense.Splits[1].AmountMinor != 700 {
		t.Fatalf("unexpected manual splits: %#v", body.Expense.Splits)
	}
}

func TestCreateQuickExpenseLinksRepeatedPlaceByScheduleItemOccurrence(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	provider := &fakePlaceProvider{details: placedomain.GooglePlaceDetails{
		GooglePlaceID:    "google-lodging-repeat",
		DisplayName:      "호텔 니코 오사카",
		FormattedAddress: "Nishi-Shinsaibashi",
		Latitude:         34.6721,
		Longitude:        135.4983,
		PrimaryType:      "lodging",
		Types:            []string{"lodging", "point_of_interest"},
	}}

	createGoogleItem := func(body string) createdScheduleItem {
		t.Helper()

		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/places/google/schedule-items", bytes.NewReader([]byte(body)))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+ownerToken)

		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)
		if recorder.Code != http.StatusCreated {
			t.Fatalf("expected create Google schedule item status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
		}

		var response struct {
			Item struct {
				ID    string `json:"id"`
				Place struct {
					ID string `json:"id"`
				} `json:"place"`
			} `json:"scheduleItem"`
		}
		if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
			t.Fatalf("decode create Google schedule item response: %v", err)
		}
		return createdScheduleItem{ID: response.Item.ID, PlaceID: response.Item.Place.ID}
	}

	first := createGoogleItem(`{"googlePlaceId":"google-lodging-repeat","duplicateConfirmed":false,"title":"숙소 방문"}`)
	second := createGoogleItem(`{"googlePlaceId":"google-lodging-repeat","duplicateConfirmed":true,"title":"숙소 재방문"}`)
	if first.ID == second.ID || first.PlaceID != second.PlaceID {
		t.Fatalf("expected two schedule item occurrences for one trip place, got first=%#v second=%#v", first, second)
	}

	payerID := backend.participants[tripID][0].ID
	requestBody := []byte(fmt.Sprintf(`{"scheduleItemId":%q,"amountMinor":4500,"payerParticipantId":%q,"splitPolicy":"equal","participantIds":[%q]}`, second.ID, payerID, payerID))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/expenses/quick", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+ownerToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Expense struct {
			ScheduleItemID string `json:"scheduleItemId"`
			Place          struct {
				TripPlaceID string `json:"tripPlaceId"`
				Name        string `json:"name"`
				Address     string `json:"address"`
				PlaceType   string `json:"placeType"`
				Source      string `json:"source"`
			} `json:"place"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Expense.ScheduleItemID != second.ID || body.Expense.ScheduleItemID == first.ID {
		t.Fatalf("expected expense to link to second occurrence %q, got %#v", second.ID, body.Expense)
	}
	if body.Expense.Place.TripPlaceID != second.PlaceID {
		t.Fatalf("expected derived shared trip place %q, got %#v", second.PlaceID, body.Expense)
	}
	if body.Expense.Place.Name != "호텔 니코 오사카" || body.Expense.Place.Address != "Nishi-Shinsaibashi" || body.Expense.Place.PlaceType != "lodging" || body.Expense.Place.Source != "live" {
		t.Fatalf("unexpected place display: %#v", body.Expense.Place)
	}
}

func TestGetUpdateDeleteExpenseHandlers(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	item := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	_ = loginTestUserWithSubject(t, backend, "apple-2", "지영")
	member := tripdomain.Participant{
		ID:          testUUID(2222),
		TripID:      tripID,
		UserID:      "user-2",
		Role:        tripdomain.RoleMember,
		DisplayName: "지영",
		JoinedAt:    time.Date(2026, 6, 22, 15, 0, 0, 0, time.UTC),
	}
	backend.participants[tripID] = append(backend.participants[tripID], member)
	ownerParticipantID := backend.participants[tripID][0].ID

	createBody := []byte(fmt.Sprintf(`{"scheduleItemId":%q,"amountMinor":1200,"payerParticipantId":%q,"splitPolicy":"equal","participantIds":[%q,%q]}`, item.ID, ownerParticipantID, ownerParticipantID, member.ID))
	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/expenses/quick", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create expense status %d, got %d with body %s", http.StatusCreated, createRecorder.Code, createRecorder.Body.String())
	}
	var created struct {
		Expense struct {
			ID string `json:"id"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(createRecorder.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/expenses/"+created.Expense.ID, nil)
	getRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get expense status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var got struct {
		Expense struct {
			ID           string  `json:"id"`
			Memo         *string `json:"memo"`
			DisplayTitle string  `json:"displayTitle"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&got); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if got.Expense.ID != created.Expense.ID || got.Expense.Memo != nil || got.Expense.DisplayTitle != "도톤보리" {
		t.Fatalf("unexpected get expense response: %#v", got.Expense)
	}

	patchBody := []byte(fmt.Sprintf(`{"amountMinor":1501,"payerParticipantId":%q,"splitPolicy":"equal","participantIds":[%q,%q],"memo":"  저녁  ","scheduleItemId":null}`, member.ID, ownerParticipantID, member.ID))
	patchRecorder := httptest.NewRecorder()
	patchRequest := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID+"/days/2026-07-11/expenses/"+created.Expense.ID, bytes.NewReader(patchBody))
	patchRequest.Header.Set("Content-Type", "application/json")
	patchRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(patchRecorder, patchRequest)
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("expected patch expense status %d, got %d with body %s", http.StatusOK, patchRecorder.Code, patchRecorder.Body.String())
	}
	var patched struct {
		Expense struct {
			AnchorType     string  `json:"anchorType"`
			AmountMinor    int64   `json:"amountMinor"`
			Memo           *string `json:"memo"`
			ScheduleItemID *string `json:"scheduleItemId"`
			Place          struct {
				Name string `json:"name"`
			} `json:"place"`
			Payer struct {
				ParticipantID string `json:"participantId"`
			} `json:"payer"`
			Splits []struct {
				AmountMinor int64 `json:"amountMinor"`
			} `json:"splits"`
		} `json:"expense"`
	}
	if err := json.NewDecoder(patchRecorder.Body).Decode(&patched); err != nil {
		t.Fatalf("decode patch response: %v", err)
	}
	if patched.Expense.AnchorType != "trip_day" || patched.Expense.AmountMinor != 1501 || patched.Expense.Memo == nil || *patched.Expense.Memo != "저녁" || patched.Expense.ScheduleItemID != nil || patched.Expense.Place.Name != "장소 없음" || patched.Expense.Payer.ParticipantID != member.ID || len(patched.Expense.Splits) != 2 || patched.Expense.Splits[0].AmountMinor != 751 || patched.Expense.Splits[1].AmountMinor != 750 {
		t.Fatalf("unexpected patch expense response: %#v", patched.Expense)
	}

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/days/2026-07-11/expenses/"+created.Expense.ID, nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(deleteRecorder, deleteRequest)
	if deleteRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected delete expense status %d, got %d with body %s", http.StatusNoContent, deleteRecorder.Code, deleteRecorder.Body.String())
	}

	missingRecorder := httptest.NewRecorder()
	missingRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/expenses/"+created.Expense.ID, nil)
	missingRequest.Header.Set("Authorization", "Bearer "+ownerToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(missingRecorder, missingRequest)
	if missingRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected missing expense status %d, got %d with body %s", http.StatusNotFound, missingRecorder.Code, missingRecorder.Body.String())
	}
}

func TestCreateQuickExpenseRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/expenses/quick", bytes.NewReader([]byte(`{"scheduleItemId":"00000000-0000-0000-0000-000000007001","amountMinor":1,"payerParticipantId":"00000000-0000-0000-0000-000000002001"}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestCreateQuickExpenseValidationNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	item := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	payerID := backend.participants[tripID][0].ID
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	bodyFor := func(scheduleItemID string, amountMinor int64, payerParticipantID string, participantIDs []string) string {
		t.Helper()
		payload := map[string]interface{}{
			"scheduleItemId":     scheduleItemID,
			"amountMinor":        amountMinor,
			"payerParticipantId": payerParticipantID,
		}
		payload["splitPolicy"] = "equal"
		if participantIDs != nil {
			payload["participantIds"] = participantIDs
		}
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal quick expense request: %v", err)
		}
		return string(data)
	}

	tests := []struct {
		name       string
		path       string
		body       string
		token      string
		expectCode int
	}{
		{name: "invalid path date", path: "/trips/" + tripID + "/days/not-a-date/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{payerID}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "invalid amount", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 0, payerID, []string{payerID}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "missing split participants", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, nil), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "empty split participants", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "malformed split participant", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{"not-a-uuid"}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "duplicate split participant", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{payerID, payerID}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "non trip split participant", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{testUUID(2998)}), token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{payerID}), token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{payerID}), token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, payerID, []string{payerID}), token: nonParticipantToken, expectCode: http.StatusForbidden},
		{name: "missing item", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(testUUID(7999), 1, payerID, []string{payerID}), token: ownerToken, expectCode: http.StatusNotFound},
		{name: "missing payer", path: "/trips/" + tripID + "/days/2026-07-11/expenses/quick", body: bodyFor(item.ID, 1, testUUID(2999), []string{payerID}), token: ownerToken, expectCode: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewReader([]byte(tt.body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+tt.token)

			NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

			if recorder.Code != tt.expectCode {
				t.Fatalf("expected status %d, got %d with body %s", tt.expectCode, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestMarkScheduleItemArrivedHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	first := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)

	path := "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + first.ID + "/arrive"
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
		} `json:"scheduleItem"`
		Items []struct {
			ID        string  `json:"id"`
			ArrivedAt *string `json:"arrivedAt"`
		} `json:"scheduleItems"`
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
		} `json:"scheduleItem"`
	}
	if err := json.NewDecoder(repeatRecorder.Body).Decode(&repeatBody); err != nil {
		t.Fatalf("decode repeat response: %v", err)
	}
	if repeatBody.Item.ArrivedAt == nil || *repeatBody.Item.ArrivedAt != *firstBody.Item.ArrivedAt {
		t.Fatalf("expected idempotent repeat to preserve arrivedAt, first=%v repeat=%v", firstBody.Item.ArrivedAt, repeatBody.Item.ArrivedAt)
	}
}

func TestMarkScheduleItemArrivedRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/schedule-items/00000000-0000-0000-0000-000000005001/arrive", nil)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestMarkScheduleItemArrivedValidationNotFoundForbiddenAndConflict(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)
	otherDay := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-12", `{"name":"교토","address":"Kyoto","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
		expectErr  string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/schedule-items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/schedule-items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/not-a-uuid/arrive", token: ownerToken, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/schedule-items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/schedule-items/" + first.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + otherDay.ID + "/arrive", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + first.ID + "/arrive", token: nonParticipantToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "later pending conflict", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + second.ID + "/arrive", token: ownerToken, expectCode: http.StatusConflict, expectErr: "CONFLICT"},
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

func TestMarkScheduleItemSkippedAndRestoreHandlers(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	first := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)

	skipPath := "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + first.ID + "/skip"
	skipRecorder := httptest.NewRecorder()
	skipRequest := httptest.NewRequest(http.MethodPost, skipPath, nil)
	skipRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(skipRecorder, skipRequest)
	if skipRecorder.Code != http.StatusOK {
		t.Fatalf("expected skip status %d, got %d with body %s", http.StatusOK, skipRecorder.Code, skipRecorder.Body.String())
	}

	var skipBody struct {
		Item struct {
			ID        string  `json:"id"`
			SkippedAt *string `json:"skippedAt"`
		} `json:"scheduleItem"`
		Items []struct {
			ID        string  `json:"id"`
			SkippedAt *string `json:"skippedAt"`
		} `json:"scheduleItems"`
	}
	if err := json.NewDecoder(skipRecorder.Body).Decode(&skipBody); err != nil {
		t.Fatalf("decode skip response: %v", err)
	}
	if skipBody.Item.ID != first.ID || skipBody.Item.SkippedAt == nil {
		t.Fatalf("expected skipped target item, got %#v", skipBody.Item)
	}
	if len(skipBody.Items) != 2 || skipBody.Items[0].ID != first.ID || skipBody.Items[0].SkippedAt == nil || skipBody.Items[1].ID != second.ID || skipBody.Items[1].SkippedAt != nil {
		t.Fatalf("expected full latest snapshot with only first skipped, got %#v", skipBody.Items)
	}

	repeatRecorder := httptest.NewRecorder()
	repeatRequest := httptest.NewRequest(http.MethodPost, skipPath, nil)
	repeatRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(repeatRecorder, repeatRequest)
	if repeatRecorder.Code != http.StatusOK {
		t.Fatalf("expected repeat skip status %d, got %d with body %s", http.StatusOK, repeatRecorder.Code, repeatRecorder.Body.String())
	}

	restorePath := "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + first.ID + "/restore"
	restoreRecorder := httptest.NewRecorder()
	restoreRequest := httptest.NewRequest(http.MethodPost, restorePath, nil)
	restoreRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(restoreRecorder, restoreRequest)
	if restoreRecorder.Code != http.StatusOK {
		t.Fatalf("expected restore status %d, got %d with body %s", http.StatusOK, restoreRecorder.Code, restoreRecorder.Body.String())
	}

	var restoreBody struct {
		Item struct {
			ID        string  `json:"id"`
			SkippedAt *string `json:"skippedAt"`
		} `json:"scheduleItem"`
	}
	if err := json.NewDecoder(restoreRecorder.Body).Decode(&restoreBody); err != nil {
		t.Fatalf("decode restore response: %v", err)
	}
	if restoreBody.Item.ID != first.ID || restoreBody.Item.SkippedAt != nil {
		t.Fatalf("expected restored pending target item, got %#v", restoreBody.Item)
	}
}

func TestScheduleItemSkipAndRestoreRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	for _, path := range []string{
		"/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/schedule-items/00000000-0000-0000-0000-000000005001/skip",
		"/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/schedule-items/00000000-0000-0000-0000-000000005001/restore",
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, path, nil)
		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("expected status %d for %s, got %d with body %s", http.StatusUnauthorized, path, recorder.Code, recorder.Body.String())
		}
	}
}

func TestScheduleItemSkipAndRestoreValidationNotFoundForbiddenAndConflict(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	second := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"오사카성","address":"Osakajo","placeType":"sights"}`)
	otherDay := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-12", `{"name":"교토","address":"Kyoto","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "skip invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/not-a-uuid/skip", token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "skip item not in selected day", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + otherDay.ID + "/skip", token: ownerToken, expectCode: http.StatusNotFound},
		{name: "skip forbidden", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + first.ID + "/skip", token: nonParticipantToken, expectCode: http.StatusForbidden},
		{name: "skip later pending conflict", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + second.ID + "/skip", token: ownerToken, expectCode: http.StatusConflict},
		{name: "restore invalid date", path: "/trips/" + tripID + "/days/not-a-date/schedule-items/" + first.ID + "/restore", token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "restore item not in selected day", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + otherDay.ID + "/restore", token: ownerToken, expectCode: http.StatusNotFound},
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
		})
	}
}

func TestUpdateScheduleItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{
		"name":"우메다 공중정원",
		"address":"Umeda",
		"placeType":"sights"
	}`)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/"+tripID+"/days/2026-07-11/schedule-items/"+created.ID, bytes.NewReader([]byte(`{
		"name":"  우메다 스카이빌딩  ",
		"placeType":"food",
		"startTime":"09:30",
		"endTime":"11:00"
	}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	var body struct {
		Item struct {
			ID        string  `json:"id"`
			ItemOrder int     `json:"itemOrder"`
			StartTime *string `json:"startTime"`
			EndTime   *string `json:"endTime"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
		} `json:"scheduleItem"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Item.ID != created.ID || body.Item.ItemOrder != 1 || body.Item.Place.ID != created.PlaceID || body.Item.Place.Name != "우메다 스카이빌딩" || body.Item.Place.Address != "Umeda" || body.Item.Place.PlaceType != "food" {
		t.Fatalf("unexpected updated item: %#v", body.Item)
	}
	if body.Item.StartTime == nil || *body.Item.StartTime != "09:30" || body.Item.EndTime == nil || *body.Item.EndTime != "11:00" {
		t.Fatalf("expected response time fields, got start=%v end=%v", body.Item.StartTime, body.Item.EndTime)
	}
}

func TestReorderScheduleItemsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/trips/00000000-0000-0000-0000-000000000001/days/2026-07-11/schedule-items/order", bytes.NewReader([]byte(`{"moves":[]}`)))
	request.Header.Set("Content-Type", "application/json")

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestReorderScheduleItemsValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	second := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)},
		{name: "empty moves", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", body: `{"moves":[]}`},
		{name: "both anchors nil", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":null,"afterScheduleItemId":null,"clientVersion":1}]}`, first.ID)},
		{name: "invalid client version", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":0}]}`, first.ID, second.ID)},
		{name: "item not in day", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":1}]}`, testUUID(9999), second.ID)},
		{name: "anchor not in day", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", body: fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":1}]}`, first.ID, testUUID(9999))},
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

func TestReorderScheduleItemsNotFoundForbiddenAndConflict(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	first := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	second := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"도톤보리","address":"Dotonbori","placeType":"food"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")
	validBody := fmt.Sprintf(`{"moves":[{"scheduleItemId":%q,"beforeScheduleItemId":%q,"clientVersion":1}]}`, first.ID, second.ID)

	tests := []struct {
		name       string
		path       string
		token      string
		setup      func()
		expectCode int
		expectErr  string
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/schedule-items/order", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/schedule-items/order", token: ownerToken, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", token: nonParticipantToken, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "conflict", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/order", token: ownerToken, setup: func() { backend.reorderErr = tripdomain.ErrConflict }, expectCode: http.StatusConflict, expectErr: "CONFLICT"},
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

func TestUpdateScheduleItemValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)

	tests := []struct {
		name string
		path string
		body string
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/schedule-items/" + created.ID, body: `{"name":"도톤보리"}`},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/schedule-items/" + created.ID, body: `{"name":"도톤보리"}`},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/not-a-uuid", body: `{"name":"도톤보리"}`},
		{name: "empty patch", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, body: `{}`},
		{name: "unknown field", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, body: `{"memo":"x"}`},
		{name: "blank name", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, body: `{"name":" "}`},
		{name: "invalid place type", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, body: `{"placeType":"museum"}`},
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

func TestUpdateScheduleItemNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-12/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, token: nonParticipantToken, expectCode: http.StatusForbidden},
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

func TestDeleteScheduleItemHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	created := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/days/2026-07-11/schedule-items/"+created.ID, nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNoContent, recorder.Code, recorder.Body.String())
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("expected empty body, got %q", recorder.Body.String())
	}

	getRecorder := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/schedule-items", nil)
	getRequest.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(getRecorder, getRequest)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected get status %d, got %d with body %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	var getBody struct {
		Items []interface{} `json:"scheduleItems"`
	}
	if err := json.NewDecoder(getRecorder.Body).Decode(&getBody); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if len(getBody.Items) != 0 {
		t.Fatalf("expected item to be removed, got %#v", getBody.Items)
	}
}

func TestDeleteScheduleItemRequiresAuthBeforeValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/trips/not-a-uuid/days/2026-07-10/schedule-items/not-a-uuid", nil)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestDeleteScheduleItemValidationNotFoundAndForbidden(t *testing.T) {
	backend := newFakeAuthBackend()
	ownerToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, ownerToken)
	created := createTestScheduleItem(t, backend, ownerToken, tripID, "2026-07-11", `{"name":"우메다","address":"Umeda","placeType":"sights"}`)
	nonParticipantToken := loginTestUserWithSubject(t, backend, "apple-2", "지영")

	tests := []struct {
		name       string
		path       string
		token      string
		expectCode int
	}{
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-11/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "invalid date", path: "/trips/" + tripID + "/days/not-a-date/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "invalid item id", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/not-a-uuid", token: ownerToken, expectCode: http.StatusBadRequest},
		{name: "missing trip", path: "/trips/00000000-0000-0000-0000-000000000404/days/2026-07-11/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "item not in selected day", path: "/trips/" + tripID + "/days/2026-07-12/schedule-items/" + created.ID, token: ownerToken, expectCode: http.StatusNotFound},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-11/schedule-items/" + created.ID, token: nonParticipantToken, expectCode: http.StatusForbidden},
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

func TestSearchDestinationsHandlerReturnsCityResults(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	provider := &fakePlaceProvider{destinationResults: []placedomain.DestinationSearchResult{{
		CityName:        "오사카",
		CountryName:     "일본",
		CountryCode:     "JP",
		DisplayName:     "오사카, 일본",
		Latitude:        34.6937,
		Longitude:       135.5023,
		RadiusMeters:    25000,
		Provider:        placedomain.DestinationProviderGoogle,
		ProviderPlaceID: "google-city-osaka",
	}}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/destinations/search?query=%20%EC%98%A4%EC%82%AC%EC%B9%B4%20&limit=3", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if !provider.destinationCalled || provider.destinationInput.Query != "오사카" || provider.destinationInput.Limit != 3 {
		t.Fatalf("expected destination provider input, got called=%v input=%#v", provider.destinationCalled, provider.destinationInput)
	}
	var body struct {
		Results []struct {
			DisplayName     string `json:"displayName"`
			ProviderPlaceID string `json:"providerPlaceId"`
		} `json:"results"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Results) != 1 || body.Results[0].DisplayName != "오사카, 일본" || body.Results[0].ProviderPlaceID != "google-city-osaka" {
		t.Fatalf("unexpected destination results: %#v", body.Results)
	}
}

func TestSearchDestinationsRequiresAuth(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/destinations/search?query=%EC%98%A4%EC%82%AC%EC%B9%B4", nil)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: &fakePlaceProvider{}}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusUnauthorized, recorder.Code, recorder.Body.String())
	}
}

func TestSearchDestinationsValidation(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/destinations/search?query=%EC%98%A4", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: &fakePlaceProvider{}}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, recorder.Code, recorder.Body.String())
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
	if len(backend.dayScheduleItems) != 0 {
		t.Fatalf("expected search not to persist schedule items, got %#v", backend.dayScheduleItems)
	}
}

func TestSearchGooglePlacesHandlerReturnsMapMetadataAndPhotoToken(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	rating := 4.5
	reviewCount := 12304
	openNow := true
	provider := &fakePlaceProvider{results: []placedomain.SearchResult{{
		GooglePlaceID:          "google-1",
		DisplayName:            "우메다 스카이 빌딩",
		FormattedAddress:       "Osaka",
		PrimaryType:            "tourist_attraction",
		PrimaryTypeDisplayName: "관광명소",
		Latitude:               34.7053,
		Longitude:              135.4905,
		Rating:                 &rating,
		UserRatingCount:        &reviewCount,
		OpenNow:                &openNow,
		GoogleMapsURI:          "https://maps.google.com/?cid=1",
		Photo: &placedomain.SearchResultPhoto{
			Name:     "places/google-1/photos/photo-1",
			WidthPx:  600,
			HeightPx: 400,
			AuthorAttributions: []placedomain.PhotoAttribution{{
				DisplayName: "Google User",
				URI:         "https://maps.google.com/contrib/1",
			}},
		},
	}}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/places/google/search?query=%EC%9A%B0%EB%A9%94%EB%8B%A4&latitude=34.7&longitude=135.5&radiusMeters=1200", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)

	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if provider.input.Limit != 10 || provider.input.LocationBias == nil || provider.input.LocationBias.Latitude != 34.7 || provider.input.LocationBias.Longitude != 135.5 || provider.input.LocationBias.RadiusMeters != 1200 {
		t.Fatalf("expected default limit and location bias, got %#v", provider.input)
	}
	var body struct {
		Results []struct {
			GooglePlaceID          string   `json:"googlePlaceId"`
			DisplayName            string   `json:"displayName"`
			FormattedAddress       string   `json:"formattedAddress"`
			PrimaryType            string   `json:"primaryType"`
			PrimaryTypeDisplayName string   `json:"primaryTypeDisplayName"`
			Latitude               float64  `json:"latitude"`
			Longitude              float64  `json:"longitude"`
			Rating                 *float64 `json:"rating"`
			UserRatingCount        *int     `json:"userRatingCount"`
			OpenNow                *bool    `json:"openNow"`
			GoogleMapsURI          string   `json:"googleMapsUri"`
			Photo                  *struct {
				Token              string `json:"token"`
				WidthPx            int    `json:"widthPx"`
				HeightPx           int    `json:"heightPx"`
				AuthorAttributions []struct {
					DisplayName string `json:"displayName"`
					URI         string `json:"uri"`
				} `json:"authorAttributions"`
			} `json:"photo"`
		} `json:"results"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Results) != 1 {
		t.Fatalf("expected one result, got %#v", body.Results)
	}
	result := body.Results[0]
	if result.PrimaryTypeDisplayName != "관광명소" || result.Latitude != 34.7053 || result.Longitude != 135.4905 || result.Rating == nil || *result.Rating != 4.5 || result.UserRatingCount == nil || *result.UserRatingCount != 12304 || result.OpenNow == nil || !*result.OpenNow || result.GoogleMapsURI == "" {
		t.Fatalf("expected rich metadata, got %#v", result)
	}
	if result.Photo == nil || result.Photo.Token == "" || strings.Contains(result.Photo.Token, "places/") || len(result.Photo.AuthorAttributions) != 1 || result.Photo.AuthorAttributions[0].DisplayName != "Google User" {
		t.Fatalf("expected signed photo token and attribution, got %#v", result.Photo)
	}
}

func TestGooglePlaceDetailsAndPhotoHandlers(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{
		description: placedomain.GooglePlaceDescription{GooglePlaceID: "google-1", Description: "공중정원 전망대로 유명한 오사카 대표 명소입니다."},
		photo:       placedomain.GooglePlacePhoto{URI: "https://lh3.googleusercontent.com/photo"},
		results: []placedomain.SearchResult{{
			GooglePlaceID:    "google-1",
			DisplayName:      "우메다 스카이 빌딩",
			FormattedAddress: "Osaka",
			PrimaryType:      "tourist_attraction",
			Latitude:         34.7053,
			Longitude:        135.4905,
			Photo:            &placedomain.SearchResultPhoto{Name: "places/google-1/photos/photo-1"},
		}},
	}
	router := NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider})

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/places/google/google-1/details", nil)
	detailRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected details status %d, got %d with body %s", http.StatusOK, detailRecorder.Code, detailRecorder.Body.String())
	}
	if !provider.descriptionCalled || provider.descriptionInput.GooglePlaceID != "google-1" {
		t.Fatalf("expected selected details provider call, got called=%v input=%#v", provider.descriptionCalled, provider.descriptionInput)
	}
	var detailBody struct {
		GooglePlaceID string `json:"googlePlaceId"`
		Description   string `json:"description"`
	}
	if err := json.NewDecoder(detailRecorder.Body).Decode(&detailBody); err != nil {
		t.Fatalf("decode details response: %v", err)
	}
	if detailBody.Description != "공중정원 전망대로 유명한 오사카 대표 명소입니다." {
		t.Fatalf("unexpected details body %#v", detailBody)
	}

	searchRecorder := httptest.NewRecorder()
	searchRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/places/google/search?query=%EC%9A%B0%EB%A9%94%EB%8B%A4", nil)
	searchRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(searchRecorder, searchRequest)
	if searchRecorder.Code != http.StatusOK {
		t.Fatalf("expected search status %d, got %d with body %s", http.StatusOK, searchRecorder.Code, searchRecorder.Body.String())
	}
	var searchBody struct {
		Results []struct {
			Photo *struct {
				Token string `json:"token"`
			} `json:"photo"`
		} `json:"results"`
	}
	if err := json.NewDecoder(searchRecorder.Body).Decode(&searchBody); err != nil {
		t.Fatalf("decode search response: %v", err)
	}
	photoToken := searchBody.Results[0].Photo.Token

	photoRecorder := httptest.NewRecorder()
	photoRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/days/2026-07-11/places/google/photos/"+photoToken+"?maxWidthPx=240", nil)
	photoRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(photoRecorder, photoRequest)
	if photoRecorder.Code != http.StatusFound {
		t.Fatalf("expected photo status %d, got %d with body %s", http.StatusFound, photoRecorder.Code, photoRecorder.Body.String())
	}
	if provider.photoInput.Name != "places/google-1/photos/photo-1" || provider.photoInput.MaxWidthPx != 240 {
		t.Fatalf("expected photo provider input to restore raw photo name, got %#v", provider.photoInput)
	}
	if photoRecorder.Header().Get("Location") != "https://lh3.googleusercontent.com/photo" || photoRecorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("expected redirect with no-store headers, got location=%q cache=%q", photoRecorder.Header().Get("Location"), photoRecorder.Header().Get("Cache-Control"))
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

func TestTripPlaceBookmarkHandlers(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	provider := &fakePlaceProvider{details: placedomain.GooglePlaceDetails{
		GooglePlaceID:    "google-airport-1",
		DisplayName:      "간사이공항",
		FormattedAddress: "Kansai International Airport",
		Latitude:         34.4347,
		Longitude:        135.244,
		PrimaryType:      "airport",
		Types:            []string{"airport", "point_of_interest"},
	}}
	router := NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider})

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/place-bookmarks/google", bytes.NewReader([]byte(`{"googlePlaceId":"google-airport-1","category":"transport"}`)))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected create status %d, got %d with body %s", http.StatusCreated, createRecorder.Code, createRecorder.Body.String())
	}
	var created struct {
		Bookmark struct {
			ID       string `json:"id"`
			Category string `json:"category"`
			Place    struct {
				Name          string `json:"name"`
				PlaceType     string `json:"placeType"`
				RoutablePlace struct {
					GooglePlaceID string  `json:"googlePlaceId"`
					Latitude      float64 `json:"latitude"`
				} `json:"routablePlace"`
			} `json:"place"`
		} `json:"bookmark"`
	}
	if err := json.NewDecoder(createRecorder.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.Bookmark.ID == "" || created.Bookmark.Category != "transport" || created.Bookmark.Place.PlaceType != "transport" || created.Bookmark.Place.RoutablePlace.GooglePlaceID != "google-airport-1" {
		t.Fatalf("unexpected create body %#v", created.Bookmark)
	}

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/trips/"+tripID+"/place-bookmarks", nil)
	listRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected list status %d, got %d with body %s", http.StatusOK, listRecorder.Code, listRecorder.Body.String())
	}
	var listed struct {
		Bookmarks []struct {
			ID       string `json:"id"`
			Category string `json:"category"`
		} `json:"bookmarks"`
	}
	if err := json.NewDecoder(listRecorder.Body).Decode(&listed); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listed.Bookmarks) != 1 || listed.Bookmarks[0].ID != created.Bookmark.ID || listed.Bookmarks[0].Category != "transport" {
		t.Fatalf("unexpected list body %#v", listed.Bookmarks)
	}

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/trips/"+tripID+"/place-bookmarks/"+created.Bookmark.ID, nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+accessToken)
	router.ServeHTTP(deleteRecorder, deleteRequest)
	if deleteRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected delete status %d, got %d with body %s", http.StatusNoContent, deleteRecorder.Code, deleteRecorder.Body.String())
	}
}

func TestCreateGooglePlaceScheduleItemHandler(t *testing.T) {
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
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/places/google/schedule-items", bytes.NewReader([]byte(`{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"오전 산책","startTime":"09:30","endTime":"11:00","memo":"강가 산책하기"}`)))
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
			ItemOrder int     `json:"itemOrder"`
			StartTime *string `json:"startTime"`
			EndTime   *string `json:"endTime"`
			Place     struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				PlaceType string `json:"placeType"`
				Address   string `json:"address"`
			} `json:"place"`
			PlaceSchedule struct {
				Title string  `json:"title"`
				Memo  *string `json:"memo"`
			} `json:"placeSchedule"`
		} `json:"scheduleItem"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Day.Date != "2026-07-11" || body.Day.DayOrder != 2 || body.Item.ItemOrder != 1 || body.Item.Place.Name != "도톤보리" || body.Item.Place.PlaceType != "sights" {
		t.Fatalf("unexpected response %#v", body)
	}
	if body.Item.PlaceSchedule.Title != "오전 산책" || body.Item.PlaceSchedule.Memo == nil || *body.Item.PlaceSchedule.Memo != "강가 산책하기" || body.Item.StartTime == nil || *body.Item.StartTime != "09:30" || body.Item.EndTime == nil || *body.Item.EndTime != "11:00" {
		t.Fatalf("expected schedule details in response, got %#v", body.Item)
	}
	if len(backend.dayScheduleItems[tripID+":2026-07-11"]) != 1 {
		t.Fatalf("expected created schedule item, got %#v", backend.dayScheduleItems)
	}

	provider.detailsCalled = false
	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-12/places/google/schedule-items", bytes.NewReader([]byte(`{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"저녁 산책"}`)))
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

func TestCreateGooglePlaceScheduleItemDuplicateConfirmation(t *testing.T) {
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
		request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-11/places/google/schedule-items", bytes.NewReader([]byte(body)))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+accessToken)
		NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, PlaceProvider: provider}).ServeHTTP(recorder, request)
		return recorder
	}

	if recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":false,"title":"첫 방문"}`); recorder.Code != http.StatusCreated {
		t.Fatalf("expected first create status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}

	recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":false,"title":"다시 방문","memo":"야경 보기"}`)
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

	if recorder := create(`{"googlePlaceId":"google-dup","duplicateConfirmed":true,"title":"다시 방문","memo":"야경 보기"}`); recorder.Code != http.StatusCreated {
		t.Fatalf("expected confirmed duplicate status %d, got %d with body %s", http.StatusCreated, recorder.Code, recorder.Body.String())
	}
	if len(backend.dayScheduleItems[tripID+":2026-07-11"]) != 2 {
		t.Fatalf("expected confirmed duplicate to create second item, got %#v", backend.dayScheduleItems[tripID+":2026-07-11"])
	}
}

func TestCreateGooglePlaceScheduleItemValidationAuthAndProviderErrors(t *testing.T) {
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
		{name: "requires auth", path: "/trips/" + tripID + "/days/2026-07-10/places/google/schedule-items", token: "", body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{}, expectCode: http.StatusUnauthorized, expectErr: "UNAUTHORIZED"},
		{name: "invalid trip id", path: "/trips/not-a-uuid/days/2026-07-10/places/google/schedule-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{}, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "blank google place id", path: "/trips/" + tripID + "/days/2026-07-10/places/google/schedule-items", token: accessToken, body: `{"googlePlaceId":" ","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{}, expectCode: http.StatusBadRequest, expectErr: "VALIDATION_ERROR"},
		{name: "out of range", path: "/trips/" + tripID + "/days/2026-07-14/places/google/schedule-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{}, expectCode: http.StatusNotFound, expectErr: "NOT_FOUND"},
		{name: "forbidden", path: "/trips/" + tripID + "/days/2026-07-10/places/google/schedule-items", token: nonParticipantToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{}, expectCode: http.StatusForbidden, expectErr: "FORBIDDEN"},
		{name: "provider unavailable", path: "/trips/" + tripID + "/days/2026-07-10/places/google/schedule-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{detailsErr: placedomain.ErrProviderUnavailable}, expectCode: http.StatusBadGateway, expectErr: "PLACE_PROVIDER_UNAVAILABLE"},
		{name: "provider rate limited", path: "/trips/" + tripID + "/days/2026-07-10/places/google/schedule-items", token: accessToken, body: `{"googlePlaceId":"google-1","duplicateConfirmed":false,"title":"도톤보리"}`, provider: &fakePlaceProvider{detailsErr: placedomain.ErrProviderRateLimited}, expectCode: http.StatusTooManyRequests, expectErr: "PLACE_PROVIDER_RATE_LIMITED"},
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

func TestCreateRoutePreviewHandler(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	item, err := backend.CreateGooglePlaceScheduleItem(context.Background(), placedomain.CreateGooglePlaceScheduleItemRecord{
		TripID:             tripID,
		TripDayID:          "2026-07-10",
		GooglePlaceID:      "google-1",
		Name:               "도톤보리",
		Address:            "Dotonbori",
		PlaceType:          "food",
		Latitude:           34.6687,
		Longitude:          135.5013,
		DuplicateConfirmed: true,
		Title:              "도톤보리",
	})
	if err != nil {
		t.Fatalf("create google schedule fixture: %v", err)
	}
	transfers := 1
	provider := &fakeRouteProvider{result: routedomain.ProviderPreviewResult{
		DurationSeconds: 1200,
		DistanceMeters:  3500,
		EncodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
		Bounds: &routedomain.GeoBounds{
			Northeast: routedomain.GeoPoint{Latitude: 34.7, Longitude: 135.6},
			Southwest: routedomain.GeoPoint{Latitude: 34.6, Longitude: 135.5},
		},
		TransferCount: &transfers,
	}}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-10/schedule-items/"+item.ID+"/route-preview", bytes.NewReader([]byte(`{"origin":{"latitude":34.6,"longitude":135.5}}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, RouteProvider: provider}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if !provider.called || provider.input.Mode != "transit" || provider.input.Destination.Latitude != 34.6687 {
		t.Fatalf("unexpected provider input: %#v", provider.input)
	}
	var body struct {
		Mode    string `json:"mode"`
		Summary struct {
			DurationSeconds int    `json:"durationSeconds"`
			DistanceMeters  int    `json:"distanceMeters"`
			SummaryText     string `json:"summaryText"`
		} `json:"summary"`
		Map *struct {
			EncodedPolyline string `json:"encodedPolyline"`
		} `json:"map"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Mode != "transit" || body.Summary.DurationSeconds != 1200 || body.Summary.DistanceMeters != 3500 || body.Summary.SummaryText != "환승 1회" || body.Map == nil || body.Map.EncodedPolyline == "" {
		t.Fatalf("unexpected route preview response: %#v", body)
	}
}

func TestCreateRoutePreviewUnsupportedManualPlace(t *testing.T) {
	backend := newFakeAuthBackend()
	accessToken := loginTestUser(t, backend)
	tripID := createTestTrip(t, backend, accessToken)
	item := createTestScheduleItem(t, backend, accessToken, tripID, "2026-07-10", `{"name":"수동 장소","address":"Address","placeType":"sights"}`)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/trips/"+tripID+"/days/2026-07-10/schedule-items/"+item.ID+"/route-preview", bytes.NewReader([]byte(`{"origin":{"latitude":34.6,"longitude":135.5}}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)
	NewRouterWithConfig(backend, Config{AuthTokenSecret: "test-secret", AllowDevOAuth: true, RouteProvider: &fakeRouteProvider{}}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusConflict, recorder.Code, recorder.Body.String())
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "ROUTE_PREVIEW_UNSUPPORTED_PLACE" {
		t.Fatalf("expected unsupported code, got %q", body.Error.Code)
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
	users            map[string]auth.User
	identityUser     map[string]string
	sessions         map[string]auth.Session
	deletedUsers     map[string]bool
	trips            map[string]tripdomain.Trip
	participants     map[string][]tripdomain.Participant
	tripPlaces       map[string]tripdomain.TripPlaceSummary
	googleTripPlaces map[string]string
	placeBookmarks   map[string]placedomain.TripPlaceBookmark
	dayLodgingPlaces map[string]tripdomain.TripPlaceSummary
	dayScheduleItems map[string][]tripdomain.ScheduleItem
	dayExpenses      map[string][]tripdomain.DayExpenseListItem
	tripInvites      map[string]tripdomain.TripInvite
	reorderErr       error
	arrivalErr       error
	skipErr          error
	restoreErr       error
	listedTrips      []tripdomain.ListItem
	listTripsUserID  string
	nextUser         int
	nextSession      int
	nextTrip         int
	nextInvite       int
	nextPlace        int
	nextScheduleItem int
	nextExpense      int
}

func (b *fakeAuthBackend) TripToday() time.Time {
	return time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC)
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
		"defaultCurrency":"JPY",
		"destinations":[{
			"cityName":"오사카",
			"countryName":"일본",
			"countryCode":"JP",
			"displayName":"오사카, 일본",
			"latitude":34.6937,
			"longitude":135.5023,
			"radiusMeters":25000,
			"provider":"google",
			"providerPlaceId":"google-city-osaka"
		}]
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

type createdScheduleItem struct {
	ID      string
	PlaceID string
}

func createTestScheduleItem(t *testing.T, backend *fakeAuthBackend, _ string, tripID string, date string, body string) createdScheduleItem {
	t.Helper()

	var request struct {
		Name      string `json:"name"`
		Address   string `json:"address"`
		PlaceType string `json:"placeType"`
	}
	if err := json.NewDecoder(bytes.NewReader([]byte(body))).Decode(&request); err != nil {
		t.Fatalf("decode create schedule item fixture: %v", err)
	}
	item, err := backend.CreateManualScheduleItem(context.Background(), tripdomain.CreateManualScheduleItemRecord{
		TripID:    tripID,
		TripDayID: date,
		Name:      request.Name,
		Address:   request.Address,
		PlaceType: request.PlaceType,
	})
	if err != nil {
		t.Fatalf("create schedule item fixture: %v", err)
	}
	return createdScheduleItem{ID: item.ID, PlaceID: item.Place.ID}
}

func newFakeAuthBackend() *fakeAuthBackend {
	return &fakeAuthBackend{
		fakeReadiness:    fakeReadiness{schema: "initialized"},
		users:            map[string]auth.User{},
		identityUser:     map[string]string{},
		sessions:         map[string]auth.Session{},
		deletedUsers:     map[string]bool{},
		trips:            map[string]tripdomain.Trip{},
		participants:     map[string][]tripdomain.Participant{},
		tripPlaces:       map[string]tripdomain.TripPlaceSummary{},
		googleTripPlaces: map[string]string{},
		placeBookmarks:   map[string]placedomain.TripPlaceBookmark{},
		dayLodgingPlaces: map[string]tripdomain.TripPlaceSummary{},
		dayScheduleItems: map[string][]tripdomain.ScheduleItem{},
		dayExpenses:      map[string][]tripdomain.DayExpenseListItem{},
		tripInvites:      map[string]tripdomain.TripInvite{},
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
	destinations := make([]tripdomain.TripDestination, 0, len(record.Destinations))
	for index, destination := range record.Destinations {
		destinations = append(destinations, tripdomain.TripDestination{
			ID:              testUUID(3000 + b.nextTrip*10 + index),
			TripID:          tripID,
			CityName:        destination.CityName,
			CountryName:     destination.CountryName,
			CountryCode:     destination.CountryCode,
			DisplayName:     destination.DisplayName,
			Latitude:        destination.Latitude,
			Longitude:       destination.Longitude,
			RadiusMeters:    destination.RadiusMeters,
			Provider:        destination.Provider,
			ProviderPlaceID: destination.ProviderPlaceID,
			SortOrder:       destination.SortOrder,
		})
	}
	createdTrip := tripdomain.Trip{
		ID:              tripID,
		Name:            record.Name,
		StartDate:       record.StartDate.Format("2006-01-02"),
		EndDate:         record.EndDate.Format("2006-01-02"),
		DefaultCurrency: record.DefaultCurrency,
		CreatedBy:       record.CreatedBy,
		CreatedAt:       now,
		UpdatedAt:       now,
		Destinations:    destinations,
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

func (b *fakeAuthBackend) ListActiveTripDaysByTrip(_ context.Context, tripID string) ([]tripdomain.TripDay, error) {
	tripRecord, ok := b.trips[tripID]
	if !ok {
		return []tripdomain.TripDay{}, nil
	}
	startDate, _ := time.Parse("2006-01-02", tripRecord.StartDate)
	endDate, _ := time.Parse("2006-01-02", tripRecord.EndDate)
	days := []tripdomain.TripDay{}
	for current, order := startDate, 1; !current.After(endDate); current, order = current.AddDate(0, 0, 1), order+1 {
		date := current.Format("2006-01-02")
		day := tripdomain.TripDay{ID: date, Date: date, DayOrder: order}
		if lodging, ok := b.dayLodgingPlaces[tripID+":"+date]; ok {
			day.LodgingPlace = &lodging
		}
		days = append(days, day)
	}
	return days, nil
}

func (b *fakeAuthBackend) GetActiveTripDayByTripAndID(_ context.Context, tripID string, tripDayID string) (tripdomain.TripDay, bool, error) {
	days, _ := b.ListActiveTripDaysByTrip(context.Background(), tripID)
	for _, day := range days {
		if day.ID == tripDayID || day.Date == tripDayID {
			return day, true, nil
		}
	}
	return tripdomain.TripDay{}, false, nil
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

func (b *fakeAuthBackend) DeleteTripMemberParticipant(_ context.Context, tripID string, participantID string) (bool, error) {
	participants := b.participants[tripID]
	for index, participant := range participants {
		if participant.ID != participantID || participant.Role != tripdomain.RoleMember {
			continue
		}
		b.participants[tripID] = append(participants[:index], participants[index+1:]...)
		return true, nil
	}
	return false, nil
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

func (b *fakeAuthBackend) ListTripPlaces(_ context.Context, tripID string) ([]tripdomain.TripPlaceSummary, error) {
	places := make([]tripdomain.TripPlaceSummary, 0)
	prefix := tripID + ":"
	for key, place := range b.tripPlaces {
		if strings.HasPrefix(key, prefix) {
			places = append(places, place)
		}
	}
	sort.SliceStable(places, func(i, j int) bool { return places[i].ID < places[j].ID })
	return places, nil
}

func (b *fakeAuthBackend) GetGoogleTripPlaceByGooglePlaceID(_ context.Context, tripID string, googlePlaceID string) (tripdomain.TripPlaceSummary, bool, error) {
	placeID, ok := b.googleTripPlaces[tripID+":"+googlePlaceID]
	if !ok {
		return tripdomain.TripPlaceSummary{}, false, nil
	}
	place, ok := b.tripPlaces[tripID+":"+placeID]
	return place, ok, nil
}

func (b *fakeAuthBackend) ListTripPlaceBookmarks(_ context.Context, tripID string) ([]placedomain.TripPlaceBookmark, error) {
	bookmarks := make([]placedomain.TripPlaceBookmark, 0)
	prefix := tripID + ":"
	for key, bookmark := range b.placeBookmarks {
		if strings.HasPrefix(key, prefix) {
			bookmarks = append(bookmarks, bookmark)
		}
	}
	sort.SliceStable(bookmarks, func(i, j int) bool { return bookmarks[i].ID < bookmarks[j].ID })
	return bookmarks, nil
}

func (b *fakeAuthBackend) UpsertGoogleTripPlaceBookmark(_ context.Context, record placedomain.CreateGoogleTripPlaceBookmarkRecord) (placedomain.TripPlaceBookmark, error) {
	placeID, ok := b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID]
	var place tripdomain.TripPlaceSummary
	if ok {
		place = b.tripPlaces[record.TripID+":"+placeID]
	} else {
		b.nextPlace++
		place = tripdomain.TripPlaceSummary{
			ID:        testUUID(6000 + b.nextPlace),
			Name:      record.Name,
			Address:   record.Address,
			PlaceType: record.PlaceType,
			RoutablePlace: &tripdomain.RoutablePlace{
				Provider:      "google",
				GooglePlaceID: record.GooglePlaceID,
				Latitude:      record.Latitude,
				Longitude:     record.Longitude,
			},
		}
		b.tripPlaces[record.TripID+":"+place.ID] = place
		b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID] = place.ID
	}

	key := record.TripID + ":" + place.ID
	bookmark, ok := b.placeBookmarks[key]
	if !ok {
		bookmark = placedomain.TripPlaceBookmark{
			ID:        testUUID(8000 + len(b.placeBookmarks) + 1),
			TripID:    record.TripID,
			Place:     place,
			CreatedAt: b.TripToday(),
		}
	}
	bookmark.Category = record.Category
	bookmark.Place = place
	bookmark.UpdatedAt = b.TripToday()
	b.placeBookmarks[key] = bookmark
	return bookmark, nil
}

func (b *fakeAuthBackend) DeleteTripPlaceBookmark(_ context.Context, tripID string, bookmarkID string) (bool, error) {
	prefix := tripID + ":"
	for key, bookmark := range b.placeBookmarks {
		if strings.HasPrefix(key, prefix) && bookmark.ID == bookmarkID {
			delete(b.placeBookmarks, key)
			return true, nil
		}
	}
	return false, nil
}

func (b *fakeAuthBackend) SetDayLodgingPlace(_ context.Context, record tripdomain.SetDayLodgingPlaceRecord) (tripdomain.TripPlaceSummary, error) {
	place, ok := b.tripPlaces[record.TripID+":"+record.TripPlaceID]
	if !ok {
		return tripdomain.TripPlaceSummary{}, tripdomain.ErrNotFound
	}
	b.dayLodgingPlaces[record.TripID+":"+record.TripDayID] = place
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	return place, nil
}

func (b *fakeAuthBackend) CreateManualDayLodgingPlace(_ context.Context, record tripdomain.CreateManualDayLodgingPlaceRecord) (tripdomain.TripPlaceSummary, error) {
	b.nextPlace++
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		Address:   record.Address,
		PlaceType: "lodging",
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.dayLodgingPlaces[record.TripID+":"+record.TripDayID] = place
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	return place, nil
}

func (b *fakeAuthBackend) CreateGoogleDayLodgingPlace(_ context.Context, record placedomain.CreateGoogleDayLodgingPlaceRecord) (tripdomain.TripPlaceSummary, error) {
	if placeID, ok := b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID]; ok {
		place, ok := b.tripPlaces[record.TripID+":"+placeID]
		if !ok {
			return tripdomain.TripPlaceSummary{}, tripdomain.ErrNotFound
		}
		b.dayLodgingPlaces[record.TripID+":"+record.TripDayID] = place
		b.markDayScheduleLodging(record.TripID, record.TripDayID)
		return place, nil
	}

	b.nextPlace++
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		Address:   record.Address,
		PlaceType: record.PlaceType,
		RoutablePlace: &tripdomain.RoutablePlace{
			Provider:      "google",
			GooglePlaceID: record.GooglePlaceID,
			Latitude:      record.Latitude,
			Longitude:     record.Longitude,
		},
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID] = place.ID
	b.dayLodgingPlaces[record.TripID+":"+record.TripDayID] = place
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	return place, nil
}

func (b *fakeAuthBackend) DeleteDayLodgingPlace(_ context.Context, tripID string, date string) error {
	delete(b.dayLodgingPlaces, tripID+":"+date)
	b.markDayScheduleLodging(tripID, date)
	return nil
}

func (b *fakeAuthBackend) ListScheduleItemsByTripDay(_ context.Context, tripID string, date string) ([]tripdomain.ScheduleItem, error) {
	b.markDayScheduleLodging(tripID, date)
	return b.dayScheduleItems[tripID+":"+date], nil
}

func (b *fakeAuthBackend) ListDayExpensesByTripDay(_ context.Context, tripID string, date string) ([]tripdomain.DayExpenseListItem, error) {
	expenses := append([]tripdomain.DayExpenseListItem(nil), b.dayExpenses[tripID+":"+date]...)
	sort.SliceStable(expenses, func(left, right int) bool {
		if expenses[left].CreatedAt.Equal(expenses[right].CreatedAt) {
			return expenses[left].ID > expenses[right].ID
		}
		return expenses[left].CreatedAt.After(expenses[right].CreatedAt)
	})
	return expenses, nil
}

func (b *fakeAuthBackend) GetTripSettlementInput(_ context.Context, tripID string) (tripdomain.SettlementInput, error) {
	participants := make([]tripdomain.SettlementParticipantInput, 0, len(b.participants[tripID]))
	for _, participant := range b.participants[tripID] {
		participants = append(participants, tripdomain.SettlementParticipantInput{
			ParticipantID: participant.ID,
			DisplayName:   participant.DisplayName,
			JoinedAt:      participant.JoinedAt,
		})
	}

	expenses := make([]tripdomain.SettlementExpenseInput, 0)
	prefix := tripID + ":"
	for key, dayExpenses := range b.dayExpenses {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		for _, dayExpense := range dayExpenses {
			splits := make([]tripdomain.SettlementSplitInput, 0, len(dayExpense.Splits))
			for _, split := range dayExpense.Splits {
				splits = append(splits, tripdomain.SettlementSplitInput{
					ParticipantID:   copyStringPtr(split.Participant.ParticipantID),
					DisplayName:     split.Participant.DisplayName,
					ParticipantLive: split.Participant.ParticipantID != nil,
					AmountMinor:     split.AmountMinor,
					SplitOrder:      split.SplitOrder,
				})
			}
			expenses = append(expenses, tripdomain.SettlementExpenseInput{
				ExpenseID:            dayExpense.ID,
				Currency:             dayExpense.Currency,
				AmountMinor:          dayExpense.AmountMinor,
				PayerParticipantID:   copyStringPtr(dayExpense.Payer.ParticipantID),
				PayerDisplayName:     dayExpense.Payer.DisplayName,
				PayerParticipantLive: dayExpense.Payer.ParticipantID != nil,
				Splits:               splits,
			})
		}
	}
	return tripdomain.SettlementInput{Participants: participants, Expenses: expenses}, nil
}

func testStringPtr(value string) *string {
	return &value
}

func copyStringPtr(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func (b *fakeAuthBackend) GetExpenseByTripDayAndID(_ context.Context, tripID string, tripDayID string, expenseID string) (tripdomain.Expense, bool, error) {
	for _, dayExpense := range b.dayExpenses[tripID+":"+tripDayID] {
		if dayExpense.ID == expenseID {
			return expenseFromDayExpenseListItem(tripID, dayExpense), true, nil
		}
	}
	return tripdomain.Expense{}, false, nil
}

func (b *fakeAuthBackend) UpdateExpense(_ context.Context, record tripdomain.UpdateExpenseRecord) (tripdomain.Expense, error) {
	foundTrip, ok := b.trips[record.TripID]
	if !ok {
		return tripdomain.Expense{}, tripdomain.ErrNotFound
	}

	key := record.TripID + ":" + record.TripDayID
	expenseIndex := -1
	for index, expense := range b.dayExpenses[key] {
		if expense.ID == record.ExpenseID {
			expenseIndex = index
			break
		}
	}
	if expenseIndex < 0 {
		return tripdomain.Expense{}, tripdomain.ErrNotFound
	}

	var payer tripdomain.Participant
	for _, participant := range b.participants[record.TripID] {
		if participant.ID == record.PayerParticipantID {
			payer = participant
			break
		}
	}
	if payer.ID == "" {
		return tripdomain.Expense{}, tripdomain.ErrNotFound
	}

	allParticipants := make([]tripdomain.ExpenseSplitParticipant, 0, len(b.participants[record.TripID]))
	for _, participant := range b.participants[record.TripID] {
		allParticipants = append(allParticipants, tripdomain.ExpenseSplitParticipant{
			ParticipantID: participant.ID,
			DisplayName:   participant.DisplayName,
			JoinedAt:      participant.JoinedAt,
		})
	}
	splitRecords, err := tripdomain.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return tripdomain.Expense{}, err
	}

	anchorType := "trip_day"
	var scheduleItemID *string
	var placeDisplay *tripdomain.ExpensePlaceDisplay
	displayTitle := "장소 없음"
	if record.ScheduleItemID != nil {
		var foundItem tripdomain.ScheduleItem
		for _, item := range b.dayScheduleItems[key] {
			if item.ID == *record.ScheduleItemID {
				foundItem = item
				break
			}
		}
		if foundItem.ID == "" {
			return tripdomain.Expense{}, tripdomain.ErrNotFound
		}
		itemID := foundItem.ID
		scheduleItemID = &itemID
		anchorType = "schedule_item"
		tripPlaceID := foundItem.Place.ID
		placeAddress := foundItem.Place.Address
		placeType := foundItem.Place.PlaceType
		placeDisplay = &tripdomain.ExpensePlaceDisplay{TripPlaceID: &tripPlaceID, Name: foundItem.Place.Name, Address: &placeAddress, PlaceType: &placeType, Source: tripdomain.ExpenseDisplaySourceLive}
		displayTitle = foundItem.Place.Name
	} else {
		placeAddress := "연결된 장소 없음"
		placeType := "etc"
		placeDisplay = &tripdomain.ExpensePlaceDisplay{Name: displayTitle, Address: &placeAddress, PlaceType: &placeType, Source: tripdomain.ExpenseDisplaySourceFallback}
	}

	payerID := payer.ID
	payerDisplay := tripdomain.ExpenseParticipantDisplay{ParticipantID: &payerID, DisplayName: tripdomain.NormalizeParticipantDisplayName(payer.DisplayName), Source: tripdomain.ExpenseDisplaySourceLive}
	splits := make([]tripdomain.ExpenseSplit, 0, len(splitRecords))
	daySplits := make([]tripdomain.DayExpenseSplitListItem, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		participantID := splitRecord.ParticipantID
		participantDisplay := tripdomain.ExpenseParticipantDisplay{ParticipantID: &participantID, DisplayName: splitRecord.ParticipantDisplayName, Source: tripdomain.ExpenseDisplaySourceLive}
		splits = append(splits, tripdomain.ExpenseSplit{Participant: participantDisplay, AmountMinor: splitRecord.AmountMinor})
		daySplits = append(daySplits, tripdomain.DayExpenseSplitListItem{SplitOrder: splitRecord.SplitOrder, Participant: participantDisplay, AmountMinor: splitRecord.AmountMinor})
	}

	tripDayID := record.TripDayID
	existing := b.dayExpenses[key][expenseIndex]
	updatedDayExpense := tripdomain.DayExpenseListItem{
		ID:             existing.ID,
		AnchorType:     anchorType,
		TripDayID:      &tripDayID,
		ScheduleItemID: scheduleItemID,
		ExpenseDate:    existing.ExpenseDate,
		DisplayTitle:   displayTitle,
		Place:          placeDisplay,
		AmountMinor:    record.AmountMinor,
		Currency:       foundTrip.DefaultCurrency,
		Payer:          payerDisplay,
		SplitPolicy:    record.SplitPolicy,
		Splits:         daySplits,
		CreatedAt:      existing.CreatedAt,
	}
	b.dayExpenses[key][expenseIndex] = updatedDayExpense

	return tripdomain.Expense{
		ID:             updatedDayExpense.ID,
		TripID:         record.TripID,
		AnchorType:     updatedDayExpense.AnchorType,
		TripDayID:      updatedDayExpense.TripDayID,
		ScheduleItemID: updatedDayExpense.ScheduleItemID,
		ExpenseDate:    updatedDayExpense.ExpenseDate,
		DisplayTitle:   updatedDayExpense.DisplayTitle,
		Place:          updatedDayExpense.Place,
		AmountMinor:    updatedDayExpense.AmountMinor,
		Currency:       updatedDayExpense.Currency,
		Payer:          updatedDayExpense.Payer,
		Memo:           record.Memo,
		SplitPolicy:    updatedDayExpense.SplitPolicy,
		Splits:         splits,
		CreatedAt:      updatedDayExpense.CreatedAt,
	}, nil
}

func (b *fakeAuthBackend) DeleteExpenseByTripDayAndID(_ context.Context, tripID string, tripDayID string, expenseID string) (bool, error) {
	key := tripID + ":" + tripDayID
	for index, expense := range b.dayExpenses[key] {
		if expense.ID == expenseID {
			b.dayExpenses[key] = append(b.dayExpenses[key][:index], b.dayExpenses[key][index+1:]...)
			return true, nil
		}
	}
	return false, nil
}

func expenseFromDayExpenseListItem(tripID string, expense tripdomain.DayExpenseListItem) tripdomain.Expense {
	return tripdomain.Expense{
		ID:             expense.ID,
		TripID:         tripID,
		AnchorType:     expense.AnchorType,
		TripDayID:      expense.TripDayID,
		ScheduleItemID: expense.ScheduleItemID,
		ExpenseDate:    expense.ExpenseDate,
		DisplayTitle:   expense.DisplayTitle,
		Place:          expense.Place,
		AmountMinor:    expense.AmountMinor,
		Currency:       expense.Currency,
		Payer:          expense.Payer,
		SplitPolicy:    expense.SplitPolicy,
		Splits:         expenseSplitsFromDaySplits(expense.Splits),
		CreatedAt:      expense.CreatedAt,
	}
}

func expenseSplitsFromDaySplits(daySplits []tripdomain.DayExpenseSplitListItem) []tripdomain.ExpenseSplit {
	splits := make([]tripdomain.ExpenseSplit, 0, len(daySplits))
	for _, split := range daySplits {
		splits = append(splits, tripdomain.ExpenseSplit{Participant: split.Participant, AmountMinor: split.AmountMinor})
	}
	return splits
}

func (b *fakeAuthBackend) CreateQuickExpense(_ context.Context, record tripdomain.CreateQuickExpenseRecord) (tripdomain.CreateQuickExpenseResult, error) {
	foundTrip, ok := b.trips[record.TripID]
	if !ok {
		return tripdomain.CreateQuickExpenseResult{}, tripdomain.ErrNotFound
	}

	var foundItem tripdomain.ScheduleItem
	for _, item := range b.dayScheduleItems[record.TripID+":"+record.TripDayID] {
		if item.ID == record.ScheduleItemID {
			foundItem = item
			break
		}
	}
	if foundItem.ID == "" {
		return tripdomain.CreateQuickExpenseResult{}, tripdomain.ErrNotFound
	}

	var payer tripdomain.Participant
	for _, participant := range b.participants[record.TripID] {
		if participant.ID == record.PayerParticipantID {
			payer = participant
			break
		}
	}
	if payer.ID == "" {
		return tripdomain.CreateQuickExpenseResult{}, tripdomain.ErrNotFound
	}

	allParticipants := make([]tripdomain.ExpenseSplitParticipant, 0, len(b.participants[record.TripID]))
	for _, participant := range b.participants[record.TripID] {
		allParticipants = append(allParticipants, tripdomain.ExpenseSplitParticipant{
			ParticipantID: participant.ID,
			DisplayName:   participant.DisplayName,
			JoinedAt:      participant.JoinedAt,
		})
	}
	splitRecords, err := tripdomain.BuildExpenseSplitRecords(record.AmountMinor, record.SplitPolicy, allParticipants, record.ParticipantIDs, record.ManualSplits)
	if err != nil {
		return tripdomain.CreateQuickExpenseResult{}, err
	}

	splits := make([]tripdomain.ExpenseSplit, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		participantID := splitRecord.ParticipantID
		splits = append(splits, tripdomain.ExpenseSplit{
			Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &participantID, DisplayName: splitRecord.ParticipantDisplayName, Source: tripdomain.ExpenseDisplaySourceLive},
			AmountMinor: splitRecord.AmountMinor,
		})
	}

	b.nextExpense++
	scheduleItemID := foundItem.ID
	tripPlaceID := foundItem.Place.ID
	payerParticipantID := payer.ID
	expenseID := testUUID(9000 + b.nextExpense)
	createdAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC).Add(time.Duration(b.nextExpense) * time.Minute)
	placeAddress := foundItem.Place.Address
	placeType := foundItem.Place.PlaceType
	placeDisplay := &tripdomain.ExpensePlaceDisplay{TripPlaceID: &tripPlaceID, Name: foundItem.Place.Name, Address: &placeAddress, PlaceType: &placeType, Source: tripdomain.ExpenseDisplaySourceLive}
	payerDisplay := tripdomain.ExpenseParticipantDisplay{ParticipantID: &payerParticipantID, DisplayName: tripdomain.NormalizeParticipantDisplayName(payer.DisplayName), Source: tripdomain.ExpenseDisplaySourceLive}

	daySplits := make([]tripdomain.DayExpenseSplitListItem, 0, len(splitRecords))
	for _, splitRecord := range splitRecords {
		participantID := splitRecord.ParticipantID
		daySplits = append(daySplits, tripdomain.DayExpenseSplitListItem{
			SplitOrder:  splitRecord.SplitOrder,
			Participant: tripdomain.ExpenseParticipantDisplay{ParticipantID: &participantID, DisplayName: splitRecord.ParticipantDisplayName, Source: tripdomain.ExpenseDisplaySourceLive},
			AmountMinor: splitRecord.AmountMinor,
		})
	}
	tripDayID := record.TripDayID
	b.dayExpenses[record.TripID+":"+record.TripDayID] = append(b.dayExpenses[record.TripID+":"+record.TripDayID], tripdomain.DayExpenseListItem{
		ID:             expenseID,
		AnchorType:     "schedule_item",
		TripDayID:      &tripDayID,
		ScheduleItemID: &scheduleItemID,
		ExpenseDate:    "2026-07-10",
		DisplayTitle:   foundItem.Place.Name,
		Place:          placeDisplay,
		AmountMinor:    record.AmountMinor,
		Currency:       foundTrip.DefaultCurrency,
		Payer:          payerDisplay,
		SplitPolicy:    record.SplitPolicy,
		Splits:         daySplits,
		CreatedAt:      createdAt,
	})

	return tripdomain.CreateQuickExpenseResult{Expense: tripdomain.Expense{
		ID:             expenseID,
		TripID:         record.TripID,
		AnchorType:     "schedule_item",
		TripDayID:      &tripDayID,
		ScheduleItemID: &scheduleItemID,
		ExpenseDate:    "2026-07-10",
		DisplayTitle:   foundItem.Place.Name,
		Place:          placeDisplay,
		AmountMinor:    record.AmountMinor,
		Currency:       foundTrip.DefaultCurrency,
		Payer:          payerDisplay,
		SplitPolicy:    record.SplitPolicy,
		Splits:         splits,
		CreatedAt:      createdAt,
	}}, nil
}

func (b *fakeAuthBackend) CreateManualScheduleItem(_ context.Context, record tripdomain.CreateManualScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	b.nextPlace++
	b.nextScheduleItem++
	key := record.TripID + ":" + record.TripDayID
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		PlaceType: record.PlaceType,
		Address:   record.Address,
	}
	item := tripdomain.ScheduleItem{
		ID:            testUUID(5000 + b.nextScheduleItem),
		ItemOrder:     len(b.dayScheduleItems[key]) + 1,
		Version:       1,
		ItemType:      tripdomain.ScheduleItemTypePlace,
		Place:         place,
		PlaceSchedule: &tripdomain.PlaceScheduleItemDetails{Title: record.Name},
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.dayScheduleItems[key] = append(b.dayScheduleItems[key], item)
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	return item, nil
}

func (b *fakeAuthBackend) CreateNonPlaceScheduleItem(_ context.Context, record tripdomain.CreateNonPlaceScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	b.nextScheduleItem++
	key := record.TripID + ":" + record.TripDayID
	item := tripdomain.ScheduleItem{
		ID:        testUUID(5000 + b.nextScheduleItem),
		ItemOrder: len(b.dayScheduleItems[key]) + 1,
		Version:   1,
		ItemType:  tripdomain.ScheduleItemTypeNonPlace,
		StartTime: record.StartTime,
		EndTime:   record.EndTime,
		NonPlace:  &record.Details,
	}
	b.dayScheduleItems[key] = append(b.dayScheduleItems[key], item)
	return item, nil
}

func (b *fakeAuthBackend) AppendGooglePlaceScheduleItem(_ context.Context, record placedomain.AppendGooglePlaceScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	place, ok := b.tripPlaces[record.TripID+":"+record.TripPlaceID]
	if !ok {
		return tripdomain.ScheduleItem{}, placedomain.ErrNotFound
	}
	key := record.TripID + ":" + record.TripDayID
	if !record.DuplicateConfirmed {
		for _, item := range b.dayScheduleItems[key] {
			if item.Place.ID == record.TripPlaceID {
				return tripdomain.ScheduleItem{}, placedomain.DuplicateDayPlaceConfirmationError{TripPlaceID: record.TripPlaceID}
			}
		}
	}
	b.nextScheduleItem++
	item := tripdomain.ScheduleItem{
		ID:            testUUID(5000 + b.nextScheduleItem),
		ItemOrder:     len(b.dayScheduleItems[key]) + 1,
		Version:       1,
		ItemType:      tripdomain.ScheduleItemTypePlace,
		StartTime:     record.StartTime,
		EndTime:       record.EndTime,
		Place:         place,
		PlaceSchedule: &tripdomain.PlaceScheduleItemDetails{Title: record.Title, Memo: record.Memo},
	}
	b.dayScheduleItems[key] = append(b.dayScheduleItems[key], item)
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	return item, nil
}

func (b *fakeAuthBackend) CreateGooglePlaceScheduleItem(ctx context.Context, record placedomain.CreateGooglePlaceScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	if placeID, ok := b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID]; ok {
		return b.AppendGooglePlaceScheduleItem(ctx, placedomain.AppendGooglePlaceScheduleItemRecord{
			TripID:             record.TripID,
			TripDayID:          record.TripDayID,
			TripPlaceID:        placeID,
			DuplicateConfirmed: record.DuplicateConfirmed,
			Title:              record.Title,
			StartTime:          record.StartTime,
			EndTime:            record.EndTime,
			Memo:               record.Memo,
		})
	}

	b.nextPlace++
	place := tripdomain.TripPlaceSummary{
		ID:        testUUID(6000 + b.nextPlace),
		Name:      record.Name,
		PlaceType: record.PlaceType,
		Address:   record.Address,
		RoutablePlace: &tripdomain.RoutablePlace{
			Provider:      "google",
			GooglePlaceID: record.GooglePlaceID,
			Latitude:      record.Latitude,
			Longitude:     record.Longitude,
		},
	}
	b.tripPlaces[record.TripID+":"+place.ID] = place
	b.googleTripPlaces[record.TripID+":"+record.GooglePlaceID] = place.ID
	return b.AppendGooglePlaceScheduleItem(ctx, placedomain.AppendGooglePlaceScheduleItemRecord{
		TripID:             record.TripID,
		TripDayID:          record.TripDayID,
		TripPlaceID:        place.ID,
		DuplicateConfirmed: record.DuplicateConfirmed,
		Title:              record.Title,
		StartTime:          record.StartTime,
		EndTime:            record.EndTime,
		Memo:               record.Memo,
	})
}

func (b *fakeAuthBackend) GetScheduleItemByTripDayAndID(_ context.Context, tripID string, date string, itemID string) (tripdomain.ScheduleItem, bool, error) {
	for _, item := range b.dayScheduleItems[tripID+":"+date] {
		if item.ID == itemID {
			return item, true, nil
		}
	}
	return tripdomain.ScheduleItem{}, false, nil
}

func (b *fakeAuthBackend) ReorderScheduleItems(_ context.Context, record tripdomain.ReorderScheduleItemsRecord) ([]tripdomain.ScheduleItem, error) {
	if b.reorderErr != nil {
		return nil, b.reorderErr
	}
	return b.dayScheduleItems[record.TripID+":"+record.TripDayID], nil
}

func (b *fakeAuthBackend) MarkScheduleItemArrived(_ context.Context, record tripdomain.MarkScheduleItemArrivedRecord) (tripdomain.MarkScheduleItemArrivedMutationResult, error) {
	if b.arrivalErr != nil {
		return tripdomain.MarkScheduleItemArrivedMutationResult{}, b.arrivalErr
	}

	key := record.TripID + ":" + record.TripDayID
	items := b.dayScheduleItems[key]
	targetIndex := -1
	firstPendingIndex := -1
	for index, item := range items {
		if targetIndex < 0 && item.ID == record.ItemID {
			targetIndex = index
		}
		if firstPendingIndex < 0 && item.ArrivedAt == nil && item.SkippedAt == nil {
			firstPendingIndex = index
		}
	}
	if targetIndex < 0 {
		return tripdomain.MarkScheduleItemArrivedMutationResult{}, tripdomain.ErrNotFound
	}

	if items[targetIndex].SkippedAt != nil {
		return tripdomain.MarkScheduleItemArrivedMutationResult{}, tripdomain.ErrConflict
	}

	if items[targetIndex].ArrivedAt == nil {
		if firstPendingIndex < 0 || firstPendingIndex != targetIndex {
			return tripdomain.MarkScheduleItemArrivedMutationResult{}, tripdomain.ErrConflict
		}
		arrivedAt := time.Date(2026, 7, 10, 9, 30, 0, 0, time.UTC)
		items[targetIndex].ArrivedAt = &arrivedAt
		b.dayScheduleItems[key] = items
	}

	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	items = b.dayScheduleItems[key]
	return tripdomain.MarkScheduleItemArrivedMutationResult{Item: items[targetIndex], Items: items}, nil
}

func (b *fakeAuthBackend) MarkScheduleItemSkipped(_ context.Context, record tripdomain.MarkScheduleItemSkippedRecord) (tripdomain.MarkScheduleItemSkippedMutationResult, error) {
	if b.skipErr != nil {
		return tripdomain.MarkScheduleItemSkippedMutationResult{}, b.skipErr
	}

	key := record.TripID + ":" + record.TripDayID
	items := b.dayScheduleItems[key]
	targetIndex := -1
	firstPendingIndex := -1
	for index, item := range items {
		if targetIndex < 0 && item.ID == record.ItemID {
			targetIndex = index
		}
		if firstPendingIndex < 0 && item.ArrivedAt == nil && item.SkippedAt == nil {
			firstPendingIndex = index
		}
	}
	if targetIndex < 0 {
		return tripdomain.MarkScheduleItemSkippedMutationResult{}, tripdomain.ErrNotFound
	}
	if items[targetIndex].ArrivedAt != nil {
		return tripdomain.MarkScheduleItemSkippedMutationResult{}, tripdomain.ErrConflict
	}

	if items[targetIndex].SkippedAt == nil {
		if firstPendingIndex < 0 || firstPendingIndex != targetIndex {
			return tripdomain.MarkScheduleItemSkippedMutationResult{}, tripdomain.ErrConflict
		}
		skippedAt := time.Date(2026, 7, 10, 10, 30, 0, 0, time.UTC)
		items[targetIndex].SkippedAt = &skippedAt
		b.dayScheduleItems[key] = items
	}

	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	items = b.dayScheduleItems[key]
	return tripdomain.MarkScheduleItemSkippedMutationResult{Item: items[targetIndex], Items: items}, nil
}

func (b *fakeAuthBackend) RestoreScheduleItem(_ context.Context, record tripdomain.RestoreScheduleItemRecord) (tripdomain.RestoreScheduleItemMutationResult, error) {
	if b.restoreErr != nil {
		return tripdomain.RestoreScheduleItemMutationResult{}, b.restoreErr
	}

	key := record.TripID + ":" + record.TripDayID
	items := b.dayScheduleItems[key]
	targetIndex := -1
	for index, item := range items {
		if item.ID == record.ItemID {
			targetIndex = index
			break
		}
	}
	if targetIndex < 0 {
		return tripdomain.RestoreScheduleItemMutationResult{}, tripdomain.ErrNotFound
	}
	if items[targetIndex].ArrivedAt != nil {
		return tripdomain.RestoreScheduleItemMutationResult{}, tripdomain.ErrConflict
	}

	items[targetIndex].SkippedAt = nil
	b.dayScheduleItems[key] = items
	b.markDayScheduleLodging(record.TripID, record.TripDayID)
	items = b.dayScheduleItems[key]
	return tripdomain.RestoreScheduleItemMutationResult{Item: items[targetIndex], Items: items}, nil
}

func (b *fakeAuthBackend) UpdateScheduleItemPlace(_ context.Context, record tripdomain.UpdateScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	var updated tripdomain.ScheduleItem
	for key, items := range b.dayScheduleItems {
		if !strings.HasPrefix(key, record.TripID+":") {
			continue
		}
		for index, item := range items {
			if key == record.TripID+":"+record.TripDayID && item.ID == record.ItemID {
				item.Place.Name = record.Name
				item.Place.Address = record.Address
				item.Place.PlaceType = record.PlaceType
				item.StartTime = record.StartTime
				item.EndTime = record.EndTime
				updated = item
				items[index] = item
				b.dayScheduleItems[key] = items
				break
			}
		}
	}
	if updated.ID == "" {
		return tripdomain.ScheduleItem{}, tripdomain.ErrNotFound
	}
	b.tripPlaces[record.TripID+":"+updated.Place.ID] = updated.Place
	for lodgingKey, lodgingPlace := range b.dayLodgingPlaces {
		if strings.HasPrefix(lodgingKey, record.TripID+":") && lodgingPlace.ID == updated.Place.ID {
			b.dayLodgingPlaces[lodgingKey] = updated.Place
		}
	}
	for key, items := range b.dayScheduleItems {
		if !strings.HasPrefix(key, record.TripID+":") {
			continue
		}
		for index, item := range items {
			if item.Place.ID == updated.Place.ID {
				item.Place = updated.Place
				items[index] = item
			}
		}
		b.dayScheduleItems[key] = items
	}
	return updated, nil
}

func (b *fakeAuthBackend) UpdateNonPlaceScheduleItem(_ context.Context, record tripdomain.UpdateNonPlaceScheduleItemRecord) (tripdomain.ScheduleItem, error) {
	key := record.TripID + ":" + record.TripDayID
	items := b.dayScheduleItems[key]
	for index, item := range items {
		if item.ID == record.ItemID && item.ItemType == tripdomain.ScheduleItemTypeNonPlace {
			item.StartTime = record.StartTime
			item.EndTime = record.EndTime
			item.NonPlace = &record.Details
			items[index] = item
			b.dayScheduleItems[key] = items
			return item, nil
		}
	}
	return tripdomain.ScheduleItem{}, tripdomain.ErrNotFound
}

func (b *fakeAuthBackend) DeleteScheduleItem(_ context.Context, tripID string, date string, itemID string) (bool, error) {
	key := tripID + ":" + date
	items := b.dayScheduleItems[key]
	for index, item := range items {
		if item.ID != itemID {
			continue
		}
		placeID := item.Place.ID
		b.dayScheduleItems[key] = append(items[:index], items[index+1:]...)
		if !b.hasSchedulePlace(tripID, placeID) && !b.hasDayLodgingPlace(tripID, placeID) {
			delete(b.tripPlaces, tripID+":"+placeID)
			for lodgingKey, lodgingPlace := range b.dayLodgingPlaces {
				if strings.HasPrefix(lodgingKey, tripID+":") && lodgingPlace.ID == placeID {
					delete(b.dayLodgingPlaces, lodgingKey)
				}
			}
		}
		b.markDayScheduleLodging(tripID, date)
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

func (b *fakeAuthBackend) markDayScheduleLodging(tripID string, date string) {
	key := tripID + ":" + date
	lodgingPlace, ok := b.dayLodgingPlaces[key]
	items := b.dayScheduleItems[key]
	for index, item := range items {
		item.IsLodging = ok && item.Place.ID == lodgingPlace.ID
		items[index] = item
	}
	b.dayScheduleItems[key] = items
}

func (b *fakeAuthBackend) hasSchedulePlace(tripID string, placeID string) bool {
	for key, items := range b.dayScheduleItems {
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
				ParticipantID:    participant.ID,
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
	called             bool
	input              placedomain.ProviderSearchInput
	results            []placedomain.SearchResult
	err                error
	destinationCalled  bool
	destinationInput   placedomain.ProviderDestinationSearchInput
	destinationResults []placedomain.DestinationSearchResult
	destinationErr     error
	detailsCalled      bool
	detailsInput       placedomain.ProviderDetailsInput
	details            placedomain.GooglePlaceDetails
	detailsErr         error
	descriptionCalled  bool
	descriptionInput   placedomain.ProviderDescriptionInput
	description        placedomain.GooglePlaceDescription
	descriptionErr     error
	photoCalled        bool
	photoInput         placedomain.ProviderPhotoInput
	photo              placedomain.GooglePlacePhoto
	photoErr           error
}

func (p *fakePlaceProvider) Search(_ context.Context, input placedomain.ProviderSearchInput) ([]placedomain.SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}

func (p *fakePlaceProvider) SearchDestinations(_ context.Context, input placedomain.ProviderDestinationSearchInput) ([]placedomain.DestinationSearchResult, error) {
	p.destinationCalled = true
	p.destinationInput = input
	return p.destinationResults, p.destinationErr
}

func (p *fakePlaceProvider) Details(_ context.Context, input placedomain.ProviderDetailsInput) (placedomain.GooglePlaceDetails, error) {
	p.detailsCalled = true
	p.detailsInput = input
	return p.details, p.detailsErr
}

func (p *fakePlaceProvider) Description(_ context.Context, input placedomain.ProviderDescriptionInput) (placedomain.GooglePlaceDescription, error) {
	p.descriptionCalled = true
	p.descriptionInput = input
	return p.description, p.descriptionErr
}

func (p *fakePlaceProvider) Photo(_ context.Context, input placedomain.ProviderPhotoInput) (placedomain.GooglePlacePhoto, error) {
	p.photoCalled = true
	p.photoInput = input
	return p.photo, p.photoErr
}

type fakeRouteProvider struct {
	called bool
	input  routedomain.ProviderPreviewInput
	result routedomain.ProviderPreviewResult
	err    error
}

func (p *fakeRouteProvider) Preview(_ context.Context, input routedomain.ProviderPreviewInput) (routedomain.ProviderPreviewResult, error) {
	p.called = true
	p.input = input
	return p.result, p.err
}

func testUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}
