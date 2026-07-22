package trip

import (
	"strings"
	"testing"
)

func TestReceiptExtractionPromptDocumentsZeroDecimalMinorUnits(t *testing.T) {
	prompt := receiptExtractionSystemPrompt
	for _, want := range []string{"KRW", "JPY", "VND", "multiplier 1", "17,800원", "17800", "not 1780000"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt does not contain %q\n%s", want, prompt)
		}
	}
}

func TestReceiptExtractionJSONSchemaIncludesPlaceCandidateFields(t *testing.T) {
	schema := receiptExtractionJSONSchema()
	required, ok := schema["required"].([]string)
	if !ok {
		t.Fatalf("schema required has unexpected type %T", schema["required"])
	}
	for _, want := range []string{"merchantAddress", "placeCandidateName", "placeCandidateAddress", "placeCandidateConfidence", "placeCandidateWarnings"} {
		if !containsString(required, want) {
			t.Fatalf("schema required fields missing %q: %#v", want, required)
		}
	}
	props, ok := schema["properties"].(map[string]any)
	if !ok {
		t.Fatalf("schema properties has unexpected type %T", schema["properties"])
	}
	for _, want := range []string{"merchantAddress", "placeCandidateName", "placeCandidateAddress", "placeCandidateConfidence", "placeCandidateWarnings"} {
		if _, ok := props[want]; !ok {
			t.Fatalf("schema properties missing %q", want)
		}
	}
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
