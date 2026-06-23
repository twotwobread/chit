import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse, AuthProvider } from '@i-um/api-contract';

import { getMeWithRefresh, linkOAuthProvider, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { createLogoutFlow, type LogoutFlow } from '../lib/auth/logout-flow';
import { getOAuthCredential } from '../lib/auth/oauth';
import { theme } from '../lib/design';

type AccountState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse; message?: string }
  | { status: 'error'; message: string };

const providers: AuthProvider[] = ['apple', 'kakao'];

export default function AccountScreen() {
  const [state, setState] = useState<AccountState>({ status: 'loading' });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutFlowRef = useRef<LogoutFlow | null>(null);

  if (logoutFlowRef.current === null) {
    logoutFlowRef.current = createLogoutFlow({
      logoutCurrentSession,
      replace: (path) => router.replace(path),
    });
  }

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const me = await getMeWithRefresh();
      setState({ status: 'ready', me });
    } catch {
      setState({ status: 'error', message: '다시 로그인해주세요.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkProvider = async (provider: AuthProvider) => {
    if (state.status !== 'ready') {
      return;
    }
    setState({ ...state, message: undefined });
    try {
      const credential = await getOAuthCredential(provider);
      await linkOAuthProvider(provider, credential);
      const me = await getMeWithRefresh();
      setState({ status: 'ready', me, message: '로그인 방법이 연결되었습니다.' });
    } catch (error) {
      setState({ status: 'ready', me: state.me, message: linkErrorMessage(error) });
    }
  };

  const logout = async () => {
    const logoutFlow = logoutFlowRef.current;
    if (!logoutFlow || logoutFlow.isLoggingOut()) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutFlow.run();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>계정</Text>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>계정 정보를 확인 중...</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
            <Text style={styles.buttonText}>로그인하기</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' ? (
        <View style={styles.card}>
          <Text style={styles.message}>사용자: {state.me.user.displayName}</Text>
          <Text style={styles.message}>연결된 로그인: {state.me.linkedProviders.join(', ')}</Text>

          {providers.map((provider) => {
            const linked = state.me.linkedProviders.includes(provider);
            return (
              <Pressable
                accessibilityRole="button"
                disabled={linked}
                key={provider}
                onPress={() => void linkProvider(provider)}
                style={[styles.secondaryButton, linked ? styles.disabledButton : null]}
              >
                <Text style={styles.secondaryButtonText}>
                  {provider === 'apple' ? 'Apple' : 'Kakao'} {linked ? '연결됨' : '연결'}
                </Text>
              </Pressable>
            );
          })}

          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}

          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>뒤로</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isLoggingOut}
              onPress={() => void logout()}
              style={[styles.button, isLoggingOut ? styles.disabledButton : null]}
            >
              <Text style={styles.buttonText}>{isLoggingOut ? '로그아웃 중...' : '로그아웃'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function linkErrorMessage(error: unknown): string {
  if (error instanceof MobileAuthError) {
    if (error.code === 'PROVIDER_ALREADY_LINKED') {
      return '이미 다른 계정에 연결된 로그인 방법입니다.';
    }
    if (error.code === 'INVALID_PROVIDER_TOKEN') {
      return '로그인 정보를 확인할 수 없어요. 다시 시도해주세요.';
    }
  }
  return '로그인 방법 연결에 실패했어요. 다시 시도해주세요.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
    padding: theme.space[7],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    marginBottom: theme.space[7],
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
