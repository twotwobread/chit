import * as SecureStore from 'expo-secure-store';

import type { AuthTokens, AuthUser } from '@i-um/api-contract';

const SESSION_KEY = 'i-um.auth.session';

export type StoredSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export async function getStoredSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
