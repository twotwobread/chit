package server

import (
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
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
		Name:              body.Name,
		StartDate:         dateFromOpenAPI(body.StartDate),
		EndDate:           dateFromOpenAPI(body.EndDate),
		DefaultCurrency:   string(body.DefaultCurrency),
		DefaultTravelMode: tripDefaultTravelModeFromOpenAPI(body.DefaultTravelMode),
		MeetingContext:    createTripMeetingContextFromOpenAPI(body.MeetingContext),
		Destinations:      createDestinationsFromOpenAPI(body.Destinations),
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
	if s.auth == nil || (s.meetings == nil && s.trips == nil) {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "invite acceptance is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if s.meetings != nil {
		result, err := s.meetings.AcceptInvite(r.Context(), authContext.UserID, token)
		if err == nil {
			writeJSON(w, http.StatusOK, acceptMeetingInviteResponseToOpenAPI(result))
			return
		}
		if !errors.Is(err, meeting.ErrInviteNotFound) {
			writeMeetingError(w, err)
			return
		}
	}

	if s.trips == nil {
		writeMeetingError(w, meeting.ErrInviteNotFound)
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

func (s apiServer) ReplaceTripParticipants(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip participant replacement is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.ReplaceTripParticipantsJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.ReplaceParticipants(r.Context(), authContext.UserID, tripId, trip.ReplaceParticipantsInput{ParticipantMemberIDs: body.ParticipantMemberIds})
	if err != nil {
		writeTripDetailError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripParticipantsResponseToOpenAPI(trip.ListParticipantsResult{CurrentUserParticipantID: result.CurrentUserParticipantID, Participants: result.Participants}))
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

func (s apiServer) ListTripPlaces(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip places are not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.ListTripPlaces(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripDetailError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripPlacesResponseToOpenAPI(result))
}

func (s apiServer) CreateManualTripPlace(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "manual trip place creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateManualTripPlaceJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.CreateManualTripPlace(r.Context(), authContext.UserID, tripId, trip.CreateManualTripPlaceInput{
		Name:      body.Name,
		Address:   body.Address,
		PlaceType: string(body.PlaceType),
	})
	if err != nil {
		writeTripDetailError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createManualTripPlaceResponseToOpenAPI(result))
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

func (s apiServer) CreateManualDayLodgingPlace(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "manual day lodging place creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateManualDayLodgingPlaceJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.CreateManualDayLodgingPlace(r.Context(), authContext.UserID, tripId, tripDayId, trip.CreateManualDayLodgingPlaceInput{
		Name:    body.Name,
		Address: body.Address,
	})
	if err != nil {
		writeDayLodgingPlaceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createManualDayLodgingPlaceResponseToOpenAPI(result))
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

func (s apiServer) ListTripScheduleItems(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip schedule is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.trips.ListTripScheduleItems(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeTripDayScheduleError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripScheduleItemsResponseToOpenAPI(result))
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

func (s apiServer) ListTripExpenses(w http.ResponseWriter, r *http.Request, tripId string, params openapi.ListTripExpensesParams) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip expense listing is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	searchQuery := ""
	if params.Q != nil {
		searchQuery = *params.Q
	}
	result, err := s.trips.ListTripExpenses(r.Context(), authContext.UserID, tripId, searchQuery)
	if err != nil {
		writeDayExpenseListError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listTripExpensesResponseToOpenAPI(result))
}

func (s apiServer) CreateTripExpense(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip expense creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateTripExpenseJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.CreateTripExpense(r.Context(), authContext.UserID, tripId, trip.CreateTripExpenseInput{
		Title:               body.Title,
		ExpenseDate:         body.ExpenseDate.Time.Format("2006-01-02"),
		TripDayID:           body.TripDayId,
		ScheduleItemID:      body.ScheduleItemId,
		TripPlaceID:         body.TripPlaceId,
		AmountMinor:         body.AmountMinor,
		Currency:            optionalCurrencyFromOpenAPI(body.Currency),
		ExpenseCategory:     optionalExpenseCategoryFromOpenAPI(body.ExpenseCategory),
		ExpenseKind:         optionalExpenseKindFromOpenAPI(body.ExpenseKind),
		PayerParticipantID:  body.PayerParticipantId,
		SplitPolicy:         string(body.SplitPolicy),
		ParticipantIDs:      optionalStringSlice(body.ParticipantIds),
		ManualSplits:        manualExpenseSplitsFromOpenAPI(body.Splits),
		Memo:                body.Memo,
		IncludeInSettlement: body.IncludeInSettlement,
		ReceiptDraftID:      body.ReceiptDraftId,
	})
	if err != nil {
		writeQuickExpenseError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createTripExpenseResponseToOpenAPI(result))
}

func (s apiServer) GetTripExpense(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip expense detail is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.trips.GetTripExpense(r.Context(), authContext.UserID, tripId, expenseId)
	if err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, getExpenseResponseToOpenAPI(result))
}

