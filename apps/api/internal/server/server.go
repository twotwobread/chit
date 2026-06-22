package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

type readinessChecker interface {
	CheckReady(context.Context) (string, error)
}

type Config struct {
	AuthTokenSecret string
	AppleAudience   string
	AllowDevOAuth   bool
}

type apiServer struct {
	readiness readinessChecker
	auth      *auth.Service
	trips     *trip.Service
}

func NewRouter(readiness readinessChecker) http.Handler {
	return NewRouterWithConfig(readiness, ConfigFromEnv())
}

func NewRouterWithConfig(readiness readinessChecker, config Config) http.Handler {
	var authService *auth.Service
	if repo, ok := readiness.(auth.Repository); ok {
		authService = auth.NewService(
			repo,
			auth.NewHTTPProviderVerifier(auth.ProviderConfig{
				AppleAudience: config.AppleAudience,
				AllowDevOAuth: config.AllowDevOAuth,
			}),
			auth.NewTokenManager(config.AuthTokenSecret),
		)
	}

	var tripService *trip.Service
	if repo, ok := readiness.(trip.Repository); ok {
		tripService = trip.NewService(repo)
	}

	router := chi.NewRouter()
	return openapi.HandlerFromMux(apiServer{readiness: readiness, auth: authService, trips: tripService}, router)
}

func ConfigFromEnv() Config {
	return Config{
		AuthTokenSecret: os.Getenv("AUTH_TOKEN_SECRET"),
		AppleAudience:   firstNonEmpty(os.Getenv("APPLE_CLIENT_ID"), os.Getenv("APPLE_BUNDLE_ID")),
		AllowDevOAuth:   envBool(os.Getenv("AUTH_ALLOW_DEV_OAUTH")),
	}
}

func (apiServer) GetHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, openapi.HealthResponse{Status: openapi.HealthResponseStatusOk})
}

func (s apiServer) GetReady(w http.ResponseWriter, r *http.Request) {
	if s.readiness == nil {
		writeServiceUnavailable(w)
		return
	}

	schema, err := s.readiness.CheckReady(r.Context())
	if err != nil {
		writeServiceUnavailable(w)
		return
	}

	writeJSON(w, http.StatusOK, openapi.ReadinessResponse{
		Status: openapi.ReadinessResponseStatusOk,
		Checks: openapi.ReadinessChecks{
			Database: openapi.ReadinessCheck{
				Status: openapi.ReadinessCheckStatusOk,
			},
			Metadata: openapi.MetadataReadinessCheck{
				Status: openapi.MetadataReadinessCheckStatusOk,
				Schema: openapi.MetadataReadinessCheckSchema(schema),
			},
		},
	})
}

func (s apiServer) ListTrips(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip listing is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	trips, err := s.trips.List(r.Context(), authContext.UserID)
	if err != nil {
		writeTripError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripsResponseToOpenAPI(trips))
}

func (s apiServer) CreateTrip(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateTripJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.Create(r.Context(), authContext.UserID, trip.CreateInput{
		Name:            body.Name,
		StartDate:       dateFromOpenAPI(body.StartDate),
		EndDate:         dateFromOpenAPI(body.EndDate),
		DefaultCurrency: string(body.DefaultCurrency),
	})
	if err != nil {
		writeTripError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createTripResponseToOpenAPI(result))
}

func (s apiServer) GetTripDetail(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip detail is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.GetDetail(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripDetailError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getTripDetailResponseToOpenAPI(result))
}

func (s apiServer) UpdateTrip(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip update is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.UpdateTripJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.Update(r.Context(), authContext.UserID, tripId, trip.UpdateInput{
		Name:            body.Name,
		StartDate:       optionalDateFromOpenAPI(body.StartDate),
		EndDate:         optionalDateFromOpenAPI(body.EndDate),
		DefaultCurrency: optionalCurrencyFromOpenAPI(body.DefaultCurrency),
	})
	if err != nil {
		writeTripUpdateError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updateTripResponseToOpenAPI(result))
}

