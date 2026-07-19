package objectstorage

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestS3StoreSignedGetURLUsesPublicEndpointAndPathStyle(t *testing.T) {
	store, err := NewS3Store(context.Background(), S3Config{
		Bucket:         "ium-dev-objects",
		Endpoint:       "http://minio:9000",
		PublicEndpoint: "http://10.0.2.2:9000",
		AccessKey:      "minioadmin",
		SecretKey:      "minioadmin",
		Region:         "us-east-1",
		ForcePathStyle: true,
	})
	if err != nil {
		t.Fatalf("NewS3Store returned error: %v", err)
	}
	defer store.Close()

	now := time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return now }

	result, err := store.SignedGetURL(context.Background(), Object{
		Bucket:      "ium-dev-objects",
		ObjectKey:   "boarding-passes/object.png",
		ContentType: "image/png",
		ByteSize:    7,
	}, 5*time.Minute)
	if err != nil {
		t.Fatalf("SignedGetURL returned error: %v", err)
	}

	parsed, err := url.Parse(result.URL)
	if err != nil {
		t.Fatalf("invalid signed URL: %v", err)
	}
	if parsed.Scheme != "http" || parsed.Host != "10.0.2.2:9000" {
		t.Fatalf("signed URL did not use public endpoint: %s", result.URL)
	}
	if parsed.Path != "/ium-dev-objects/boarding-passes/object.png" {
		t.Fatalf("signed URL did not use path-style bucket path: %s", parsed.Path)
	}
	if credential := parsed.Query().Get("X-Amz-Credential"); !strings.Contains(credential, "minioadmin/") {
		t.Fatalf("signed URL credential did not use configured access key: %q", credential)
	}
	if !result.ExpiresAt.Equal(now.Add(5 * time.Minute)) {
		t.Fatalf("unexpected expiry: %s", result.ExpiresAt)
	}
	if result.ContentType != "image/png" || result.ByteSize != 7 {
		t.Fatalf("signed metadata mismatch: %#v", result)
	}
}

func TestNewS3StoreRejectsMissingRequiredConfig(t *testing.T) {
	_, err := NewS3Store(context.Background(), S3Config{
		Bucket:    "ium-dev-objects",
		Endpoint:  "http://localhost:9000",
		AccessKey: "minioadmin",
	})
	if err == nil {
		t.Fatal("expected missing secret key to fail")
	}
}
