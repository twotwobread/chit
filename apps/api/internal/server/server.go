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
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

type readinessChecker interface {
	CheckReady(context.Context) (string, error)
}

type Config struct {
	AuthTokenSecret    string
	AppleAudience      string
	AllowDevOAuth      bool
	GooglePlacesAPIKey string
	PlaceProvider      place.Provider
}

type apiServer struct {
	readiness readinessChecker
	auth      *auth.Service
	trips     *trip.Service
	places    *place.Service
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

	var placeService *place.Service
	if repo, ok := readiness.(place.Repository); ok {
		provider := config.PlaceProvider
		if provider == nil {
			provider = place.NewGoogleProvider(config.GooglePlacesAPIKey)
		}
		placeService = place.NewService(repo, provider)
	}

	router := chi.NewRouter()
	return openapi.HandlerWithOptions(apiServer{readiness: readiness, auth: authService, trips: tripService, places: placeService}, openapi.ChiServerOptions{
		BaseRouter:       router,
		ErrorHandlerFunc: writeOpenAPIRequestError,
	})
}

func ConfigFromEnv() Config {
	return Config{
		AuthTokenSecret:    os.Getenv("AUTH_TOKEN_SECRET"),
		AppleAudience:      firstNonEmpty(os.Getenv("APPLE_CLIENT_ID"), os.Getenv("APPLE_BUNDLE_ID")),
		AllowDevOAuth:      envBool(os.Getenv("AUTH_ALLOW_DEV_OAUTH")),
		GooglePlacesAPIKey: os.Getenv("GOOGLE_PLACES_API_KEY"),
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

func (s apiServer) GetDayItinerary(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.GetDayItinerary(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date))
	if err != nil {
		writeTripDayItineraryError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getDayItineraryResponseToOpenAPI(result))
}

func (s apiServer) CreateManualDayItineraryItem(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateManualDayItineraryItemJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.CreateManualDayItineraryItem(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), trip.CreateManualDayItineraryItemInput{
		Name:      body.Name,
		Address:   body.Address,
		PlaceType: string(body.PlaceType),
	})
	if err != nil {
		writeTripDayItineraryError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createManualDayItineraryItemResponseToOpenAPI(result))
}

func (s apiServer) SearchGooglePlaces(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, params openapi.SearchGooglePlacesParams) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place search is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	limit := 0
	if params.Limit != nil {
		limit = *params.Limit
	}
	results, err := s.places.SearchGoogle(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), place.SearchInput{
		Query: params.Query,
		Limit: limit,
	})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, searchGooglePlacesResponseToOpenAPI(results))
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

func writeOpenAPIRequestError(w http.ResponseWriter, _ *http.Request, _ error) {
	writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request parameter", nil)
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

func writeTripDayItineraryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day itinerary request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day itinerary not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day itinerary append conflict", nil)
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

func writePlaceSearchError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, place.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid place search request", nil)
	case errors.Is(err, place.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, place.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, place.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "place search context not found", nil)
	case errors.Is(err, place.ErrProviderRateLimited):
		writeError(w, http.StatusTooManyRequests, "PLACE_PROVIDER_RATE_LIMITED", "place provider rate limited", nil)
	case errors.Is(err, place.ErrProviderUnavailable):
		writeError(w, http.StatusBadGateway, "PLACE_PROVIDER_UNAVAILABLE", "place provider unavailable", nil)
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

func getDayItineraryResponseToOpenAPI(result trip.GetDayItineraryResult) openapi.GetDayItineraryResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.GetDayItineraryResponse{
		Day: openapi.TripDay{
			Date:     dateToOpenAPI(result.Day.Date),
			DayOrder: result.Day.DayOrder,
		},
		Items: items,
	}
}

func createManualDayItineraryItemResponseToOpenAPI(result trip.CreateManualDayItineraryItemResult) openapi.CreateManualDayItineraryItemResponse {
	return openapi.CreateManualDayItineraryItemResponse{
		Day: openapi.TripDay{
			Date:     dateToOpenAPI(result.Day.Date),
			DayOrder: result.Day.DayOrder,
		},
		Item: dayItineraryItemToOpenAPI(result.Item),
	}
}

func searchGooglePlacesResponseToOpenAPI(results []place.SearchResult) openapi.SearchGooglePlacesResponse {
	items := make([]openapi.GooglePlaceSearchResult, 0, len(results))
	for _, result := range results {
		items = append(items, openapi.GooglePlaceSearchResult{
			GooglePlaceId:    result.GooglePlaceID,
			DisplayName:      result.DisplayName,
			FormattedAddress: result.FormattedAddress,
			PrimaryType:      result.PrimaryType,
		})
	}
	return openapi.SearchGooglePlacesResponse{Results: items}
}

func dayItineraryItemToOpenAPI(item trip.DayItineraryItem) openapi.DayItineraryItem {
	return openapi.DayItineraryItem{
		Id:        item.ID,
		ItemOrder: item.ItemOrder,
		Place: openapi.TripPlaceSummary{
			Id:        item.Place.ID,
			Name:      item.Place.Name,
			PlaceType: openapi.TripPlaceType(item.Place.PlaceType),
			Address:   item.Place.Address,
		},
	}
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
