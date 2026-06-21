import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse } from '@i-um/api-contract';

import { fetchHealthAndReadiness } from '../lib/api/health';
import { clearStoredSession, getStoredSession } from '../lib/auth/session';
import { getCurrentUserWithRefresh, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { theme } from '../lib/design';

type HomeState =
  | { status: 'loading' }
  | { status: 'authenticated'; me: AuthMeResponse; apiStatus: string; dbStatus: string; schema: string }
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
      const diagnostics = await fetchHealthAndReadiness();
      setHomeState({
        status: 'authenticated',
        me,
        apiStatus: diagnostics.health.status,
        dbStatus: diagnostics.readiness.checks.database.status,
        schema: diagnostics.readiness.checks.metadata.schema,
      });
    } catch (error) {
      if (error instanceof MobileAuthError && error.code === 'INVALID_REFRESH_TOKEN') {
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

  const logout = async () => {
    await logoutCurrentSession();
    setHomeState({ status: 'needsLogin' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이음</Text>
      <Text style={styles.subtitle}>여행을 이어갈 준비를 확인해요.</Text>

      {homeState.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>API 및 DB 상태 확인 중...</Text>
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
          <Text style={styles.successTitle}>로그인되었습니다.</Text>
          <Text style={styles.message}>사용자: {homeState.me.user.displayName}</Text>
          <Text style={styles.message}>연결된 로그인: {homeState.me.linkedProviders.join(', ')}</Text>
          <Text style={styles.successTitle}>API 연결 성공</Text>
          <Text style={styles.message}>status: {homeState.apiStatus}</Text>
          <Text style={styles.successTitle}>DB 연결 성공</Text>
          <Text style={styles.message}>database: {homeState.dbStatus}</Text>
          <Text style={styles.message}>schema: {homeState.schema}</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>계정</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.button}>
              <Text style={styles.buttonText}>로그아웃</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {homeState.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>API 또는 DB 연결 실패</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
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
  successTitle: {
    color: theme.color.success,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
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
  secondaryButton: {
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: theme.layout.controlH,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