func (s apiServer) UpdateTripExpense(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip expense update is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.UpdateTripExpenseJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.trips.UpdateTripExpense(r.Context(), authContext.UserID, tripId, expenseId, trip.UpdateExpenseInput{
		AmountMinor:         body.AmountMinor,
		Currency:            optionalCurrencyFromOpenAPI(body.Currency),
		ExpenseCategory:     optionalExpenseCategoryFromOpenAPI(body.ExpenseCategory),
		ExpenseKind:         optionalExpenseKindPtrFromOpenAPI(body.ExpenseKind),
		PayerParticipantID:  body.PayerParticipantId,
		SplitPolicy:         string(body.SplitPolicy),
		ParticipantIDs:      optionalStringSlice(body.ParticipantIds),
		ManualSplits:        manualExpenseSplitsFromOpenAPI(body.Splits),
		Memo:                body.Memo,
		Title:               body.Title,
		ScheduleItemID:      body.ScheduleItemId,
		TripPlaceID:         body.TripPlaceId,
		IncludeInSettlement: body.IncludeInSettlement,
	})
	if err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updateExpenseResponseToOpenAPI(result))
}

func (s apiServer) DeleteTripExpense(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "trip expense deletion is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.trips.DeleteTripExpense(r.Context(), authContext.UserID, tripId, expenseId); err != nil {
		writeDayExpenseMutationError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
		AmountMinor:         body.AmountMinor,
		Currency:            optionalCurrencyFromOpenAPI(body.Currency),
		ExpenseCategory:     optionalExpenseCategoryFromOpenAPI(body.ExpenseCategory),
		ExpenseKind:         optionalExpenseKindPtrFromOpenAPI(body.ExpenseKind),
		PayerParticipantID:  body.PayerParticipantId,
		SplitPolicy:         string(body.SplitPolicy),
		ParticipantIDs:      optionalStringSlice(body.ParticipantIds),
		ManualSplits:        manualExpenseSplitsFromOpenAPI(body.Splits),
		Memo:                body.Memo,
		Title:               body.Title,
		ScheduleItemID:      body.ScheduleItemId,
		TripPlaceID:         body.TripPlaceId,
		IncludeInSettlement: body.IncludeInSettlement,
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
		ScheduleItemID:      body.ScheduleItemId,
		TripPlaceID:         body.TripPlaceId,
		AmountMinor:         body.AmountMinor,
		Currency:            optionalCurrencyFromOpenAPI(body.Currency),
		ExpenseCategory:     optionalExpenseCategoryFromOpenAPI(body.ExpenseCategory),
		ExpenseKind:         optionalExpenseKindFromOpenAPI(body.ExpenseKind),
		PayerParticipantID:  body.PayerParticipantId,
		SplitPolicy:         string(body.SplitPolicy),
		ParticipantIDs:      optionalStringSlice(body.ParticipantIds),
		ManualSplits:        manualExpenseSplitsFromOpenAPI(body.Splits),
		IncludeInSettlement: body.IncludeInSettlement,
		ClientMutationID:    body.ClientMutationId,
		Memo:                body.Memo,
		ReceiptDraftID:      body.ReceiptDraftId,
	})
	if err != nil {
		writeQuickExpenseError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createQuickExpenseResponseToOpenAPI(result))
}

