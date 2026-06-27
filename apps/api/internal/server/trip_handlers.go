package server

import (
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/route"
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

func (s apiServer) AcceptTripInvite(w http.ResponseWriter, r *http.Request, token string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip invite acceptance is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.AcceptInvite(r.Context(), authContext.UserID, token)
	if err != nil {
		writeTripInviteAcceptError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, acceptTripInviteResponseToOpenAPI(result))
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

func (s apiServer) RemoveTripParticipant(w http.ResponseWriter, r *http.Request, tripId string, participantId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip participant removal is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.RemoveParticipant(r.Context(), authContext.UserID, tripId, participantId); err != nil {
		writeTripDetailError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

func (s apiServer) ListDayExpenses(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day expense listing is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.ListDayExpenses(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date))
	if err != nil {
		writeDayExpenseListError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listDayExpensesResponseToOpenAPI(result))
}

func (s apiServer) CreateQuickExpense(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "quick expense creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateQuickExpenseJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.CreateQuickExpense(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), trip.CreateQuickExpenseInput{
		ItineraryItemID:    body.ItineraryItemId,
		AmountMinor:        body.AmountMinor,
		PayerParticipantID: body.PayerParticipantId,
	})
	if err != nil {
		writeQuickExpenseError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createQuickExpenseResponseToOpenAPI(result))
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

	_ = authContext
	writeError(w, http.StatusGone, "MANUAL_PLACE_CREATION_DISABLED", "manual place creation is disabled; use google place search", nil)
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

func (s apiServer) MarkDayItineraryItemArrived(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary arrival is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.MarkDayItineraryItemArrived(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId)
	if err != nil {
		writeDayItineraryArrivalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, markDayItineraryItemArrivedResponseToOpenAPI(result))
}

func (s apiServer) MarkDayItineraryItemSkipped(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary skip is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.MarkDayItineraryItemSkipped(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId)
	if err != nil {
		writeDayItinerarySkipError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, markDayItineraryItemSkippedResponseToOpenAPI(result))
}

func (s apiServer) RestoreDayItineraryItem(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day itinerary restore is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.RestoreDayItineraryItem(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId)
	if err != nil {
		writeDayItineraryRestoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, restoreDayItineraryItemResponseToOpenAPI(result))
}

func (s apiServer) CreateRoutePreview(w http.ResponseWriter, r *http.Request, tripId string, date openapi_types.Date, itemId string) {
	if s.auth == nil || s.routes == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "route preview is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateRoutePreviewJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.routes.CreatePreview(r.Context(), authContext.UserID, tripId, dateFromOpenAPI(date), itemId, route.PreviewInput{
		Origin: route.GeoPoint{Latitude: body.Origin.Latitude, Longitude: body.Origin.Longitude},
	})
	if err != nil {
		writeRoutePreviewError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, routePreviewResponseToOpenAPI(result))
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
