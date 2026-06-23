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
	trips             map[string]tripdomain.Trip
	participants      map[string][]tripdomain.Participant
	dayItineraryItems map[string][]tripdomain.DayItineraryItem
	reorderErr        error
	listedTrips       []tripdomain.ListItem
	listTripsUserID   string
	nextUser          int
	nextSession       int
	nextTrip          int
	nextPlace         int
	nextItineraryItem int
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
		trips:             map[string]tripdomain.Trip{},
		participants:      map[string][]tripdomain.Participant{},
		dayItineraryItems: map[string][]tripdomain.DayItineraryItem{},
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
	return true, nil
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

func (b *fakeAuthBackend) ListItineraryItemsByTripAndDate(_ context.Context, tripID string, date string) ([]tripdomain.DayItineraryItem, error) {
	return b.dayItineraryItems[tripID+":"+date], nil
}

func (b *fakeAuthBackend) CreateManualDayItineraryItem(_ context.Context, record tripdomain.CreateManualDayItineraryItemRecord) (tripdomain.DayItineraryItem, error) {
	b.nextPlace++
	b.nextItineraryItem++
	key := record.TripID + ":" + record.ScheduledDate
	item := tripdomain.DayItineraryItem{
		ID:        testUUID(5000 + b.nextItineraryItem),
		ItemOrder: len(b.dayItineraryItems[key]) + 1,
		Place: tripdomain.TripPlaceSummary{
			ID:        testUUID(6000 + b.nextPlace),
			Name:      record.Name,
			PlaceType: record.PlaceType,
			Address:   record.Address,
		},
	}
	b.dayItineraryItems[key] = append(b.dayItineraryItems[key], item)
	return item, nil
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
		b.dayItineraryItems[key] = append(items[:index], items[index+1:]...)
		return true, nil
	}
	return false, nil
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
	called  bool
	input   placedomain.ProviderSearchInput
	results []placedomain.SearchResult
	err     error
}

func (p *fakePlaceProvider) Search(_ context.Context, input placedomain.ProviderSearchInput) ([]placedomain.SearchResult, error) {
	p.called = true
	p.input = input
	return p.results, p.err
}

func testUUID(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}
