package server

import (
	"errors"
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/route"
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

func writeMySettlementSummaryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrSettlementSummaryUnavailable):
		writeError(w, http.StatusConflict, "SETTLEMENT_SUMMARY_UNAVAILABLE", "정산 요약을 계산할 수 없어요. 지출 내역을 다시 확인해주세요.", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripSettlementError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid trip id", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "trip not found", nil)
	case errors.Is(err, trip.ErrSettlementDataInconsistent):
		writeError(w, http.StatusConflict, "SETTLEMENT_DATA_INCONSISTENT", "정산 데이터를 계산할 수 없어요. 지출 내역을 다시 확인해주세요.", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeTripDayScheduleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day schedule append conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayExpenseListError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day expense list request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day expense list not found", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayExpenseMutationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day expense request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day expense not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day expense conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeQuickExpenseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid quick expense request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "quick expense context not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "quick expense creation conflict", nil)
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

func writeDayScheduleArrivalError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule arrival request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule item not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day schedule arrival conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayScheduleSkipError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule skip request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule item not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day schedule skip conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayScheduleRestoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule restore request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule item not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day schedule restore conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayScheduleMoveError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule move request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule item not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "schedule move conflict", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeDayScheduleReorderError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, trip.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid day schedule reorder request", nil)
	case errors.Is(err, trip.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, trip.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, trip.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "day schedule not found", nil)
	case errors.Is(err, trip.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "schedule reorder conflict", nil)
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

func writeGoogleDayLodgingPlaceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, place.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid google day lodging request", nil)
	case errors.Is(err, place.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, place.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, place.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "google day lodging context not found", nil)
	case errors.Is(err, place.ErrProviderRateLimited):
		writeError(w, http.StatusTooManyRequests, "PLACE_PROVIDER_RATE_LIMITED", "place provider rate limited", nil)
	case errors.Is(err, place.ErrProviderUnavailable):
		writeError(w, http.StatusBadGateway, "PLACE_PROVIDER_UNAVAILABLE", "place provider unavailable", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeGooglePlaceDayScheduleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, place.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid google place schedule request", nil)
	case errors.Is(err, place.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, place.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, place.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "google place schedule context not found", nil)
	case errors.Is(err, place.ErrDuplicateDayPlaceConfirmationNeeded):
		writeError(w, http.StatusConflict, "DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED", "duplicate day place confirmation required", nil)
	case errors.Is(err, place.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "day schedule append conflict", nil)
	case errors.Is(err, place.ErrProviderRateLimited):
		writeError(w, http.StatusTooManyRequests, "PLACE_PROVIDER_RATE_LIMITED", "place provider rate limited", nil)
	case errors.Is(err, place.ErrProviderUnavailable):
		writeError(w, http.StatusBadGateway, "PLACE_PROVIDER_UNAVAILABLE", "place provider unavailable", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func writeRoutePreviewError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, route.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid route preview request", nil)
	case errors.Is(err, route.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, route.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, route.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "route preview context not found", nil)
	case errors.Is(err, route.ErrProviderNoRoute):
		writeError(w, http.StatusNotFound, "ROUTE_NOT_FOUND", "route not found", nil)
	case errors.Is(err, route.ErrStaleItem):
		writeError(w, http.StatusConflict, "ROUTE_PREVIEW_STALE_ITEM", "route preview target item is stale", nil)
	case errors.Is(err, route.ErrUnsupportedPlace):
		writeError(w, http.StatusConflict, "ROUTE_PREVIEW_UNSUPPORTED_PLACE", "route preview destination is unsupported", nil)
	case errors.Is(err, route.ErrProviderLimited):
		writeError(w, http.StatusTooManyRequests, "ROUTE_PROVIDER_RATE_LIMITED", "route provider rate limited", nil)
	case errors.Is(err, route.ErrProviderDown):
		writeError(w, http.StatusBadGateway, "ROUTE_PROVIDER_UNAVAILABLE", "route provider unavailable", nil)
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
