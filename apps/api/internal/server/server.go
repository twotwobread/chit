package server

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/flight"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/route"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

type readinessChecker interface {
	CheckReady(context.Context) (string, error)
}

type tripTodayProvider interface {
	TripToday() time.Time
}

type apiServer struct {
	readiness                           readinessChecker
	auth                                *auth.Service
	trips                               *trip.Service
	flights                             *flight.Service
	places                              *place.Service
	routes                              *route.Service
	inviteBaseURL                       string
	inviteAppScheme                     string
	inviteIOSAppIDs                     []string
	inviteAndroidPackageName            string
	inviteAndroidSHA256CertFingerprints []string
	appStoreURL                         string
	playStoreURL                        string
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
		options := []trip.ServiceOption{trip.WithInviteBaseURL(config.InviteBaseURL)}
		if provider, ok := readiness.(tripTodayProvider); ok {
			options = append(options, trip.WithToday(provider.TripToday))
		}
		tripService = trip.NewService(repo, options...)
	}

	var flightService *flight.Service
	if repo, ok := readiness.(flight.Repository); ok {
		options := []flight.ServiceOption{}
		if config.BoardingPassObjectStore != nil {
			options = append(options, flight.WithBoardingPassObjectStore(config.BoardingPassObjectStore))
		}
		flightService = flight.NewService(repo, options...)
	}

	var placeService *place.Service
	if repo, ok := readiness.(place.Repository); ok {
		provider := config.PlaceProvider
		if provider == nil {
			provider = place.NewGoogleProvider(config.GooglePlacesAPIKey)
		}
		placeService = place.NewService(repo, provider, place.WithPhotoTokenSecret(firstNonEmpty(config.GooglePlacesPhotoTokenSecret, config.AuthTokenSecret)))
	}

	var routeService *route.Service
	if repo, ok := readiness.(route.Repository); ok {
		provider := config.RouteProvider
		if provider == nil {
			provider = route.NewGoogleProvider(config.GoogleRoutesAPIKey)
		}
		routeService = route.NewService(repo, provider)
	}

	router := chi.NewRouter()
	server := apiServer{
		readiness:                           readiness,
		auth:                                authService,
		trips:                               tripService,
		flights:                             flightService,
		places:                              placeService,
		routes:                              routeService,
		inviteBaseURL:                       config.InviteBaseURL,
		inviteAppScheme:                     config.InviteAppScheme,
		inviteIOSAppIDs:                     config.InviteIOSAppIDs,
		inviteAndroidPackageName:            config.InviteAndroidPackageName,
		inviteAndroidSHA256CertFingerprints: config.InviteAndroidSHA256CertFingerprints,
		appStoreURL:                         config.AppStoreURL,
		playStoreURL:                        config.PlayStoreURL,
	}
	router.Get("/.well-known/apple-app-site-association", server.InviteAppleAppSiteAssociation)
	router.Get("/.well-known/assetlinks.json", server.InviteAndroidAssetLinks)
	router.Get("/invite/{token}", server.InviteFallback)
	return openapi.HandlerWithOptions(server, openapi.ChiServerOptions{
		BaseRouter:       router,
		ErrorHandlerFunc: writeOpenAPIRequestError,
	})
}
