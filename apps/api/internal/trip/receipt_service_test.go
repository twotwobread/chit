package trip

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestServiceCreateExpenseReceiptDraftUsesClientKoreanOCRAndDoesNotSaveExpense(t *testing.T) {
	repo := &receiptFakeRepository{fakeRepository: &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}}
	store := &fakeExpenseReceiptObjectStore{}
	model := &fakeReceiptModelProvider{extraction: ExpenseReceiptExtraction{
		MerchantName:     stringPtr("오사카 식당"),
		ExpenseTitle:     stringPtr("오사카 식당"),
		ExpenseDate:      stringPtr("2026-07-10"),
		ExpenseTime:      stringPtr("19:30"),
		Currency:         stringPtr("JPY"),
		TotalAmountMinor: int64Ptr(18500),
		Confidence:       ExpenseReceiptConfidenceHigh,
		Warnings:         []string{},
	}}
	service := newReceiptTestService(repo, store, model)

	result, err := service.CreateExpenseReceiptDraft(context.Background(), "user-1", testTripID, CreateExpenseReceiptDraftInput{
		CaptureMode:  ReceiptCaptureModeSingle,
		OCRLanguage:  ReceiptOCRLanguageKorean,
		OCRTextParts: []ExpenseReceiptOCRTextPart{{Role: ReceiptImageRoleSingle, Text: "오사카 식당\n합계 18,500원\n카드 승인"}},
		Images:       []ExpenseReceiptImageUpload{{Role: ReceiptImageRoleSingle, ContentType: "image/png", Data: receiptPNGBytes()}},
	})
	if err != nil {
		t.Fatalf("CreateExpenseReceiptDraft returned error: %v", err)
	}

	if result.Draft.ID == "" || result.Draft.TripID != testTripID || result.Draft.CaptureMode != ReceiptCaptureModeSingle {
		t.Fatalf("unexpected draft identity: %#v", result.Draft)
	}
	if result.Draft.ImageCount != 1 || result.Draft.ByteSize != len(receiptPNGBytes()) {
		t.Fatalf("unexpected image summary: %#v", result.Draft)
	}
	if result.Draft.Extraction.TotalAmountMinor == nil || *result.Draft.Extraction.TotalAmountMinor != 18500 {
		t.Fatalf("unexpected extraction: %#v", result.Draft.Extraction)
	}
	if repo.receiptDraftRecord.TripID != testTripID || repo.receiptDraftRecord.CreatedByUserID != "user-1" {
		t.Fatalf("draft record did not preserve ownership: %#v", repo.receiptDraftRecord)
	}
	if len(repo.receiptDraftRecord.Objects) != 1 || repo.receiptDraftRecord.Objects[0].Role != ReceiptImageRoleSingle {
		t.Fatalf("draft record did not preserve image role: %#v", repo.receiptDraftRecord.Objects)
	}
	if repo.receiptDraftRecord.Objects[0].ObjectKey == "" || !strings.Contains(repo.receiptDraftRecord.Objects[0].ObjectKey, testTripID) {
		t.Fatalf("object key should be trip scoped, got %#v", repo.receiptDraftRecord.Objects[0])
	}
	if repo.quickExpenseCalled || repo.tripExpenseCalled {
		t.Fatalf("receipt draft must not auto-save an expense")
	}
	if !strings.Contains(model.ocrText, "Receipt OCR:") || !strings.Contains(model.ocrText, "합계 18,500원") {
		t.Fatalf("model did not receive client OCR text: %q", model.ocrText)
	}
}

