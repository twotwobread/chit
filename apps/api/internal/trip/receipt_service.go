package trip

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"
)

const (
	MaxExpenseReceiptBytes      = 10 * 1024 * 1024
	expenseReceiptObjectKeySize = 16
	expenseReceiptDraftTTL      = 24 * time.Hour
	expenseReceiptSignedURLTTL  = 5 * time.Minute
)

var receiptKRWAmountPattern = regexp.MustCompile(`(?:₩\s*)?\d{1,3}(?:,\d{3})+\s*원?|\d+\s*원`)

var koreanReceiptKeywords = []string{
	"합계",
	"총액",
	"결제금액",
	"결제 금액",
	"승인금액",
	"받을금액",
	"부가세",
	"공급가액",
	"승인번호",
	"카드",
	"현금영수증",
	"매출전표",
	"사업자",
}

var koreanReceiptTotalKeywords = []string{"합계", "총액", "결제금액", "결제 금액", "승인금액", "받을금액"}

func (s *Service) CreateExpenseReceiptDraft(ctx context.Context, userID string, tripID string, input CreateExpenseReceiptDraftInput) (CreateExpenseReceiptDraftResult, error) {
	userID = strings.TrimSpace(userID)
	tripID = strings.TrimSpace(tripID)
	if userID == "" {
		return CreateExpenseReceiptDraftResult{}, ErrUnauthorized
	}
	if !isUUID(tripID) || s.repo == nil {
		return CreateExpenseReceiptDraftResult{}, ErrValidation
	}
	if s.receiptObjectStore == nil {
		return CreateExpenseReceiptDraftResult{}, ErrStorageUnavailable
	}
	if s.receiptModelProvider == nil {
		return CreateExpenseReceiptDraftResult{}, ErrReceiptProviderUnavailable
	}
	repo, ok := s.repo.(ExpenseReceiptDraftRepository)
	if !ok {
		return CreateExpenseReceiptDraftResult{}, ErrStorageUnavailable
	}
	if _, ok, err := s.repo.GetTripByID(ctx, tripID); err != nil {
		return CreateExpenseReceiptDraftResult{}, err
	} else if !ok {
		return CreateExpenseReceiptDraftResult{}, ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return CreateExpenseReceiptDraftResult{}, err
	}
	if !isParticipant {
		return CreateExpenseReceiptDraftResult{}, ErrForbidden
	}

	textParts, err := validateAndNormalizeExpenseReceiptOCRInput(input.CaptureMode, input.OCRLanguage, input.OCRTextParts)
	if err != nil {
		return CreateExpenseReceiptDraftResult{}, err
	}
	images, err := validateAndNormalizeExpenseReceiptImageInput(input.CaptureMode, input.Images)
	if err != nil {
		return CreateExpenseReceiptDraftResult{}, err
	}

	storedObjects := make([]ExpenseReceiptObject, 0, len(images))
	for _, image := range images {
		objectKey, err := newExpenseReceiptObjectKey(tripID, "drafts", image.Role)
		if err != nil {
			deleteExpenseReceiptObjects(ctx, s.receiptObjectStore, storedObjects)
			return CreateExpenseReceiptDraftResult{}, err
		}
		stored, err := s.receiptObjectStore.UploadExpenseReceipt(ctx, objectKey, image.ContentType, image.Data)
		if err != nil {
			deleteExpenseReceiptObjects(ctx, s.receiptObjectStore, storedObjects)
			if err == ErrStorageUnavailable {
				return CreateExpenseReceiptDraftResult{}, ErrStorageUnavailable
			}
			return CreateExpenseReceiptDraftResult{}, err
		}
		if stored.UploadedAt.IsZero() {
			stored.UploadedAt = s.now().UTC()
		}
		stored.Role = image.Role
		stored.ContentType = image.ContentType
		stored.ByteSize = len(image.Data)
		storedObjects = append(storedObjects, stored)
	}

	ocrText := formatReceiptOCRText(input.CaptureMode, textParts)
	extraction, err := s.receiptModelProvider.ExtractExpenseReceiptDraft(ctx, ocrText)
	if err != nil {
		deleteExpenseReceiptObjects(ctx, s.receiptObjectStore, storedObjects)
		return CreateExpenseReceiptDraftResult{}, normalizeReceiptProviderError(err)
	}
	if err := validateExpenseReceiptExtraction(extraction); err != nil {
		deleteExpenseReceiptObjects(ctx, s.receiptObjectStore, storedObjects)
		return CreateExpenseReceiptDraftResult{}, err
	}

	result, err := repo.CreateExpenseReceiptDraft(ctx, CreateExpenseReceiptDraftRecord{
		TripID:          tripID,
		CreatedByUserID: userID,
		CaptureMode:     input.CaptureMode,
		Objects:         storedObjects,
		Extraction:      normalizeExpenseReceiptExtraction(extraction),
		ExpiresAt:       s.now().UTC().Add(expenseReceiptDraftTTL),
	})
	if err != nil {
		deleteExpenseReceiptObjects(ctx, s.receiptObjectStore, storedObjects)
		return CreateExpenseReceiptDraftResult{}, err
	}
	return result, nil
}

