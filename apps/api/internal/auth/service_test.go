package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestLoginCreatesUserSessionAndRotatesRefreshToken(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo, fakeVerifier{profile: ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: "apple-1",
		Email:           ptr("minsu@example.com"),
		EmailVerified:   true,
		DisplayName:     ptr("민수"),
	}}, NewTokenManager("test-secret"))

	login, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if login.User.ID == "" || login.Tokens.AccessToken == "" || login.Tokens.RefreshToken == "" {
		t.Fatalf("expected user and tokens, got %#v", login)
	}

	refreshed, err := service.Refresh(context.Background(), login.Tokens.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if refreshed.RefreshToken == "" || refreshed.RefreshToken == login.Tokens.RefreshToken {
		t.Fatalf("expected rotated refresh token")
	}

	_, err = service.Refresh(context.Background(), login.Tokens.RefreshToken)
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected old refresh token to be invalid, got %v", err)
	}
}

func TestLoginWithExistingProviderSubjectWinsBeforeEmailConflict(t *testing.T) {
	repo := newFakeRepository()
	appleUser, err := repo.CreateUserWithIdentity(context.Background(), User{
		DisplayName:   "애플 사용자",
		Email:         ptr("old@example.com"),
		EmailVerified: true,
	}, Identity{
		Provider:        ProviderApple,
		ProviderSubject: "apple-1",
		Email:           ptr("old@example.com"),
		EmailVerified:   true,
	})
	if err != nil {
		t.Fatalf("seed apple user: %v", err)
	}
	_, err = repo.CreateUserWithIdentity(context.Background(), User{
		DisplayName:   "카카오 사용자",
		Email:         ptr("shared@example.com"),
		EmailVerified: true,
	}, Identity{
		Provider:        ProviderKakao,
		ProviderSubject: "kakao-1",
		Email:           ptr("shared@example.com"),
		EmailVerified:   true,
	})
	if err != nil {
		t.Fatalf("seed kakao user: %v", err)
	}

	service := NewService(repo, fakeVerifier{profile: ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: "apple-1",
		Email:           ptr("shared@example.com"),
		EmailVerified:   true,
	}}, NewTokenManager("test-secret"))

	login, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login existing apple identity: %v", err)
	}
	if login.User.ID != appleUser.ID {
		t.Fatalf("expected existing apple identity user %q, got %q", appleUser.ID, login.User.ID)
	}
}

func TestLoginWithMissingOptionalProviderProfileCreatesDefaultUser(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo, fakeVerifier{profile: ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: "apple-no-profile",
	}}, NewTokenManager("test-secret"))

	login, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login without optional profile: %v", err)
	}
	if login.User.DisplayName != "이음 사용자" {
		t.Fatalf("expected default display name, got %q", login.User.DisplayName)
	}
	if login.User.Email != nil || login.User.EmailVerified {
		t.Fatalf("expected no email snapshot, got %#v", login.User)
	}
	if len(repo.providers[login.User.ID]) != 1 || repo.providers[login.User.ID][0] != ProviderApple {
		t.Fatalf("expected apple identity to be created, got %#v", repo.providers[login.User.ID])
	}
}

func TestLoginSameVerifiedEmailRequiresExplicitLinking(t *testing.T) {
	repo := newFakeRepository()
	_, err := repo.CreateUserWithIdentity(context.Background(), User{
		DisplayName:   "민수",
		Email:         ptr("minsu@example.com"),
		EmailVerified: true,
	}, Identity{
		Provider:        ProviderKakao,
		ProviderSubject: "kakao-1",
		Email:           ptr("minsu@example.com"),
		EmailVerified:   true,
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}

	service := NewService(repo, fakeVerifier{profile: ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: "apple-1",
		Email:           ptr("minsu@example.com"),
		EmailVerified:   true,
	}}, NewTokenManager("test-secret"))

	_, err = service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if !errors.Is(err, ErrAccountLinkRequired) {
		t.Fatalf("expected ErrAccountLinkRequired, got %v", err)
	}
}

func TestLinkProviderRejectsIdentityLinkedToAnotherUser(t *testing.T) {
	repo := newFakeRepository()
	user1, err := repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "user1"}, Identity{Provider: ProviderApple, ProviderSubject: "apple-1"})
	if err != nil {
		t.Fatalf("seed user1: %v", err)
	}
	_, err = repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "user2"}, Identity{Provider: ProviderKakao, ProviderSubject: "kakao-1"})
	if err != nil {
		t.Fatalf("seed user2: %v", err)
	}

	service := NewService(repo, fakeVerifier{profile: ProviderProfile{Provider: ProviderKakao, ProviderSubject: "kakao-1"}}, NewTokenManager("test-secret"))

	_, err = service.LinkProvider(context.Background(), AuthContext{UserID: user1.ID}, ProviderKakao, Credential{})
	if !errors.Is(err, ErrProviderAlreadyLinked) {
		t.Fatalf("expected ErrProviderAlreadyLinked, got %v", err)
	}
}

