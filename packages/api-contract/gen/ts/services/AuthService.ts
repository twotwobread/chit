/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthLinkResponse } from '../models/AuthLinkResponse';
import type { AuthLoginResponse } from '../models/AuthLoginResponse';
import type { AuthLogoutResponse } from '../models/AuthLogoutResponse';
import type { AuthMeResponse } from '../models/AuthMeResponse';
import type { AuthRefreshResponse } from '../models/AuthRefreshResponse';
import type { OAuthLinkRequest } from '../models/OAuthLinkRequest';
import type { OAuthLoginRequest } from '../models/OAuthLoginRequest';
import type { RefreshTokenRequest } from '../models/RefreshTokenRequest';
import type { UpdateMeRequest } from '../models/UpdateMeRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
    /**
     * Login or sign up with Apple or Kakao OAuth
     * @param requestBody
     * @returns AuthLoginResponse Login succeeded.
     * @throws ApiError
     */
    public static loginWithOAuth(
        requestBody: OAuthLoginRequest,
    ): CancelablePromise<AuthLoginResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/oauth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Provider token is invalid.`,
                409: `Existing verified email requires explicit account linking.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Link an Apple or Kakao OAuth identity to the current user
     * @param requestBody
     * @returns AuthLinkResponse Provider linked.
     * @throws ApiError
     */
    public static linkOAuthProvider(
        requestBody: OAuthLinkRequest,
    ): CancelablePromise<AuthLinkResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/oauth/link',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized or invalid provider token.`,
                409: `Provider identity already linked to another user.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Rotate a refresh token and issue a new token pair
     * @param requestBody
     * @returns AuthRefreshResponse Refresh succeeded.
     * @throws ApiError
     */
    public static refreshToken(
        requestBody: RefreshTokenRequest,
    ): CancelablePromise<AuthRefreshResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/token/refresh',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Refresh token is invalid, expired, or revoked.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Revoke the current session
     * @returns AuthLogoutResponse Logout succeeded.
     * @throws ApiError
     */
    public static logout(): CancelablePromise<AuthLogoutResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/logout',
            errors: {
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Return the current user and linked providers
     * Canonical current-profile endpoint. Returns the same AuthMeResponse shape as deprecated GET /auth/me.
     * @returns AuthMeResponse Current user.
     * @throws ApiError
     */
    public static getMe(): CancelablePromise<AuthMeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/me',
            errors: {
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * Update the current user's display name
     * Updates the authenticated user's canonical display name. Server trims leading/trailing whitespace, then validates 1-20 Unicode code points before storing the value.
     * @param requestBody
     * @returns AuthMeResponse Current user after display-name update.
     * @throws ApiError
     */
    public static updateMe(
        requestBody: UpdateMeRequest,
    ): CancelablePromise<AuthMeResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/me',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error.`,
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
    /**
     * @deprecated
     * Return the current user and linked providers
     * Deprecated compatibility alias for GET /me. Use GET /me for new clients.
     * @returns AuthMeResponse Current user.
     * @throws ApiError
     */
    public static getCurrentUser(): CancelablePromise<AuthMeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/me',
            errors: {
                401: `Unauthorized.`,
                500: `Unexpected server error.`,
            },
        });
    }
}
