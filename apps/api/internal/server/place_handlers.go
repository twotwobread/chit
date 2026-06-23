package server

import (
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
)

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
