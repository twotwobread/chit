import type { AuthProvider } from '@i-um/api-contract';

import { clearKakaoNativeSession } from './kakao';

export type OAuthProviderCleanupAdapter = {
  provider: AuthProvider | string;
  clearLocalSession: () => Promise<void>;
};

export const defaultOAuthProviderCleanupAdapters: OAuthProviderCleanupAdapter[] = [
  { provider: 'kakao', clearLocalSession: clearKakaoNativeSession },
];

export async function clearOAuthProviderLocalSessions(
  adapters: OAuthProviderCleanupAdapter[] = defaultOAuthProviderCleanupAdapters,
): Promise<void> {
  for (const adapter of adapters) {
    try {
      await adapter.clearLocalSession();
    } catch {
      // Provider-local cleanup is best-effort and must not block i-um local logout.
    }
  }
}
