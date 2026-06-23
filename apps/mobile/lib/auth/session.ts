import type { AuthTokens, AuthUser } from '@i-um/api-contract';

const SESSION_KEY = 'i-um.auth.session';

export type StoredSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type StoredSessionReadResult =
  | { status: 'missing' }
  | { status: 'corrupt' }
  | { status: 'ready'; session: StoredSession };

export type SessionStore = {
  getItem: () => Promise<string | null>;
  setItem: (value: string) => Promise<void>;
  deleteItem: () => Promise<void>;
};

const secureSessionStore: SessionStore = {
  getItem: async () => {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(SESSION_KEY);
  },
  setItem: async (value) => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(SESSION_KEY, value);
  },
  deleteItem: async () => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};

export async function readStoredSession(store: SessionStore = secureSessionStore): Promise<StoredSessionReadResult> {
  const raw = await store.getItem();
  if (!raw) {
    return { status: 'missing' };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredSession(parsed)) {
      await store.deleteItem();
      return { status: 'corrupt' };
    }
    return { status: 'ready', session: parsed };
  } catch {
    await store.deleteItem();
    return { status: 'corrupt' };
  }
}

export async function getStoredSession(store: SessionStore = secureSessionStore): Promise<StoredSession | null> {
  const result = await readStoredSession(store);
  return result.status === 'ready' ? result.session : null;
}

export async function saveStoredSession(session: StoredSession, store: SessionStore = secureSessionStore): Promise<void> {
  await store.setItem(JSON.stringify(session));
}

export async function clearStoredSession(store: SessionStore = secureSessionStore): Promise<void> {
  await store.deleteItem();
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value)) {
    return false;
  }
  return isAuthUser(value.user) && isAuthTokens(value.tokens);
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.id) && isNonEmptyString(value.displayName);
}

function isAuthTokens(value: unknown): value is AuthTokens {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.accessToken) &&
    isNonEmptyString(value.accessTokenExpiresAt) &&
    isNonEmptyString(value.refreshToken) &&
    isNonEmptyString(value.refreshTokenExpiresAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