func TestLogoutRevokesOnlyCurrentSession(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo, fakeVerifier{profile: ProviderProfile{Provider: ProviderApple, ProviderSubject: "apple-1"}}, NewTokenManager("test-secret"))

	login1, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login1: %v", err)
	}
	login2, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login2: %v", err)
	}

	auth1, err := service.Authenticate(context.Background(), "Bearer "+login1.Tokens.AccessToken)
	if err != nil {
		t.Fatalf("authenticate session 1: %v", err)
	}
	if err := service.Logout(context.Background(), auth1); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := service.Authenticate(context.Background(), "Bearer "+login1.Tokens.AccessToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected session 1 unauthorized after logout, got %v", err)
	}
	if _, err := service.Authenticate(context.Background(), "Bearer "+login2.Tokens.AccessToken); err != nil {
		t.Fatalf("expected session 2 to remain valid, got %v", err)
	}
}

func TestDeleteAccountInvalidatesSessionsAndAllowsSameProviderSignup(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo, fakeVerifier{profile: ProviderProfile{
		Provider:        ProviderApple,
		ProviderSubject: "apple-1",
		Email:           ptr("minsu@example.com"),
		EmailVerified:   true,
		DisplayName:     ptr("민수"),
		AvatarURL:       ptr("https://example.com/avatar.png"),
	}}, NewTokenManager("test-secret"))

	login, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	oldUserID := login.User.ID
	authContext, err := service.Authenticate(context.Background(), "Bearer "+login.Tokens.AccessToken)
	if err != nil {
		t.Fatalf("authenticate before delete: %v", err)
	}
	if err := service.DeleteAccount(context.Background(), authContext); err != nil {
		t.Fatalf("delete account: %v", err)
	}

	if _, err := service.Authenticate(context.Background(), "Bearer "+login.Tokens.AccessToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected old access token unauthorized, got %v", err)
	}
	if _, err := service.Refresh(context.Background(), login.Tokens.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected old refresh token invalid, got %v", err)
	}
	if _, err := service.Me(context.Background(), AuthContext{UserID: oldUserID, SessionID: authContext.SessionID}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected deleted user hidden from me, got %v", err)
	}

	deletedUser := repo.users[oldUserID]
	if deletedUser.DisplayName != "탈퇴한 사용자" || deletedUser.Email != nil || deletedUser.EmailVerified || deletedUser.AvatarURL != nil {
		t.Fatalf("expected tombstoned user PII to be wiped, got %#v", deletedUser)
	}

	relogin, err := service.Login(context.Background(), ProviderApple, Credential{}, Device{})
	if err != nil {
		t.Fatalf("relogin with same provider: %v", err)
	}
	if relogin.User.ID == oldUserID {
		t.Fatalf("expected same provider to create a new user id, got old id %q", oldUserID)
	}
}

func TestDeleteAccountRequiresAuthContext(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo, fakeVerifier{}, NewTokenManager("test-secret"))

	if err := service.DeleteAccount(context.Background(), AuthContext{}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized without auth context, got %v", err)
	}
}

func TestUpdateDisplayNameNormalizesAndValidates(t *testing.T) {
	repo := newFakeRepository()
	user, err := repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "민수"}, Identity{Provider: ProviderApple, ProviderSubject: "apple-1"})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	service := NewService(repo, fakeVerifier{}, NewTokenManager("test-secret"))

	result, err := service.UpdateDisplayName(context.Background(), AuthContext{UserID: user.ID}, "  지  영  ")
	if err != nil {
		t.Fatalf("update display name: %v", err)
	}
	if result.User.DisplayName != "지  영" {
		t.Fatalf("expected trimmed display name preserving internal whitespace, got %q", result.User.DisplayName)
	}
	stored, _, _ := repo.GetUser(context.Background(), user.ID)
	if stored.DisplayName != "지  영" {
		t.Fatalf("expected stored display name 지  영, got %q", stored.DisplayName)
	}
	if len(result.LinkedProviders) != 1 || result.LinkedProviders[0] != ProviderApple {
		t.Fatalf("expected linked provider apple, got %#v", result.LinkedProviders)
	}
}

