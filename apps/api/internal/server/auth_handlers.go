package server

import (
	"net/http"

	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
)

func (s apiServer) LoginWithOAuth(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	var body openapi.LoginWithOAuthJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.auth.Login(r.Context(), auth.Provider(body.Provider), credentialFromOpenAPI(body.Credential), deviceFromOpenAPI(body.Device, r.UserAgent()))
	if err != nil {
		writeAuthError(w, err, auth.Provider(body.Provider))
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLoginResponse{
		Result: openapi.LoginSuccess,
		User:   userToOpenAPI(result.User),
		Tokens: tokensToOpenAPI(result.Tokens),
	})
}

func (s apiServer) LinkOAuthProvider(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}

	var body openapi.LinkOAuthProviderJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	result, err := s.auth.LinkProvider(r.Context(), authContext, auth.Provider(body.Provider), credentialFromOpenAPI(body.Credential))
	if err != nil {
		writeAuthError(w, err, auth.Provider(body.Provider))
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLinkResponse{
		Result: openapi.ProviderLinkSuccess,
		LinkedIdentity: openapi.LinkedIdentity{
			Provider:      openapi.AuthProvider(result.Identity.Provider),
			Email:         result.Identity.Email,
			EmailVerified: result.Identity.EmailVerified,
		},
	})
}

func (s apiServer) RefreshToken(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	var body openapi.RefreshTokenJSONRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}

	tokens, err := s.auth.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		writeAuthError(w, err, "")
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthRefreshResponse{
		Result: openapi.RefreshSuccess,
		Tokens: tokensToOpenAPI(tokens),
	})
}

func (s apiServer) Logout(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	if err := s.auth.Logout(r.Context(), authContext); err != nil {
		writeAuthError(w, err, "")
		return
	}

	writeJSON(w, http.StatusOK, openapi.AuthLogoutResponse{Result: openapi.LogoutSuccess})
}

func (s apiServer) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	if s.auth == nil {
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "auth is not configured", nil)
		return
	}

	authContext, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	result, err := s.auth.Me(r.Context(), authContext)
	if err != nil {
		writeAuthError(w, err, "")
		return
	}

	providers := make([]openapi.AuthProvider, 0, len(result.LinkedProviders))
	for _, provider := range result.LinkedProviders {
		providers = append(providers, openapi.AuthProvider(provider))
	}

	writeJSON(w, http.StatusOK, openapi.AuthMeResponse{
		User:            userToOpenAPI(result.User),
		LinkedProviders: providers,
	})
}

func (s apiServer) requireAuth(w http.ResponseWriter, r *http.Request) (auth.AuthContext, bool) {
	authContext, err := s.auth.Authenticate(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		writeAuthError(w, err, "")
		return auth.AuthContext{}, false
	}
	return authContext, true
}
