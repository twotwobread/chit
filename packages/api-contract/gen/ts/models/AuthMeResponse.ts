/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthProvider } from './AuthProvider';
import type { AuthUser } from './AuthUser';
export type AuthMeResponse = {
    user: AuthUser;
    linkedProviders: Array<AuthProvider>;
};
