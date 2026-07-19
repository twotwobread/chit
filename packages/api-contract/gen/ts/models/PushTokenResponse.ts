/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PushPlatform } from './PushPlatform';
import type { PushTokenStatus } from './PushTokenStatus';
export type PushTokenResponse = {
    installationId: string;
    platform: PushPlatform;
    status: PushTokenStatus;
    lastRegisteredAt: string;
};
