package server

import (
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

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

func (s apiServer) CreateTripInvite(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip invite creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.CreateInvite(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripInviteError(w, err)
		return
	}

	status := http.StatusCreated
	if !result.Created {
		status = http.StatusOK
	}
	writeJSON(w, status, createTripInviteResponseToOpenAPI(result))
}

func (s apiServer) ListTripParticipants(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip participants are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	participants, err := s.trips.ListParticipants(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripDetailError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripParticipantsResponseToOpenAPI(participants))
}

func (s apiServer) SetDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day lodging place is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.SetDayLodgingPlaceJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.SetDayLodgingPlace(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), trip.SetDayLodgingPlaceInput{
		TripPlaceID: body.TripPlaceId,
	})
	if err != nil {
		writeDayLodgingPlaceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, setDayLodgingPlaceResponseToOpenAPI(result))
}

func (s apiServer) ClearDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day lodging place is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.ClearDayLodgingPlace(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date)); err != nil {
		writeDayLodgingPlaceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

func (s apiServer) ReorderDayItineraryItems(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary reorder is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.ReorderDayItineraryItemsJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	moves := make([]trip.ReorderDayItineraryMoveInput, 0, len(body.Moves))
	for _, move := range body.Moves {
		moves = append(moves, trip.ReorderDayItineraryMoveInput{
			ItemID:        move.ItemId,
			BeforeItemID:  move.BeforeItemId,
			AfterItemID:   move.AfterItemId,
			ClientVersion: move.ClientVersion,
		})
	}

	result, err := s.trips.ReorderDayItineraryItems(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), moves)
	if err != nil {
		writeDayItineraryReorderError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, reorderDayItineraryItemsResponseToOpenAPI(result))
}

func (s apiServer) UpdateDayItineraryItem(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary update is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.UpdateDayItineraryItemJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.UpdateDayItineraryItem(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId, trip.UpdateDayItineraryItemInput{
		Name:      body.Name,
		Address:   body.Address,
		PlaceType: optionalPlaceTypeFromOpenAPI(body.PlaceType),
	})
	if err != nil {
		writeTripDayItineraryError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updateDayItineraryItemResponseToOpenAPI(result))
}

func (s apiServer) DeleteDayItineraryItem(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary deletion is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.DeleteDayItineraryItem(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId); err != nil {
		writeTripDayItineraryError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
