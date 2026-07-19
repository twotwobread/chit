package trip

import (
	"context"
	"strings"
)

func (s *Service) CancelExpenseReceiptDraft(ctx context.Context, userID string, tripID string, receiptDraftID string) error {
	userID = strings.TrimSpace(userID)
	tripID = strings.TrimSpace(tripID)
	receiptDraftID = strings.TrimSpace(receiptDraftID)
	if userID == "" {
		return ErrUnauthorized
	}
	if !isUUID(tripID) || !isUUID(receiptDraftID) {
		return ErrValidation
	}
	if err := s.requireExpenseReceiptTripParticipant(ctx, userID, tripID); err != nil {
		return err
	}
	repo, ok := s.repo.(ExpenseReceiptRepository)
	if !ok {
		return ErrStorageUnavailable
	}
	objects, err := repo.CancelExpenseReceiptDraft(ctx, tripID, userID, receiptDraftID)
	if err != nil {
		return err
	}
	if s.receiptObjectStore != nil {
		for _, object := range objects {
			_ = s.receiptObjectStore.DeleteObject(ctx, object)
		}
	}
	return nil
}

func (s *Service) UploadExpenseReceipt(ctx context.Context, userID string, tripID string, expenseID string, contentType string, data []byte) (ExpenseReceiptSummary, error) {
	userID = strings.TrimSpace(userID)
	tripID = strings.TrimSpace(tripID)
	expenseID = strings.TrimSpace(expenseID)
	contentType = strings.TrimSpace(contentType)
	if userID == "" {
		return ExpenseReceiptSummary{}, ErrUnauthorized
	}
	if !isUUID(tripID) || !isUUID(expenseID) {
		return ExpenseReceiptSummary{}, ErrValidation
	}
	if err := validateExpenseReceiptUpload(contentType, data); err != nil {
		return ExpenseReceiptSummary{}, err
	}
	if err := s.requireExpenseReceiptTripParticipant(ctx, userID, tripID); err != nil {
		return ExpenseReceiptSummary{}, err
	}
	if s.receiptObjectStore == nil {
		return ExpenseReceiptSummary{}, ErrStorageUnavailable
	}
	repo, ok := s.repo.(ExpenseReceiptRepository)
	if !ok {
		return ExpenseReceiptSummary{}, ErrStorageUnavailable
	}
	objectKey, err := newExpenseReceiptObjectKey(tripID, "expenses/"+expenseID, ReceiptImageRoleSingle)
	if err != nil {
		return ExpenseReceiptSummary{}, err
	}
	stored, err := s.receiptObjectStore.UploadExpenseReceipt(ctx, objectKey, contentType, data)
	if err != nil {
		return ExpenseReceiptSummary{}, normalizeStorageError(err)
	}
	if stored.UploadedAt.IsZero() {
		stored.UploadedAt = s.now().UTC()
	}
	stored.Role = ReceiptImageRoleSingle
	stored.ContentType = contentType
	stored.ByteSize = len(data)
	result, err := repo.UpsertExpenseReceipt(ctx, UpsertExpenseReceiptRecord{TripID: tripID, ExpenseID: expenseID, UploadedByUserID: userID, Object: stored})
	if err != nil {
		_ = s.receiptObjectStore.DeleteObject(ctx, stored)
		return ExpenseReceiptSummary{}, err
	}
	for _, oldObject := range result.OldObjects {
		_ = s.receiptObjectStore.DeleteObject(ctx, oldObject)
	}
	return result.Receipt, nil
}

func (s *Service) DeleteExpenseReceipt(ctx context.Context, userID string, tripID string, expenseID string) error {
	userID = strings.TrimSpace(userID)
	tripID = strings.TrimSpace(tripID)
	expenseID = strings.TrimSpace(expenseID)
	if userID == "" {
		return ErrUnauthorized
	}
	if !isUUID(tripID) || !isUUID(expenseID) {
		return ErrValidation
	}
	if err := s.requireExpenseReceiptTripParticipant(ctx, userID, tripID); err != nil {
		return err
	}
	repo, ok := s.repo.(ExpenseReceiptRepository)
	if !ok {
		return ErrStorageUnavailable
	}
	oldObjects, err := repo.ClearExpenseReceipt(ctx, tripID, expenseID)
	if err != nil {
		return err
	}
	if s.receiptObjectStore != nil {
		for _, oldObject := range oldObjects {
			_ = s.receiptObjectStore.DeleteObject(ctx, oldObject)
		}
	}
	return nil
}

func (s *Service) OpenExpenseReceipt(ctx context.Context, userID string, tripID string, expenseID string) (SignedExpenseReceiptURL, error) {
	userID = strings.TrimSpace(userID)
	tripID = strings.TrimSpace(tripID)
	expenseID = strings.TrimSpace(expenseID)
	if userID == "" {
		return SignedExpenseReceiptURL{}, ErrUnauthorized
	}
	if !isUUID(tripID) || !isUUID(expenseID) {
		return SignedExpenseReceiptURL{}, ErrValidation
	}
	if err := s.requireExpenseReceiptTripParticipant(ctx, userID, tripID); err != nil {
		return SignedExpenseReceiptURL{}, err
	}
	if s.receiptObjectStore == nil {
		return SignedExpenseReceiptURL{}, ErrStorageUnavailable
	}
	repo, ok := s.repo.(ExpenseReceiptRepository)
	if !ok {
		return SignedExpenseReceiptURL{}, ErrStorageUnavailable
	}
	object, err := repo.GetExpenseReceiptObject(ctx, tripID, expenseID)
	if err != nil {
		return SignedExpenseReceiptURL{}, err
	}
	result, err := s.receiptObjectStore.SignedGetURL(ctx, object, expenseReceiptSignedURLTTL)
	if err != nil {
		return SignedExpenseReceiptURL{}, normalizeStorageError(err)
	}
	if result.ContentType == "" {
		result.ContentType = object.ContentType
	}
	if result.ByteSize == 0 {
		result.ByteSize = object.ByteSize
	}
	if result.ExpiresAt.IsZero() || result.ExpiresAt.After(s.now().UTC().Add(expenseReceiptSignedURLTTL)) {
		result.ExpiresAt = s.now().UTC().Add(expenseReceiptSignedURLTTL)
	}
	return result, nil
}

func (s *Service) requireExpenseReceiptTripParticipant(ctx context.Context, userID string, tripID string) error {
	if s.repo == nil {
		return ErrValidation
	}
	if _, ok, err := s.repo.GetTripByID(ctx, tripID); err != nil {
		return err
	} else if !ok {
		return ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return err
	}
	if !isParticipant {
		return ErrForbidden
	}
	return nil
}

func normalizeStorageError(err error) error {
	if err == ErrStorageUnavailable {
		return ErrStorageUnavailable
	}
	return err
}
