package trip

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

type GCSExpenseReceiptObjectStore struct {
	client         *storage.Client
	bucket         string
	googleAccessID string
	privateKey     []byte
	now            func() time.Time
}

func NewGCSExpenseReceiptObjectStore(ctx context.Context, bucket string, googleAccessID string, privateKeyPEM string) (*GCSExpenseReceiptObjectStore, error) {
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, ErrStorageUnavailable
	}
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}
	privateKeyPEM = strings.ReplaceAll(strings.TrimSpace(privateKeyPEM), `\n`, "\n")
	return &GCSExpenseReceiptObjectStore{client: client, bucket: bucket, googleAccessID: strings.TrimSpace(googleAccessID), privateKey: []byte(privateKeyPEM), now: func() time.Time { return time.Now().UTC() }}, nil
}

func (s *GCSExpenseReceiptObjectStore) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}

func (s *GCSExpenseReceiptObjectStore) UploadExpenseReceipt(ctx context.Context, objectKey string, contentType string, data []byte) (ExpenseReceiptObject, error) {
	if s == nil || s.client == nil || strings.TrimSpace(s.bucket) == "" {
		return ExpenseReceiptObject{}, ErrStorageUnavailable
	}
	objectKey = strings.TrimSpace(objectKey)
	contentType = strings.TrimSpace(contentType)
	if objectKey == "" {
		return ExpenseReceiptObject{}, ErrValidation
	}
	writer := s.client.Bucket(s.bucket).Object(objectKey).NewWriter(ctx)
	writer.ContentType = contentType
	writer.CacheControl = "no-store"
	if _, err := writer.Write(data); err != nil {
		_ = writer.Close()
		return ExpenseReceiptObject{}, err
	}
	if err := writer.Close(); err != nil {
		return ExpenseReceiptObject{}, err
	}
	attrs, err := s.client.Bucket(s.bucket).Object(objectKey).Attrs(ctx)
	if err != nil {
		return ExpenseReceiptObject{}, err
	}
	uploadedAt := attrs.Updated.UTC()
	if uploadedAt.IsZero() {
		uploadedAt = s.now().UTC()
	}
	return ExpenseReceiptObject{
		Bucket:      s.bucket,
		ObjectKey:   objectKey,
		Generation:  strconv.FormatInt(attrs.Generation, 10),
		ContentType: contentType,
		ByteSize:    len(data),
		UploadedAt:  uploadedAt,
	}, nil
}

func (s *GCSExpenseReceiptObjectStore) DeleteObject(ctx context.Context, object ExpenseReceiptObject) error {
	if s == nil || s.client == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" {
		return ErrStorageUnavailable
	}
	handle := s.client.Bucket(object.Bucket).Object(object.ObjectKey)
	if generation, err := strconv.ParseInt(strings.TrimSpace(object.Generation), 10, 64); err == nil && generation > 0 {
		handle = handle.Generation(generation)
	}
	if err := handle.Delete(ctx); err != nil && err != storage.ErrObjectNotExist {
		return err
	}
	return nil
}

func (s *GCSExpenseReceiptObjectStore) SignedGetURL(ctx context.Context, object ExpenseReceiptObject, ttl time.Duration) (SignedExpenseReceiptURL, error) {
	if s == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" || strings.TrimSpace(s.googleAccessID) == "" || len(bytes.TrimSpace(s.privateKey)) == 0 {
		return SignedExpenseReceiptURL{}, ErrStorageUnavailable
	}
	if ttl <= 0 || ttl > expenseReceiptSignedURLTTL {
		ttl = expenseReceiptSignedURLTTL
	}
	expiresAt := s.now().UTC().Add(ttl)
	query := url.Values{}
	if strings.TrimSpace(object.Generation) != "" {
		query.Set("generation", strings.TrimSpace(object.Generation))
	}
	signedURL, err := storage.SignedURL(object.Bucket, object.ObjectKey, &storage.SignedURLOptions{
		GoogleAccessID:  s.googleAccessID,
		PrivateKey:      s.privateKey,
		Method:          "GET",
		Expires:         expiresAt,
		Scheme:          storage.SigningSchemeV4,
		QueryParameters: query,
	})
	if err != nil {
		return SignedExpenseReceiptURL{}, fmt.Errorf("sign receipt url: %w", err)
	}
	return SignedExpenseReceiptURL{URL: signedURL, ExpiresAt: expiresAt, ContentType: object.ContentType, ByteSize: object.ByteSize}, nil
}

var _ ExpenseReceiptObjectStore = (*GCSExpenseReceiptObjectStore)(nil)
