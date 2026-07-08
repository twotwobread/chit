package place

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
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

	requestBody := map[string]interface{}{
		"textQuery":      input.Query,
		"maxResultCount": input.Limit,
		"languageCode":   "ko",
	}
	if input.LocationBias != nil {
		requestBody["locationBias"] = map[string]interface{}{
			"circle": map[string]interface{}{
				"center": map[string]float64{
					"latitude":  input.LocationBias.Latitude,
					"longitude": input.LocationBias.Longitude,
				},
				"radius": input.LocationBias.RadiusMeters,
			},
		}
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.searchEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Goog-Api-Key", p.apiKey)
	request.Header.Set("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.currentOpeningHours,places.googleMapsUri,places.photos")

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
			GooglePlaceID:          strings.TrimSpace(item.ID),
			DisplayName:            strings.TrimSpace(item.DisplayName.Text),
			FormattedAddress:       strings.TrimSpace(item.FormattedAddress),
			PrimaryType:            strings.TrimSpace(item.PrimaryType),
			PrimaryTypeDisplayName: strings.TrimSpace(item.PrimaryTypeDisplayName.Text),
			Latitude:               item.Location.Latitude,
			Longitude:              item.Location.Longitude,
			Rating:                 item.Rating,
			UserRatingCount:        item.UserRatingCount,
			OpenNow:                item.CurrentOpeningHours.OpenNow,
			GoogleMapsURI:          strings.TrimSpace(item.GoogleMapsURI),
		}
		if len(item.Photos) > 0 {
			photo := item.Photos[0]
			result.Photo = &SearchResultPhoto{
				Name:               strings.TrimSpace(photo.Name),
				WidthPx:            photo.WidthPx,
				HeightPx:           photo.HeightPx,
				AuthorAttributions: googlePhotoAttributions(photo.AuthorAttributions),
			}
			if result.Photo.Name == "" {
				result.Photo = nil
			}
		}
		if result.GooglePlaceID == "" || result.DisplayName == "" || result.FormattedAddress == "" || result.PrimaryType == "" || !validCoordinate(result.Latitude, result.Longitude) {
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

func (p *GoogleProvider) Description(ctx context.Context, input ProviderDescriptionInput) (GooglePlaceDescription, error) {
	googlePlaceID := strings.TrimSpace(input.GooglePlaceID)
	if p == nil || p.apiKey == "" || p.detailsBaseURL == "" || p.client == nil || googlePlaceID == "" {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}

	requestURL := p.detailsBaseURL + "/" + url.PathEscape(googlePlaceID)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return GooglePlaceDescription{}, err
	}
	request.Header.Set("X-Goog-Api-Key", p.apiKey)
	request.Header.Set("X-Goog-FieldMask", "id,editorialSummary,generativeSummary")

	response, err := p.client.Do(request)
	if err != nil {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return GooglePlaceDescription{}, ErrNotFound
	}
	if response.StatusCode == http.StatusTooManyRequests {
		return GooglePlaceDescription{}, ErrProviderRateLimited
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}

	var payload googlePlaceDescriptionResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return GooglePlaceDescription{}, ErrProviderUnavailable
	}
	return GooglePlaceDescription{
		GooglePlaceID: strings.TrimSpace(payload.ID),
		Description:   firstNonEmptyString(payload.EditorialSummary.Text, payload.GenerativeSummary.Text),
	}, nil
}

func (p *GoogleProvider) Photo(ctx context.Context, input ProviderPhotoInput) (GooglePlacePhoto, error) {
	name := strings.Trim(strings.TrimSpace(input.Name), "/")
	if p == nil || p.apiKey == "" || p.client == nil || name == "" || input.MaxWidthPx < 1 {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}

	requestURL := googlePlacePhotoMediaBaseURL(p.detailsBaseURL) + "/" + name + "/media"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return GooglePlacePhoto{}, err
	}
	query := request.URL.Query()
	query.Set("key", p.apiKey)
	query.Set("maxWidthPx", strconv.Itoa(input.MaxWidthPx))
	query.Set("skipHttpRedirect", "true")
	request.URL.RawQuery = query.Encode()

	response, err := p.client.Do(request)
	if err != nil {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNotFound {
		return GooglePlacePhoto{}, ErrNotFound
	}
	if response.StatusCode == http.StatusTooManyRequests {
		return GooglePlacePhoto{}, ErrProviderRateLimited
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}

	var payload googlePlacePhotoResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}
	photoURI := strings.TrimSpace(payload.PhotoURI)
	if photoURI == "" {
		return GooglePlacePhoto{}, ErrProviderUnavailable
	}
	return GooglePlacePhoto{URI: photoURI}, nil
}

func IsProviderError(err error) bool {
	return errors.Is(err, ErrProviderUnavailable) || errors.Is(err, ErrProviderRateLimited)
}

func validCoordinate(latitude float64, longitude float64) bool {
	return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

func googlePhotoAttributions(input []googlePhotoAttribution) []PhotoAttribution {
	out := make([]PhotoAttribution, 0, len(input))
	for _, attribution := range input {
		displayName := strings.TrimSpace(attribution.DisplayName)
		if displayName == "" {
			continue
		}
		out = append(out, PhotoAttribution{
			DisplayName: displayName,
			URI:         strings.TrimSpace(attribution.URI),
			PhotoURI:    strings.TrimSpace(attribution.PhotoURI),
		})
	}
	return out
}

func googlePlacePhotoMediaBaseURL(detailsBaseURL string) string {
	base := strings.TrimRight(strings.TrimSpace(detailsBaseURL), "/")
	return strings.TrimSuffix(base, "/places")
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

type googlePhotoAttribution struct {
	DisplayName string `json:"displayName"`
	URI         string `json:"uri"`
	PhotoURI    string `json:"photoUri"`
}

type googleSearchTextResponse struct {
	Places []struct {
		ID               string   `json:"id"`
		FormattedAddress string   `json:"formattedAddress"`
		PrimaryType      string   `json:"primaryType"`
		Rating           *float64 `json:"rating"`
		UserRatingCount  *int     `json:"userRatingCount"`
		GoogleMapsURI    string   `json:"googleMapsUri"`
		DisplayName      struct {
			Text string `json:"text"`
		} `json:"displayName"`
		PrimaryTypeDisplayName struct {
			Text string `json:"text"`
		} `json:"primaryTypeDisplayName"`
		Location struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"location"`
		CurrentOpeningHours struct {
			OpenNow *bool `json:"openNow"`
		} `json:"currentOpeningHours"`
		Photos []struct {
			Name               string                   `json:"name"`
			WidthPx            int                      `json:"widthPx"`
			HeightPx           int                      `json:"heightPx"`
			AuthorAttributions []googlePhotoAttribution `json:"authorAttributions"`
		} `json:"photos"`
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

type googlePlaceDescriptionResponse struct {
	ID               string `json:"id"`
	EditorialSummary struct {
		Text string `json:"text"`
	} `json:"editorialSummary"`
	GenerativeSummary struct {
		Text string `json:"text"`
	} `json:"generativeSummary"`
}

type googlePlacePhotoResponse struct {
	PhotoURI string `json:"photoUri"`
}
