package objectstorage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var ErrUnavailable = errors.New("object storage unavailable")

type Object struct {
	Bucket      string
	ObjectKey   string
	Generation  string
	ContentType string
	ByteSize    int
	UploadedAt  time.Time
}

type SignedURL struct {
	URL         string
	ExpiresAt   time.Time
	ContentType string
	ByteSize    int
}

type Store interface {
	UploadObject(ctx context.Context, objectKey string, contentType string, data []byte) (Object, error)
	DeleteObject(ctx context.Context, object Object) error
	SignedGetURL(ctx context.Context, object Object, ttl time.Duration) (SignedURL, error)
	Close() error
}

type S3Config struct {
	Bucket         string
	Endpoint       string
	PublicEndpoint string
	AccessKey      string
	SecretKey      string
	Region         string
	ForcePathStyle bool
}

type S3Store struct {
	client  *minio.Client
	presign *minio.Client
	bucket  string
	now     func() time.Time
}

func NewS3Store(_ context.Context, config S3Config) (*S3Store, error) {
	bucket := strings.TrimSpace(config.Bucket)
	accessKey := strings.TrimSpace(config.AccessKey)
	secretKey := strings.TrimSpace(config.SecretKey)
	if bucket == "" || strings.TrimSpace(config.Endpoint) == "" || accessKey == "" || secretKey == "" {
		return nil, ErrUnavailable
	}
	region := strings.TrimSpace(config.Region)
	if region == "" {
		region = "us-east-1"
	}
	endpoint, secure, err := parseS3Endpoint(config.Endpoint)
	if err != nil {
		return nil, err
	}
	client, err := newMinioClient(endpoint, secure, accessKey, secretKey, region, config.ForcePathStyle)
	if err != nil {
		return nil, err
	}

	presignClient := client
	if strings.TrimSpace(config.PublicEndpoint) != "" {
		publicEndpoint, publicSecure, err := parseS3Endpoint(config.PublicEndpoint)
		if err != nil {
			return nil, err
		}
		presignClient, err = newMinioClient(publicEndpoint, publicSecure, accessKey, secretKey, region, config.ForcePathStyle)
		if err != nil {
			return nil, err
		}
	}

	return &S3Store{client: client, presign: presignClient, bucket: bucket, now: func() time.Time { return time.Now().UTC() }}, nil
}

func newMinioClient(endpoint string, secure bool, accessKey string, secretKey string, region string, forcePathStyle bool) (*minio.Client, error) {
	options := &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
		Region: region,
	}
	if forcePathStyle {
		options.BucketLookup = minio.BucketLookupPath
	}
	return minio.New(endpoint, options)
}

func parseS3Endpoint(value string) (string, bool, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", false, ErrUnavailable
	}
	if !strings.Contains(trimmed, "://") {
		return trimmed, false, nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", false, fmt.Errorf("parse object storage endpoint: %w", err)
	}
	if parsed.Host == "" || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false, fmt.Errorf("object storage endpoint must be an http(s) origin: %q", value)
	}
	switch parsed.Scheme {
	case "http":
		return parsed.Host, false, nil
	case "https":
		return parsed.Host, true, nil
	default:
		return "", false, fmt.Errorf("object storage endpoint must use http or https: %q", value)
	}
}

func (s *S3Store) Close() error { return nil }

func (s *S3Store) UploadObject(ctx context.Context, objectKey string, contentType string, data []byte) (Object, error) {
	if s == nil || s.client == nil || strings.TrimSpace(s.bucket) == "" {
		return Object{}, ErrUnavailable
	}
	objectKey = strings.TrimSpace(objectKey)
	contentType = strings.TrimSpace(contentType)
	if objectKey == "" {
		return Object{}, ErrUnavailable
	}
	info, err := s.client.PutObject(ctx, s.bucket, objectKey, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType:  contentType,
		CacheControl: "no-store",
	})
	if err != nil {
		return Object{}, err
	}
	uploadedAt := info.LastModified.UTC()
	if uploadedAt.IsZero() {
		uploadedAt = s.now().UTC()
	}
	return Object{
		Bucket:      s.bucket,
		ObjectKey:   objectKey,
		Generation:  strings.TrimSpace(info.VersionID),
		ContentType: contentType,
		ByteSize:    len(data),
		UploadedAt:  uploadedAt,
	}, nil
}

func (s *S3Store) DeleteObject(ctx context.Context, object Object) error {
	if s == nil || s.client == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" {
		return ErrUnavailable
	}
	options := minio.RemoveObjectOptions{}
	if generation := strings.TrimSpace(object.Generation); generation != "" {
		options.VersionID = generation
	}
	return s.client.RemoveObject(ctx, strings.TrimSpace(object.Bucket), strings.TrimSpace(object.ObjectKey), options)
}

func (s *S3Store) SignedGetURL(ctx context.Context, object Object, ttl time.Duration) (SignedURL, error) {
	if s == nil || s.presign == nil || strings.TrimSpace(object.Bucket) == "" || strings.TrimSpace(object.ObjectKey) == "" {
		return SignedURL{}, ErrUnavailable
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	expiresAt := s.now().UTC().Add(ttl)
	query := make(url.Values)
	if generation := strings.TrimSpace(object.Generation); generation != "" {
		query.Set("versionId", generation)
	}
	signedURL, err := s.presign.PresignedGetObject(ctx, strings.TrimSpace(object.Bucket), strings.TrimSpace(object.ObjectKey), ttl, query)
	if err != nil {
		return SignedURL{}, err
	}
	return SignedURL{URL: signedURL.String(), ExpiresAt: expiresAt, ContentType: object.ContentType, ByteSize: object.ByteSize}, nil
}

var _ Store = (*S3Store)(nil)