func (s apiServer) DeleteTrip(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip deletion is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.Delete(r.Context(), authContext.UserID, tripId); err != nil {
		writeTripDetailError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) LoginWithOAuth(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	var body openapi.LoginWithOAuthJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.auth.Login(r.Context(), auth.Provider(body.Provider), credentialFromOpenAPI(body.Credential), deviceFromOpenAPI(body.Device, r.UserAgent()))
	if err != nil {
		writeAuthError(w, err, auth.Provider(body.Provider))
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLoginResponse{
		Result: openapi.LoginSuccess,
		User:   userToOpenAPI(result.User),
		Tokens: tokensToOpenAPI(result.Tokens),
	})
}

func (s apiServer) LinkOAuthProvider(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.LinkOAuthProviderJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.auth.LinkProvider(r.Context(), authContext, auth.Provider(body.Provider), credentialFromOpenAPI(body.Credential))
	if err != nil {
		writeAuthError(w, err, auth.Provider(body.Provider))
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLinkResponse{
		Result: openapi.ProviderLinkSuccess,
		LinkedIdentity: openapi.LinkedIdentity{
			Provider:      openapi.AuthProvider(result.Identity.Provider),
			Email:         result.Identity.Email,
			EmailVerified: result.Identity.EmailVerified,
		},
	})
}

func (s apiServer) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	var body openapi.RefreshTokenJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	tokens, err := s.auth.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		writeAuthError(w, err, "")
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthRefreshResponse{
		Result: openapi.RefreshSuccess,
		Tokens: tokensToOpenAPI(tokens),
	})
}

func (s apiServer) Logout(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.auth.Logout(r.Context(), authContext); err != nil {
		writeAuthError(w, err, "")
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLogoutResponse{Result: openapi.LogoutSuccess})
}

func (s apiServer) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.auth.Me(r.Context(), authContext)
	if err != nil {
		writeAuthError(w, err, "")
		return
	}

	providers := make([]openapi.AuthProvider, 0, len(result.LinkedProviders))
	for _, provider := range result.LinkedProviders {
		providers = append(providers, openapi.AuthProvider(provider))
	}

	writeJSON(w, http.StatusOK, openapi.AuthMeResponse{
		User:            userToOpenAPI(result.User),
		LinkedProviders: providers,
	})
}

func (s apiServer) requireAuth(w http.ResponseWriter, r *http.Request) (auth.AuthContext, bool) {
	authContext, err := s.auth.Authenticate(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		writeAuthError(w, err, "")
		return auth.AuthContext{}, false
	}
	return authContext, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out interface{}) bool {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body", nil)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeServiceUnavailable(w http.ResponseWriter) {
	writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "database is not ready", nil)
}

