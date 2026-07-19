import { AuthService, type ListNotificationsResponse, type RegisterPushTokenRequest } from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function registerPushToken(request: RegisterPushTokenRequest): Promise<void> {
  await runAuthenticatedRequest(() => AuthService.registerPushToken(request));
}

export async function revokePushToken(installationId: string): Promise<void> {
  await runAuthenticatedRequest(() => AuthService.revokePushToken(installationId));
}

export async function listNotifications(limit = 20, cursor?: string): Promise<ListNotificationsResponse> {
  return runAuthenticatedRequest(() => AuthService.listNotifications(limit, cursor));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await runAuthenticatedRequest(() => AuthService.markNotificationRead(notificationId));
}
