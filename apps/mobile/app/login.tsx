import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthProvider } from '@i-um/api-contract';

import { loginWithOAuth, MobileAuthError } from '../lib/auth/client';
import { createLoginAttemptGate } from '../lib/auth/login-attempt';
import { getOAuthCredential, getVisibleOAuthProviderConfigs } from '../lib/auth/oauth';
import { Card, PrimaryButton, SecondaryButton, theme } from '../lib/design';
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
      <View style={styles.hero}>
        <Text style={styles.brandBadge}>CHIT</Text>
        <Text style={styles.title}>칫 Chit</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>로그인하면 바로 이어가요</Text>
          <Text style={styles.cardHelper}>초대받은 여행도, 내 여행도 안전하게 불러옵니다.</Text>
        </View>

        {providers.map((provider) => {
          const providerLoading = state.status === 'loading' && state.provider === provider.id;
          return (
            <Pressable
              accessibilityLabel={provider.loginLabel(provider)}
              accessibilityRole="button"
              accessibilityState={{ busy: providerLoading, disabled: isLoading }}
              disabled={isLoading}
              key={provider.id}
              onPress={() => void login(provider.id)}
              style={({ pressed }) => [
                styles.providerButton,
                { backgroundColor: provider.buttonStyle.backgroundColor },
                pressed && !isLoading ? styles.providerButtonPressed : null,
                isLoading ? styles.disabledButton : null,
              ]}
            >
              <Text style={[styles.providerButtonText, { color: provider.buttonStyle.textColor }]}>
                {provider.loginLabel(provider)}
              </Text>
            </Pressable>
          );
        })}

        {isLoading ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>로그인 중이에요. 잠시만 기다려주세요.</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View accessibilityLiveRegion="polite" style={styles.errorBox}>
            <Text style={styles.errorText}>{state.message}</Text>
            {state.conflict ? (
              <SecondaryButton label="기존 계정으로 로그인" onPress={() => setState({ status: 'idle' })} />
            ) : (
              <PrimaryButton label="다시 시도" onPress={() => setState({ status: 'idle' })} />
            )}
          </View>
        ) : null}
      </Card>
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
  return { status: 'error', conflict: false, message: '로그인에 실패했어요. 잠시 후 다시 시도해주세요.' };
}

const styles = StyleSheet.create({
  brandBadge: {
    alignSelf: 'center',
    backgroundColor: theme.color.textStrong,
    borderRadius: theme.radius.pill,
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.4,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  card: {
    gap: theme.space[5],
  },
  cardHeader: {
    gap: theme.space[2],
  },
  cardHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  cardTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorBox: {
    gap: theme.space[3],
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: theme.space[3],
    marginBottom: theme.space[7],
    maxWidth: theme.layout.cardMaxW,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
  },
  message: {
    color: theme.color.textBody,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  providerButton: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  providerButtonPressed: {
    opacity: 0.78,
  },
  providerButtonText: {
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.display,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.8,
  },
});
