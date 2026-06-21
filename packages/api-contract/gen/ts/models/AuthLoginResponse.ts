/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthTokens } from './AuthTokens';
import type { AuthUser } from './AuthUser';
export type AuthLoginResponse = {
    result: 'login_success';
    user: AuthUser;
    tokens: AuthTokens;
};

