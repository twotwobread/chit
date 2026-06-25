import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../lib/design';
import { acceptTripInvite } from '../../lib/trips/client';
import {
  buildInviteInvalidViewModel,
  buildInviteLoginRequiredViewModel,
  getInviteAcceptErrorViewModel,
  isInviteTokenFormatValid,
  toInviteAcceptViewModel,
  type InviteAcceptAction,
  type InviteAcceptViewModel,
} from '../../lib/trips/invite';
import { setPendingInviteLoginHandoffForToken } from '../../lib/trips/invite-login-handoff';
import { tripDetailPath } from '../../lib/trips/mypage';

type InviteAcceptScreenState = { status: 'loading' } | { status: 'ready'; viewModel: InviteAcceptViewModel };

export default function InviteAcceptScreen() {
  const params = useLocalSearchParams();
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const hasUnsafeHandoffParams = Object.keys(params).some((key) => key !== 'token');
  const [state, setState] = useState<InviteAcceptScreenState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (!isInviteTokenFormatValid(normalizedToken)) {
      setState({ status: 'ready', viewModel: buildInviteInvalidViewModel() });
      return;
    }

    const stored = await readStoredSession();
    if (stored.status === 'missing' || stored.status === 'corrupt') {
      setState({ status: 'ready', viewModel: buildInviteLoginRequiredViewModel() });
      return;
    }

    try {
      const response = await acceptTripInvite(normalizedToken);
      setState({ status: 'ready', viewModel: toInviteAcceptViewModel(response) });
    } catch (error) {
      if (isAuthFailure(error)) {
        await clearStoredSession();
      }
      setState({ status: 'ready', viewModel: getInviteAcceptErrorViewModel(error) });
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const runAction = useCallback(
    (action: InviteAcceptAction, viewModel: InviteAcceptViewModel) => {
      if (action === 'retry') {
        void load();
        return;
      }
      if (action === 'login') {
        const normalizedToken = typeof token === 'string' ? token.trim() : '';
        const handoff = hasUnsafeHandoffParams ? null : setPendingInviteLoginHandoffForToken(normalizedToken);
        if (!handoff) {
          setState({ status: 'ready', viewModel: buildInviteInvalidViewModel() });
          return;
        }
        router.replace('/login');
        return;
      }
      if (action === 'viewTrip' && viewModel.tripId) {
        router.replace(tripDetailPath(viewModel.tripId));
        return;
      }
      router.replace('/');
    },
    [hasUnsafeHandoffParams, load, token],
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <Card>
        {state.status === 'loading' ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>초대 링크를 확인하고 있어요.</Text>
          </View>
        ) : (
          <InviteAcceptResult onAction={runAction} viewModel={state.viewModel} />
        )}
      </Card>
    </ScrollView>
  );
}

function InviteAcceptResult({
  onAction,
  viewModel,
}: {
  onAction: (action: InviteAcceptAction, viewModel: InviteAcceptViewModel) => void;
  viewModel: InviteAcceptViewModel;
}) {
  return (
    <>
      <Text style={styles.title}>{viewModel.title}</Text>
      <Text style={styles.message}>{viewModel.message}</Text>
      <View style={styles.actionGroup}>
        <PrimaryButton label={viewModel.primaryLabel} onPress={() => onAction(viewModel.primaryAction, viewModel)} />
        {viewModel.secondaryAction && viewModel.secondaryLabel ? (
          <SecondaryButton
            label={viewModel.secondaryLabel}
            onPress={() => onAction(viewModel.secondaryAction!, viewModel)}
          />
        ) : null}
      </View>
    </>
  );
}

function isAuthFailure(error: unknown): boolean {
  if (error instanceof MobileAuthError) {
    return error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED';
  }
  return error instanceof ApiError && error.status === 401;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  centeredContent: {
    alignItems: 'center',
    gap: theme.space[4],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  actionGroup: {
    gap: theme.space[3],
  },
});
