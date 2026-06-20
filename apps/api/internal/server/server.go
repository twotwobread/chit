package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

type apiServer struct{}

func NewRouter() http.Handler {
	router := chi.NewRouter()
	return openapi.HandlerFromMux(apiServer{}, router)
}

func (apiServer) GetHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(openapi.HealthResponse{Status: "ok"})
}
