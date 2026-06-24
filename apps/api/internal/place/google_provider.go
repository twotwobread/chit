package place

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	googlePlacesAPIBaseURL     = "https://places.googleapis.com/v1"
	googlePlacesSearchTextURL  = googlePlacesAPIBaseURL + "/places:searchText"
	googlePlacesDetailsBaseURL = googlePlacesAPIBaseURL + "/places"
)

type GoogleProvider struct {
	apiKey         string
	searchEndpoint string
	detailsBaseURL string
	client         *http.Client
}

func NewGoogleProvider(apiKey string) *GoogleProvider {
	return NewGoogleProviderWithEndpoints(apiKey, googlePlacesSearchTextURL, googlePlacesDetailsBaseURL, &http.Client{Timeout: 5 * time.Second})
}

func NewGoogleProviderWithClient(apiKey string, endpoint string, client *http.Client) *GoogleProvider {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	return NewGoogleProviderWithEndpoints(apiKey, endpoint, endpoint+"/places", client)
}

func NewGoogleProviderWithEndpoints(apiKey string, searchEndpoint string, detailsBaseURL string, client *http.Client) *GoogleProvider {
	return &GoogleProvider{
		apiKey:         strings.TrimSpace(apiKey),
		searchEndpoint: strings.TrimSpace(searchEndpoint),
		detailsBaseURL: strings.TrimRight(strings.TrimSpace(detailsBaseURL), "/"),
		client:         client,
	}
}

func (p *GoogleProvider) Search(ctx context.Context, input ProviderSearchInput) ([]SearchResult, error) {
	if p == nil || p.apiKey == "" || p.searchEndpoint == "" || p.client == nil {
		return nil, ErrProviderUnavailable
	}

	body, err := json.Marshal(map[string]interface{}{
		"textQuery":      input.Query,
		"maxResultCount": input.Limit,
	})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.searchEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Goog-Api-Key", p.apiKey)
	request.Header.Set("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.primaryType")

	response, err := p.client.Do(request)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusTooManyRequests {
		return nil, ErrProviderRateLimited
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, ErrProviderUnavailable
	}

	var payload googleSearchTextResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, ErrProviderUnavailable
	}

	results := make([]SearchResult, 0, len(payload.Places))
	for _, item := range payload.Places {
		result := SearchResult{
			GooglePlaceID:    strings.TrimSpace(item.ID),
			DisplayName:      strings.TrimSpace(item.DisplayName.Text),
			FormattedAddress: strings.TrimSpace(item.FormattedAddress),
			PrimaryType:      strings.TrimSpace(item.PrimaryType),
		}
		if result.GooglePlaceID == "" || result.DisplayName == "" || result.FormattedAddress == "" || result.PrimaryType == "" {
			continue
		}
		results = append(results, result)
	}

	return results, nil
}

func (p *GoogleProvider) Details(ctx context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error) {
	googlePlaceID := strings.TrimSpace(input.GooglePlaceID)
	if p == nil || p.apiKey == "" || p.detailsBaseURL == "" || p.client == nil || googlePlaceID == "" {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	requestURL := p.detailsBaseURL + "/" + url.PathEscape(googlePlaceID)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return GooglePlaceDetails{}, err
	}
	request.Header.Set("X-Goog-Api-Key", p.apiKey)
	request.Header.Set("X-Goog-FieldMask", "id,displayName,formattedAddress,location,primaryType,types")

	response, err := p.client.Do(request)
	if err != nil {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return GooglePlaceDetails{}, ErrNotFound
	}
	if response.StatusCode == http.StatusTooManyRequests {
		return GooglePlaceDetails{}, ErrProviderRateLimited
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	var payload googlePlaceDetailsResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return GooglePlaceDetails{}, ErrProviderUnavailable
	}

	return GooglePlaceDetails{
		GooglePlaceID:    strings.TrimSpace(payload.ID),
		DisplayName:      strings.TrimSpace(payload.DisplayName.Text),
		FormattedAddress: strings.TrimSpace(payload.FormattedAddress),
		Latitude:         payload.Location.Latitude,
		Longitude:        payload.Location.Longitude,
		PrimaryType:      strings.TrimSpace(payload.PrimaryType),
		Types:            payload.Types,
	}, nil
}

func IsProviderError(err error) bool {
	return errors.Is(err, ErrProviderUnavailable) || errors.Is(err, ErrProviderRateLimited)
}

type googleSearchTextResponse struct {
	Places []struct {
		ID               string `json:"id"`
		FormattedAddress string `json:"formattedAddress"`
		PrimaryType      string `json:"primaryType"`
		DisplayName      struct {
			Text string `json:"text"`
		} `json:"displayName"`
	} `json:"places"`
}

type googlePlaceDetailsResponse struct {
	ID               string   `json:"id"`
	FormattedAddress string   `json:"formattedAddress"`
	PrimaryType      string   `json:"primaryType"`
	Types            []string `json:"types"`
	DisplayName      struct {
		Text string `json:"text"`
	} `json:"displayName"`
	Location struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
}
