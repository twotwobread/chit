package auth

import (
	"context"
	"errors"
	"strings"
	"time"
)

const maxDisplayNameCodePoints = 20

type Service struct {
	repo     Repository
	verifier ProviderVerifier
	tokens   *TokenManager
	now      func() time.Time
}

type LoginResult struct {
	User   User
	Tokens TokenPair
}

type LinkResult struct {
	Identity Identity
}

type MeResult struct {
	User            User
	LinkedProviders []Provider
}

func NewService(repo Repository, verifier ProviderVerifier, tokens *TokenManager) *Service {
	return &Service{repo: repo, verifier: verifier, tokens: tokens, now: time.Now}
}

func (s *Service) Login(ctx context.Context, provider Provider, credential Credential, device Device) (LoginResult, error) {
	if err := validateProvider(provider); err != nil {
		return LoginResult{}, err
	}

	profile, err := s.verifier.Verify(ctx, provider, credential)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			return LoginResult{}, err
		}
		return LoginResult{}, ErrInvalidProviderToken
	}
	if err := validateProfile(provider, profile); err != nil {
		return LoginResult{}, err
	}

	if user, ok, err := s.repo.FindUserByIdentity(ctx, provider, profile.ProviderSubject); err != nil {
		return LoginResult{}, err
	} else if ok {
		return s.loginExistingUser(ctx, user, device)
	}

	if normalizedEmail := normalizeEmailPtr(profile.Email); profile.EmailVerified && normalizedEmail != "" {
		if _, ok, err := s.repo.FindUserByVerifiedEmail(ctx, normalizedEmail); err != nil {
			return LoginResult{}, err
		} else if ok {
			return LoginResult{}, ErrAccountLinkRequired
		}
	}

	user := User{
		DisplayName:   displayNameOrDefault(profile.DisplayName),
		Email:         profile.Email,
		EmailVerified: profile.EmailVerified && profile.Email != nil,
		AvatarURL:     profile.AvatarURL,
	}
	identity := Identity{
		Provider:        provider,
		ProviderSubject: profile.ProviderSubject,
		Email:           profile.Email,
		EmailVerified:   profile.EmailVerified && profile.Email != nil,
		DisplayName:     profile.DisplayName,
		AvatarURL:       profile.AvatarURL,
	}

	createdUser, err := s.repo.CreateUserWithIdentity(ctx, user, identity)
	if err != nil {
		return LoginResult{}, err
	}
	return s.loginExistingUser(ctx, createdUser, device)
}

func (s *Service) LinkProvider(ctx context.Context, authContext AuthContext, provider Provider, credential Credential) (LinkResult, error) {
	if authContext.UserID == "" {
		return LinkResult{}, ErrUnauthorized
	}
	if err := validateProvider(provider); err != nil {
		return LinkResult{}, err
	}

	profile, err := s.verifier.Verify(ctx, provider, credential)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			return LinkResult{}, err
		}
		return LinkResult{}, ErrInvalidProviderToken
	}
	if err := validateProfile(provider, profile); err != nil {
		return LinkResult{}, err
	}

	if existingUser, ok, err := s.repo.FindUserByIdentity(ctx, provider, profile.ProviderSubject); err != nil {
		return LinkResult{}, err
	} else if ok {
		if existingUser.ID != authContext.UserID {
			return LinkResult{}, ErrProviderAlreadyLinked
		}
		return LinkResult{Identity: Identity{
			UserID:          existingUser.ID,
			Provider:        provider,
			ProviderSubject: profile.ProviderSubject,
			Email:           profile.Email,
			EmailVerified:   profile.EmailVerified && profile.Email != nil,
			DisplayName:     profile.DisplayName,
			AvatarURL:       profile.AvatarURL,
		}}, nil
	}

	identity := Identity{
		Provider:        provider,
		ProviderSubject: profile.ProviderSubject,
		Email:           profile.Email,
		EmailVerified:   profile.EmailVerified && profile.Email != nil,
		DisplayName:     profile.DisplayName,
		AvatarURL:       profile.AvatarURL,
	}
	created, err := s.repo.CreateIdentity(ctx, authContext.UserID, identity)
	if err != nil {
		if errors.Is(err, ErrProviderAlreadyLinked) {
			return LinkResult{}, ErrProviderAlreadyLinked
		}
		return LinkResult{}, err
	}
	return LinkResult{Identity: created}, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return TokenPair{}, ErrInvalidRefreshToken
	}

	hash := HashRefreshToken(refreshToken)
	session, ok, err := s.repo.FindSessionByRefreshTokenHash(ctx, hash)
	if err != nil {
		return TokenPair{}, err
	}
	if !ok || session.RevokedAt != nil || !s.now().UTC().Before(session.RefreshTokenExpiresAt) {
		return TokenPair{}, ErrInvalidRefreshToken
	}

	newRefreshToken, newRefreshHash, newRefreshExpiresAt, err := s.tokens.NewRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	rotated, err := s.repo.RotateSessionRefreshToken(ctx, session.ID, newRefreshHash, newRefreshExpiresAt)
	if err != nil {
		return TokenPair{}, err
	}

	accessToken, accessExpiresAt, err := s.tokens.IssueAccessToken(rotated.UserID, rotated.ID)
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshToken:          newRefreshToken,
		RefreshTokenExpiresAt: newRefreshExpiresAt,
	}, nil
}

