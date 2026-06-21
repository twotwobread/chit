/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Provider credential. Apple uses identityToken/authorizationCode/nonce. Kakao uses accessToken. dev* fields are accepted only when server dev OAuth is enabled.
 */
export type OAuthCredential = {
    identityToken?: string;
    authorizationCode?: string;
    nonce?: string;
    accessToken?: string;
    devSubject?: string;
    email?: string | null;
    emailVerified?: boolean;
    displayName?: string | null;
    avatarUrl?: string | null;
};

