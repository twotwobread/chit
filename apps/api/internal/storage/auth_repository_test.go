package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
)

func TestDeleteAccountTransactionAnonymizesSharedTripsAndInvalidatesAuth(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for storage integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()
	if !authDeletionSchemaReady(t, ctx, store) {
		t.Skip("users.deleted_at migration is required for account deletion storage tests")
	}

	deleteUserID := insertAuthTestUser(t, ctx, store, "계정삭제테스트 삭제", "delete-account@example.com")
	memberOwnerID := insertAuthTestUser(t, ctx, store, "계정삭제테스트 멤버공유 오너", "member-owner@example.com")
	successorID := insertAuthTestUser(t, ctx, store, "계정삭제테스트 후임", "successor@example.com")
	lateMemberID := insertAuthTestUser(t, ctx, store, "계정삭제테스트 늦은멤버", "late-member@example.com")
	defer cleanupAuthDeletionFixture(t, store, []string{deleteUserID, memberOwnerID, successorID, lateMemberID})

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO auth_identities (user_id, provider, provider_subject, email, email_normalized, email_verified, display_name, avatar_url)
		VALUES ($1::uuid, 'apple', 'delete-subject', 'delete-account@example.com', 'delete-account@example.com', true, '삭제전 이름', 'https://example.com/identity.png')
	`, deleteUserID); err != nil {
		t.Fatalf("insert identity: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO auth_sessions (user_id, refresh_token_hash, refresh_token_expires_at)
		VALUES ($1::uuid, 'delete-refresh-hash', '2026-07-23T12:00:00Z')
	`, deleteUserID); err != nil {
		t.Fatalf("insert session: %v", err)
	}

	soloTripID := insertAuthDeletionTrip(t, ctx, store, "계정삭제테스트 솔로", deleteUserID)
	insertAuthDeletionParticipant(t, ctx, store, soloTripID, deleteUserID, "owner", "삭제전 이름", "2026-06-21T09:00:00Z")
	insertAuthDeletionInvite(t, ctx, store, soloTripID, deleteUserID, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

	memberSharedTripID := insertAuthDeletionTrip(t, ctx, store, "계정삭제테스트 멤버공유", memberOwnerID)
	insertAuthDeletionParticipant(t, ctx, store, memberSharedTripID, memberOwnerID, "owner", "멤버공유 오너", "2026-06-21T08:00:00Z")
	insertAuthDeletionParticipant(t, ctx, store, memberSharedTripID, deleteUserID, "member", "삭제전 이름", "2026-06-21T09:00:00Z")
	insertAuthDeletionInvite(t, ctx, store, memberSharedTripID, deleteUserID, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

	ownedSharedTripID := insertAuthDeletionTrip(t, ctx, store, "계정삭제테스트 오너공유", deleteUserID)
	insertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, deleteUserID, "owner", "삭제전 이름", "2026-06-21T08:00:00Z")
	insertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, successorID, "member", "후임", "2026-06-21T09:00:00Z")
	insertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, lateMemberID, "member", "늦은멤버", "2026-06-21T10:00:00Z")
	insertAuthDeletionInvite(t, ctx, store, ownedSharedTripID, deleteUserID, "cccccccccccccccccccccccccccccccc")

	deleteAt := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	if err := store.DeleteAccount(ctx, deleteUserID, deleteAt); err != nil {
		t.Fatalf("delete account: %v", err)
	}

	var displayName string
	var email *string
	var emailNormalized *string
	var emailVerified bool
	var avatarURL *string
	var deletedAt time.Time
	if err := store.pool.QueryRow(ctx, `
		SELECT display_name, email, email_normalized, email_verified, avatar_url, deleted_at
		FROM users
		WHERE id = $1::uuid
	`, deleteUserID).Scan(&displayName, &email, &emailNormalized, &emailVerified, &avatarURL, &deletedAt); err != nil {
		t.Fatalf("load deleted user: %v", err)
	}
	if displayName != "탈퇴한 사용자" || email != nil || emailNormalized != nil || emailVerified || avatarURL != nil || !deletedAt.Equal(deleteAt) {
		t.Fatalf("unexpected deleted user tombstone: display=%q email=%v normalized=%v verified=%v avatar=%v deletedAt=%v", displayName, email, emailNormalized, emailVerified, avatarURL, deletedAt)
	}

	if user, ok, err := store.GetUser(ctx, deleteUserID); err != nil || ok || user.ID != "" {
		t.Fatalf("expected deleted user hidden from GetUser, user=%#v ok=%v err=%v", user, ok, err)
	}
	if _, ok, err := store.UpdateUserDisplayName(ctx, deleteUserID, "새 이름"); err != nil || ok {
		t.Fatalf("expected deleted user display-name update to be hidden, ok=%v err=%v", ok, err)
	}

	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM auth_identities WHERE user_id = $1::uuid`, deleteUserID, 0)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM auth_sessions WHERE user_id = $1::uuid`, deleteUserID, 0)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM trips WHERE id = $1::uuid`, soloTripID, 0)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM trips WHERE id = $1::uuid`, memberSharedTripID, 1)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM trips WHERE id = $1::uuid`, ownedSharedTripID, 1)

	assertAuthDeletionParticipant(t, ctx, store, memberSharedTripID, deleteUserID, "member", "탈퇴한 사용자")
	assertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, deleteUserID, "member", "탈퇴한 사용자")
	assertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, successorID, "owner", "후임")
	assertAuthDeletionParticipant(t, ctx, store, ownedSharedTripID, lateMemberID, "member", "늦은멤버")

	var createdBy string
	if err := store.pool.QueryRow(ctx, `SELECT created_by::text FROM trips WHERE id = $1::uuid`, ownedSharedTripID).Scan(&createdBy); err != nil {
		t.Fatalf("load transferred trip owner: %v", err)
	}
	if createdBy != successorID {
		t.Fatalf("expected created_by transferred to earliest remaining participant %q, got %q", successorID, createdBy)
	}

	assertAuthDeletionDeactivatedInvite(t, ctx, store, memberSharedTripID, deleteAt)
	assertAuthDeletionDeactivatedInvite(t, ctx, store, ownedSharedTripID, deleteAt)

	if _, ok, err := store.FindUserByIdentity(ctx, auth.ProviderApple, "delete-subject"); err != nil || ok {
		t.Fatalf("expected deleted identity to be removed, ok=%v err=%v", ok, err)
	}
	newUser, err := store.CreateUserWithIdentity(ctx, auth.User{DisplayName: "재가입", Email: stringPtr("delete-account@example.com"), EmailVerified: true}, auth.Identity{Provider: auth.ProviderApple, ProviderSubject: "delete-subject", Email: stringPtr("delete-account@example.com"), EmailVerified: true})
	if err != nil {
		t.Fatalf("same provider signup after deletion: %v", err)
	}
	if newUser.ID == deleteUserID {
		t.Fatalf("expected same provider signup to create a new user id, got old id %q", newUser.ID)
	}
	cleanupAuthDeletionFixture(t, store, []string{newUser.ID})
}

func TestDeleteAccountRollsBackWhenMarkDeletedFails(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for storage integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()
	if !authDeletionSchemaReady(t, ctx, store) {
		t.Skip("users.deleted_at migration is required for account deletion storage tests")
	}

	userID := insertAuthTestUser(t, ctx, store, "계정삭제테스트 롤백", "rollback@example.com")
	defer cleanupAuthDeletionFixture(t, store, []string{userID})
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO auth_identities (user_id, provider, provider_subject)
		VALUES ($1::uuid, 'apple', 'rollback-subject')
	`, userID); err != nil {
		t.Fatalf("insert rollback identity: %v", err)
	}
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO auth_sessions (user_id, refresh_token_hash, refresh_token_expires_at)
		VALUES ($1::uuid, 'rollback-refresh-hash', '2026-07-23T12:00:00Z')
	`, userID); err != nil {
		t.Fatalf("insert rollback session: %v", err)
	}
	tripID := insertAuthDeletionTrip(t, ctx, store, "계정삭제테스트 롤백솔로", userID)
	insertAuthDeletionParticipant(t, ctx, store, tripID, userID, "owner", "롤백", "2026-06-21T09:00:00Z")

	if _, err := store.pool.Exec(ctx, `
		CREATE OR REPLACE FUNCTION f012_abort_mark_user_deleted()
		RETURNS trigger
		LANGUAGE plpgsql
		AS $$
		BEGIN
		  RAISE EXCEPTION 'injected mark deleted failure';
		END;
		$$;
		DROP TRIGGER IF EXISTS f012_abort_mark_user_deleted_trigger ON users;
		CREATE TRIGGER f012_abort_mark_user_deleted_trigger
		BEFORE UPDATE OF deleted_at ON users
		FOR EACH ROW
		WHEN (NEW.deleted_at IS NOT NULL)
		EXECUTE FUNCTION f012_abort_mark_user_deleted();
	`); err != nil {
		t.Fatalf("install rollback trigger: %v", err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), `
			DROP TRIGGER IF EXISTS f012_abort_mark_user_deleted_trigger ON users;
			DROP FUNCTION IF EXISTS f012_abort_mark_user_deleted();
		`)
	}()

	if err := store.DeleteAccount(ctx, userID, time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("expected injected delete account failure")
	}

	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM users WHERE id = $1::uuid AND deleted_at IS NULL AND display_name = '계정삭제테스트 롤백'`, userID, 1)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM auth_identities WHERE user_id = $1::uuid`, userID, 1)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM auth_sessions WHERE user_id = $1::uuid`, userID, 1)
	assertAuthDeletionCount(t, ctx, store, `SELECT count(*)::int FROM trips WHERE id = $1::uuid`, tripID, 1)
}

