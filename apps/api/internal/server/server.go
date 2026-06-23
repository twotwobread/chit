package server

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

type readinessChecker interface {
	CheckReady(context.Context) (string, error)
}

type apiServer struct {
	readiness readinessChecker
	auth      *auth.Service
	trips     *trip.Service
	places    *place.Service
}

func NewRouter(readiness readinessChecker) http.Handler {
	return NewRouterWithConfig(readiness, ConfigFromEnv())
}

func NewRouterWithConfig(readiness readinessChecker, config Config) http.Handler {
	var authService *auth.Service
	if repo, ok := readiness.(auth.Repository); ok {
		authService = auth.NewService(
			repo,
			auth.NewHTTPProviderVerifier(auth.ProviderConfig{
				AppleAudience: config.AppleAudience,
				AllowDevOAuth: config.AllowDevOAuth,
			}),
			auth.NewTokenManager(config.AuthTokenSecret),
		)
	}

	var tripService *trip.Service
	if repo, ok := readiness.(trip.Repository); ok {
		tripService = trip.NewService(repo)
	}

	var placeService *place.Service
	if repo, ok := readiness.(place.Repository); ok {
		provider := config.PlaceProvider
		if provider == nil {
			provider = place.NewGoogleProvider(config.GooglePlacesAPIKey)
		}
		placeService = place.NewService(repo, provider)
	}

	router := chi.NewRouter()
	return openapi.HandlerWithOptions(apiServer{readiness: readiness, auth: authService, trips: tripService, places: placeService}, openapi.ChiServerOptions{
		BaseRouter:       router,
		ErrorHandlerFunc: writeOpenAPIRequestError,
	})
}
