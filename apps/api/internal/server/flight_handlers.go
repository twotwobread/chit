package server

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	openapiTypes "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/flight"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

func (s apiServer) ListTripFlights(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flights are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.flights.ListFlights(r.Context(), authContext.UserID, tripId)
	if err != nil {
		writeFlightError(w, err)
		return
	}
	flights := make([]openapi.FlightSummary, 0, len(result))
	for _, item := range result {
		flights = append(flights, flightDetailToOpenAPI(item))
	}
	writeJSON(w, http.StatusOK, openapi.ListTripFlightsResponse{Flights: flights})
}

func (s apiServer) CreateTripFlight(w http.ResponseWriter, r *http.Request, tripId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flights are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.CreateTripFlightJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.flights.CreateFlight(r.Context(), authContext.UserID, tripId, flight.CreateFlightInput{
		DisplayTitle: body.DisplayTitle,
		FlightNumber: body.FlightNumber,
		Departure:    flightEndpointInputFromOpenAPI(body.Departure),
		Arrival:      flightEndpointInputFromOpenAPI(body.Arrival),
		PassengerIDs: body.PassengerParticipantIds,
	})
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, openapi.CreateTripFlightResponse{Flight: flightDetailToOpenAPI(result)})
}

func (s apiServer) GetTripFlight(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flights are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.flights.GetFlight(r.Context(), authContext.UserID, tripId, flightId)
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.GetTripFlightResponse{Flight: flightDetailToOpenAPI(result)})
}

func (s apiServer) UpdateTripFlight(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flights are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.UpdateTripFlightJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.flights.UpdateFlight(r.Context(), authContext.UserID, tripId, flightId, flight.UpdateFlightInput{
		DisplayTitle: body.DisplayTitle,
		FlightNumber: body.FlightNumber,
		Departure:    flightEndpointInputFromOpenAPI(body.Departure),
		Arrival:      flightEndpointInputFromOpenAPI(body.Arrival),
	})
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.UpdateTripFlightResponse{Flight: flightDetailToOpenAPI(result)})
}

func (s apiServer) AddTripFlightPassengers(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flights are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.AddTripFlightPassengersJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.flights.AddPassengers(r.Context(), authContext.UserID, tripId, flightId, flight.AddPassengersInput{PassengerIDs: body.PassengerParticipantIds})
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.AddTripFlightPassengersResponse{Flight: flightDetailToOpenAPI(result)})
}

func (s apiServer) UpsertMyFlightPersonalDetail(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flight personal details are not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var body openapi.UpsertMyFlightPersonalDetailJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := s.flights.UpsertMyPersonalDetail(r.Context(), authContext.UserID, tripId, flightId, flight.UpsertPersonalDetailInput{
		ReservationNumber: body.ReservationNumber,
		Seat:              body.Seat,
		CheckInURL:        body.CheckInUrl,
	})
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.UpsertMyFlightPersonalDetailResponse{PersonalDetail: personalDetailToOpenAPI(result)})
}

func (s apiServer) UploadMyFlightBoardingPass(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flight boarding pass upload is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, int64(flight.MaxBoardingPassBytes)+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid upload body", nil)
		return
	}
	result, err := s.flights.UploadMyBoardingPass(r.Context(), authContext.UserID, tripId, flightId, strings.TrimSpace(r.Header.Get("Content-Type")), data)
	if err != nil {
		writeFlightError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, openapi.UploadMyFlightBoardingPassResponse{PersonalDetail: personalDetailToOpenAPI(result)})
}

func (s apiServer) DeleteMyFlightBoardingPass(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flight boarding pass deletion is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.flights.DeleteMyBoardingPass(r.Context(), authContext.UserID, tripId, flightId); err != nil {
		writeFlightError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) OpenMyFlightBoardingPass(w http.ResponseWriter, r *http.Request, tripId string, flightId string) {
	if s.auth == nil || s.flights == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "flight boarding pass open is not configured", nil)
		return
	}
	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.flights.OpenMyBoardingPass(r.Context(), authContext.UserID, tripId, flightId)
	if err != nil {
		writeFlightError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, openapi.OpenMyFlightBoardingPassResponse{Url: result.URL, ExpiresAt: result.ExpiresAt.UTC(), ContentType: openapi.FlightImageContentType(result.ContentType), ByteSize: result.ByteSize})
}

