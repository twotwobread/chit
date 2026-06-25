package route

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

const googleRoutesComputeURL = "https://routes.googleapis.com/directions/v2:computeRoutes"

type GoogleProvider struct {
	apiKey   string
	endpoint string
	client   *http.Client
}

func NewGoogleProvider(apiKey string) *GoogleProvider {
	return NewGoogleProviderWithClient(apiKey, googleRoutesComputeURL, &http.Client{Timeout: 6 * time.Second})
}

func NewGoogleProviderWithClient(apiKey string, endpoint string, client *http.Client) *GoogleProvider {
	return &GoogleProvider{
		apiKey:   strings.TrimSpace(apiKey),
		endpoint: strings.TrimSpace(endpoint),
		client:   client,
	}
}

func (p *GoogleProvider) Preview(ctx context.Context, input ProviderPreviewInput) (ProviderPreviewResult, error) {
	if p == nil || p.apiKey == "" || p.endpoint == "" || p.client == nil || input.Mode != transitMode {
		return ProviderPreviewResult{}, ErrProviderDown
	}

	body, err := json.Marshal(map[string]interface{}{
		"origin": map[string]interface{}{
			"location": map[string]interface{}{
				"latLng": map[string]float64{"latitude": input.Origin.Latitude, "longitude": input.Origin.Longitude},
			},
		},
		"destination": map[string]interface{}{
			"location": map[string]interface{}{
				"latLng": map[string]float64{"latitude": input.Destination.Latitude, "longitude": input.Destination.Longitude},
			},
		},
		"travelMode":               "TRANSIT",
		"computeAlternativeRoutes": false,
		"polylineEncoding":         "ENCODED_POLYLINE",
	})
	if err != nil {
		return ProviderPreviewResult{}, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(body))
	if err != nil {
		return ProviderPreviewResult{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Goog-Api-Key", p.apiKey)
	request.Header.Set("X-Goog-FieldMask", "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.viewport,routes.legs.steps.transitDetails")

	response, err := p.client.Do(request)
	if err != nil {
		return ProviderPreviewResult{}, ErrProviderDown
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusTooManyRequests {
		return ProviderPreviewResult{}, ErrProviderLimited
	}
	if response.StatusCode == http.StatusNotFound {
		return ProviderPreviewResult{}, ErrProviderNoRoute
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ProviderPreviewResult{}, ErrProviderDown
	}

	var payload googleRoutesResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return ProviderPreviewResult{}, ErrProviderDown
	}
	if len(payload.Routes) == 0 {
		return ProviderPreviewResult{}, ErrProviderNoRoute
	}

	first := payload.Routes[0]
	durationSeconds, ok := parseGoogleDurationSeconds(first.Duration)
	if !ok || first.DistanceMeters < 0 {
		return ProviderPreviewResult{}, ErrProviderDown
	}

	transferCount := googleTransferCount(first)
	result := ProviderPreviewResult{
		DurationSeconds: durationSeconds,
		DistanceMeters:  first.DistanceMeters,
		EncodedPolyline: strings.TrimSpace(first.Polyline.EncodedPolyline),
		TransferCount:   transferCount,
	}
	if bounds, ok := googleBounds(first.Viewport); ok {
		result.Bounds = &bounds
	}
	return result, nil
}

func parseGoogleDurationSeconds(value string) (int, bool) {
	value = strings.TrimSpace(value)
	if !strings.HasSuffix(value, "s") {
		return 0, false
	}
	duration, err := time.ParseDuration(strings.TrimSuffix(value, "s") + "s")
	if err != nil || duration < 0 {
		return 0, false
	}
	return int(duration.Seconds()), true
}

func googleTransferCount(route googleRoute) *int {
	transitSteps := 0
	for _, leg := range route.Legs {
		for _, step := range leg.Steps {
			if step.TransitDetails != nil {
				transitSteps++
			}
		}
	}
	if transitSteps == 0 {
		return nil
	}
	count := transitSteps - 1
	if count < 0 {
		count = 0
	}
	return &count
}

func googleBounds(viewport googleViewport) (GeoBounds, bool) {
	if !validGeoPoint(GeoPoint{Latitude: viewport.High.Latitude, Longitude: viewport.High.Longitude}) || !validGeoPoint(GeoPoint{Latitude: viewport.Low.Latitude, Longitude: viewport.Low.Longitude}) {
		return GeoBounds{}, false
	}
	return GeoBounds{
		Northeast: GeoPoint{Latitude: viewport.High.Latitude, Longitude: viewport.High.Longitude},
		Southwest: GeoPoint{Latitude: viewport.Low.Latitude, Longitude: viewport.Low.Longitude},
	}, true
}

type googleRoutesResponse struct {
	Routes []googleRoute `json:"routes"`
}

type googleRoute struct {
	Duration       string         `json:"duration"`
	DistanceMeters int            `json:"distanceMeters"`
	Polyline       googlePolyline `json:"polyline"`
	Viewport       googleViewport `json:"viewport"`
	Legs           []googleLeg    `json:"legs"`
}

type googlePolyline struct {
	EncodedPolyline string `json:"encodedPolyline"`
}

type googleViewport struct {
	High googleLatLng `json:"high"`
	Low  googleLatLng `json:"low"`
}

type googleLatLng struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type googleLeg struct {
	Steps []googleStep `json:"steps"`
}

type googleStep struct {
	TransitDetails *struct{} `json:"transitDetails"`
}
