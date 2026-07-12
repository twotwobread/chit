package server

import (
	"errors"
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
)

func (s apiServer) SearchDestinations(w http.ResponseWriter, r *http.Request, params openapi.SearchDestinationsParams) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "destination search is not configured", nil)
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
	results, err := s.places.SearchDestinations(r.Context(), authContext.UserID, place.DestinationSearchInput{Query: params.Query, Limit: limit})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, searchDestinationsResponseToOpenAPI(results))
}

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
	var bias *place.SearchLocationBias
	if params.Latitude != nil || params.Longitude != nil || params.RadiusMeters != nil {
		if params.Latitude == nil || params.Longitude == nil || params.RadiusMeters == nil {
			writePlaceSearchError(w, place.ErrValidation)
			return
		}
		bias = &place.SearchLocationBias{Latitude: *params.Latitude, Longitude: *params.Longitude, RadiusMeters: *params.RadiusMeters}
	}
	results, err := s.places.SearchGoogle(r.Context(), authContext.UserID, tripId, tripDayId, place.SearchInput{
		Query:        params.Query,
		Limit:        limit,
		LocationBias: bias,
	})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, searchGooglePlacesResponseToOpenAPI(results))
}

func (s apiServer) GetGooglePlaceDetails(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, googlePlaceId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place details are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.places.GetGooglePlaceDetails(r.Context(), authContext.UserID, tripId, tripDayId, place.SelectedDetailsInput{GooglePlaceID: googlePlaceId})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, googlePlaceDetailsResponseToOpenAPI(result))
}

func (s apiServer) GetGooglePlacePhoto(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, photoToken string, params openapi.GetGooglePlacePhotoParams) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place photo proxy is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	maxWidthPx := 320
	if params.MaxWidthPx != nil {
		maxWidthPx = *params.MaxWidthPx
	}
	photo, err := s.places.GetGooglePlacePhoto(r.Context(), authContext.UserID, tripId, tripDayId, place.PhotoInput{Token: photoToken, MaxWidthPx: maxWidthPx})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, photo.URI, http.StatusFound)
}

func (s apiServer) ListTripPlaceBookmarks(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place bookmarks are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	bookmarks, err := s.places.ListTripPlaceBookmarks(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, tripPlaceBookmarksResponseToOpenAPI(bookmarks))
}

func (s apiServer) CreateGoogleTripPlaceBookmark(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place bookmarks are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateGoogleTripPlaceBookmarkJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.places.CreateGoogleTripPlaceBookmark(r.Context(), authContext.UserID, tripId, place.CreateGoogleTripPlaceBookmarkInput{
		GooglePlaceID: body.GooglePlaceId,
	})
	if err != nil {
		writePlaceSearchError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createGoogleTripPlaceBookmarkResponseToOpenAPI(result))
}

func (s apiServer) DeleteTripPlaceBookmark(w http.ResponseWriter, r *http.Request, tripId string, bookmarkId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "place bookmarks are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.places.DeleteTripPlaceBookmark(r.Context(), authContext.UserID, tripId, bookmarkId); err != nil {
		writePlaceSearchError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) CreateGoogleDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.places == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "google day lodging creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateGoogleDayLodgingPlaceJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.places.CreateGoogleDayLodgingPlace(r.Context(), authContext.UserID, tripId, tripDayId, place.CreateGoogleDayLodgingPlaceInput{
		GooglePlaceID: body.GooglePlaceId,
	})
	if err != nil {
		writeGoogleDayLodgingPlaceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createGoogleDayLodgingPlaceResponseToOpenAPI(result))
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