func TestServiceCreateExpenseReceiptDraftSupportsSplitHeaderAndTotalImages(t *testing.T) {
	repo := &receiptFakeRepository{fakeRepository: &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}}
	store := &fakeExpenseReceiptObjectStore{}
	model := &fakeReceiptModelProvider{extraction: ExpenseReceiptExtraction{
		MerchantName:     stringPtr("카페 노티드 성수"),
		ExpenseTitle:     stringPtr("카페 노티드 성수"),
		ExpenseDate:      stringPtr("2026-07-10"),
		Currency:         stringPtr("KRW"),
		TotalAmountMinor: int64Ptr(18500),
		Confidence:       ExpenseReceiptConfidenceMedium,
		Warnings:         []string{"상단/하단 분할 영수증"},
	}}
	service := newReceiptTestService(repo, store, model)

	result, err := service.CreateExpenseReceiptDraft(context.Background(), "user-1", testTripID, CreateExpenseReceiptDraftInput{
		CaptureMode: ReceiptCaptureModeSplit,
		OCRLanguage: ReceiptOCRLanguageKorean,
		OCRTextParts: []ExpenseReceiptOCRTextPart{
			{Role: ReceiptImageRoleHeader, Text: "카페 노티드 성수\n2026-07-10"},
			{Role: ReceiptImageRoleTotal, Text: "합계 18,500원\n카드 승인"},
		},
		Images: []ExpenseReceiptImageUpload{
			{Role: ReceiptImageRoleHeader, ContentType: "image/png", Data: receiptPNGBytes()},
			{Role: ReceiptImageRoleTotal, ContentType: "image/png", Data: receiptPNGBytes()},
		},
	})
	if err != nil {
		t.Fatalf("CreateExpenseReceiptDraft returned error: %v", err)
	}
	if result.Draft.CaptureMode != ReceiptCaptureModeSplit || result.Draft.ImageCount != 2 {
		t.Fatalf("unexpected split draft: %#v", result.Draft)
	}
	if len(repo.receiptDraftRecord.Objects) != 2 || repo.receiptDraftRecord.Objects[0].Role != ReceiptImageRoleHeader || repo.receiptDraftRecord.Objects[1].Role != ReceiptImageRoleTotal {
		t.Fatalf("split image roles not persisted: %#v", repo.receiptDraftRecord.Objects)
	}
	if !strings.Contains(model.ocrText, "Header OCR:") || !strings.Contains(model.ocrText, "Total OCR:") {
		t.Fatalf("split OCR prompt missing role sections: %q", model.ocrText)
	}
}

func TestServiceCreateExpenseReceiptDraftRejectsUnreadableKoreanText(t *testing.T) {
	repo := &receiptFakeRepository{fakeRepository: &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}}
	store := &fakeExpenseReceiptObjectStore{}
	model := &fakeReceiptModelProvider{}
	service := newReceiptTestService(repo, store, model)

	_, err := service.CreateExpenseReceiptDraft(context.Background(), "user-1", testTripID, CreateExpenseReceiptDraftInput{
		CaptureMode:  ReceiptCaptureModeSingle,
		OCRLanguage:  ReceiptOCRLanguageKorean,
		OCRTextParts: []ExpenseReceiptOCRTextPart{{Role: ReceiptImageRoleSingle, Text: "오사카 식당\n메뉴 2개\n카드 승인"}},
		Images:       []ExpenseReceiptImageUpload{{Role: ReceiptImageRoleSingle, ContentType: "image/png", Data: receiptPNGBytes()}},
	})
	if !errors.Is(err, ErrReceiptTextUnreadable) {
		t.Fatalf("expected ErrReceiptTextUnreadable, got %v", err)
	}
	if len(store.uploadedObjects) != 0 || repo.receiptDraftCalled {
		t.Fatalf("unreadable text must be rejected before upload/persist")
	}
}

