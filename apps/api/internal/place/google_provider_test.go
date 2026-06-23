package place

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGoogleProviderSearch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Fatalf("expected api key header, got %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got != "places.id,places.displayName,places.formattedAddress,places.primaryType" {
			t.Fatalf("unexpected field mask %q", got)
		}

		var body struct {
			TextQuery      string `json:"textQuery"`
			MaxResultCount int    `json:"maxResultCount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode provider request: %v", err)
		}
		if body.TextQuery != "도톤보리" || body.MaxResultCount != 3 {
			t.Fatalf("unexpected provider request body %#v", body)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"places":[
				{"id":"google-1","displayName":{"text":"도톤보리"},"formattedAddress":"Osaka","primaryType":"tourist_attraction"},
				{"id":"google-2","displayName":{"text":"우메다 카페"},"formattedAddress":"Umeda","primaryType":"cafe"},
				{"id":"","displayName":{"text":"skip"},"formattedAddress":"Nowhere","primaryType":"store"}
			]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithClient(" test-key ", server.URL, server.Client())
	results, err := provider.Search(context.Background(), ProviderSearchInput{Query: "도톤보리", Limit: 3})
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected two valid results, got %#v", results)
	}
	if results[0].GooglePlaceID != "google-1" || results[0].DisplayName != "도톤보리" || results[0].FormattedAddress != "Osaka" || results[0].PrimaryType != "tourist_attraction" {
		t.Fatalf("unexpected first result %#v", results[0])
	}
}

func TestGoogleProviderSearchMissingKey(t *testing.T) {
	provider := NewGoogleProviderWithClient(" ", "https://example.test", http.DefaultClient)
	_, err := provider.Search(context.Background(), ProviderSearchInput{Query: "도톤보리", Limit: 5})
	if !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("expected ErrProviderUnavailable, got %v", err)
	}
}

func TestGoogleProviderSearchProviderErrors(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		expected   error
	}{
		{name: "rate limited", statusCode: http.StatusTooManyRequests, body: `{}`, expected: ErrProviderRateLimited},
		{name: "unavailable", statusCode: http.StatusBadGateway, body: `{}`, expected: ErrProviderUnavailable},
		{name: "malformed", statusCode: http.StatusOK, body: `{`, expected: ErrProviderUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			provider := NewGoogleProviderWithClient("test-key", server.URL, server.Client())
			_, err := provider.Search(context.Background(), ProviderSearchInput{Query: "도톤보리", Limit: 5})
			if !errors.Is(err, tt.expected) {
				t.Fatalf("expected %v, got %v", tt.expected, err)
			}
		})
	}
}

func TestIsProviderError(t *testing.T) {
	if !IsProviderError(ErrProviderUnavailable) || !IsProviderError(ErrProviderRateLimited) {
		t.Fatal("expected provider errors to be classified")
	}
	if IsProviderError(ErrValidation) {
		t.Fatal("expected validation not to be provider error")
	}
}
