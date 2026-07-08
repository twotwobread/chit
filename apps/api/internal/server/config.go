package server

import (
	"os"
	"strings"

	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/route"
)

type Config struct {
	AuthTokenSecret                     string
	AppleAudience                       string
	AllowDevOAuth                       bool
	GooglePlacesAPIKey                  string
	GooglePlacesPhotoTokenSecret        string
	GoogleRoutesAPIKey                  string
	InviteBaseURL                       string
	InviteAppScheme                     string
	InviteIOSAppIDs                     []string
	InviteAndroidPackageName            string
	InviteAndroidSHA256CertFingerprints []string
	AppStoreURL                         string
	PlayStoreURL                        string
	PlaceProvider                       place.Provider
	RouteProvider                       route.Provider
}

func ConfigFromEnv() Config {
	return Config{
		AuthTokenSecret:                     os.Getenv("AUTH_TOKEN_SECRET"),
		AppleAudience:                       firstNonEmpty(os.Getenv("APPLE_CLIENT_ID"), os.Getenv("APPLE_BUNDLE_ID")),
		AllowDevOAuth:                       envBool(os.Getenv("AUTH_ALLOW_DEV_OAUTH")),
		GooglePlacesAPIKey:                  os.Getenv("GOOGLE_PLACES_API_KEY"),
		GooglePlacesPhotoTokenSecret:        firstNonEmpty(os.Getenv("GOOGLE_PLACES_PHOTO_TOKEN_SECRET"), os.Getenv("AUTH_TOKEN_SECRET")),
		GoogleRoutesAPIKey:                  firstNonEmpty(os.Getenv("GOOGLE_ROUTES_API_KEY"), os.Getenv("GOOGLE_MAPS_API_KEY")),
		InviteBaseURL:                       os.Getenv("INVITE_BASE_URL"),
		InviteAppScheme:                     os.Getenv("INVITE_APP_SCHEME"),
		InviteIOSAppIDs:                     splitCommaValues(os.Getenv("INVITE_IOS_APP_IDS")),
		InviteAndroidPackageName:            os.Getenv("INVITE_ANDROID_PACKAGE_NAME"),
		InviteAndroidSHA256CertFingerprints: splitCommaValues(os.Getenv("INVITE_ANDROID_SHA256_CERT_FINGERPRINTS")),
		AppStoreURL:                         os.Getenv("INVITE_APP_STORE_URL"),
		PlayStoreURL:                        os.Getenv("INVITE_PLAY_STORE_URL"),
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

func splitCommaValues(value string) []string {
	parts := strings.Split(value, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func envBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
