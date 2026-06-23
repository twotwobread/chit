package place

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

const googlePlacesSearchTextURL = "https://places.googleapis.com/v1/places:searchText"

type GoogleProvider struct {
	apiKey   string
	endpoint string
	client   *http.Client
}

func NewGoogleProvider(apiKey string) *GoogleProvider {
	return NewGoogleProviderWithClient(apiKey, googlePlacesSearchTextURL, &http.Client{Timeout: 5 * time.Second})
}

func NewGoogleProviderWithClient(apiKey string, endpoint string, client *http.Client) *GoogleProvider {
	return &GoogleProvider{apiKey: strings.TrimSpace(apiKey), endpoint: strings.TrimSpace(endpoint), client: client}
}

func (p *GoogleProvider) Search(ctx context.Context, input ProviderSearchInput) ([]SearchResult, error) {
	if p == nil || p.apiKey == "" || p.endpoint == "" || p.client == nil {
		return nil, ErrProviderUnavailable
	}

	body, err := json.Marshal(map[string]interface{}{
		"textQuery":      input.Query,
		"maxResultCount": input.Limit,
	})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(body))
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