func writeTripError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid trip request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripDetailError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid trip id", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "trip not found", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripUpdateError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid trip update request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "trip not found", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeAuthError(w http.ResponseWriter, err error, provider auth.Provider) {
	switch {
	case errors.Is(err, auth.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid auth request", nil)
	case errors.Is(err, auth.ErrInvalidProviderToken):
		writeError(w, http.StatusUnauthorized, "INVALID_PROVIDER_TOKEN", "provider token is invalid", nil)
	case errors.Is(err, auth.ErrAccountLinkRequired):
		writeError(w, http.StatusConflict, "ACCOUNT_LINK_REQUIRED", "account link required", []map[string]interface{}{{"result": "link_required_conflict", "provider": string(provider)}})
	case errors.Is(err, auth.ErrProviderAlreadyLinked):
		writeError(w, http.StatusConflict, "PROVIDER_ALREADY_LINKED", "provider identity is already linked", []map[string]interface{}{{"result": "provider_already_linked", "provider": string(provider)}})
	case errors.Is(err, auth.ErrInvalidRefreshToken):
		writeError(w, http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", "refresh token is invalid", []map[string]interface{}{{"result": "invalid_refresh_token"}})
	case errors.Is(err, auth.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeError(w http.ResponseWriter, status int, code string, message string, details []map[string]interface{}) {
	if details == nil {
		details = []map[string]interface{}{}
	}
	var body openapi.ErrorResponse
	body.Error.Code = code
	body.Error.Message = message
	body.Error.Details = details
	writeJSON(w, status, body)
}

func credentialFromOpenAPI(value openapi.OAuthCredential) auth.Credential {
	return auth.Credential{
		IdentityToken:     value.IdentityToken,
		AuthorizationCode: value.AuthorizationCode,
		Nonce:             value.Nonce,
		AccessToken:       value.AccessToken,
		DevSubject:        value.DevSubject,
		Email:             value.Email,
		EmailVerified:     value.EmailVerified,
		DisplayName:       value.DisplayName,
		AvatarURL:         value.AvatarUrl,
	}
}

func deviceFromOpenAPI(value *openapi.DeviceInfo, userAgent string) auth.Device {
	device := auth.Device{UserAgent: optionalString(userAgent)}
	if value != nil {
		device.DeviceName = value.DeviceName
		device.Platform = value.Platform
	}
	return device
}

func userToOpenAPI(user auth.User) openapi.AuthUser {
	return openapi.AuthUser{
		Id:          user.ID,
		DisplayName: user.DisplayName,
		Email:       user.Email,
		AvatarUrl:   user.AvatarURL,
	}
}

func tokensToOpenAPI(tokens auth.TokenPair) openapi.AuthTokens {
	return openapi.AuthTokens{
		AccessToken:           tokens.AccessToken,
		AccessTokenExpiresAt:  tokens.AccessTokenExpiresAt,
		RefreshToken:          tokens.RefreshToken,
		RefreshTokenExpiresAt: tokens.RefreshTokenExpiresAt,
	}
}

func listTripsResponseToOpenAPI(trips []trip.ListItem) openapi.ListTripsResponse {
	items := make([]openapi.TripListItem, 0, len(trips))
	for _, item := range trips {
		items = append(items, openapi.TripListItem{
			Id:               item.ID,
			Name:             item.Name,
			StartDate:        dateToOpenAPI(item.StartDate),
			EndDate:          dateToOpenAPI(item.EndDate),
			DefaultCurrency:  openapi.SupportedCurrency(item.DefaultCurrency),
			JoinedAt:         item.JoinedAt,
			CreatedAt:        item.CreatedAt,
			MyRole:           openapi.TripParticipantRole(item.MyRole),
			ParticipantCount: item.ParticipantCount,
		})
	}
	return openapi.ListTripsResponse{Trips: items}
}

func createTripResponseToOpenAPI(result trip.CreateResult) openapi.CreateTripResponse {
	return openapi.CreateTripResponse{
		Trip: tripToOpenAPI(result.Trip),
		OwnerParticipant: openapi.TripParticipant{
			Id:          result.OwnerParticipant.ID,
			TripId:      result.OwnerParticipant.TripID,
			UserId:      result.OwnerParticipant.UserID,
			Role:        openapi.TripParticipantRole(result.OwnerParticipant.Role),
			DisplayName: result.OwnerParticipant.DisplayName,
			JoinedAt:    result.OwnerParticipant.JoinedAt,
		},
	}
}

func getTripDetailResponseToOpenAPI(result trip.GetDetailResult) openapi.GetTripDetailResponse {
	return openapi.GetTripDetailResponse{
		Trip: tripToOpenAPI(result.Trip),
		ParticipantSummary: openapi.TripParticipantSummary{
			TotalCount:    result.ParticipantSummary.TotalCount,
			PreviewNames:  result.ParticipantSummary.PreviewNames,
			OverflowCount: result.ParticipantSummary.OverflowCount,
		},
		Days: tripDaysToOpenAPI(result.Days),
	}
}

func updateTripResponseToOpenAPI(result trip.UpdateResult) openapi.UpdateTripResponse {
	return openapi.UpdateTripResponse{Trip: tripToOpenAPI(result.Trip)}
}

func tripToOpenAPI(value trip.Trip) openapi.Trip {
	return openapi.Trip{
		Id:              value.ID,
		Name:            value.Name,
		StartDate:       dateToOpenAPI(value.StartDate),
		EndDate:         dateToOpenAPI(value.EndDate),
		DefaultCurrency: openapi.SupportedCurrency(value.DefaultCurrency),
		CreatedBy:       value.CreatedBy,
		CreatedAt:       value.CreatedAt,
		UpdatedAt:       value.UpdatedAt,
	}
}

func tripDaysToOpenAPI(days []trip.TripDay) []openapi.TripDay {
	items := make([]openapi.TripDay, 0, len(days))
	for _, day := range days {
		items = append(items, openapi.TripDay{
			Date:     dateToOpenAPI(day.Date),
			DayOrder: day.DayOrder,
		})
	}
	return items
}

func dateFromOpenAPI(value openapi_types.Date) string {
	if value.Time.IsZero() {
		return ""
	}
	return value.Time.Format("2006-01-02")
}

func optionalDateFromOpenAPI(value *openapi_types.Date) *string {
	if value == nil {
		return nil
	}
	date := dateFromOpenAPI(*value)
	return &date
}

func optionalCurrencyFromOpenAPI(value *openapi.SupportedCurrency) *string {
	if value == nil {
		return nil
	}
	currency := string(*value)
	return &currency
}

func dateToOpenAPI(value string) openapi_types.Date {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return openapi_types.Date{}
	}
	return openapi_types.Date{Time: parsed}
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func envBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
