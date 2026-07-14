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
		if got := r.Header.Get("X-Goog-FieldMask"); got != "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.currentOpeningHours,places.googleMapsUri,places.photos" {
			t.Fatalf("unexpected field mask %q", got)
		}

		var body struct {
			TextQuery      string `json:"textQuery"`
			MaxResultCount int    `json:"maxResultCount"`
			LanguageCode   string `json:"languageCode"`
			LocationBias   *struct {
				Circle struct {
					Center struct {
						Latitude  float64 `json:"latitude"`
						Longitude float64 `json:"longitude"`
					} `json:"center"`
					Radius float64 `json:"radius"`
				} `json:"circle"`
			} `json:"locationBias"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode provider request: %v", err)
		}
		if body.TextQuery != "도톤보리" || body.MaxResultCount != 3 || body.LanguageCode != "ko" {
			t.Fatalf("unexpected provider request body %#v", body)
		}
		if body.LocationBias == nil || body.LocationBias.Circle.Center.Latitude != 34.7 || body.LocationBias.Circle.Center.Longitude != 135.5 || body.LocationBias.Circle.Radius != 1200 {
			t.Fatalf("expected location bias in provider request, got %#v", body.LocationBias)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"places":[
				{
					"id":"google-1",
					"displayName":{"text":"도톤보리"},
					"formattedAddress":"Osaka",
					"location":{"latitude":34.6687,"longitude":135.5013},
					"primaryType":"tourist_attraction",
					"primaryTypeDisplayName":{"text":"관광명소"},
					"rating":4.5,
					"userRatingCount":12304,
					"currentOpeningHours":{"openNow":true},
					"googleMapsUri":"https://maps.google.com/?cid=1",
					"photos":[{"name":"places/google-1/photos/photo-1","widthPx":600,"heightPx":400,"authorAttributions":[{"displayName":"Google User","uri":"https://maps.google.com/contrib/1","photoUri":"https://lh3.googleusercontent.com/a"}]}]
				},
				{"id":"google-2","displayName":{"text":"우메다 카페"},"formattedAddress":"Umeda","location":{"latitude":34.7,"longitude":135.49},"primaryType":"cafe"},
				{"id":"","displayName":{"text":"skip"},"formattedAddress":"Nowhere","location":{"latitude":34.7,"longitude":135.49},"primaryType":"store"}
			]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithClient(" test-key ", server.URL, server.Client())
	results, err := provider.Search(context.Background(), ProviderSearchInput{
		Query:        "도톤보리",
		Limit:        3,
		LocationBias: &SearchLocationBias{Latitude: 34.7, Longitude: 135.5, RadiusMeters: 1200},
	})
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected two valid results, got %#v", results)
	}
	if results[0].GooglePlaceID != "google-1" || results[0].DisplayName != "도톤보리" || results[0].FormattedAddress != "Osaka" || results[0].PrimaryType != "tourist_attraction" {
		t.Fatalf("unexpected first result %#v", results[0])
	}
	if results[0].Latitude != 34.6687 || results[0].Longitude != 135.5013 || results[0].PrimaryTypeDisplayName != "관광명소" {
		t.Fatalf("expected coordinates and Korean category, got %#v", results[0])
	}
	if results[0].Rating == nil || *results[0].Rating != 4.5 || results[0].UserRatingCount == nil || *results[0].UserRatingCount != 12304 || results[0].OpenNow == nil || !*results[0].OpenNow {
		t.Fatalf("expected rating, review count, and open status, got %#v", results[0])
	}
	if results[0].GoogleMapsURI != "https://maps.google.com/?cid=1" {
		t.Fatalf("expected Google Maps URI, got %q", results[0].GoogleMapsURI)
	}
	if results[0].Photo == nil || results[0].Photo.Name != "places/google-1/photos/photo-1" || len(results[0].Photo.AuthorAttributions) != 1 || results[0].Photo.AuthorAttributions[0].DisplayName != "Google User" {
		t.Fatalf("expected representative photo metadata, got %#v", results[0].Photo)
	}
	if results[1].Rating != nil || results[1].Photo != nil {
		t.Fatalf("expected missing optional fields to remain optional, got %#v", results[1])
	}
}

func TestGoogleProviderSearchDestinations(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Fatalf("expected api key header, got %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got != "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.addressComponents,places.viewport" {
			t.Fatalf("unexpected field mask %q", got)
		}

		var body struct {
			TextQuery      string `json:"textQuery"`
			MaxResultCount int    `json:"maxResultCount"`
			LanguageCode   string `json:"languageCode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode provider request: %v", err)
		}
		if body.TextQuery != "오사카" || body.MaxResultCount != 5 || body.LanguageCode != "ko" {
			t.Fatalf("unexpected provider request body %#v", body)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"places":[
				{
					"id":"google-city-osaka",
					"displayName":{"text":"오사카"},
					"formattedAddress":"오사카부 일본",
					"location":{"latitude":34.6937,"longitude":135.5023},
					"primaryType":"locality",
					"addressComponents":[
						{"longText":"오사카","shortText":"오사카","types":["locality","political"],"languageCode":"ko"},
						{"longText":"일본","shortText":"JP","types":["country","political"],"languageCode":"ko"}
					],
					"viewport":{"low":{"latitude":34.55,"longitude":135.35},"high":{"latitude":34.85,"longitude":135.7}}
				},
				{
					"id":"google-pref-osaka",
					"displayName":{"text":"오사카부"},
					"formattedAddress":"일본 오사카부",
					"location":{"latitude":34.6863,"longitude":135.52},
					"primaryType":"administrative_area_level_1",
					"addressComponents":[
						{"longText":"오사카부","shortText":"오사카부","types":["administrative_area_level_1","political"],"languageCode":"ko"},
						{"longText":"일본","shortText":"JP","types":["country","political"],"languageCode":"ko"}
					]
				},
				{
					"id":"google-poi",
					"displayName":{"text":"도톤보리"},
					"formattedAddress":"오사카 도톤보리",
					"location":{"latitude":34.6687,"longitude":135.5013},
					"primaryType":"tourist_attraction",
					"addressComponents":[{"longText":"일본","shortText":"JP","types":["country","political"],"languageCode":"ko"}]
				}
			]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithEndpoints(" test-key ", server.URL+"/search", server.URL+"/places", server.Client())
	results, err := provider.SearchDestinations(context.Background(), ProviderDestinationSearchInput{Query: "오사카", Limit: 5})
	if err != nil {
		t.Fatalf("SearchDestinations returned error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected two city/admin destinations, got %#v", results)
	}
	if results[0].CityName != "오사카" || results[0].CountryName != "일본" || results[0].CountryCode != "JP" || results[0].DisplayName != "오사카, 일본" {
		t.Fatalf("unexpected first destination %#v", results[0])
	}
	if results[0].Provider != DestinationProviderGoogle || results[0].ProviderPlaceID != "google-city-osaka" || results[0].RadiusMeters <= 0 {
		t.Fatalf("expected provider identity and radius, got %#v", results[0])
	}
	if results[1].CityName != "오사카부" || results[1].RadiusMeters != defaultDestinationRadiusMeters {
		t.Fatalf("expected admin destination fallback radius, got %#v", results[1])
	}
}

