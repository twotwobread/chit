package flight

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/objectstorage"
)

type ObjectStorageBoardingPassObjectStore struct {
	store objectstorage.Store
}

func NewObjectStorageBoardingPassObjectStore(store objectstorage.Store) *ObjectStorageBoardingPassObjectStore {
	return &ObjectStorageBoardingPassObjectStore{store: store}
}

func (s *ObjectStorageBoardingPassObjectStore) UploadBoardingPass(ctx context.Context, objectKey string, contentType string, data []byte) (BoardingPassObject, error) {
	if s == nil || s.store == nil {
		return BoardingPassObject{}, ErrStorageUnavailable
	}
	object, err := s.store.UploadObject(ctx, objectKey, contentType, data)
	if err != nil {
		return BoardingPassObject{}, mapObjectStorageBoardingPassError(err)
	}
	var generation *string
	if trimmed := strings.TrimSpace(object.Generation); trimmed != "" {
		generation = &trimmed
	}
	return BoardingPassObject{
		Bucket:      object.Bucket,
		ObjectKey:   object.ObjectKey,
		Generation:  generation,
		ContentType: object.ContentType,
		ByteSize:    object.ByteSize,
		UploadedAt:  object.UploadedAt,
	}, nil
}

func (s *ObjectStorageBoardingPassObjectStore) DeleteObject(ctx context.Context, object BoardingPassObject) error {
	if s == nil || s.store == nil {
		return ErrStorageUnavailable
	}
	generation := ""
	if object.Generation != nil {
		generation = *object.Generation
	}
	if err := s.store.DeleteObject(ctx, objectstorage.Object{
		Bucket:     object.Bucket,
		ObjectKey:  object.ObjectKey,
		Generation: generation,
	}); err != nil {
		return mapObjectStorageBoardingPassError(err)
	}
	return nil
}

func (s *ObjectStorageBoardingPassObjectStore) SignedGetURL(ctx context.Context, object BoardingPassObject, ttl time.Duration) (SignedBoardingPassURL, error) {
	if s == nil || s.store == nil {
		return SignedBoardingPassURL{}, ErrStorageUnavailable
	}
	generation := ""
	if object.Generation != nil {
		generation = *object.Generation
	}
	result, err := s.store.SignedGetURL(ctx, objectstorage.Object{
		Bucket:      object.Bucket,
		ObjectKey:   object.ObjectKey,
		Generation:  generation,
		ContentType: object.ContentType,
		ByteSize:    object.ByteSize,
	}, ttl)
	if err != nil {
		return SignedBoardingPassURL{}, mapObjectStorageBoardingPassError(err)
	}
	return SignedBoardingPassURL{URL: result.URL, ExpiresAt: result.ExpiresAt, ContentType: result.ContentType, ByteSize: result.ByteSize}, nil
}

func mapObjectStorageBoardingPassError(err error) error {
	if errors.Is(err, objectstorage.ErrUnavailable) {
		return ErrStorageUnavailable
	}
	return err
}

var _ BoardingPassObjectStore = (*ObjectStorageBoardingPassObjectStore)(nil)
