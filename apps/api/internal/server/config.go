package server

import (
	"os"
	"strings"

	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/route"
)

type Config struct {
	AuthTokenSecret    string
	AppleAudience      string
	AllowDevOAuth      bool
	GooglePlacesAPIKey string
	GoogleRoutesAPIKey string
	InviteBaseURL      string
	AppStoreURL        string
	PlayStoreURL       string
	PlaceProvider      place.Provider
	RouteProvider      route.Provider
}

func ConfigFromEnv() Config {
	return Config{
		AuthTokenSecret:    os.Getenv("AUTH_TOKEN_SECRET"),
		AppleAudience:      firstNonEmpty(os.Getenv("APPLE_CLIENT_ID"), os.Getenv("APPLE_BUNDLE_ID")),
		AllowDevOAuth:      envBool(os.Getenv("AUTH_ALLOW_DEV_OAUTH")),
		GooglePlacesAPIKey: os.Getenv("GOOGLE_PLACES_API_KEY"),
		GoogleRoutesAPIKey: firstNonEmpty(os.Getenv("GOOGLE_ROUTES_API_KEY"), os.Getenv("GOOGLE_MAPS_API_KEY"), os.Getenv("GOOGLE_PLACES_API_KEY")),
		InviteBaseURL:      os.Getenv("INVITE_BASE_URL"),
		AppStoreURL:        os.Getenv("INVITE_APP_STORE_URL"),
		PlayStoreURL:       os.Getenv("INVITE_PLAY_STORE_URL"),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func envBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
