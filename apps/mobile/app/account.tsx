import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse, AuthProvider } from '@i-um/api-contract';

import {
  deleteAccountWithRefresh,
  getMeWithRefresh,
  linkOAuthProvider,
  logoutCurrentSession,
  MobileAuthError,
  updateDisplayNameWithRefresh,
} from '../lib/auth/client';
import { AccountDeletionSection } from '../lib/auth/account-deletion-section';
import {
  createAccountDeletionFlow,
  type AccountDeletionFlow,
  type AccountDeletionStatus,
} from '../lib/auth/account-deletion-flow';
import { normalizeDisplayNameInput } from '../lib/auth/display-name';
import { createLogoutFlow, type LogoutFlow } from '../lib/auth/logout-flow';
import { getOAuthCredential, getVisibleOAuthProviderConfigs } from '../lib/auth/oauth';
import { theme } from '../lib/design';

type AccountState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse; message?: string }
  | { status: 'error'; message: string };

const providers = getVisibleOAuthProviderConfigs();

export default function AccountScreen() {
  const [state, setState] = useState<AccountState>({ status: 'loading' });
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<AccountDeletionStatus>('idle');
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const logoutFlowRef = useRef<LogoutFlow | null>(null);
  const accountDeletionFlowRef = useRef<AccountDeletionFlow | null>(null);

  if (logoutFlowRef.current === null) {
    logoutFlowRef.current = createLogoutFlow({
      logoutCurrentSession,
      replace: (path) => router.replace(path),
    });
  }

  if (accountDeletionFlowRef.current === null) {
    accountDeletionFlowRef.current = createAccountDeletionFlow({
      deleteAccount: deleteAccountWithRefresh,
      replace: (path) => {
        if (router.canDismiss()) {
          router.dismissAll();
        }
        router.replace(path);
      },
    });
  }

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setIsEditingName(false);
    setNameError(null);
    setDeletionStatus('idle');
    setDeletionError(null);
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

  const startEditingName = () => {
    if (state.status !== 'ready') {
      return;
    }
    setDraftDisplayName(state.me.user.displayName);
    setNameError(null);
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setNameError(null);
  };

  const saveDisplayName = async () => {
    if (state.status !== 'ready' || isSavingName) {
      return;
    }

    const currentMe = state.me;
    const validation = normalizeDisplayNameInput(draftDisplayName);
    if (!validation.valid) {
      setNameError(validation.message);
      return;
    }

    setNameError(null);
    setIsSavingName(true);
    setState({ status: 'ready', me: currentMe });
    try {
      const me = await updateDisplayNameWithRefresh(validation.value);
      setIsEditingName(false);
      setState({ status: 'ready', me, message: '이름이 수정되었어요.' });
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'error', message: '다시 로그인해주세요.' });
      } else if (error instanceof MobileAuthError && error.code === 'VALIDATION_ERROR') {
        setNameError('이름은 1~20자로 입력해주세요.');
        setState({ status: 'ready', me: currentMe });
      } else {
        setState({ status: 'ready', me: currentMe, message: '이름을 수정할 수 없어요. 다시 시도해주세요.' });
      }
    } finally {
      setIsSavingName(false);
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

  const requestAccountDeletion = () => {
    if (state.status !== 'ready') {
      return;
    }
    const flow = accountDeletionFlowRef.current;
    if (!flow || flow.isDeleting()) {
      return;
    }
    setDeletionError(null);
    setDeletionStatus(flow.requestConfirmation());
  };

  const cancelAccountDeletion = () => {
    const flow = accountDeletionFlowRef.current;
    if (!flow || flow.isDeleting()) {
      return;
    }
    setDeletionError(null);
    setDeletionStatus(flow.cancelConfirmation());
  };

  const confirmAccountDeletion = async () => {
    if (state.status !== 'ready') {
      return;
    }
    const flow = accountDeletionFlowRef.current;
    if (!flow || flow.isDeleting()) {
      return;
    }

    setDeletionError(null);
    setDeletionStatus('deleting');
    const result = await flow.confirmDeletion();
    setDeletionStatus(flow.getStatus());
    if (result.status === 'authError') {
      setState({ status: 'error', message: result.message });
      return;
    }
    if (result.status === 'retryableError') {
      setDeletionError(result.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>
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
          <View style={styles.nameSection}>
            <Text style={styles.sectionTitle}>내 이름</Text>
            {isEditingName ? (
              <>
                <Text style={styles.inputLabel}>이름</Text>
                <TextInput
                  accessibilityLabel="이름"
                  editable={!isSavingName}
                  onChangeText={setDraftDisplayName}
                  placeholder="이름"
                  placeholderTextColor={theme.color.textMuted}
                  style={styles.input}
                  value={draftDisplayName}
                />
                {nameError ? <Text style={styles.errorMessage}>{nameError}</Text> : null}
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSavingName}
                    onPress={() => void saveDisplayName()}
                    style={[styles.button, isSavingName ? styles.disabledButton : null]}
                  >
                    <Text style={styles.buttonText}>{isSavingName ? '저장 중...' : '저장'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSavingName}
                    onPress={cancelEditingName}
                    style={[styles.secondaryButton, isSavingName ? styles.disabledButton : null]}
                  >
                    <Text style={styles.secondaryButtonText}>취소</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.profileName}>{state.me.user.displayName}</Text>
                <Pressable accessibilityRole="button" onPress={startEditingName} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>이름 수정</Text>
                </Pressable>
              </>
            )}
          </View>

          <Text style={styles.message}>연결된 로그인: {state.me.linkedProviders.join(', ')}</Text>

          {providers.map((provider) => {
            const linked = state.me.linkedProviders.includes(provider.id);
            return (
              <Pressable
                accessibilityRole="button"
                disabled={linked}
                key={provider.id}
                onPress={() => void linkProvider(provider.id)}
                style={[styles.secondaryButton, linked ? styles.disabledButton : null]}
              >
                <Text style={styles.secondaryButtonText}>{provider.linkLabel(provider, linked)}</Text>
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

          <AccountDeletionSection
            error={deletionError}
            onCancel={cancelAccountDeletion}
            onConfirm={() => void confirmAccountDeletion()}
            onRequest={requestAccountDeletion}
            status={deletionStatus}
          />
        </View>
      ) : null}
    </ScrollView>
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
  screen: {
    backgroundColor: theme.color.bg,
  },
  container: {
    flexGrow: 1,
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
  nameSection: {
    alignItems: 'center',
    gap: theme.space[3],
    width: '100%',
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  profileName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  inputLabel: {
    alignSelf: 'stretch',
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
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