func TestUpdateDisplayNameValidationKeepsPreviousValue(t *testing.T) {
	repo := newFakeRepository()
	user, err := repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "민수"}, Identity{Provider: ProviderApple, ProviderSubject: "apple-1"})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	service := NewService(repo, fakeVerifier{}, NewTokenManager("test-secret"))

	cases := []struct {
		name  string
		input string
	}{
		{name: "empty after trim", input: "  \t  "},
		{name: "over 20 code points", input: strings.Repeat("가", 21)},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateDisplayName(context.Background(), AuthContext{UserID: user.ID}, tt.input)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			stored, _, _ := repo.GetUser(context.Background(), user.ID)
			if stored.DisplayName != "민수" {
				t.Fatalf("expected previous display name to remain 민수, got %q", stored.DisplayName)
			}
		})
	}
}

func TestUpdateDisplayNameAcceptsUnicodeCodePointBoundary(t *testing.T) {
	repo := newFakeRepository()
	user, err := repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "민수"}, Identity{Provider: ProviderApple, ProviderSubject: "apple-1"})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	service := NewService(repo, fakeVerifier{}, NewTokenManager("test-secret"))

	name := strings.Repeat("가", 20)
	result, err := service.UpdateDisplayName(context.Background(), AuthContext{UserID: user.ID}, name)
	if err != nil {
		t.Fatalf("expected 20 Korean code points to be accepted, got %v", err)
	}
	if result.User.DisplayName != name {
		t.Fatalf("expected %q, got %q", name, result.User.DisplayName)
	}
}

func TestUpdateDisplayNameAllowsDuplicatesAndSameValue(t *testing.T) {
	repo := newFakeRepository()
	user1, err := repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "민수"}, Identity{Provider: ProviderApple, ProviderSubject: "apple-1"})
	if err != nil {
		t.Fatalf("seed user1: %v", err)
	}
	_, err = repo.CreateUserWithIdentity(context.Background(), User{DisplayName: "지영"}, Identity{Provider: ProviderKakao, ProviderSubject: "kakao-1"})
	if err != nil {
		t.Fatalf("seed user2: %v", err)
	}
	service := NewService(repo, fakeVerifier{}, NewTokenManager("test-secret"))

	duplicate, err := service.UpdateDisplayName(context.Background(), AuthContext{UserID: user1.ID}, "지영")
	if err != nil {
		t.Fatalf("expected duplicate display name to be allowed, got %v", err)
	}
	if duplicate.User.DisplayName != "지영" {
		t.Fatalf("expected duplicate display name 지영, got %q", duplicate.User.DisplayName)
	}

	sameValue, err := service.UpdateDisplayName(context.Background(), AuthContext{UserID: user1.ID}, "  지영  ")
	if err != nil {
		t.Fatalf("expected same value update to be idempotent success, got %v", err)
	}
	if sameValue.User.DisplayName != "지영" {
		t.Fatalf("expected same value display name 지영, got %q", sameValue.User.DisplayName)
	}
}

type fakeVerifier struct {
	profile ProviderProfile
	err     error
}

func (v fakeVerifier) Verify(context.Context, Provider, Credential) (ProviderProfile, error) {
	if v.err != nil {
		return ProviderProfile{}, v.err
	}
	return v.profile, nil
}

type fakeRepository struct {
	users          map[string]User
	identityUser   map[string]string
	providers      map[string][]Provider
	verifiedEmails map[string]string
	sessions       map[string]Session
	deleted        map[string]bool
	nextUser       int
	nextSession    int
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		users:          map[string]User{},
		identityUser:   map[string]string{},
		providers:      map[string][]Provider{},
		verifiedEmails: map[string]string{},
		sessions:       map[string]Session{},
		deleted:        map[string]bool{},
	}
}

func (r *fakeRepository) FindUserByIdentity(_ context.Context, provider Provider, providerSubject string) (User, bool, error) {
	userID, ok := r.identityUser[identityKey(provider, providerSubject)]
	if !ok || r.deleted[userID] {
		return User{}, false, nil
	}
	return r.users[userID], true, nil
}

func (r *fakeRepository) FindUserByVerifiedEmail(_ context.Context, emailNormalized string) (User, bool, error) {
	userID, ok := r.verifiedEmails[emailNormalized]
	if !ok || r.deleted[userID] {
		return User{}, false, nil
	}
	return r.users[userID], true, nil
}

