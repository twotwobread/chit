package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

type readinessChecker interface {
	CheckReady(context.Context) (string, error)
}

type apiServer struct {
	readiness readinessChecker
}

func NewRouter(readiness readinessChecker) http.Handler {
	router := chi.NewRouter()
	return openapi.HandlerFromMux(apiServer{readiness: readiness}, router)
}

func (apiServer) GetHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, openapi.HealthResponse{Status: openapi.HealthResponseStatusOk})
}

func (s apiServer) GetReady(w http.ResponseWriter, r *http.Request) {
	if s.readiness == nil {
		writeServiceUnavailable(w)
		return
	}

	schema, err := s.readiness.CheckReady(r.Context())
	if err != nil {
		writeServiceUnavailable(w)
		return
	}

	writeJSON(w, http.StatusOK, openapi.ReadinessResponse{
		Status: openapi.ReadinessResponseStatusOk,
		Checks: openapi.ReadinessChecks{
			Database: openapi.ReadinessCheck{
				Status: openapi.ReadinessCheckStatusOk,
			},
			Metadata: openapi.MetadataReadinessCheck{
				Status: openapi.MetadataReadinessCheckStatusOk,
				Schema: openapi.MetadataReadinessCheckSchema(schema),
			},
		},
	})
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeServiceUnavailable(w http.ResponseWriter) {
	var body openapi.ErrorResponse
	body.Error.Code = "SERVICE_UNAVAILABLE"
	body.Error.Message = "database is not ready"
	body.Error.Details = []map[string]interface{}{}
	writeJSON(w, http.StatusServiceUnavailable, body)
}
