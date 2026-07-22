package trip

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	openAIChatCompletionsEndpoint = "https://api.openai.com/v1/chat/completions"
	defaultReceiptOpenAIModel     = "gpt-4o-mini"
	maxReceiptOCRPromptRunes      = 12000
)

type OpenAIReceiptModelProvider struct {
	apiKey   string
	model    string
	client   *http.Client
	endpoint string
}

func NewOpenAIReceiptModelProvider(apiKey string, model string) *OpenAIReceiptModelProvider {
	model = strings.TrimSpace(model)
	if model == "" {
		model = defaultReceiptOpenAIModel
	}
	return &OpenAIReceiptModelProvider{
		apiKey:   strings.TrimSpace(apiKey),
		model:    model,
		client:   &http.Client{Timeout: 30 * time.Second},
		endpoint: openAIChatCompletionsEndpoint,
	}
}

func (p *OpenAIReceiptModelProvider) ExtractExpenseReceiptDraft(ctx context.Context, ocrText string) (ExpenseReceiptExtraction, error) {
	if p == nil || strings.TrimSpace(p.apiKey) == "" {
		return ExpenseReceiptExtraction{}, ErrReceiptProviderUnavailable
	}
	ocrText = strings.TrimSpace(truncateRunes(ocrText, maxReceiptOCRPromptRunes))
	if ocrText == "" {
		return ExpenseReceiptExtraction{}, ErrReceiptExtractionInvalid
	}
	requestBody := openAIChatRequest{
		Model: p.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: receiptExtractionSystemPrompt},
			{Role: "user", Content: "OCR text from receipt capture sections:\n\n" + ocrText},
		},
		Temperature: 0,
		ResponseFormat: openAIResponseFormat{
			Type: "json_schema",
			JSONSchema: openAIJSONSchema{
				Name:   "expense_receipt_extraction",
				Strict: true,
				Schema: receiptExtractionJSONSchema(),
			},
		},
	}
	payload, err := json.Marshal(requestBody)
	if err != nil {
		return ExpenseReceiptExtraction{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return ExpenseReceiptExtraction{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := p.client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return ExpenseReceiptExtraction{}, ErrReceiptProviderUnavailable
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return ExpenseReceiptExtraction{}, ErrReceiptProviderUnavailable
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		return ExpenseReceiptExtraction{}, ErrReceiptProviderRateLimited
	}
	if resp.StatusCode >= 500 {
		return ExpenseReceiptExtraction{}, ErrReceiptProviderUnavailable
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ExpenseReceiptExtraction{}, fmt.Errorf("openai status %d: %w", resp.StatusCode, ErrReceiptProviderUnavailable)
	}
	var decoded openAIChatResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return ExpenseReceiptExtraction{}, ErrReceiptExtractionInvalid
	}
	if len(decoded.Choices) == 0 || strings.TrimSpace(decoded.Choices[0].Message.Content) == "" {
		return ExpenseReceiptExtraction{}, ErrReceiptExtractionInvalid
	}
	var extraction ExpenseReceiptExtraction
	if err := json.Unmarshal([]byte(decoded.Choices[0].Message.Content), &extraction); err != nil {
		return ExpenseReceiptExtraction{}, ErrReceiptExtractionInvalid
	}
	return normalizeExpenseReceiptExtraction(extraction), nil
}

const receiptExtractionSystemPrompt = `You extract an expense draft from OCR text for a travel settlement app.
Return only fields allowed by the JSON schema. Use null when the receipt does not support a value.
Never invent payer, participants, split policy, schedule item, place binding, or settlement inclusion.
Prefer the final paid total over subtotals. Convert monetary values to minor units for the detected currency.
Minor-unit rules are currency-specific: KRW, JPY, and VND are zero-decimal currencies with multiplier 1, so 17,800원 must be totalAmountMinor 17800, not 1780000. USD, EUR, GBP, AUD, CAD, SGD, HKD, TWD, THB, PHP, and CNY usually use multiplier 100 when amounts include major units.
Extract merchantAddress when the receipt has a business/store address. For explicit user confirmation only, set placeCandidateName/placeCandidateAddress when the merchant looks like a visitable trip place; otherwise use null. Do not imply that the candidate is already saved.
Use ISO date YYYY-MM-DD and 24-hour HH:MM when present. If confidence is not high, include concise warnings.`

type openAIChatRequest struct {
	Model          string               `json:"model"`
	Messages       []openAIChatMessage  `json:"messages"`
	Temperature    float64              `json:"temperature"`
	ResponseFormat openAIResponseFormat `json:"response_format"`
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponseFormat struct {
	Type       string           `json:"type"`
	JSONSchema openAIJSONSchema `json:"json_schema"`
}

type openAIJSONSchema struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func receiptExtractionJSONSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"merchantName", "merchantAddress", "expenseTitle", "expenseDate", "expenseTime", "currency", "totalAmountMinor", "taxAmountMinor", "serviceChargeMinor", "lineItems", "confidence", "warnings", "placeCandidateName", "placeCandidateAddress", "placeCandidateConfidence", "placeCandidateWarnings",
		},
		"properties": map[string]any{
			"merchantName":       map[string]any{"type": []string{"string", "null"}},
			"merchantAddress":    map[string]any{"type": []string{"string", "null"}},
			"expenseTitle":       map[string]any{"type": []string{"string", "null"}},
			"expenseDate":        map[string]any{"type": []string{"string", "null"}, "pattern": "^\\d{4}-\\d{2}-\\d{2}$"},
			"expenseTime":        map[string]any{"type": []string{"string", "null"}, "pattern": "^\\d{2}:\\d{2}$"},
			"currency":           map[string]any{"type": []string{"string", "null"}, "enum": []any{"KRW", "USD", "JPY", "EUR", "CNY", "TWD", "HKD", "THB", "VND", "PHP", "SGD", "AUD", "CAD", "GBP", nil}},
			"totalAmountMinor":   map[string]any{"type": []string{"integer", "null"}, "minimum": 0},
			"taxAmountMinor":     map[string]any{"type": []string{"integer", "null"}, "minimum": 0},
			"serviceChargeMinor": map[string]any{"type": []string{"integer", "null"}, "minimum": 0},
			"lineItems": map[string]any{
				"type":     "array",
				"maxItems": 50,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"name", "amountMinor", "quantity"},
					"properties": map[string]any{
						"name":        map[string]any{"type": "string"},
						"amountMinor": map[string]any{"type": []string{"integer", "null"}, "minimum": 0},
						"quantity":    map[string]any{"type": []string{"number", "null"}, "minimum": 0},
					},
				},
			},
			"confidence":               map[string]any{"type": "string", "enum": []string{ExpenseReceiptConfidenceHigh, ExpenseReceiptConfidenceMedium, ExpenseReceiptConfidenceLow}},
			"warnings":                 map[string]any{"type": "array", "maxItems": 10, "items": map[string]any{"type": "string"}},
			"placeCandidateName":       map[string]any{"type": []string{"string", "null"}},
			"placeCandidateAddress":    map[string]any{"type": []string{"string", "null"}},
			"placeCandidateConfidence": map[string]any{"type": []string{"string", "null"}, "enum": []any{ExpenseReceiptConfidenceHigh, ExpenseReceiptConfidenceMedium, ExpenseReceiptConfidenceLow, nil}},
			"placeCandidateWarnings":   map[string]any{"type": "array", "maxItems": 5, "items": map[string]any{"type": "string"}},
		},
	}
}

func truncateRunes(value string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}

var _ ReceiptModelProvider = (*OpenAIReceiptModelProvider)(nil)