func (r *fakeRepository) CreateUserWithIdentity(_ context.Context, user User, identity Identity) (User, error) {
	r.nextUser++
	user.ID = "user-" + string(rune('0'+r.nextUser))
	r.users[user.ID] = user
	identity.UserID = user.ID
	if _, exists := r.identityUser[identityKey(identity.Provider, identity.ProviderSubject)]; exists {
		return User{}, ErrProviderAlreadyLinked
	}
	r.identityUser[identityKey(identity.Provider, identity.ProviderSubject)] = user.ID
	r.providers[user.ID] = append(r.providers[user.ID], identity.Provider)
	if identity.Email != nil && identity.EmailVerified {
		r.verifiedEmails[normalizeEmail(*identity.Email)] = user.ID
	}
	return user, nil
}

func (r *fakeRepository) CreateIdentity(_ context.Context, userID string, identity Identity) (Identity, error) {
	if _, exists := r.identityUser[identityKey(identity.Provider, identity.ProviderSubject)]; exists {
		return Identity{}, ErrProviderAlreadyLinked
	}
	identity.UserID = userID
	r.identityUser[identityKey(identity.Provider, identity.ProviderSubject)] = userID
	r.providers[userID] = append(r.providers[userID], identity.Provider)
	return identity, nil
}

func (r *fakeRepository) CreateSession(_ context.Context, userID string, refreshTokenHash string, refreshTokenExpiresAt time.Time, _ Device) (Session, error) {
	r.nextSession++
	session := Session{ID: "session-" + string(rune('0'+r.nextSession)), UserID: userID, RefreshTokenHash: refreshTokenHash, RefreshTokenExpiresAt: refreshTokenExpiresAt}
	r.sessions[session.ID] = session
	return session, nil
}

func (r *fakeRepository) FindSessionByRefreshTokenHash(_ context.Context, refreshTokenHash string) (Session, bool, error) {
	for _, session := range r.sessions {
		if session.RefreshTokenHash == refreshTokenHash {
			return session, true, nil
		}
	}
	return Session{}, false, nil
}

func (r *fakeRepository) GetSession(_ context.Context, sessionID string) (Session, bool, error) {
	session, ok := r.sessions[sessionID]
	return session, ok, nil
}

func (r *fakeRepository) RotateSessionRefreshToken(_ context.Context, sessionID string, refreshTokenHash string, refreshTokenExpiresAt time.Time) (Session, error) {
	session := r.sessions[sessionID]
	session.RefreshTokenHash = refreshTokenHash
	session.RefreshTokenExpiresAt = refreshTokenExpiresAt
	r.sessions[sessionID] = session
	return session, nil
}

func (r *fakeRepository) RevokeSession(_ context.Context, sessionID string) error {
	session := r.sessions[sessionID]
	now := time.Now()
	session.RevokedAt = &now
	r.sessions[sessionID] = session
	return nil
}

func (r *fakeRepository) UpdateUserDisplayName(_ context.Context, userID string, displayName string) (User, bool, error) {
	user, ok := r.users[userID]
	if !ok || r.deleted[userID] {
		return User{}, false, nil
	}
	user.DisplayName = displayName
	r.users[userID] = user
	return user, true, nil
}

func (r *fakeRepository) GetUser(_ context.Context, userID string) (User, bool, error) {
	user, ok := r.users[userID]
	if !ok || r.deleted[userID] {
		return User{}, false, nil
	}
	return user, true, nil
}

func (r *fakeRepository) ListProviders(_ context.Context, userID string) ([]Provider, error) {
	return r.providers[userID], nil
}

func (r *fakeRepository) DeleteAccount(_ context.Context, userID string, _ time.Time) error {
	user, ok := r.users[userID]
	if !ok || r.deleted[userID] {
		return ErrUnauthorized
	}

	for key, identityUserID := range r.identityUser {
		if identityUserID == userID {
			delete(r.identityUser, key)
		}
	}
	for email, identityUserID := range r.verifiedEmails {
		if identityUserID == userID {
			delete(r.verifiedEmails, email)
		}
	}
	for sessionID, session := range r.sessions {
		if session.UserID == userID {
			delete(r.sessions, sessionID)
		}
	}
	delete(r.providers, userID)

	user.DisplayName = "탈퇴한 사용자"
	user.Email = nil
	user.EmailVerified = false
	user.AvatarURL = nil
	r.users[userID] = user
	r.deleted[userID] = true
	return nil
}

func identityKey(provider Provider, subject string) string {
	return string(provider) + ":" + subject
}

func ptr(value string) *string {
	return &value
}