func authDeletionSchemaReady(t *testing.T, ctx context.Context, store *Store) bool {
	t.Helper()
	var exists bool
	if err := store.pool.QueryRow(ctx, `
		SELECT EXISTS (
		  SELECT 1
		  FROM information_schema.columns
		  WHERE table_name = 'users'
		    AND column_name = 'deleted_at'
		)
	`).Scan(&exists); err != nil {
		t.Fatalf("check account deletion schema: %v", err)
	}
	return exists
}

func insertAuthTestUser(t *testing.T, ctx context.Context, store *Store, displayName string, email string) string {
	t.Helper()
	var userID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO users (display_name, email, email_normalized, email_verified, avatar_url)
		VALUES ($1, $2, lower($2), true, 'https://example.com/avatar.png')
		RETURNING id::text
	`, displayName, email).Scan(&userID); err != nil {
		t.Fatalf("insert user %q: %v", displayName, err)
	}
	return userID
}

func insertAuthDeletionTrip(t *testing.T, ctx context.Context, store *Store, name string, createdBy string) string {
	t.Helper()
	var tripID string
	if err := store.pool.QueryRow(ctx, `
		INSERT INTO trips (name, start_date, end_date, default_currency, created_by)
		VALUES ($1, '2026-07-10', '2026-07-13', 'JPY', $2::uuid)
		RETURNING id::text
	`, name, createdBy).Scan(&tripID); err != nil {
		t.Fatalf("insert trip %q: %v", name, err)
	}
	return tripID
}

func insertAuthDeletionParticipant(t *testing.T, ctx context.Context, store *Store, tripID string, userID string, role string, displayName string, joinedAt string) {
	t.Helper()
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_participants (trip_id, user_id, role, display_name, joined_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5::timestamptz)
	`, tripID, userID, role, displayName, joinedAt); err != nil {
		t.Fatalf("insert participant trip=%s user=%s: %v", tripID, userID, err)
	}
}

