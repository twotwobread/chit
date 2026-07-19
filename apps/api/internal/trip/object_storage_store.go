package trip

import (
	"context"
	"errors"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/objectstorage"
)

type ObjectStorageExpenseReceiptObjectStore struct {
	store objectstorage.Store
}

func NewObjectStorageExpenseReceiptObjectStore(store objectstorage.Store) *ObjectStorageExpenseReceiptObjectStore {
	return &ObjectStorageExpenseReceiptObjectStore{store: store}
}

func (s *ObjectStorageExpenseReceiptObjectStore) UploadExpenseReceipt(ctx context.Context, objectKey string, contentType string, data []byte) (ExpenseReceiptObject, error) {
	if s == nil || s.store == nil {
		return ExpenseReceiptObject{}, ErrStorageUnavailable
	}
	object, err := s.store.UploadObject(ctx, objectKey, contentType, data)
	if err != nil {
		return ExpenseReceiptObject{}, mapObjectStorageExpenseReceiptError(err)
	}
	return ExpenseReceiptObject{
		Bucket:      object.Bucket,
		ObjectKey:   object.ObjectKey,
		Generation:  object.Generation,
		ContentType: object.ContentType,
		ByteSize:    object.ByteSize,
		UploadedAt:  object.UploadedAt,
	}, nil
}

func (s *ObjectStorageExpenseReceiptObjectStore) DeleteObject(ctx context.Context, object ExpenseReceiptObject) error {
	if s == nil || s.store == nil {
		return ErrStorageUnavailable
	}
	if err := s.store.DeleteObject(ctx, objectstorage.Object{
		Bucket:     object.Bucket,
		ObjectKey:  object.ObjectKey,
		Generation: object.Generation,
	}); err != nil {
		return mapObjectStorageExpenseReceiptError(err)
	}
	return nil
}

func (s *ObjectStorageExpenseReceiptObjectStore) SignedGetURL(ctx context.Context, object ExpenseReceiptObject, ttl time.Duration) (SignedExpenseReceiptURL, error) {
	if s == nil || s.store == nil {
		return SignedExpenseReceiptURL{}, ErrStorageUnavailable
	}
	result, err := s.store.SignedGetURL(ctx, objectstorage.Object{
		Bucket:      object.Bucket,
		ObjectKey:   object.ObjectKey,
		Generation:  object.Generation,
		ContentType: object.ContentType,
		ByteSize:    object.ByteSize,
	}, ttl)
	if err != nil {
		return SignedExpenseReceiptURL{}, mapObjectStorageExpenseReceiptError(err)
	}
	return SignedExpenseReceiptURL{URL: result.URL, ExpiresAt: result.ExpiresAt, ContentType: result.ContentType, ByteSize: result.ByteSize}, nil
}

func mapObjectStorageExpenseReceiptError(err error) error {
	if errors.Is(err, objectstorage.ErrUnavailable) {
		return ErrStorageUnavailable
	}
	return err
}

var _ ExpenseReceiptObjectStore = (*ObjectStorageExpenseReceiptObjectStore)(nil)