func normalizeOptionalReceiptDraftID(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if !isUUID(trimmed) {
		return nil, ErrValidation
	}
	return &trimmed, nil
}

func validateAndNormalizeExpenseReceiptOCRInput(captureMode ReceiptCaptureMode, language ReceiptOCRLanguage, parts []ExpenseReceiptOCRTextPart) ([]ExpenseReceiptOCRTextPart, error) {
	if language != ReceiptOCRLanguageKorean {
		return nil, ErrUnsupportedReceiptLanguage
	}
	roles, err := requiredReceiptRoles(captureMode)
	if err != nil {
		return nil, err
	}
	if len(parts) != len(roles) {
		return nil, ErrValidation
	}
	byRole := make(map[ReceiptImageRole]string, len(parts))
	for _, part := range parts {
		role := part.Role
		text := normalizeOCRText(part.Text)
		if _, ok := byRole[role]; ok {
			return nil, ErrValidation
		}
		byRole[role] = text
	}
	normalized := make([]ExpenseReceiptOCRTextPart, 0, len(roles))
	for _, role := range roles {
		text, ok := byRole[role]
		if !ok || text == "" || len([]rune(text)) > 12000 {
			return nil, ErrValidation
		}
		normalized = append(normalized, ExpenseReceiptOCRTextPart{Role: role, Text: text})
	}
	if err := validateKoreanReceiptTextParts(normalized); err != nil {
		return nil, err
	}
	return normalized, nil
}

func validateAndNormalizeExpenseReceiptImageInput(captureMode ReceiptCaptureMode, images []ExpenseReceiptImageUpload) ([]ExpenseReceiptImageUpload, error) {
	roles, err := requiredReceiptRoles(captureMode)
	if err != nil {
		return nil, err
	}
	if len(images) != len(roles) {
		return nil, ErrValidation
	}
	byRole := make(map[ReceiptImageRole]ExpenseReceiptImageUpload, len(images))
	for _, image := range images {
		image.Role = ReceiptImageRole(strings.TrimSpace(string(image.Role)))
		image.ContentType = strings.TrimSpace(image.ContentType)
		if _, ok := byRole[image.Role]; ok {
			return nil, ErrValidation
		}
		if err := validateExpenseReceiptUpload(image.ContentType, image.Data); err != nil {
			return nil, err
		}
		byRole[image.Role] = image
	}
	normalized := make([]ExpenseReceiptImageUpload, 0, len(roles))
	for _, role := range roles {
		image, ok := byRole[role]
		if !ok {
			return nil, ErrValidation
		}
		normalized = append(normalized, image)
	}
	return normalized, nil
}

