package server

import "testing"

func TestConfigFromEnvDoesNotUsePlacesOnlyKeyForRoutePreview(t *testing.T) {
	t.Setenv("GOOGLE_ROUTES_API_KEY", "")
	t.Setenv("GOOGLE_MAPS_API_KEY", "")
	t.Setenv("GOOGLE_PLACES_API_KEY", "places-only-key")

	config := ConfigFromEnv()

	if config.GoogleRoutesAPIKey != "" {
		t.Fatalf("expected places-only key not to configure route preview, got %q", config.GoogleRoutesAPIKey)
	}
	if config.GooglePlacesAPIKey != "places-only-key" {
		t.Fatalf("expected places key to remain available for Places provider, got %q", config.GooglePlacesAPIKey)
	}
}

func TestConfigFromEnvUsesMapsKeyForPlacesWhenSpecificKeyIsUnset(t *testing.T) {
	t.Setenv("GOOGLE_MAPS_API_KEY", "maps-key")
	t.Setenv("GOOGLE_PLACES_API_KEY", "")

	config := ConfigFromEnv()

	if config.GooglePlacesAPIKey != "maps-key" {
		t.Fatalf("expected maps key fallback for Places provider, got %q", config.GooglePlacesAPIKey)
	}
}

func TestConfigFromEnvUsesRoutesOrMapsKeyForRoutePreview(t *testing.T) {
	t.Setenv("GOOGLE_ROUTES_API_KEY", " routes-key ")
	t.Setenv("GOOGLE_MAPS_API_KEY", "maps-key")
	t.Setenv("GOOGLE_PLACES_API_KEY", "places-key")
	if got := ConfigFromEnv().GoogleRoutesAPIKey; got != "routes-key" {
		t.Fatalf("expected explicit routes key, got %q", got)
	}

	t.Setenv("GOOGLE_ROUTES_API_KEY", "")
	if got := ConfigFromEnv().GoogleRoutesAPIKey; got != "maps-key" {
		t.Fatalf("expected maps key fallback, got %q", got)
	}
}
