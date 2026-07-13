package flight

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

type GCSBoardingPassObjectStore struct {
	client         *storage.Client
	bucket         string
	googleAccessID string
	privateKey     []byte
	now            func() time.Time
}

func NewGCSBoardingPassObjectStore(ctx context.Context, bucket string, googleAccessID string, privateKeyPEM string) (*GCSBoardingPassObjectStore, error) {
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, ErrStorageUnavailable
	}
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}
	privateKeyPEM = strings.ReplaceAll(strings.TrimSpace(privateKeyPEM), `\n`, "\n")
	return &GCSBoardingPassObjectStore{client: client, bucket: bucket, googleAccessID: strings.TrimSpace(googleAccessID), privateKey: []byte(privateKeyPEM), now: func() time.Time { return time.Now().UTC() }}, nil
}

func (s *GCSBoardingPassObjectStore) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}

func (s *GCSBoardingPassObjectStore) UploadBoardingPass(ctx context.Context, objectKey string, contentType string, data []byte) (BoardingPassObject, error) {
	if s == nil || s.client == nil || strings.TrimSpace(s.bucket) == "" {
		return BoardingPassObject{}, ErrStorageUnavailable
	}
	objectKey = strings.TrimSpace(objectKey)
	if objectKey == "" {
		return BoardingPassObject{}, ErrValidation
	}
	writer := s.client.Bucket(s.bucket).Object(objectKey).NewWriter(ctx)
	writer.ContentType = strings.TrimSpace(contentType)
	writer.CacheControl = "no-store"
	if _, err := writer.Write(data); err != nil {
		_ = writer.Close()
		return BoardingPassObject{}, err
	}
	if err := writer.Close(); err != nil {
		return BoardingPassObject{}, err
	}
	attrs, err := s.client.Bucket(s.bucket).Object(objectKey).Attrs(ctx)
	if err != nil {
		return BoardingPassObject{}, err
	}
	generation := strconv.FormatInt(attrs.Generation, 10)
	uploadedAt := attrs.Updated.UTC()
	if uploadedAt.IsZero() {
		uploadedAt = s.now().UTC()
	}
	return BoardingPassObject{Bucket: s.bucket, ObjectKey: objectKey, Generation: &generation, ContentType: strings.TrimSpace(contentType), ByteSize: len(data), UploadedAt: uploadedAt}, nil
}

func (s *GCSBoardingPassObjectStore) DeleteObject(ctx context.Context, object BoardingPassObject) error {
	if s == nil || s.client == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" {
		return ErrStorageUnavailable
	}
	handle := s.client.Bucket(object.Bucket).Object(object.ObjectKey)
	if object.Generation != nil && strings.TrimSpace(*object.Generation) != "" {
		generation, err := strconv.ParseInt(strings.TrimSpace(*object.Generation), 10, 64)
		if err == nil {
			handle = handle.Generation(generation)
		}
	}
	if err := handle.Delete(ctx); err != nil && err != storage.ErrObjectNotExist {
		return err
	}
	return nil
}

func (s *GCSBoardingPassObjectStore) SignedGetURL(ctx context.Context, object BoardingPassObject, ttl time.Duration) (SignedBoardingPassURL, error) {
	if s == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" || strings.TrimSpace(s.googleAccessID) == "" || len(bytes.TrimSpace(s.privateKey)) == 0 {
		return SignedBoardingPassURL{}, ErrStorageUnavailable
	}
	if ttl <= 0 || ttl > boardingPassSignedURLTTL {
		ttl = boardingPassSignedURLTTL
	}
	expiresAt := s.now().UTC().Add(ttl)
	query := url.Values{}
	if object.Generation != nil && strings.TrimSpace(*object.Generation) != "" {
		query.Set("generation", strings.TrimSpace(*object.Generation))
	}
	url, err := storage.SignedURL(object.Bucket, object.ObjectKey, &storage.SignedURLOptions{
		GoogleAccessID:  s.googleAccessID,
		PrivateKey:      s.privateKey,
		Method:          "GET",
		Expires:         expiresAt,
		Scheme:          storage.SigningSchemeV4,
		QueryParameters: query,
	})
	if err != nil {
		return SignedBoardingPassURL{}, fmt.Errorf("sign boarding pass url: %w", err)
	}
	return SignedBoardingPassURL{URL: url, ExpiresAt: expiresAt, ContentType: object.ContentType, ByteSize: object.ByteSize}, nil
}

var _ BoardingPassObjectStore = (*GCSBoardingPassObjectStore)(nil)
