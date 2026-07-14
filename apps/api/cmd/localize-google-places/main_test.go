package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotenvFileKeepsAmpersandInDatabaseURL(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env.stage")
	if err := os.WriteFile(path, []byte("# comment\nDATABASE_URL=postgresql://user:pass@example.test/db?sslmode=require&channel_binding=require\nGOOGLE_PLACES_API_KEY=places-key\n"), 0o600); err != nil {
		t.Fatalf("write env: %v", err)
	}

	values, err := loadDotenvFile(path)
	if err != nil {
		t.Fatalf("loadDotenvFile returned error: %v", err)
	}

	if values["DATABASE_URL"] != "postgresql://user:pass@example.test/db?sslmode=require&channel_binding=require" {
		t.Fatalf("DATABASE_URL was not parsed literally: %q", values["DATABASE_URL"])
	}
	if values["GOOGLE_PLACES_API_KEY"] != "places-key" {
		t.Fatalf("unexpected Google key parse: %q", values["GOOGLE_PLACES_API_KEY"])
	}
}

func TestLoadDotenvFileFindsRepositoryRootEnvFromWorktreeAppDirectory(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env.stage"), []byte("DATABASE_URL=postgresql://user:pass@example.test/db\n"), 0o600); err != nil {
		t.Fatalf("write root env: %v", err)
	}
	appDir := filepath.Join(root, ".worktrees", "F000", "apps", "api")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		t.Fatalf("mkdir app dir: %v", err)
	}
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(appDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	defer func() {
		if err := os.Chdir(oldWD); err != nil {
			t.Fatalf("restore wd: %v", err)
		}
	}()

	values, err := loadDotenvFile("../../.env.stage")
	if err != nil {
		t.Fatalf("loadDotenvFile returned error: %v", err)
	}
	if values["DATABASE_URL"] != "postgresql://user:pass@example.test/db" {
		t.Fatalf("unexpected DATABASE_URL: %q", values["DATABASE_URL"])
	}
}

func TestEnvValuePrefersDotenvFileOverAmbientEnvironment(t *testing.T) {
	oldValue, hadOldValue := os.LookupEnv("DATABASE_URL")
	if err := os.Setenv("DATABASE_URL", "postgresql://ambient.example.test/other"); err != nil {
		t.Fatalf("set env: %v", err)
	}
	defer func() {
		if hadOldValue {
			_ = os.Setenv("DATABASE_URL", oldValue)
			return
		}
		_ = os.Unsetenv("DATABASE_URL")
	}()

	values := map[string]string{"DATABASE_URL": "postgresql://dotenv.example.test/stage"}
	if got := envValue(values, "DATABASE_URL"); got != "postgresql://dotenv.example.test/stage" {
		t.Fatalf("envValue() = %q, want dotenv value", got)
	}
}

func TestEnvValueDoesNotFallBackToAmbientEnvironment(t *testing.T) {
	oldValue, hadOldValue := os.LookupEnv("DATABASE_URL")
	if err := os.Setenv("DATABASE_URL", "postgresql://ambient.example.test/other"); err != nil {
		t.Fatalf("set env: %v", err)
	}
	defer func() {
		if hadOldValue {
			_ = os.Setenv("DATABASE_URL", oldValue)
			return
		}
		_ = os.Unsetenv("DATABASE_URL")
	}()

	if got := envValue(map[string]string{}, "DATABASE_URL"); got != "" {
		t.Fatalf("envValue() = %q, want no ambient fallback", got)
	}
}

func TestDirectDatabaseURLRemovesNeonPoolerMarker(t *testing.T) {
	input := "postgresql://user:pass@ep-test-pooler.c-2.ap-southeast-1.aws.neon.tech/db?sslmode=require&channel_binding=require"
	got := directDatabaseURL(input)
	want := "postgresql://user:pass@ep-test.c-2.ap-southeast-1.aws.neon.tech/db?sslmode=require&channel_binding=require"
	if got != want {
		t.Fatalf("directDatabaseURL() = %q, want %q", got, want)
	}
}
