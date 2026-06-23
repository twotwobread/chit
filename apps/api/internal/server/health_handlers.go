package server

import (
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

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
