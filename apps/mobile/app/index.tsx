import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse } from '@i-um/api-contract';

import { getCurrentUserWithRefresh, MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, getStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';

type HomeState =
  | { status: 'loading' }
  | { status: 'authenticated'; me: AuthMeResponse }
  | { status: 'needsLogin'; message?: string }
  | { status: 'error' };

export default function HomeScreen() {
  const [homeState, setHomeState] = useState<HomeState>({ status: 'loading' });

  const load = useCallback(async () => {
    setHomeState({ status: 'loading' });

    try {
      const stored = await getStoredSession();
      if (!stored) {
        setHomeState({ status: 'needsLogin' });
        return;
      }

      const me = await getCurrentUserWithRefresh();
      setHomeState({ status: 'authenticated', me });
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')
      ) {
        await clearStoredSession();
        setHomeState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }
      setHomeState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>이음</Text>
        <Text style={styles.subtitle}>여행을 이어갈 준비를 해요.</Text>

        {homeState.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>홈을 불러오는 중...</Text>
          </View>
        ) : null}

        {homeState.status === 'needsLogin' ? (
          <View style={styles.card}>
            <Text style={styles.message}>{homeState.message ?? '로그인이 필요합니다.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {homeState.status === 'authenticated' ? (
          <View style={styles.card}>
            <Text style={styles.successTitle}>여행을 이어가요.</Text>
            <Text style={styles.message}>{displayName(homeState.me.user.displayName)}님, 다음 여행을 준비해볼까요?</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/trips/new')} style={styles.button}>
              <Text style={styles.buttonText}>새 여행 만들기</Text>
            </Pressable>
          </View>
        ) : null}

        {homeState.status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>홈을 불러올 수 없어요.</Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.button}>
              <Text style={styles.buttonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {homeState.status === 'authenticated' ? <BottomMenu selected="home" /> : null}
    </View>
  );
}

function displayName(value: string): string {
  return value.trim() || '이름을 불러올 수 없어요.';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  successTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
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
    minHeight: theme.layout.controlH,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