func requiredReceiptRoles(captureMode ReceiptCaptureMode) ([]ReceiptImageRole, error) {
	switch captureMode {
	case ReceiptCaptureModeSingle:
		return []ReceiptImageRole{ReceiptImageRoleSingle}, nil
	case ReceiptCaptureModeSplit:
		return []ReceiptImageRole{ReceiptImageRoleHeader, ReceiptImageRoleTotal}, nil
	default:
		return nil, ErrValidation
	}
}

func validateKoreanReceiptTextParts(parts []ExpenseReceiptOCRTextPart) error {
	combinedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		combinedParts = append(combinedParts, normalizeOCRText(part.Text))
	}
	combined := strings.TrimSpace(strings.Join(combinedParts, "\n"))
	if len([]rune(combined)) < 20 || !strings.ContainsAny(combined, "0123456789") {
		return ErrReceiptTextUnreadable
	}
	hangulCount := 0
	for _, r := range combined {
		if unicode.Is(unicode.Hangul, r) {
			hangulCount++
		}
	}
	if hangulCount < 2 {
		return ErrUnsupportedReceiptLanguage
	}
	keywordCount := 0
	for _, keyword := range koreanReceiptKeywords {
		if strings.Contains(combined, keyword) {
			keywordCount++
		}
	}
	hasTotalKeyword := false
	for _, keyword := range koreanReceiptTotalKeywords {
		if strings.Contains(combined, keyword) {
			hasTotalKeyword = true
			break
		}
	}
	hasKRWAmount := receiptKRWAmountPattern.MatchString(combined) || strings.Contains(combined, "₩")
	if !hasTotalKeyword && !hasKRWAmount {
		return ErrReceiptTextUnreadable
	}
	score := 0
	if hangulCount >= 5 {
		score += 2
	} else if hangulCount >= 2 {
		score++
	}
	if keywordCount >= 1 {
		score += 2
	}
	if keywordCount >= 2 {
		score++
	}
	if hasTotalKeyword {
		score += 2
	}
	if hasKRWAmount {
		score += 2
	}
	if score < 4 {
		return ErrUnsupportedReceiptLanguage
	}
	return nil
}

func normalizeOCRText(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	normalized := make([]string, 0, len(lines))
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		normalized = append(normalized, strings.Join(fields, " "))
	}
	return strings.TrimSpace(strings.Join(normalized, "\n"))
}

func formatReceiptOCRText(captureMode ReceiptCaptureMode, parts []ExpenseReceiptOCRTextPart) string {
	if captureMode == ReceiptCaptureModeSplit {
		sections := make([]string, 0, len(parts))
		for _, part := range parts {
			switch part.Role {
			case ReceiptImageRoleHeader:
				sections = append(sections, "Header OCR:\n"+part.Text)
			case ReceiptImageRoleTotal:
				sections = append(sections, "Total OCR:\n"+part.Text)
			}
		}
		return strings.Join(sections, "\n\n")
	}
	if len(parts) == 0 {
		return "Receipt OCR:\n"
	}
	return "Receipt OCR:\n" + parts[0].Text
}

func validateExpenseReceiptUpload(contentType string, data []byte) error {
	contentType = strings.TrimSpace(contentType)
	if len(data) == 0 {
		return ErrValidation
	}
	if len(data) > MaxExpenseReceiptBytes {
		return ErrUploadTooLarge
	}
	if !isSupportedExpenseReceiptContentType(contentType) {
		return ErrUnsupportedMediaType
	}
	if detectExpenseReceiptContentType(data) != contentType {
		return ErrUnsupportedMediaType
	}
	return nil
}

func isSupportedExpenseReceiptContentType(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func detectExpenseReceiptContentType(data []byte) string {
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp"
	}
	return http.DetectContentType(data)
}

