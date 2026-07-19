import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthProvider } from '@i-um/api-contract';

import { loginWithOAuth, MobileAuthError } from '../lib/auth/client';
import { createLoginAttemptGate } from '../lib/auth/login-attempt';
import { getOAuthCredential, getVisibleOAuthProviderConfigs } from '../lib/auth/oauth';
import { theme } from '../lib/design';
import {
  clearPendingInviteLoginHandoff,
  consumeInviteLoginRedirectPath,
  getLoginSubtitleForInviteHandoff,
} from '../lib/trips/invite-login-handoff';

type LoginState =
  | { status: 'idle' }
  | { status: 'loading'; provider: AuthProvider }
  | { status: 'error'; message: string; conflict: boolean };

const providers = getVisibleOAuthProviderConfigs();

export default function LoginScreen() {
  const [state, setState] = useState<LoginState>({ status: 'idle' });
  const [subtitle] = useState(() => getLoginSubtitleForInviteHandoff());
  const consumedHandoffRef = useRef(false);
  const loginAttemptGateRef = useRef(createLoginAttemptGate());

  useEffect(() => {
    return () => {
      if (!consumedHandoffRef.current) {
        clearPendingInviteLoginHandoff();
      }
    };
  }, []);

  const login = async (provider: AuthProvider) => {
    const attempt = loginAttemptGateRef.current.run(async () => {
      setState({ status: 'loading', provider });
      try {
        const credential = await getOAuthCredential(provider);
        await loginWithOAuth(provider, credential);
        const redirectPath = consumeInviteLoginRedirectPath();
        consumedHandoffRef.current = true;
        router.replace(redirectPath);
      } catch (error) {
        setState(errorState(error));
      }
    });

    await attempt;
  };

  const isLoading = state.status === 'loading';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>칫 Chit</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.card}>
        {providers.map((provider) => (
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            key={provider.id}
            onPress={() => void login(provider.id)}
            style={[
              styles.providerButton,
              { backgroundColor: provider.buttonStyle.backgroundColor },
              isLoading ? styles.disabledButton : null,
            ]}
          >
            <Text style={[styles.providerButtonText, { color: provider.buttonStyle.textColor }]}>
              {provider.loginLabel(provider)}
            </Text>
          </Pressable>
        ))}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.color.primary} />
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
    backgroundColor: theme.color.bg,
    padding: theme.space[7],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.display,
    fontWeight: theme.font.weight.bold,
    marginBottom: theme.space[3],
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    marginBottom: theme.space[7],
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  providerButton: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  providerButtonText: {
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorBox: {
    gap: theme.space[3],
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  linkText: {
    color: theme.color.textLink,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