func writeFlightError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, flight.ErrValidation):
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid flight request", nil)
	case errors.Is(err, flight.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
	case errors.Is(err, flight.ErrForbidden):
		writeError(w, http.StatusForbidden, "FORBIDDEN", "forbidden", nil)
	case errors.Is(err, flight.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "flight not found", nil)
	case errors.Is(err, flight.ErrConflict):
		writeError(w, http.StatusConflict, "CONFLICT", "flight passenger conflict", nil)
	case errors.Is(err, flight.ErrUploadTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, "UPLOAD_TOO_LARGE", "boarding pass upload is too large", nil)
	case errors.Is(err, flight.ErrUnsupportedMediaType):
		writeError(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_BOARDING_PASS_MEDIA_TYPE", "unsupported boarding pass media type", nil)
	case errors.Is(err, flight.ErrStorageUnavailable):
		writeError(w, http.StatusServiceUnavailable, "BOARDING_PASS_STORAGE_UNAVAILABLE", "boarding pass storage is unavailable", nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
	}
}

func flightEndpointInputFromOpenAPI(input openapi.FlightEndpointInput) flight.FlightEndpointInput {
	return flight.FlightEndpointInput{AirportText: input.AirportText, AirportCode: input.AirportCode, LocalDate: input.LocalDate.Time.Format("2006-01-02"), LocalTime: input.LocalTime, TimeZone: input.TimeZone}
}

func flightDetailToOpenAPI(detail flight.FlightDetail) openapi.FlightDetail {
	passengers := make([]openapi.FlightPassenger, 0, len(detail.Passengers))
	for _, passenger := range detail.Passengers {
		passengers = append(passengers, openapi.FlightPassenger{ParticipantId: passenger.ParticipantID, DisplayName: passenger.DisplayName})
	}
	result := openapi.FlightDetail{
		Id:               detail.ID,
		CreatedByUserId:  detail.CreatedByUserID,
		FlightNumber:     detail.FlightNumber,
		DisplayTitle:     detail.DisplayTitle,
		Departure:        flightEndpointToOpenAPI(detail.Departure),
		Arrival:          flightEndpointToOpenAPI(detail.Arrival),
		Passengers:       passengers,
		MyPersonalDetail: nil,
		CreatedAt:        detail.CreatedAt.UTC(),
		UpdatedAt:        detail.UpdatedAt.UTC(),
	}
	if detail.MyPersonalDetail != nil {
		personal := personalDetailToOpenAPI(*detail.MyPersonalDetail)
		result.MyPersonalDetail = &personal
	}
	return result
}

func flightEndpointToOpenAPI(endpoint flight.FlightEndpoint) openapi.FlightEndpoint {
	localDate, err := time.Parse("2006-01-02", endpoint.LocalDate)
	if err != nil {
		localDate = time.Time{}
	}
	return openapi.FlightEndpoint{AirportText: endpoint.AirportText, AirportCode: endpoint.AirportCode, LocalDate: openapiTypes.Date{Time: localDate}, LocalTime: endpoint.LocalTime, TimeZone: endpoint.TimeZone, At: endpoint.At.UTC()}
}

func personalDetailToOpenAPI(detail flight.PersonalDetail) openapi.MyFlightPersonalDetail {
	return openapi.MyFlightPersonalDetail{ReservationNumber: detail.ReservationNumber, Seat: detail.Seat, CheckInUrl: detail.CheckInURL, BoardingPass: boardingPassSummaryToOpenAPI(detail.BoardingPass)}
}

func boardingPassSummaryToOpenAPI(summary flight.BoardingPassSummary) openapi.FlightBoardingPassSummary {
	var contentType *openapi.FlightImageContentType
	if summary.ContentType != nil {
		value := openapi.FlightImageContentType(*summary.ContentType)
		contentType = &value
	}
	return openapi.FlightBoardingPassSummary{Exists: summary.Exists, ContentType: contentType, ByteSize: summary.ByteSize, UploadedAt: summary.UploadedAt}
}
