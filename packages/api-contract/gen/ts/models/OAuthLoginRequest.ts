/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthProvider } from './AuthProvider';
import type { DeviceInfo } from './DeviceInfo';
import type { OAuthCredential } from './OAuthCredential';
export type OAuthLoginRequest = {
    provider: AuthProvider;
    credential: OAuthCredential;
    device?: DeviceInfo;
};