func TestServiceCreateExpenseReceiptDraftRejectsUnsupportedLanguage(t *testing.T) {
	repo := &receiptFakeRepository{fakeRepository: &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}}
	store := &fakeExpenseReceiptObjectStore{}
	model := &fakeReceiptModelProvider{}
	service := newReceiptTestService(repo, store, model)

	_, err := service.CreateExpenseReceiptDraft(context.Background(), "user-1", testTripID, CreateExpenseReceiptDraftInput{
		CaptureMode:  ReceiptCaptureModeSingle,
		OCRLanguage:  "ja",
		OCRTextParts: []ExpenseReceiptOCRTextPart{{Role: ReceiptImageRoleSingle, Text: "TOTAL JPY 1850"}},
		Images:       []ExpenseReceiptImageUpload{{Role: ReceiptImageRoleSingle, ContentType: "image/png", Data: receiptPNGBytes()}},
	})
	if !errors.Is(err, ErrUnsupportedReceiptLanguage) {
		t.Fatalf("expected ErrUnsupportedReceiptLanguage, got %v", err)
	}
	if len(store.uploadedObjects) != 0 || repo.receiptDraftCalled {
		t.Fatalf("unsupported language must be rejected before upload/persist")
	}
}

func TestServiceCreateExpenseReceiptDraftRejectsInvalidModelExtractionAndDeletesUploads(t *testing.T) {
	repo := &receiptFakeRepository{fakeRepository: &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}}
	store := &fakeExpenseReceiptObjectStore{}
	model := &fakeReceiptModelProvider{extraction: ExpenseReceiptExtraction{Confidence: "certain"}}
	service := newReceiptTestService(repo, store, model)

	_, err := service.CreateExpenseReceiptDraft(context.Background(), "user-1", testTripID, CreateExpenseReceiptDraftInput{
		CaptureMode:  ReceiptCaptureModeSingle,
		OCRLanguage:  ReceiptOCRLanguageKorean,
		OCRTextParts: []ExpenseReceiptOCRTextPart{{Role: ReceiptImageRoleSingle, Text: "오사카 식당\n합계 18,500원\n카드 승인"}},
		Images:       []ExpenseReceiptImageUpload{{Role: ReceiptImageRoleSingle, ContentType: "image/png", Data: receiptPNGBytes()}},
	})
	if !errors.Is(err, ErrReceiptExtractionInvalid) {
		t.Fatalf("expected ErrReceiptExtractionInvalid, got %v", err)
	}
	if repo.receiptDraftCalled {
		t.Fatalf("invalid extraction must not persist a draft")
	}
	if len(store.deletedObjects) != 1 || store.deletedObjects[0].ObjectKey == "" {
		t.Fatalf("uploaded object should be deleted after invalid extraction, got %#v", store.deletedObjects)
	}
}

func TestServiceCreateTripExpensePassesReviewedReceiptDraftID(t *testing.T) {
	receiptDraftID := "00000000-0000-0000-0000-000000000331"
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	repo := &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true}
	_, err := newTestService(repo).CreateTripExpense(context.Background(), "user-1", testTripID, CreateTripExpenseInput{
		Title:              stringPtr("저녁"),
		ExpenseDate:        "2026-07-10",
		AmountMinor:        18500,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{splitParticipantID},
		ReceiptDraftID:     &receiptDraftID,
	})
	if err != nil {
		t.Fatalf("CreateTripExpense returned error: %v", err)
	}
	if repo.tripExpenseRecord.ReceiptDraftID == nil || *repo.tripExpenseRecord.ReceiptDraftID != receiptDraftID {
		t.Fatalf("receipt draft id was not passed to repository: %#v", repo.tripExpenseRecord)
	}
}