func (s apiServer) CreateExpenseReceiptDraft(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "receipt draft creation is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	input, ok := decodeExpenseReceiptDraftMultipart(w, r)
	if !ok {
		return
	}
	result, err := s.trips.CreateExpenseReceiptDraft(r.Context(), authContext.UserID, tripId, input)
	if err != nil {
		writeExpenseReceiptError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusCreated, openapi.CreateExpenseReceiptDraftResponse{Draft: expenseReceiptDraftToOpenAPI(result.Draft)})
}

func (s apiServer) CancelExpenseReceiptDraft(w http.ResponseWriter, r *http.Request, tripId string, receiptDraftId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "receipt draft cancellation is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.trips.CancelExpenseReceiptDraft(r.Context(), authContext.UserID, tripId, receiptDraftId); err != nil {
		writeExpenseReceiptError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) UploadExpenseReceipt(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "expense receipt upload is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, int64(trip.MaxExpenseReceiptBytes)+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid upload body", nil)
		return
	}
	receipt, err := s.trips.UploadExpenseReceipt(r.Context(), authContext.UserID, tripId, expenseId, strings.TrimSpace(r.Header.Get("Content-Type")), data)
	if err != nil {
		writeExpenseReceiptError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.UploadExpenseReceiptResponse{Receipt: expenseReceiptSummaryToOpenAPI(receipt)})
}

func (s apiServer) DeleteExpenseReceipt(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "expense receipt deletion is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.trips.DeleteExpenseReceipt(r.Context(), authContext.UserID, tripId, expenseId); err != nil {
		writeExpenseReceiptError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) OpenExpenseReceipt(w http.ResponseWriter, r *http.Request, tripId string, expenseId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "expense receipt open is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.trips.OpenExpenseReceipt(r.Context(), authContext.UserID, tripId, expenseId)
	if err != nil {
		writeExpenseReceiptError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, openapi.OpenExpenseReceiptResponse{Url: result.URL, ExpiresAt: result.ExpiresAt.UTC(), ContentType: openapi.ReceiptImageContentType(result.ContentType), ByteSize: result.ByteSize})
}

type expenseReceiptOCRTextPartForm struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

func decodeExpenseReceiptDraftMultipart(w http.ResponseWriter, r *http.Request) (trip.CreateExpenseReceiptDraftInput, bool) {
	const maxReceiptDraftMultipartBytes = int64(2*trip.MaxExpenseReceiptBytes + 1024*1024)
	r.Body = http.MaxBytesReader(w, r.Body, maxReceiptDraftMultipartBytes)
	if err := r.ParseMultipartForm(maxReceiptDraftMultipartBytes); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid receipt draft form", nil)
		return trip.CreateExpenseReceiptDraftInput{}, false
	}

	captureMode := trip.ReceiptCaptureMode(strings.TrimSpace(r.FormValue("captureMode")))
	ocrLanguage := trip.ReceiptOCRLanguage(strings.TrimSpace(r.FormValue("ocrLanguage")))
	var formParts []expenseReceiptOCRTextPartForm
	if err := json.Unmarshal([]byte(r.FormValue("ocrTextParts")), &formParts); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid OCR text parts", nil)
		return trip.CreateExpenseReceiptDraftInput{}, false
	}
	textParts := make([]trip.ExpenseReceiptOCRTextPart, 0, len(formParts))
	for _, part := range formParts {
		textParts = append(textParts, trip.ExpenseReceiptOCRTextPart{Role: trip.ReceiptImageRole(strings.TrimSpace(part.Role)), Text: part.Text})
	}

	images := make([]trip.ExpenseReceiptImageUpload, 0, 2)
	switch captureMode {
	case trip.ReceiptCaptureModeSingle:
		image, ok := readExpenseReceiptFormImage(w, r.MultipartForm, "image", trip.ReceiptImageRoleSingle)
		if !ok {
			return trip.CreateExpenseReceiptDraftInput{}, false
		}
		images = append(images, image)
	case trip.ReceiptCaptureModeSplit:
		headerImage, ok := readExpenseReceiptFormImage(w, r.MultipartForm, "headerImage", trip.ReceiptImageRoleHeader)
		if !ok {
			return trip.CreateExpenseReceiptDraftInput{}, false
		}
		totalImage, ok := readExpenseReceiptFormImage(w, r.MultipartForm, "totalImage", trip.ReceiptImageRoleTotal)
		if !ok {
			return trip.CreateExpenseReceiptDraftInput{}, false
		}
		images = append(images, headerImage, totalImage)
	default:
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid receipt capture mode", nil)
		return trip.CreateExpenseReceiptDraftInput{}, false
	}

	return trip.CreateExpenseReceiptDraftInput{CaptureMode: captureMode, OCRLanguage: ocrLanguage, OCRTextParts: textParts, Images: images}, true
}

