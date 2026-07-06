package server

import (
	"errors"
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
)

func (s apiServer) SearchGooglePlaces(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, params openapi.SearchGooglePlacesParams) {
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
	results, err := s.places.SearchGoogle(r.Context(), authContext.UserID, tripId, tripDayId, place.SearchInput{
		Query: params.Query,
		Limit: limit,
	})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, searchGooglePlacesResponseToOpenAPI(results))
}

func (s apiServer) CreateGooglePlaceScheduleItem(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "google place schedule creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateGooglePlaceScheduleItemJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.places.CreateGooglePlaceScheduleItem(r.Context(), authContext.UserID, tripId, tripDayId, place.CreateGooglePlaceScheduleItemInput{
		GooglePlaceID:      body.GooglePlaceId,
		DuplicateConfirmed: body.DuplicateConfirmed,
		Title:              body.Title,
		StartTime:          body.StartTime,
		EndTime:            body.EndTime,
		Memo:               body.Memo,
	})
	if err != nil {
		if errors.Is(err, place.ErrDuplicateDayPlaceConfirmationNeeded) {
			details := map[string]interface{}{"googlePlaceId": body.GooglePlaceId}
			var duplicateErr place.DuplicateDayPlaceConfirmationError
			if errors.As(err, &duplicateErr) && duplicateErr.TripPlaceID != "" {
				details["tripPlaceId"] = duplicateErr.TripPlaceID
			}
			writeError(w, http.StatusConflict, "DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED", "duplicate day place confirmation required", []map[string]interface{}{details})
			return
		}
		writeGooglePlaceDayScheduleError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createGooglePlaceScheduleItemResponseToOpenAPI(result))
}
