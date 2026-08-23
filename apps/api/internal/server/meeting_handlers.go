package server

import (
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

func (s apiServer) ListMeetings(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting listing is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	meetings, err := s.meetings.ListMeetings(r.Context(), authContext.UserID)
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, listMeetingsResponseToOpenAPI(meetings))
}

func (s apiServer) CreateMeeting(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateMeetingJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.meetings.CreateMeeting(r.Context(), authContext.UserID, meeting.CreateMeetingInput{Name: body.Name})
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createMeetingResponseToOpenAPI(result))
}

func (s apiServer) GetMeeting(w http.ResponseWriter, r *http.Request, meetingId string) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting detail is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.meetings.GetMeeting(r.Context(), authContext.UserID, meetingId)
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getMeetingResponseToOpenAPI(result))
}

func (s apiServer) CreateMeetingInvite(w http.ResponseWriter, r *http.Request, meetingId string) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting invite creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.meetings.CreateInvite(r.Context(), authContext.UserID, meetingId)
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	status := http.StatusCreated
	if !result.Created {
		status = http.StatusOK
	}
	writeJSON(w, status, createMeetingInviteResponseToOpenAPI(result))
}

func (s apiServer) LeaveMeeting(w http.ResponseWriter, r *http.Request, meetingId string) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting leave is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.meetings.LeaveMeeting(r.Context(), authContext.UserID, meetingId); err != nil {
		writeMeetingError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) RemoveMeetingMember(w http.ResponseWriter, r *http.Request, meetingId string, memberId string) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "meeting member removal is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	if err := s.meetings.RemoveMember(r.Context(), authContext.UserID, meetingId, memberId); err != nil {
		writeMeetingError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s apiServer) CreateEvent(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "event creation is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.CreateEventJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	participantMemberIDs := []string(nil)
	if body.ParticipantMemberIds != nil {
		participantMemberIDs = append(participantMemberIDs, (*body.ParticipantMemberIds)...)
	}

	result, err := s.meetings.CreateEvent(r.Context(), authContext.UserID, meeting.CreateEventInput{
		Title:                   body.Title,
		StartDate:               dateFromOpenAPI(body.StartDate),
		EndDate:                 dateFromOpenAPI(body.EndDate),
		StartTime:               optionalOpenAPIString(body.StartTime),
		PlaceName:               optionalOpenAPIString(body.PlaceName),
		PlaceAddress:            optionalOpenAPIString(body.PlaceAddress),
		Category:                optionalOpenAPIEventCategory(body.Category),
		EventType:               string(body.EventType),
		DefaultCurrency:         string(body.DefaultCurrency),
		ParticipantMemberIDs:    participantMemberIDs,
		ParticipantMemberIDsSet: body.ParticipantMemberIds != nil,
		Meeting: meeting.EventMeetingInput{
			Mode:      string(body.Meeting.Mode),
			MeetingID: optionalOpenAPIString(body.Meeting.MeetingId),
			Name:      optionalOpenAPIString(body.Meeting.Name),
		},
	})
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, createEventResponseToOpenAPI(result))
}

func (s apiServer) GetEvent(w http.ResponseWriter, r *http.Request, eventId string) {
	if s.auth == nil || s.meetings == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "event detail is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	result, err := s.meetings.GetEvent(r.Context(), authContext.UserID, eventId)
	if err != nil {
		writeMeetingError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, getEventResponseToOpenAPI(result))
}

func optionalOpenAPIString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optionalOpenAPIEventCategory(value *openapi.EventCategory) string {
	if value == nil {
		return ""
	}
	return string(*value)
}