func validateExpenseReceiptExtraction(extraction ExpenseReceiptExtraction) error {
	if !isSupportedReceiptConfidence(extraction.Confidence) {
		return ErrReceiptExtractionInvalid
	}
	if extraction.ExpenseDate != nil {
		if _, err := time.Parse(dateLayout, strings.TrimSpace(*extraction.ExpenseDate)); err != nil {
			return ErrReceiptExtractionInvalid
		}
	}
	if extraction.ExpenseTime != nil {
		if _, err := time.Parse("15:04", strings.TrimSpace(*extraction.ExpenseTime)); err != nil {
			return ErrReceiptExtractionInvalid
		}
	}
	if extraction.Currency != nil && !isSupportedCurrency(strings.TrimSpace(*extraction.Currency)) {
		return ErrReceiptExtractionInvalid
	}
	for _, amount := range []*int64{extraction.TotalAmountMinor, extraction.TaxAmountMinor, extraction.ServiceChargeMinor} {
		if amount != nil && *amount < 0 {
			return ErrReceiptExtractionInvalid
		}
	}
	if len(extraction.LineItems) > 50 || len(extraction.Warnings) > 10 {
		return ErrReceiptExtractionInvalid
	}
	for _, item := range extraction.LineItems {
		name := strings.TrimSpace(item.Name)
		if name == "" || len([]rune(name)) > 120 {
			return ErrReceiptExtractionInvalid
		}
		if item.AmountMinor != nil && *item.AmountMinor < 0 {
			return ErrReceiptExtractionInvalid
		}
		if item.Quantity != nil && *item.Quantity < 0 {
			return ErrReceiptExtractionInvalid
		}
	}
	for _, warning := range extraction.Warnings {
		if len([]rune(strings.TrimSpace(warning))) > 160 {
			return ErrReceiptExtractionInvalid
		}
	}
	return nil
}

func normalizeExpenseReceiptExtraction(extraction ExpenseReceiptExtraction) ExpenseReceiptExtraction {
	extraction.MerchantName = trimNullableString(extraction.MerchantName)
	extraction.ExpenseTitle = trimNullableString(extraction.ExpenseTitle)
	extraction.ExpenseDate = trimNullableString(extraction.ExpenseDate)
	extraction.ExpenseTime = trimNullableString(extraction.ExpenseTime)
	extraction.Currency = trimNullableString(extraction.Currency)
	if extraction.LineItems == nil {
		extraction.LineItems = []ExpenseReceiptLineItemDraft{}
	}
	for index := range extraction.LineItems {
		extraction.LineItems[index].Name = strings.TrimSpace(extraction.LineItems[index].Name)
	}
	if extraction.Warnings == nil {
		extraction.Warnings = []string{}
	}
	for index := range extraction.Warnings {
		extraction.Warnings[index] = strings.TrimSpace(extraction.Warnings[index])
	}
	return extraction
}

func trimNullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isSupportedReceiptConfidence(value string) bool {
	switch value {
	case ExpenseReceiptConfidenceHigh, ExpenseReceiptConfidenceMedium, ExpenseReceiptConfidenceLow:
		return true
	default:
		return false
	}
}

func normalizeReceiptProviderError(err error) error {
	switch err {
	case nil:
		return nil
	case ErrReceiptProviderRateLimited, ErrReceiptProviderUnavailable, ErrReceiptExtractionInvalid, ErrReceiptTextUnreadable, ErrUnsupportedReceiptLanguage:
		return err
	default:
		return ErrReceiptProviderUnavailable
	}
}

func deleteExpenseReceiptObjects(ctx context.Context, store ExpenseReceiptObjectStore, objects []ExpenseReceiptObject) {
	for _, object := range objects {
		_ = store.DeleteObject(ctx, object)
	}
}

func newExpenseReceiptObjectKey(tripID string, scope string, role ReceiptImageRole) (string, error) {
	bytes := make([]byte, expenseReceiptObjectKeySize)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return fmt.Sprintf("expense-receipts/trips/%s/%s/%s/%s", tripID, strings.Trim(strings.TrimSpace(scope), "/"), strings.TrimSpace(string(role)), hex.EncodeToString(bytes)), nil
}