func insertAuthDeletionInvite(t *testing.T, ctx context.Context, store *Store, tripID string, createdBy string, token string) {
	t.Helper()
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO trip_invites (trip_id, token, created_by, expires_at)
		VALUES ($1::uuid, $2, $3::uuid, '2026-08-01T00:00:00Z')
	`, tripID, token, createdBy); err != nil {
		t.Fatalf("insert invite trip=%s user=%s: %v", tripID, createdBy, err)
	}
}

func assertAuthDeletionCount(t *testing.T, ctx context.Context, store *Store, query string, id string, want int) {
	t.Helper()
	var got int
	if err := store.pool.QueryRow(ctx, query, id).Scan(&got); err != nil {
		t.Fatalf("count query failed: %v", err)
	}
	if got != want {
		t.Fatalf("expected count %d, got %d for query %s", want, got, query)
	}
}

func assertAuthDeletionParticipant(t *testing.T, ctx context.Context, store *Store, tripID string, userID string, wantRole string, wantDisplayName string) {
	t.Helper()
	var role string
	var displayName string
	if err := store.pool.QueryRow(ctx, `
		SELECT role, display_name
		FROM trip_participants
		WHERE trip_id = $1::uuid AND user_id = $2::uuid
	`, tripID, userID).Scan(&role, &displayName); err != nil {
		t.Fatalf("load participant trip=%s user=%s: %v", tripID, userID, err)
	}
	if role != wantRole || displayName != wantDisplayName {
		t.Fatalf("expected participant role/display %q/%q, got %q/%q", wantRole, wantDisplayName, role, displayName)
	}
}

func assertAuthDeletionDeactivatedInvite(t *testing.T, ctx context.Context, store *Store, tripID string, want time.Time) {
	t.Helper()
	var deactivatedAt time.Time
	if err := store.pool.QueryRow(ctx, `SELECT deactivated_at FROM trip_invites WHERE trip_id = $1::uuid`, tripID).Scan(&deactivatedAt); err != nil {
		t.Fatalf("load deactivated invite trip=%s: %v", tripID, err)
	}
	if !deactivatedAt.Equal(want) {
		t.Fatalf("expected deactivated_at %v, got %v", want, deactivatedAt)
	}
}

func cleanupAuthDeletionFixture(t *testing.T, store *Store, userIDs []string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, userID := range userIDs {
		_, _ = store.pool.Exec(ctx, `
			DELETE FROM trips
			WHERE id IN (
			  SELECT trip_id FROM trip_participants WHERE user_id = $1::uuid
			)
			OR created_by = $1::uuid
		`, userID)
		_, _ = store.pool.Exec(ctx, `DELETE FROM auth_sessions WHERE user_id = $1::uuid`, userID)
		_, _ = store.pool.Exec(ctx, `DELETE FROM auth_identities WHERE user_id = $1::uuid`, userID)
		_, _ = store.pool.Exec(ctx, `DELETE FROM users WHERE id = $1::uuid`, userID)
	}
}