func readExpenseReceiptFormImage(w http.ResponseWriter, form *multipart.Form, fieldName string, role trip.ReceiptImageRole) (trip.ExpenseReceiptImageUpload, bool) {
	if form == nil || len(form.File[fieldName]) != 1 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "missing receipt image", nil)
		return trip.ExpenseReceiptImageUpload{}, false
	}
	fileHeader := form.File[fieldName][0]
	file, err := fileHeader.Open()
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid receipt image", nil)
		return trip.ExpenseReceiptImageUpload{}, false
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, int64(trip.MaxExpenseReceiptBytes)+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid receipt image", nil)
		return trip.ExpenseReceiptImageUpload{}, false
	}
	return trip.ExpenseReceiptImageUpload{Role: role, ContentType: strings.TrimSpace(fileHeader.Header.Get("Content-Type")), Data: data}, true
}

func optionalStringSlice(value *[]string) []string {
	if value == nil {
		return nil
	}
	return *value
}

func optionalExpenseKindFromOpenAPI(value *openapi.ExpenseKind) string {
	if value == nil {
		return ""
	}
	return string(*value)
}

func optionalExpenseKindPtrFromOpenAPI(value *openapi.ExpenseKind) *string {
	if value == nil {
		return nil
	}
	expenseKind := string(*value)
	return &expenseKind
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
	timeUpdates := []trip.ReorderScheduleItemTimeUpdateInput(nil)
	if body.TimeUpdates != nil {
		timeUpdates = make([]trip.ReorderScheduleItemTimeUpdateInput, 0, len(*body.TimeUpdates))
		for _, update := range *body.TimeUpdates {
			timeUpdates = append(timeUpdates, trip.ReorderScheduleItemTimeUpdateInput{
				ItemID:            update.ScheduleItemId,
				ExpectedStartTime: update.ExpectedStartTime,
				ExpectedEndTime:   update.ExpectedEndTime,
				StartTime:         update.StartTime,
				EndTime:           update.EndTime,
			})
		}
	}

	result, err := s.trips.ReorderScheduleItems(r.Context(), authContext.UserID, tripId, tripDayId, moves, timeUpdates)
	if err != nil {
		writeDayScheduleReorderError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, reorderScheduleItemsResponseToOpenAPI(result))
}

func (s apiServer) MoveScheduleItemToDay(w http.ResponseWriter, r *http.Request, tripId string, tripDayId string, scheduleItemId string) {
	if s.auth == nil || s.trips == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "day schedule move is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.MoveScheduleItemToDayJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.trips.MoveScheduleItemToDay(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId, trip.MoveScheduleItemToDayInput{
		TargetTripDayID: body.TargetTripDayId,
		ClientVersion:   body.ClientVersion,
	})
	if err != nil {
		writeDayScheduleMoveError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, moveScheduleItemToDayResponseToOpenAPI(result))
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

	mode := ""
	if body.Mode != nil {
		mode = string(*body.Mode)
	}
	result, err := s.routes.CreatePreview(r.Context(), authContext.UserID, tripId, tripDayId, scheduleItemId, route.PreviewInput{
		Origin: route.GeoPoint{Latitude: body.Origin.Latitude, Longitude: body.Origin.Longitude},
		Mode:   mode,
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
		StartTime: body.StartTime,
		EndTime:   body.EndTime,
		Memo:      body.Memo,
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
		Name:              body.Name,
		StartDate:         optionalDateFromOpenAPI(body.StartDate),
		EndDate:           optionalDateFromOpenAPI(body.EndDate),
		DefaultCurrency:   optionalCurrencyFromOpenAPI(body.DefaultCurrency),
		DefaultTravelMode: optionalTripDefaultTravelModeFromOpenAPI(body.DefaultTravelMode),
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
