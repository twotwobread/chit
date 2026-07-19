package flight

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/objectstorage"
)

func TestObjectStorageBoardingPassStoreMapsGenericObjects(t *testing.T) {
	uploadedAt := time.Date(2026, 7, 19, 12, 30, 0, 0, time.UTC)
	genericStore := &fakeObjectStorageStore{
		uploaded: objectstorage.Object{
			Bucket:      "ium-dev-objects",
			ObjectKey:   "boarding-passes/object.png",
			Generation:  "version-1",
			ContentType: "image/png",
			ByteSize:    4,
			UploadedAt:  uploadedAt,
		},
		signed: objectstorage.SignedURL{
			URL:         "http://10.0.2.2:9000/ium-dev-objects/boarding-passes/object.png?X-Amz-Signature=test",
			ExpiresAt:   uploadedAt.Add(5 * time.Minute),
			ContentType: "image/png",
			ByteSize:    4,
		},
	}
	store := NewObjectStorageBoardingPassObjectStore(genericStore)

	stored, err := store.UploadBoardingPass(context.Background(), "boarding-passes/object.png", "image/png", []byte("data"))
	if err != nil {
		t.Fatalf("UploadBoardingPass returned error: %v", err)
	}
	if stored.Bucket != "ium-dev-objects" || stored.ObjectKey != "boarding-passes/object.png" || stored.Generation == nil || *stored.Generation != "version-1" {
		t.Fatalf("stored boarding pass mismatch: %#v", stored)
	}
	if stored.ContentType != "image/png" || stored.ByteSize != 4 || !stored.UploadedAt.Equal(uploadedAt) {
		t.Fatalf("stored boarding pass metadata mismatch: %#v", stored)
	}
	if genericStore.uploadKey != "boarding-passes/object.png" || genericStore.uploadContentType != "image/png" || string(genericStore.uploadData) != "data" {
		t.Fatalf("generic upload arguments mismatch: %#v", genericStore)
	}

	generation := "version-1"
	if err := store.DeleteObject(context.Background(), BoardingPassObject{Bucket: "ium-dev-objects", ObjectKey: "boarding-passes/object.png", Generation: &generation}); err != nil {
		t.Fatalf("DeleteObject returned error: %v", err)
	}
	if genericStore.deleted.Generation != "version-1" {
		t.Fatalf("delete did not pass generation: %#v", genericStore.deleted)
	}

	signed, err := store.SignedGetURL(context.Background(), BoardingPassObject{Bucket: "ium-dev-objects", ObjectKey: "boarding-passes/object.png", Generation: &generation, ContentType: "image/png", ByteSize: 4}, time.Minute)
	if err != nil {
		t.Fatalf("SignedGetURL returned error: %v", err)
	}
	if signed.URL != genericStore.signed.URL || !signed.ExpiresAt.Equal(genericStore.signed.ExpiresAt) || signed.ContentType != "image/png" || signed.ByteSize != 4 {
		t.Fatalf("signed boarding pass mismatch: %#v", signed)
	}
	if genericStore.signedObject.Generation != "version-1" || genericStore.signedTTL != time.Minute {
		t.Fatalf("signed arguments mismatch: object=%#v ttl=%s", genericStore.signedObject, genericStore.signedTTL)
	}
}

func TestObjectStorageBoardingPassStoreMapsUnavailableError(t *testing.T) {
	store := NewObjectStorageBoardingPassObjectStore(&fakeObjectStorageStore{uploadErr: objectstorage.ErrUnavailable})

	_, err := store.UploadBoardingPass(context.Background(), "boarding-passes/object.png", "image/png", []byte("data"))
	if !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("expected domain storage unavailable error, got %v", err)
	}
}

type fakeObjectStorageStore struct {
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

func (s *fakeObjectStorageStore) UploadObject(_ context.Context, objectKey string, contentType string, data []byte) (objectstorage.Object, error) {
	s.uploadKey = objectKey
	s.uploadContentType = contentType
	s.uploadData = append([]byte(nil), data...)
	if s.uploadErr != nil {
		return objectstorage.Object{}, s.uploadErr
	}
	return s.uploaded, nil
}

func (s *fakeObjectStorageStore) DeleteObject(_ context.Context, object objectstorage.Object) error {
	s.deleted = object
	return nil
}

func (s *fakeObjectStorageStore) SignedGetURL(_ context.Context, object objectstorage.Object, ttl time.Duration) (objectstorage.SignedURL, error) {
	s.signedObject = object
	s.signedTTL = ttl
	return s.signed, nil
}

func (s *fakeObjectStorageStore) Close() error { return nil }
