import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse } from '@i-um/api-contract';

import { fetchHealthAndReadiness } from '../lib/api/health';
import { clearStoredSession, getStoredSession } from '../lib/auth/session';
import { getCurrentUserWithRefresh, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';

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
      <Text style={styles.subtitle}>OAuth session readiness</Text>

      {homeState.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator />
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
  successTitle: {
    color: '#087f5b',
    fontSize: 20,
    fontWeight: '700',
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
});
