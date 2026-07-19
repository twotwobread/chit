package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const defaultExpoPushEndpoint = "https://exp.host/--/api/v2/push/send"

type ExpoProviderConfig struct {
	Endpoint    string
	AccessToken string
	HTTPClient  *http.Client
}

type ExpoPushProvider struct {
	endpoint    string
	accessToken string
	httpClient  *http.Client
}

func NewExpoPushProvider(config ExpoProviderConfig) *ExpoPushProvider {
	endpoint := strings.TrimSpace(config.Endpoint)
	if endpoint == "" {
		endpoint = defaultExpoPushEndpoint
	}
	httpClient := config.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &ExpoPushProvider{endpoint: endpoint, accessToken: strings.TrimSpace(config.AccessToken), httpClient: httpClient}
}

type expoPushRequest struct {
	To    string          `json:"to"`
	Title string          `json:"title"`
	Body  string          `json:"body"`
	Data  json.RawMessage `json:"data"`
}

type expoPushResponse struct {
	Data expoPushTicket `json:"data"`
}

type expoPushTicket struct {
	Status  string                 `json:"status"`
	ID      string                 `json:"id"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details"`
}

func (p *ExpoPushProvider) Send(ctx context.Context, message PushOutboxMessage) (PushSendResult, error) {
	if p == nil || p.httpClient == nil {
		return PushSendResult{}, errors.New("expo push provider is not configured")
	}
	data := json.RawMessage(message.DataJSON)
	if len(data) == 0 {
		data = json.RawMessage(`{}`)
	}
	payload, err := json.Marshal(expoPushRequest{To: message.ExpoPushToken, Title: message.Title, Body: message.Body, Data: data})
	if err != nil {
		return PushSendResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return PushSendResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+p.accessToken)
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return PushSendResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return PushSendResult{}, fmt.Errorf("expo push returned status %d", resp.StatusCode)
	}
	var decoded expoPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return PushSendResult{}, err
	}
	if decoded.Data.Status == "ok" {
		return PushSendResult{ProviderMessageID: decoded.Data.ID}, nil
	}
	errorMessage := decoded.Data.Message
	if errorMessage == "" {
		errorMessage = "expo push ticket error"
	}
	if isExpoInvalidTokenError(decoded.Data.Details) {
		return PushSendResult{InvalidToken: true, ErrorMessage: errorMessage}, nil
	}
	return PushSendResult{}, errors.New(errorMessage)
}

func isExpoInvalidTokenError(details map[string]interface{}) bool {
	if details == nil {
		return false
	}
	value, _ := details["error"].(string)
	return value == "DeviceNotRegistered" || value == "InvalidCredentials"
}
