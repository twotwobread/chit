import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthProvider } from '@i-um/api-contract';

import { loginWithOAuth, MobileAuthError } from '../lib/auth/client';
import { getOAuthCredential } from '../lib/auth/oauth';

type LoginState =
  | { status: 'idle' }
  | { status: 'loading'; provider: AuthProvider }
  | { status: 'error'; message: string; conflict: boolean };

export default function LoginScreen() {
  const [state, setState] = useState<LoginState>({ status: 'idle' });

  const login = async (provider: AuthProvider) => {
    setState({ status: 'loading', provider });
    try {
      const credential = await getOAuthCredential(provider);
      await loginWithOAuth(provider, credential);
      router.replace('/');
    } catch (error) {
      setState(errorState(error));
    }
  };

  const isLoading = state.status === 'loading';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이음</Text>
      <Text style={styles.subtitle}>여행을 함께 이어가려면 로그인해주세요.</Text>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void login('apple')}
          style={[styles.button, isLoading ? styles.disabledButton : null]}
        >
          <Text style={styles.buttonText}>Apple로 계속하기</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void login('kakao')}
          style={[styles.kakaoButton, isLoading ? styles.disabledButton : null]}
        >
          <Text style={styles.kakaoButtonText}>Kakao로 계속하기</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.message}>로그인 중...</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{state.message}</Text>
            {state.conflict ? (
              <Pressable accessibilityRole="button" onPress={() => setState({ status: 'idle' })}>
                <Text style={styles.linkText}>기존 계정으로 로그인</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function errorState(error: unknown): LoginState {
  if (error instanceof MobileAuthError) {
    if (error.code === 'ACCOUNT_LINK_REQUIRED') {
      return {
        status: 'error',
        conflict: true,
        message: '이미 같은 이메일로 가입한 계정이 있어요. 기존 계정으로 로그인한 뒤 이 로그인 방법을 연결해주세요.',
      };
    }
    if (error.code === 'INVALID_PROVIDER_TOKEN') {
      return { status: 'error', conflict: false, message: '로그인 정보를 확인할 수 없어요. 다시 시도해주세요.' };
    }
  }
  return { status: 'error', conflict: false, message: '로그인에 실패했어요. 다시 시도해주세요.' };
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
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderColor: '#eeeeee',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#fee500',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  kakaoButtonText: {
    color: '#111111',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  message: {
    color: '#333333',
    textAlign: 'center',
  },
  errorBox: {
    gap: 8,
  },
  errorText: {
    color: '#c92a2a',
    textAlign: 'center',
  },
  linkText: {
    color: '#1971c2',
    fontWeight: '700',
    textAlign: 'center',
  },
});
