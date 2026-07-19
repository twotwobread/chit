import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import type { AuthMeResponse, AuthProvider } from '@i-um/api-contract';

import { AccountDeletionSection } from '../lib/auth/account-deletion-section';
import {
  createAccountDeletionFlow,
  type AccountDeletionFlow,
  type AccountDeletionStatus,
} from '../lib/auth/account-deletion-flow';
import {
  deleteAccountWithRefresh,
  getMeWithRefresh,
  linkOAuthProvider,
  logoutCurrentSession,
  MobileAuthError,
  updateDisplayNameWithRefresh,
} from '../lib/auth/client';
import { normalizeDisplayNameInput } from '../lib/auth/display-name';
import { createLogoutFlow, type LogoutFlow } from '../lib/auth/logout-flow';
import { getOAuthCredential, getVisibleOAuthProviderConfigs } from '../lib/auth/oauth';
import { ProfileCard, SettingRow, SettingsList, type AccountProvider } from '../lib/account-ui/AccountRows';
import { Card, PrimaryButton, ScreenBackground, SecondaryButton, theme } from '../lib/design';
import { KeyboardAwareFormScrollView } from '../lib/trip-ui/KeyboardAwareFormScrollView';

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
      setState({ status: 'ready', me, message: '로그인 방법이 연결되었어요.' });
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
    <ScreenBackground>
      <KeyboardAwareFormScrollView contentContainerStyle={styles.container} style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>계정</Text>
          <Text style={styles.subtitle}>로그인 방법과 내 정보를 한눈에 확인해요.</Text>
        </View>

        {state.status === 'loading' ? (
          <Card>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>계정 정보를 확인 중이에요.</Text>
          </Card>
        ) : null}

        {state.status === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>{state.message}</Text>
            <Text style={styles.message}>계정 설정을 보려면 로그인이 필요해요.</Text>
            <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
          </Card>
        ) : null}

        {state.status === 'ready' ? (
          <View style={styles.readyStack}>
            <ProfileCard
              helperLabel={linkedProvidersSummary(state.me.linkedProviders)}
              name={state.me.user.displayName}
              onEdit={startEditingName}
              provider={primaryAccountProvider(state.me.linkedProviders)}
            />

            {isEditingName ? (
              <Card style={styles.formCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>내 이름 수정</Text>
                  <Text style={styles.helperText}>여행 참여자와 정산 화면에 표시되는 이름이에요.</Text>
                </View>
                <View style={styles.fieldGroup}>
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
                </View>
                <View style={styles.actionRow}>
                  <PrimaryButton
                    disabled={isSavingName}
                    label="저장"
                    loading={isSavingName}
                    loadingLabel="저장 중..."
                    onPress={() => void saveDisplayName()}
                    style={styles.actionButton}
                  />
                  <SecondaryButton
                    disabled={isSavingName}
                    label="취소"
                    onPress={cancelEditingName}
                    style={styles.actionButton}
                  />
                </View>
              </Card>
            ) : null}

            {state.message ? (
              <Card style={styles.noticeCard}>
                <Text accessibilityLiveRegion="polite" style={styles.message}>
                  {state.message}
                </Text>
              </Card>
            ) : null}

            <SettingsList title="로그인 방법">
              {providers.map((provider, index) => {
                const linked = state.me.linkedProviders.includes(provider.id);
                return (
                  <SettingRow
                    affordance={linked ? '연결됨' : '연결하기'}
                    disabled={linked}
                    first={index === 0}
                    key={provider.id}
                    label={provider.linkLabel(provider, linked)}
                    onPress={linked ? () => undefined : () => void linkProvider(provider.id)}
                  />
                );
              })}
            </SettingsList>

            <SettingsList title="계정 작업">
              <SettingRow first label="이전 화면" onPress={() => router.back()} />
              <SettingRow
                affordance={isLoggingOut ? '진행 중' : '로그아웃'}
                disabled={isLoggingOut}
                label="로그아웃"
                onPress={() => void logout()}
              />
            </SettingsList>

            <AccountDeletionSection
              error={deletionError}
              onCancel={cancelAccountDeletion}
              onConfirm={() => void confirmAccountDeletion()}
              onRequest={requestAccountDeletion}
              status={deletionStatus}
            />
          </View>
        ) : null}
      </KeyboardAwareFormScrollView>
    </ScreenBackground>
  );
}

function primaryAccountProvider(linkedProviders: AuthProvider[]): AccountProvider {
  if (linkedProviders.includes('apple')) {
    return 'apple';
  }
  return 'kakao';
}

function linkedProvidersSummary(linkedProviders: AuthProvider[]): string {
  if (linkedProviders.length === 0) {
    return '연결된 로그인 방법이 없어요.';
  }
  return `연결된 로그인 ${linkedProviders.map(providerLabel).join(' · ')}`;
}

function providerLabel(provider: AuthProvider): string {
  if (provider === 'apple') {
    return 'Apple';
  }
  if (provider === 'kakao') {
    return '카카오';
  }
  return provider;
}

function linkErrorMessage(error: unknown): string {
  if (error instanceof MobileAuthError) {
    if (error.code === 'PROVIDER_ALREADY_LINKED') {
      return '이미 다른 계정에 연결된 로그인 방법이에요.';
    }
    if (error.code === 'INVALID_PROVIDER_TOKEN') {
      return '로그인 정보를 확인할 수 없어요. 다시 시도해주세요.';
    }
  }
  return '로그인 방법 연결에 실패했어요. 잠시 후 다시 시도해주세요.';
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[5],
    padding: theme.space[5],
    paddingBottom: theme.space[8],
    paddingTop: theme.space[7],
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  eyebrow: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  formCard: {
    maxWidth: theme.layout.cardMaxW,
  },
  header: {
    gap: theme.space[2],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  input: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  inputLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  noticeCard: {
    paddingVertical: theme.space[4],
  },
  readyStack: {
    alignItems: 'center',
    gap: theme.space[5],
    width: '100%',
  },
  screen: {
    flex: 1,
  },
  sectionHeader: {
    gap: theme.space[2],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  title: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
