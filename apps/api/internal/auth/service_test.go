package auth

import (
	"context"
	"errors"
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
	}
}

func (r *fakeRepository) FindUserByIdentity(_ context.Context, provider Provider, providerSubject string) (User, bool, error) {
	userID, ok := r.identityUser[identityKey(provider, providerSubject)]
	if !ok {
		return User{}, false, nil
	}
	return r.users[userID], true, nil
}

func (r *fakeRepository) FindUserByVerifiedEmail(_ context.Context, emailNormalized string) (User, bool, error) {
	userID, ok := r.verifiedEmails[emailNormalized]
	if !ok {
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

func (r *fakeRepository) GetUser(_ context.Context, userID string) (User, bool, error) {
	user, ok := r.users[userID]
	return user, ok, nil
}

func (r *fakeRepository) ListProviders(_ context.Context, userID string) ([]Provider, error) {
	return r.providers[userID], nil
}

func identityKey(provider Provider, subject string) string {
	return string(provider) + ":" + subject
}

func ptr(value string) *string {
	return &value
}
