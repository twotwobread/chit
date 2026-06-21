import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse, AuthProvider } from '@i-um/api-contract';

import { getCurrentUserWithRefresh, linkOAuthProvider, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { getOAuthCredential } from '../lib/auth/oauth';

type AccountState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse; message?: string }
  | { status: 'error'; message: string };

const providers: AuthProvider[] = ['apple', 'kakao'];

export default function AccountScreen() {
  const [state, setState] = useState<AccountState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const me = await getCurrentUserWithRefresh();
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
      const me = await getCurrentUserWithRefresh();
      setState({ status: 'ready', me, message: '로그인 방법이 연결되었습니다.' });
    } catch (error) {
      setState({ status: 'ready', me: state.me, message: linkErrorMessage(error) });
    }
  };

  const logout = async () => {
    await logoutCurrentSession();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>계정</Text>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator />
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
            <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.button}>
              <Text style={styles.buttonText}>로그아웃</Text>
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
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderColor: '#eeeeee',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  message: {
    color: '#333333',
    textAlign: 'center',
  },
  errorTitle: {
    color: '#c92a2a',
    fontSize: 20,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#222222',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: '#222222',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#222222',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