func (s *Service) Logout(ctx context.Context, authContext AuthContext) error {
	if authContext.SessionID == "" {
		return ErrUnauthorized
	}
	return s.repo.RevokeSession(ctx, authContext.SessionID)
}

func (s *Service) Me(ctx context.Context, authContext AuthContext) (MeResult, error) {
	if authContext.UserID == "" {
		return MeResult{}, ErrUnauthorized
	}
	user, ok, err := s.repo.GetUser(ctx, authContext.UserID)
	if err != nil {
		return MeResult{}, err
	}
	if !ok {
		return MeResult{}, ErrUnauthorized
	}
	providers, err := s.repo.ListProviders(ctx, authContext.UserID)
	if err != nil {
		return MeResult{}, err
	}
	return MeResult{User: user, LinkedProviders: providers}, nil
}

func (s *Service) UpdateDisplayName(ctx context.Context, authContext AuthContext, displayName string) (MeResult, error) {
	if authContext.UserID == "" {
		return MeResult{}, ErrUnauthorized
	}

	normalized, err := normalizeDisplayNameForUpdate(displayName)
	if err != nil {
		return MeResult{}, err
	}

	user, ok, err := s.repo.UpdateUserDisplayName(ctx, authContext.UserID, normalized)
	if err != nil {
		return MeResult{}, err
	}
	if !ok {
		return MeResult{}, ErrUnauthorized
	}

	providers, err := s.repo.ListProviders(ctx, authContext.UserID)
	if err != nil {
		return MeResult{}, err
	}
	return MeResult{User: user, LinkedProviders: providers}, nil
}

func (s *Service) Authenticate(ctx context.Context, authorizationHeader string) (AuthContext, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(authorizationHeader, prefix) {
		return AuthContext{}, ErrUnauthorized
	}

	claims, err := s.tokens.ParseAccessToken(strings.TrimSpace(strings.TrimPrefix(authorizationHeader, prefix)))
	if err != nil {
		return AuthContext{}, ErrUnauthorized
	}

	session, ok, err := s.repo.GetSession(ctx, claims.SessionID)
	if err != nil {
		return AuthContext{}, err
	}
	if !ok || session.RevokedAt != nil || session.UserID != claims.Subject {
		return AuthContext{}, ErrUnauthorized
	}

	return AuthContext{UserID: claims.Subject, SessionID: claims.SessionID}, nil
}

func (s *Service) loginExistingUser(ctx context.Context, user User, device Device) (LoginResult, error) {
	refreshToken, refreshHash, refreshExpiresAt, err := s.tokens.NewRefreshToken()
	if err != nil {
		return LoginResult{}, err
	}
	session, err := s.repo.CreateSession(ctx, user.ID, refreshHash, refreshExpiresAt, device)
	if err != nil {
		return LoginResult{}, err
	}
	accessToken, accessExpiresAt, err := s.tokens.IssueAccessToken(user.ID, session.ID)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{
		User: user,
		Tokens: TokenPair{
			AccessToken:           accessToken,
			AccessTokenExpiresAt:  accessExpiresAt,
			RefreshToken:          refreshToken,
			RefreshTokenExpiresAt: refreshExpiresAt,
		},
	}, nil
}

func validateProvider(provider Provider) error {
	switch provider {
	case ProviderApple, ProviderKakao:
		return nil
	default:
		return ErrValidation
	}
}

func validateProfile(provider Provider, profile ProviderProfile) error {
	if profile.Provider != provider || strings.TrimSpace(profile.ProviderSubject) == "" {
		return ErrInvalidProviderToken
	}
	return nil
}

func displayNameOrDefault(displayName *string) string {
	if displayName != nil && strings.TrimSpace(*displayName) != "" {
		return strings.TrimSpace(*displayName)
	}
	return "이음 사용자"
}

func normalizeDisplayNameForUpdate(displayName string) (string, error) {
	normalized := strings.TrimSpace(displayName)
	if normalized == "" || len([]rune(normalized)) > maxDisplayNameCodePoints {
		return "", ErrValidation
	}
	return normalized, nil
}

func normalizeEmailPtr(email *string) string {
	if email == nil {
		return ""
	}
	return normalizeEmail(*email)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