func TestServiceCreateQuickExpensePassesReviewedReceiptDraftID(t *testing.T) {
	receiptDraftID := "00000000-0000-0000-0000-000000000332"
	payerID := testUUID(2001)
	splitParticipantID := testUUID(2002)
	itemID := testUUID(7001)
	repo := &fakeRepository{trip: receiptValidTrip(), tripFound: true, isParticipant: true, dayItem: ScheduleItem{ID: itemID}, dayItemFound: true}
	_, err := newTestService(repo).CreateQuickExpense(context.Background(), "user-1", testTripID, "2026-07-10", CreateQuickExpenseInput{
		ScheduleItemID:     stringPtr(itemID),
		AmountMinor:        18500,
		PayerParticipantID: payerID,
		SplitPolicy:        ExpenseSplitPolicyEqual,
		ParticipantIDs:     []string{payerID, splitParticipantID},
		ReceiptDraftID:     &receiptDraftID,
	})
	if err != nil {
		t.Fatalf("CreateQuickExpense returned error: %v", err)
	}
	if repo.quickExpenseRecord.ReceiptDraftID == nil || *repo.quickExpenseRecord.ReceiptDraftID != receiptDraftID {
		t.Fatalf("receipt draft id was not passed to repository: %#v", repo.quickExpenseRecord)
	}
}

type receiptFakeRepository struct {
	*fakeRepository
	receiptDraftCalled bool
	receiptDraftRecord CreateExpenseReceiptDraftRecord
}

func (r *receiptFakeRepository) CreateExpenseReceiptDraft(_ context.Context, record CreateExpenseReceiptDraftRecord) (CreateExpenseReceiptDraftResult, error) {
	r.receiptDraftCalled = true
	r.receiptDraftRecord = record
	byteSize := 0
	for _, object := range record.Objects {
		byteSize += object.ByteSize
	}
	return CreateExpenseReceiptDraftResult{Draft: ExpenseReceiptDraft{
		ID:          "draft-1",
		TripID:      record.TripID,
		CaptureMode: record.CaptureMode,
		ImageCount:  len(record.Objects),
		ByteSize:    byteSize,
		Extraction:  record.Extraction,
		ExpiresAt:   record.ExpiresAt,
		CreatedAt:   record.Objects[0].UploadedAt,
	}}, nil
}

type fakeExpenseReceiptObjectStore struct {
	uploadedObjects []ExpenseReceiptObject
	deletedObjects  []ExpenseReceiptObject
}

func (s *fakeExpenseReceiptObjectStore) UploadExpenseReceipt(_ context.Context, objectKey string, contentType string, data []byte) (ExpenseReceiptObject, error) {
	object := ExpenseReceiptObject{Bucket: "receipt-bucket", ObjectKey: objectKey, Generation: "1", ContentType: contentType, ByteSize: len(data), UploadedAt: time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)}
	s.uploadedObjects = append(s.uploadedObjects, object)
	return object, nil
}

func (s *fakeExpenseReceiptObjectStore) DeleteObject(_ context.Context, object ExpenseReceiptObject) error {
	s.deletedObjects = append(s.deletedObjects, object)
	return nil
}

func (s *fakeExpenseReceiptObjectStore) SignedGetURL(context.Context, ExpenseReceiptObject, time.Duration) (SignedExpenseReceiptURL, error) {
	return SignedExpenseReceiptURL{}, nil
}

type fakeReceiptModelProvider struct {
	extraction ExpenseReceiptExtraction
	ocrText    string
}

func (p *fakeReceiptModelProvider) ExtractExpenseReceiptDraft(_ context.Context, ocrText string) (ExpenseReceiptExtraction, error) {
	p.ocrText = ocrText
	return p.extraction, nil
}

func newReceiptTestService(repo Repository, store ExpenseReceiptObjectStore, model ReceiptModelProvider) *Service {
	service := NewService(repo, WithExpenseReceiptObjectStore(store), WithReceiptModelProvider(model))
	service.today = func() time.Time { return time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC) }
	service.now = func() time.Time { return time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC) }
	return service
}

func receiptValidTrip() Trip {
	return Trip{ID: testTripID, StartDate: "2026-07-10", EndDate: "2026-07-13", DefaultCurrency: "JPY"}
}

func receiptPNGBytes() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0, 'I', 'H', 'D', 'R'}
}

func int64Ptr(value int64) *int64 {
	return &value
}