func TestGoogleProviderSearchDestinationsUsesTypesWhenPrimaryTypeMissing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"places":[
				{
					"id":"google-city-seoul",
					"displayName":{"text":"서울특별시"},
					"formattedAddress":"대한민국 서울특별시",
					"location":{"latitude":37.5665,"longitude":126.9780},
					"types":["administrative_area_level_1","political"],
					"addressComponents":[
						{"longText":"서울특별시","shortText":"서울특별시","types":["administrative_area_level_1","political"],"languageCode":"ko"},
						{"longText":"대한민국","shortText":"KR","types":["country","political"],"languageCode":"ko"}
					]
				}
			]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithEndpoints("test-key", server.URL+"/search", server.URL+"/places", server.Client())
	results, err := provider.SearchDestinations(context.Background(), ProviderDestinationSearchInput{Query: "서울", Limit: 5})
	if err != nil {
		t.Fatalf("SearchDestinations returned error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected type-derived city destination, got %#v", results)
	}
	if results[0].CityName != "서울특별시" || results[0].CountryCode != "KR" || results[0].ProviderPlaceID != "google-city-seoul" {
		t.Fatalf("unexpected destination %#v", results[0])
	}
}

func TestGoogleProviderDescription(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/places/google-1" {
			t.Fatalf("expected details path, got %q", r.URL.Path)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Fatalf("expected api key header, got %q", got)
		}
		if got := r.URL.Query().Get("languageCode"); got != "ko" {
			t.Fatalf("expected Korean languageCode, got %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got != "id,displayName,formattedAddress,editorialSummary,generativeSummary" {
			t.Fatalf("unexpected field mask %q", got)
		}
		if got := r.URL.Query().Get("languageCode"); got != "ko" {
			t.Fatalf("expected Korean language code, got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"google-1",
			"displayName":{"text":"우메다 스카이 빌딩"},
			"formattedAddress":"일본 오사카부 오사카시 기타구 오요도나카 1초메 1-88",
			"editorialSummary":{"text":"공중정원 전망대로 유명한 오사카 대표 명소입니다."}
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithEndpoints(" test-key ", server.URL+"/search", server.URL+"/places", server.Client())
	description, err := provider.Description(context.Background(), ProviderDescriptionInput{GooglePlaceID: "google-1"})
	if err != nil {
		t.Fatalf("Description returned error: %v", err)
	}
	if description.GooglePlaceID != "google-1" || description.DisplayName != "우메다 스카이 빌딩" || description.FormattedAddress != "일본 오사카부 오사카시 기타구 오요도나카 1초메 1-88" || description.Description != "공중정원 전망대로 유명한 오사카 대표 명소입니다." {
		t.Fatalf("unexpected description %#v", description)
	}
}

func TestGoogleProviderPhoto(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/places/google-1/photos/photo-1/media" {
			t.Fatalf("expected media path, got %q", r.URL.Path)
		}
		query := r.URL.Query()
		if query.Get("key") != "test-key" || query.Get("maxWidthPx") != "320" || query.Get("skipHttpRedirect") != "true" {
			t.Fatalf("unexpected photo query %s", r.URL.RawQuery)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"photoUri":"https://lh3.googleusercontent.com/photo"}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithEndpoints(" test-key ", server.URL+"/search", server.URL+"", server.Client())
	photo, err := provider.Photo(context.Background(), ProviderPhotoInput{Name: "places/google-1/photos/photo-1", MaxWidthPx: 320})
	if err != nil {
		t.Fatalf("Photo returned error: %v", err)
	}
	if photo.URI != "https://lh3.googleusercontent.com/photo" {
		t.Fatalf("unexpected photo %#v", photo)
	}
}

func TestGoogleProviderDetails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/places/google-1" {
			t.Fatalf("expected details path, got %q", r.URL.Path)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Fatalf("expected api key header, got %q", got)
		}
		if got := r.URL.Query().Get("languageCode"); got != "ko" {
			t.Fatalf("expected Korean languageCode, got %q", got)
		}
		if got := r.Header.Get("X-Goog-FieldMask"); got != "id,displayName,formattedAddress,location,primaryType,types" {
			t.Fatalf("unexpected field mask %q", got)
		}
		if got := r.URL.Query().Get("languageCode"); got != "ko" {
			t.Fatalf("expected Korean language code, got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"google-1",
			"displayName":{"text":"도톤보리"},
			"formattedAddress":"일본 오사카부 오사카시 주오구 도톤보리",
			"location":{"latitude":34.6687,"longitude":135.5013},
			"primaryType":"tourist_attraction",
			"types":["tourist_attraction","point_of_interest"]
		}`))
	}))
	defer server.Close()

	provider := NewGoogleProviderWithEndpoints(" test-key ", server.URL+"/search", server.URL+"/places", server.Client())
	details, err := provider.Details(context.Background(), ProviderDetailsInput{GooglePlaceID: "google-1"})
	if err != nil {
		t.Fatalf("Details returned error: %v", err)
	}

	if details.GooglePlaceID != "google-1" || details.DisplayName != "도톤보리" || details.FormattedAddress != "일본 오사카부 오사카시 주오구 도톤보리" || details.PrimaryType != "tourist_attraction" {
		t.Fatalf("unexpected details %#v", details)
	}
	if details.Latitude != 34.6687 || details.Longitude != 135.5013 || len(details.Types) != 2 {
		t.Fatalf("unexpected details metadata %#v", details)
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
