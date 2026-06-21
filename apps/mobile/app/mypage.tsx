import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse, AuthProvider } from '@i-um/api-contract';

import { getCurrentUserWithRefresh, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, getStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';

type MyPageState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse }
  | { status: 'needsLogin'; message?: string }
  | { status: 'error' };

export default function MyPageScreen() {
  const [state, setState] = useState<MyPageState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const stored = await getStoredSession();
      if (!stored) {
        setState({ status: 'needsLogin' });
        return;
      }

      const me = await getCurrentUserWithRefresh();
      setState({ status: 'ready', me });
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')
      ) {
        await clearStoredSession();
        setState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await logoutCurrentSession();
    router.replace('/login');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>마이페이지</Text>
          <Text style={styles.subtitle}>내 정보와 여행을 한곳에서 확인해요.</Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>마이페이지를 불러오는 중...</Text>
          </View>
        ) : null}

        {state.status === 'needsLogin' ? (
          <View style={styles.card}>
            <Text style={styles.message}>{state.message ?? '로그인이 필요합니다.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>마이페이지를 불러올 수 없어요.</Text>
            <Text style={styles.message}>다시 시도해주세요.</Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.button}>
              <Text style={styles.buttonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>내 프로필</Text>
              <Text style={styles.profileName}>{displayName(state.me.user.displayName)}</Text>
              {state.me.user.email ? <Text style={styles.message}>{state.me.user.email}</Text> : null}
              <Text style={styles.metaLabel}>연결된 로그인</Text>
              <Text style={styles.message}>{providerSummary(state.me.linkedProviders)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>내 여행</Text>
              <Text style={styles.message}>새 여행을 만들고 여정을 이어가요.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/trips/new')} style={styles.button}>
                <Text style={styles.buttonText}>새 여행 만들기</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>설정</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>계정 관리</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.dangerButton}>
                <Text style={styles.buttonText}>로그아웃</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {state.status === 'ready' ? <BottomMenu selected="my" /> : null}
    </View>
  );
}

function displayName(value: string): string {
  return value.trim() || '이름을 불러올 수 없어요.';
}

function providerSummary(providers: AuthProvider[]): string {
  if (providers.length === 0) {
    return '연결된 로그인 없음';
  }
  return providers.map(providerLabel).join(', ');
}

function providerLabel(provider: AuthProvider): string {
  return provider === 'apple' ? 'Apple' : 'Kakao';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: theme.space[4],
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[3],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
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
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  profileName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  metaLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
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
    alignItems: 'center',
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
});
