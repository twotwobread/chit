package route

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGoogleProviderPreviewSuccess(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "routes-key" {
			t.Fatalf("expected routes key header, got %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got == "" {
			t.Fatal("expected field mask header")
		}

		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if got := body["travelMode"]; got != "TRANSIT" {
			t.Fatalf("expected TRANSIT request, got %#v", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"routes": [{
				"duration": "1320s",
				"distanceMeters": 5400,
				"polyline": {"encodedPolyline": "encoded"},
				"viewport": {
					"high": {"latitude": 37.6, "longitude": 127.1},
					"low": {"latitude": 37.5, "longitude": 127.0}
				},
				"legs": [{"steps": [{"transitDetails": {}}, {"transitDetails": {}}]}]
			}]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithClient(" routes-key ", server.URL, server.Client())
	result, err := provider.Preview(context.Background(), ProviderPreviewInput{
		Origin:      GeoPoint{Latitude: 37.5, Longitude: 127.0},
		Destination: GeoPoint{Latitude: 37.6, Longitude: 127.1},
		Mode:        transitMode,
	})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if requests != 1 {
		t.Fatalf("expected one provider request, got %d", requests)
	}
	if result.DurationSeconds != 1320 || result.DistanceMeters != 5400 || result.EncodedPolyline != "encoded" {
		t.Fatalf("unexpected route result: %#v", result)
	}
	if result.TransferCount == nil || *result.TransferCount != 1 {
		t.Fatalf("expected one transfer, got %#v", result.TransferCount)
	}
	if result.Bounds == nil || result.Bounds.Northeast.Latitude != 37.6 || result.Bounds.Southwest.Longitude != 127.0 {
		t.Fatalf("unexpected bounds: %#v", result.Bounds)
	}
}

func TestGoogleProviderPreviewRequiresRouteProviderConfig(t *testing.T) {
	provider := NewGoogleProviderWithClient("", "http://example.invalid", http.DefaultClient)
	_, err := provider.Preview(context.Background(), ProviderPreviewInput{
		Origin:      GeoPoint{Latitude: 37.5, Longitude: 127.0},
		Destination: GeoPoint{Latitude: 37.6, Longitude: 127.1},
		Mode:        transitMode,
	})
	if !errors.Is(err, ErrProviderDown) {
		t.Fatalf("expected ErrProviderDown for missing route API key, got %v", err)
	}
}

func TestGoogleProviderPreviewMapsProviderFailures(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		expected   error
	}{
		{name: "no route from empty successful response", statusCode: http.StatusOK, body: `{"routes": []}`, expected: ErrProviderNoRoute},
		{name: "not found", statusCode: http.StatusNotFound, body: `{"error":{"status":"NOT_FOUND"}}`, expected: ErrProviderNoRoute},
		{name: "rate limited", statusCode: http.StatusTooManyRequests, body: `{"error":{"status":"RESOURCE_EXHAUSTED"}}`, expected: ErrProviderLimited},
		{name: "api disabled", statusCode: http.StatusForbidden, body: `{"error":{"status":"PERMISSION_DENIED","message":"Routes API has not been used"}}`, expected: ErrProviderDown},
		{name: "upstream unavailable", statusCode: http.StatusServiceUnavailable, body: `{"error":{"status":"UNAVAILABLE"}}`, expected: ErrProviderDown},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.statusCode)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()

			provider := NewGoogleProviderWithClient("routes-key", server.URL, server.Client())
			_, err := provider.Preview(context.Background(), ProviderPreviewInput{
				Origin:      GeoPoint{Latitude: 37.5, Longitude: 127.0},
				Destination: GeoPoint{Latitude: 37.6, Longitude: 127.1},
				Mode:        transitMode,
			})
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}
