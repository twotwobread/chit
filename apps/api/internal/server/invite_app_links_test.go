package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestInviteAppleAppSiteAssociation(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/.well-known/apple-app-site-association", nil)

	NewRouterWithConfig(backend, Config{InviteIOSAppIDs: []string{"TEAMID.com.twotwobread.ium.staging", "TEAMID.com.twotwobread.ium"}}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Fatalf("expected application/json content type, got %q", contentType)
	}

	var body struct {
		Applinks struct {
			Apps    []string `json:"apps"`
			Details []struct {
				AppID string   `json:"appID"`
				Paths []string `json:"paths"`
			} `json:"details"`
		} `json:"applinks"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode AASA response: %v", err)
	}
	if len(body.Applinks.Apps) != 0 {
		t.Fatalf("expected empty apps array, got %#v", body.Applinks.Apps)
	}
	if len(body.Applinks.Details) != 2 {
		t.Fatalf("expected two AASA details, got %#v", body.Applinks.Details)
	}
	for index, expectedAppID := range []string{"TEAMID.com.twotwobread.ium.staging", "TEAMID.com.twotwobread.ium"} {
		detail := body.Applinks.Details[index]
		if detail.AppID != expectedAppID {
			t.Fatalf("expected appID %q at index %d, got %q", expectedAppID, index, detail.AppID)
		}
		if len(detail.Paths) != 1 || detail.Paths[0] != "/invite/*" {
			t.Fatalf("expected /invite/* path restriction for %q, got %#v", expectedAppID, detail.Paths)
		}
	}
}

func TestInviteAppleAppSiteAssociationMissingConfigIsDisabled(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/.well-known/apple-app-site-association", nil)

	NewRouterWithConfig(backend, Config{}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestInviteAndroidAssetLinks(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/.well-known/assetlinks.json", nil)

	NewRouterWithConfig(backend, Config{
		InviteAndroidPackageName:            "com.example.ium",
		InviteAndroidSHA256CertFingerprints: []string{"AA:BB:CC", "DD:EE:FF"},
	}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Fatalf("expected application/json content type, got %q", contentType)
	}

	var body []struct {
		Relation []string `json:"relation"`
		Target   struct {
			Namespace              string   `json:"namespace"`
			PackageName            string   `json:"package_name"`
			SHA256CertFingerprints []string `json:"sha256_cert_fingerprints"`
		} `json:"target"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode assetlinks response: %v", err)
	}
	if len(body) != 1 {
		t.Fatalf("expected one assetlinks statement, got %#v", body)
	}
	statement := body[0]
	if len(statement.Relation) != 1 || statement.Relation[0] != "delegate_permission/common.handle_all_urls" {
		t.Fatalf("expected handle_all_urls relation, got %#v", statement.Relation)
	}
	if statement.Target.Namespace != "android_app" || statement.Target.PackageName != "com.example.ium" {
		t.Fatalf("expected android target for com.example.ium, got %#v", statement.Target)
	}
	if strings.Join(statement.Target.SHA256CertFingerprints, ",") != "AA:BB:CC,DD:EE:FF" {
		t.Fatalf("unexpected fingerprints: %#v", statement.Target.SHA256CertFingerprints)
	}
}

func TestInviteAndroidAssetLinksMissingFingerprintIsDisabled(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/.well-known/assetlinks.json", nil)

	NewRouterWithConfig(backend, Config{InviteAndroidPackageName: "com.example.ium"}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusNotFound, recorder.Code, recorder.Body.String())
	}
}

func TestInviteFallbackPageProvidesTokenPreservingRecoveryActions(t *testing.T) {
	backend := newFakeAuthBackend()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/invite/test-token-abcdefghijklmnopqrstuvwxyz123456", nil)
	request.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 14)")

	NewRouterWithConfig(backend, Config{
		InviteBaseURL:   "https://invite.i-um.test/",
		InviteAppScheme: "iumtest",
		AppStoreURL:     "https://apps.apple.com/app/test",
		PlayStoreURL:    "https://play.google.com/store/apps/details?id=test",
	}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	for _, expected := range []string{
		"https://invite.i-um.test/invite/test-token-abcdefghijklmnopqrstuvwxyz123456",
		"iumtest://invite/test-token-abcdefghijklmnopqrstuvwxyz123456",
		"앱에서 열기",
		"초대 링크 복사",
		"설치한 뒤, 이 초대 링크를 다시 열어주세요.",
		"초대 token",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected fallback body to contain %q, got %s", expected, body)
		}
	}
	if strings.Contains(body, "https://apps.apple.com/app/test") || !strings.Contains(body, "https://play.google.com/store/apps/details?id=test") {
		t.Fatalf("expected Android store-only fallback body, got %s", body)
	}
	if strings.Contains(strings.ToLower(body), "accept") || strings.Contains(body, "POST /invites") {
		t.Fatalf("fallback page must not expose web invite acceptance, got %s", body)
	}
}

func TestInviteFallbackPageEscapesTokenAndEncodesLinks(t *testing.T) {
	backend := newFakeAuthBackend()
	rawToken := `<script>alert(1)`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/invite/"+url.PathEscape(rawToken), nil)

	NewRouterWithConfig(backend, Config{InviteBaseURL: "https://invite.i-um.test"}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if strings.Contains(body, rawToken) {
		t.Fatalf("expected raw token to be escaped in fallback body, got %s", body)
	}
	encodedToken := url.PathEscape(rawToken)
	for _, expected := range []string{
		"&lt;script&gt;alert(1)",
		"https://invite.i-um.test/invite/" + encodedToken,
		"ium://invite/" + encodedToken,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected escaped/encoded fallback body to contain %q, got %s", expected, body)
		}
	}
}
