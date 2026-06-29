package server

import (
	"net/http"

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

func (s apiServer) GetMySettlementSummary(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "settlement summary is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.GetMySettlementSummary(r.Context(), authContext.UserID)
	if err != nil {
		writeMySettlementSummaryError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getMySettlementSummaryResponseToOpenAPI(result))
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

func (s apiServer) GetTripSettlement(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip settlement is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.GetTripSettlement(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripSettlementError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getTripSettlementResponseToOpenAPI(result))
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

func (s apiServer) SetDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
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

	result, err := s.trips.SetDayLodgingPlace(r.Context(), authContext.UserID, tripId, tripDayId, trip.SetDayLodgingPlaceInput{
		TripPlaceID: body.TripPlaceId,
	})
	if err != nil {
		writeDayLodgingPlaceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, setDayLodgingPlaceResponseToOpenAPI(result))
}

func (s apiServer) ClearDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day lodging place is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.ClearDayLodgingPlace(r.Context(), authContext.UserID, tripId, tripDayId); err != nil {
		writeDayLodgingPlaceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) GetDayScheduleItems(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.GetDayScheduleItems(r.Context(), authContext.UserID, tripId, tripDayId)
	if err != nil {
		writeTripDayScheduleError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getDayScheduleResponseToOpenAPI(result))
}

func (s apiServer) ListDayExpenses(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day expense listing is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.ListDayExpenses(r.Context(), authContext.UserID, tripId, tripDayId)
	if err != nil {
		writeDayExpenseListError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listDayExpensesResponseToOpenAPI(result))
}

func (s apiServer) GetDayExpense(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day expense detail is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.trips.GetDayExpense(r.Context(), authContext.UserID, tripId, tripDayId, expenseId)
	if err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, getExpenseResponseToOpenAPI(result))
}

func (s apiServer) UpdateExpense(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day expense update is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.UpdateExpenseJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.trips.UpdateExpense(r.Context(), authContext.UserID, tripId, tripDayId, expenseId, trip.UpdateExpenseInput{
		AmountMinor:        body.AmountMinor,
		PayerParticipantID: body.PayerParticipantId,
		SplitPolicy:        string(body.SplitPolicy),
		ParticipantIDs:     optionalStringSlice(body.ParticipantIds),
		ManualSplits:       manualExpenseSplitsFromOpenAPI(body.Splits),
		Memo:               body.Memo,
		ScheduleItemID:     body.ScheduleItemId,
	})
	if err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updateExpenseResponseToOpenAPI(result))
}

func (s apiServer) DeleteExpense(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day expense deletion is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.trips.DeleteExpense(r.Context(), authContext.UserID, tripId, tripDayId, expenseId); err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) CreateQuickExpense(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
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

	result, err := s.trips.CreateQuickExpense(r.Context(), authContext.UserID, tripId, tripDayId, trip.CreateQuickExpenseInput{
		ScheduleItemID:     body.ScheduleItemId,
		AmountMinor:        body.AmountMinor,
		PayerParticipantID: body.PayerParticipantId,
		SplitPolicy:        string(body.SplitPolicy),
		ParticipantIDs:     optionalStringSlice(body.ParticipantIds),
		ManualSplits:       manualExpenseSplitsFromOpenAPI(body.Splits),
	})
	if err != nil {
		writeQuickExpenseError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createQuickExpenseResponseToOpenAPI(result))
}

func optionalStringSlice(value *[]string) []string {
	if value == nil {
		return nil
	}
	return *value
}

func manualExpenseSplitsFromOpenAPI(value *[]openapi.ManualExpenseSplitInput) []trip.ManualExpenseSplitInput {
	if value == nil {
		return nil
	}
	splits := make([]trip.ManualExpenseSplitInput, 0, len(*value))
	for _, split := range *value {
		splits = append(splits, trip.ManualExpenseSplitInput{ParticipantID: split.ParticipantId, AmountMinor: split.AmountMinor})
	}
	return splits
}

func (s apiServer) CreateManualScheduleItem(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	_ = authContext
	writeError(w, http.StatusGone, "MANUAL_PLACE_CREATION_DISABLED", "manual place creation is disabled; use google place search", nil)
}

func (s apiServer) ReorderScheduleItems(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule reorder is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.ReorderScheduleItemsJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	moves := make([]trip.ReorderDayScheduleMoveInput, 0, len(body.Moves))
	for _, move := range body.Moves {
		moves = append(moves, trip.ReorderDayScheduleMoveInput{
			ItemID:        move.ScheduleItemId,
			BeforeItemID:  move.BeforeScheduleItemId,
			AfterItemID:   move.AfterScheduleItemId,
			ClientVersion: move.ClientVersion,
		})
	}

	result, err := s.trips.ReorderScheduleItems(r.Context(), authContext.UserID, tripId, tripDayId, moves)
	if err != nil {
		writeDayScheduleReorderError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, reorderScheduleItemsResponseToOpenAPI(result))
}

func (s apiServer) MarkScheduleItemArrived(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule arrival is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.MarkScheduleItemArrived(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId)
	if err != nil {
		writeDayScheduleArrivalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, markScheduleItemArrivedResponseToOpenAPI(result))
}

func (s apiServer) MarkScheduleItemSkipped(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule skip is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.MarkScheduleItemSkipped(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId)
	if err != nil {
		writeDayScheduleSkipError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, markScheduleItemSkippedResponseToOpenAPI(result))
}

func (s apiServer) RestoreScheduleItem(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule restore is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.RestoreScheduleItem(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId)
	if err != nil {
		writeDayScheduleRestoreError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, restoreScheduleItemResponseToOpenAPI(result))
}

func (s apiServer) CreateRoutePreview(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
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

	result, err := s.routes.CreatePreview(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId, route.PreviewInput{
		Origin: route.GeoPoint{Latitude: body.Origin.Latitude, Longitude: body.Origin.Longitude},
	})
	if err != nil {
		writeRoutePreviewError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, routePreviewResponseToOpenAPI(result))
}

func (s apiServer) UpdateScheduleItem(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule update is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.UpdateScheduleItemJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.UpdateScheduleItem(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId, trip.UpdateScheduleItemInput{
		Name:      body.Name,
		Address:   body.Address,
		PlaceType: optionalPlaceTypeFromOpenAPI(body.PlaceType),
	})
	if err != nil {
		writeTripDayScheduleError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updateScheduleItemResponseToOpenAPI(result))
}

func (s apiServer) DeleteScheduleItem(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule deletion is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.trips.DeleteScheduleItem(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId); err != nil {
		writeTripDayScheduleError(w, err)
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
