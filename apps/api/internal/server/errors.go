package server

import (
	"errors"
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

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

func writeDayLodgingPlaceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day lodging place request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day lodging place not found", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayItineraryReorderError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day itinerary reorder request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day itinerary not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "itinerary reorder conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripInviteError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid trip id", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "trip not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "invite token conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripInviteAcceptError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid invite token", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrInviteNotFound):
		writeError(w, http.StatusNotFound, "INVITE_NOT_FOUND", "invite not found", nil)
	case errors.Is(err, trip.ErrInviteExpired):
		writeError(w, http.StatusGone, "INVITE_EXPIRED", "invite expired", nil)
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
