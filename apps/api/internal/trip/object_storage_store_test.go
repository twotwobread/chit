package trip

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/objectstorage"
)

func TestObjectStorageExpenseReceiptStoreMapsGenericObjects(t *testing.T) {
	uploadedAt := time.Date(2026, 7, 19, 12, 45, 0, 0, time.UTC)
	genericStore := &fakeReceiptObjectStorageStore{
		uploaded: objectstorage.Object{
			Bucket:      "ium-dev-objects",
			ObjectKey:   "receipts/object.png",
			Generation:  "version-2",
			ContentType: "image/png",
			ByteSize:    7,
			UploadedAt:  uploadedAt,
		},
		signed: objectstorage.SignedURL{
			URL:         "http://10.0.2.2:9000/ium-dev-objects/receipts/object.png?X-Amz-Signature=test",
			ExpiresAt:   uploadedAt.Add(5 * time.Minute),
			ContentType: "image/png",
			ByteSize:    7,
		},
	}
	store := NewObjectStorageExpenseReceiptObjectStore(genericStore)

	stored, err := store.UploadExpenseReceipt(context.Background(), "receipts/object.png", "image/png", []byte("receipt"))
	if err != nil {
		t.Fatalf("UploadExpenseReceipt returned error: %v", err)
	}
	if stored.Bucket != "ium-dev-objects" || stored.ObjectKey != "receipts/object.png" || stored.Generation != "version-2" {
		t.Fatalf("stored receipt mismatch: %#v", stored)
	}
	if stored.ContentType != "image/png" || stored.ByteSize != 7 || !stored.UploadedAt.Equal(uploadedAt) {
		t.Fatalf("stored receipt metadata mismatch: %#v", stored)
	}
	if genericStore.uploadKey != "receipts/object.png" || genericStore.uploadContentType != "image/png" || string(genericStore.uploadData) != "receipt" {
		t.Fatalf("generic upload arguments mismatch: %#v", genericStore)
	}

	if err := store.DeleteObject(context.Background(), ExpenseReceiptObject{Bucket: "ium-dev-objects", ObjectKey: "receipts/object.png", Generation: "version-2"}); err != nil {
		t.Fatalf("DeleteObject returned error: %v", err)
	}
	if genericStore.deleted.Generation != "version-2" {
		t.Fatalf("delete did not pass generation: %#v", genericStore.deleted)
	}

	signed, err := store.SignedGetURL(context.Background(), ExpenseReceiptObject{Bucket: "ium-dev-objects", ObjectKey: "receipts/object.png", Generation: "version-2", ContentType: "image/png", ByteSize: 7}, time.Minute)
	if err != nil {
		t.Fatalf("SignedGetURL returned error: %v", err)
	}
	if signed.URL != genericStore.signed.URL || !signed.ExpiresAt.Equal(genericStore.signed.ExpiresAt) || signed.ContentType != "image/png" || signed.ByteSize != 7 {
		t.Fatalf("signed receipt mismatch: %#v", signed)
	}
	if genericStore.signedObject.Generation != "version-2" || genericStore.signedTTL != time.Minute {
		t.Fatalf("signed arguments mismatch: object=%#v ttl=%s", genericStore.signedObject, genericStore.signedTTL)
	}
}

func TestObjectStorageExpenseReceiptStoreMapsUnavailableError(t *testing.T) {
	store := NewObjectStorageExpenseReceiptObjectStore(&fakeReceiptObjectStorageStore{uploadErr: objectstorage.ErrUnavailable})

	_, err := store.UploadExpenseReceipt(context.Background(), "receipts/object.png", "image/png", []byte("receipt"))
	if !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("expected domain storage unavailable error, got %v", err)
	}
}

type fakeReceiptObjectStorageStore struct {
	uploaded          objectstorage.Object
	signed            objectstorage.SignedURL
	uploadErr         error
	uploadKey         string
	uploadContentType string
	uploadData        []byte
	deleted           objectstorage.Object
	signedObject      objectstorage.Object
	signedTTL         time.Duration
}

func (s *fakeReceiptObjectStorageStore) UploadObject(_ context.Context, objectKey string, contentType string, data []byte) (objectstorage.Object, error) {
	s.uploadKey = objectKey
	s.uploadContentType = contentType
	s.uploadData = append([]byte(nil), data...)
	if s.uploadErr != nil {
		return objectstorage.Object{}, s.uploadErr
	}
	return s.uploaded, nil
}

func (s *fakeReceiptObjectStorageStore) DeleteObject(_ context.Context, object objectstorage.Object) error {
	s.deleted = object
	return nil
}

func (s *fakeReceiptObjectStorageStore) SignedGetURL(_ context.Context, object objectstorage.Object, ttl time.Duration) (objectstorage.SignedURL, error) {
	s.signedObject = object
	s.signedTTL = ttl
	return s.signed, nil
}

func (s *fakeReceiptObjectStorageStore) Close() error { return nil }
