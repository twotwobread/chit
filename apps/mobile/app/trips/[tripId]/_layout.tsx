import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import KakaoShareLink from 'react-native-kakao-share-link';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, type TripListItem } from '@i-um/api-contract';

import { getMeWithRefresh, MobileAuthError } from '../../../lib/auth/client';
import { theme } from '../../../lib/design';
import { AppBar } from '../../../lib/trip-ui/AppBar';
import { CompanionsSheet } from '../../../lib/trip-ui/CompanionsSheet';
import { TripSwitcherSheet } from '../../../lib/trip-ui/TripSwitcherSheet';
import {
  createTripInvite,
  getTripDetail,
  listMyTrips,
  listTripParticipants,
  removeTripParticipant,
} from '../../../lib/trips/client';
import { markExplicitHomeIntent } from '../../../lib/trips/home-intent';
import {
  buildFallbackShareContent,
  buildInviteCopyText,
  buildKakaoInviteTemplate,
  canCreateTripInvite,
  getInviteActionErrorMessage,
  getKakaoShareFailureMessage,
  toInviteViewModel,
  type InviteViewModel,
} from '../../../lib/trips/invite';
import {
  buildCompanionSheetParticipants,
  buildParticipantListViewModel,
  participantListFailureStatus,
  participantRemovalFailureMessage,
  removeParticipantFromViewModel,
  type ParticipantListViewModel,
} from '../../../lib/trips/participants';
import { isTripRootTabPath, tripFallbackPathForPathname, tripTodayPath } from '../../../lib/trips/routes';
import { TripShellProvider, type TripShellState } from '../../../lib/trips/trip-shell-context';
import { buildSwitchableTrips, buildTripAppBarMembers } from '../../../lib/trips/trip-tabs';

type CompanionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'success';
      viewModel: ParticipantListViewModel;
      canManage: boolean;
      currentUserId: string;
      tripName: string;
    }
  | { status: 'auth' | 'invalid' | 'notFound' | 'error'; message: string };

type CompanionsInviteState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'ready'; viewModel: InviteViewModel }
  | { status: 'error'; message: string };

type CompanionsShareBusyState = 'none' | 'copy' | 'kakao' | 'fallback';

export default function TripLayout() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [companionsOpen, setCompanionsOpen] = useState(false);
  const [companionsState, setCompanionsState] = useState<CompanionsState>({ status: 'idle' });
  const [companionsInviteState, setCompanionsInviteState] = useState<CompanionsInviteState>({ status: 'idle' });
  const [companionsShareBusy, setCompanionsShareBusy] = useState<CompanionsShareBusyState>('none');
  const [companionsFeedback, setCompanionsFeedback] = useState<string | null>(null);
  const [removingCompanionId, setRemovingCompanionId] = useState<string | null>(null);
  const [shellState, setShellState] = useState<TripShellState>({ status: 'loading', tripId: tripId ?? '' });
  const [switchableTrips, setSwitchableTrips] = useState<TripListItem[]>([]);

  const loadShell = useCallback(async () => {
    if (!tripId) {
      setShellState({ status: 'notFound', tripId: '' });
      setSwitchableTrips([]);
      return;
    }

    setShellState({ status: 'loading', tripId });
    const [detailResult, tripsResult] = await Promise.allSettled([getTripDetail(tripId), listMyTrips()]);

    if (tripsResult.status === 'fulfilled') {
      setSwitchableTrips(tripsResult.value.trips);
    } else {
      setSwitchableTrips([]);
    }

    if (detailResult.status === 'fulfilled') {
      setShellState({ status: 'success', tripId, detail: detailResult.value });
      return;
    }

    setShellState(shellFailureState(tripId, detailResult.reason));
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadShell();
    }, [loadShell]),
  );

  const refreshShellDetail = useCallback(async () => {
    if (!tripId) {
      return;
    }

    try {
      const detail = await getTripDetail(tripId);
      setShellState((current) => (current.tripId === tripId ? { status: 'success', tripId, detail } : current));
    } catch {
      // Keep the current shell state; the next focus reload will surface any persistent failure.
    }
  }, [tripId]);

  const loadCompanions = useCallback(async () => {
    if (!tripId) {
      setCompanionsState({ status: 'invalid', message: '여행 정보를 확인할 수 없어요.' });
      return;
    }

    setCompanionsState({ status: 'loading' });
    setCompanionsInviteState({ status: 'idle' });
    setCompanionsFeedback(null);
    setRemovingCompanionId(null);

    try {
      const shellDetail = shellState.status === 'success' && shellState.tripId === tripId ? shellState.detail : null;
      const [currentUser, participantsResponse, detail] = await Promise.all([
        getMeWithRefresh(),
        listTripParticipants(tripId),
        shellDetail ? Promise.resolve(shellDetail) : getTripDetail(tripId),
      ]);
      const canManage = canCreateTripInvite(detail, currentUser.user.id);
      setCompanionsState({
        status: 'success',
        canManage,
        currentUserId: currentUser.user.id,
        tripName: detail.trip.name.trim() || '여행',
        viewModel: buildParticipantListViewModel(participantsResponse.participants, {
          canRemoveMembers: canManage,
        }),
      });
    } catch (error) {
      if (error instanceof MobileAuthError) {
        setCompanionsState(companionFailureState(participantListFailureStatus({ mobileAuthCode: error.code })));
        return;
      }
      if (error instanceof ApiError) {
        setCompanionsState(companionFailureState(participantListFailureStatus({ httpStatus: error.status })));
        return;
      }
      setCompanionsState(companionFailureState('error'));
    }
  }, [shellState, tripId]);

  const openCompanions = useCallback(() => {
    setCompanionsOpen(true);
    void loadCompanions();
  }, [loadCompanions]);

  const createCompanionInvite = useCallback(async () => {
    if (!tripId) {
      return;
    }

    setCompanionsInviteState({ status: 'creating' });
    setCompanionsFeedback(null);
    try {
      const response = await createTripInvite(tripId);
      setCompanionsInviteState({ status: 'ready', viewModel: toInviteViewModel(response) });
    } catch (error) {
      if (error instanceof ApiError) {
        const code = getApiErrorCode(error);
        setCompanionsInviteState({ status: 'error', message: getInviteActionErrorMessage(code ? { code } : error) });
        return;
      }
      if (error instanceof MobileAuthError) {
        setCompanionsInviteState({ status: 'error', message: getInviteActionErrorMessage({ code: error.code }) });
        return;
      }
      setCompanionsInviteState({ status: 'error', message: getInviteActionErrorMessage(error) });
    }
  }, [tripId]);

  const copyCompanionInvite = useCallback(async (inviteUrl: string) => {
    setCompanionsShareBusy('copy');
    setCompanionsFeedback(null);
    try {
      await Clipboard.setStringAsync(buildInviteCopyText(inviteUrl));
      setCompanionsFeedback('링크를 복사했어요.');
    } catch {
      setCompanionsFeedback('링크를 복사할 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setCompanionsShareBusy('none');
    }
  }, []);

  const shareCompanionToKakao = useCallback(async (tripName: string, inviteUrl: string) => {
    setCompanionsShareBusy('kakao');
    setCompanionsFeedback(null);
    try {
      await KakaoShareLink.sendText(buildKakaoInviteTemplate({ tripName, inviteUrl }));
    } catch {
      setCompanionsFeedback(getKakaoShareFailureMessage());
    } finally {
      setCompanionsShareBusy('none');
    }
  }, []);

  const shareCompanionFallback = useCallback(async (tripName: string, inviteUrl: string) => {
    setCompanionsShareBusy('fallback');
    setCompanionsFeedback(null);
    try {
      await Share.share(buildFallbackShareContent({ tripName, inviteUrl }));
    } catch {
      setCompanionsFeedback('공유를 열 수 없어요. 링크 복사를 사용해보세요.');
    } finally {
      setCompanionsShareBusy('none');
    }
  }, []);

  const confirmRemoveCompanion = useCallback(
    async (participantId: string, participantName: string) => {
      if (!tripId) {
        return;
      }

      setRemovingCompanionId(participantId);
      setCompanionsFeedback(null);
      try {
        await removeTripParticipant(tripId, participantId);
        setCompanionsState((current) => {
          if (current.status !== 'success') {
            return current;
          }
          return {
            ...current,
            viewModel: removeParticipantFromViewModel(current.viewModel, participantId),
          };
        });
        setCompanionsFeedback(`${participantName}님을 내보냈어요.`);
        void refreshShellDetail();
      } catch (error) {
        if (error instanceof MobileAuthError) {
          setCompanionsFeedback(participantRemovalFailureMessage({ mobileAuthCode: error.code }));
        } else if (error instanceof ApiError) {
          setCompanionsFeedback(participantRemovalFailureMessage({ httpStatus: error.status }));
        } else {
          setCompanionsFeedback(participantRemovalFailureMessage({}));
        }
      } finally {
        setRemovingCompanionId(null);
      }
    },
    [refreshShellDetail, tripId],
  );

  const requestRemoveCompanion = useCallback(
    (participantId: string) => {
      if (companionsState.status !== 'success') {
        return;
      }
      const participant = companionsState.viewModel.rows.find((row) => row.participantId === participantId);
      if (!participant || !participant.canRemove) {
        return;
      }

      Alert.alert('동행자를 내보낼까요?', `${participant.displayName}님을 이 여행에서 내보냅니다.`, [
        { text: '취소', style: 'cancel' },
        {
          text: '내보내기',
          onPress: () => void confirmRemoveCompanion(participant.participantId, participant.displayName),
          style: 'destructive',
        },
      ]);
    },
    [companionsState, confirmRemoveCompanion],
  );

  const detail = shellState.status === 'success' ? shellState.detail : null;
  const tripName = detail?.trip.name.trim() || '여행';
  const selectedTripId = detail?.trip.id ?? tripId ?? '';
  const tripsForSheet = buildSwitchableTrips(switchableTrips, selectedTripId);
  const isRootTripTab = tripId ? isTripRootTabPath(pathname, tripId) : false;
  const companionsSuccess = companionsState.status === 'success' ? companionsState : null;
  const companionParticipants = companionsSuccess
    ? buildCompanionSheetParticipants(companionsSuccess.viewModel, companionsSuccess.currentUserId)
    : [];
  const companionInviteViewModel = companionsInviteState.status === 'ready' ? companionsInviteState.viewModel : null;
  const companionInviteStatusLabel = companionInviteStatus(companionsInviteState);
  const companionInviteFeedback =
    companionsInviteState.status === 'error'
      ? companionsInviteState.message
      : (companionsFeedback ?? companionShareBusyLabel(companionsShareBusy));
  const companionErrorMessage = companionFailureMessage(companionsState);

  const handleBack = useCallback(() => {
    if (!tripId) {
      markExplicitHomeIntent();
      router.replace('/');
      return;
    }

    if (isRootTripTab || pathname.split('?')[0] === `/trips/${tripId}/detail`) {
      markExplicitHomeIntent();
      router.replace('/');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(tripFallbackPathForPathname(pathname, tripId));
  }, [isRootTripTab, pathname, tripId]);

  return (
    <TripShellProvider value={shellState}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppBar
          leadingAction={isRootTripTab ? 'home' : 'back'}
          members={buildTripAppBarMembers(detail)}
          onBack={handleBack}
          onPressMembers={detail ? openCompanions : undefined}
          onPressTitle={() => setSwitcherOpen(true)}
          tripName={tripName}
        />

        <View style={styles.navigator}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: theme.color.bg }, headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="detail" />
            <Stack.Screen name="edit" />
            <Stack.Screen name="participants" />
            <Stack.Screen name="days/[date]" />
            <Stack.Screen name="days/[date]/place-search" />
            <Stack.Screen name="days/[date]/places/new" />
            <Stack.Screen name="days/[date]/expenses/quick" />
          </Stack>
        </View>

        <TripSwitcherSheet
          hrefForTrip={(nextTripId): Href => tripTodayPath(nextTripId)}
          onClose={() => setSwitcherOpen(false)}
          trips={tripsForSheet}
          visible={switcherOpen}
        />

        <CompanionsSheet
          actionBusy={companionsInviteState.status === 'creating' || companionsShareBusy !== 'none'}
          canManage={Boolean(companionsSuccess?.canManage)}
          errorMessage={companionErrorMessage}
          expiryLabel={companionInviteViewModel?.expiryLabel}
          feedbackMessage={companionInviteFeedback}
          inviteStatusLabel={companionInviteStatusLabel}
          inviteUrl={companionInviteViewModel?.inviteUrl}
          loading={companionsState.status === 'loading'}
          onClose={() => setCompanionsOpen(false)}
          onCopyInvite={
            companionInviteViewModel ? () => void copyCompanionInvite(companionInviteViewModel.inviteUrl) : undefined
          }
          onCreateInvite={companionsSuccess?.canManage ? () => void createCompanionInvite() : undefined}
          onFallbackShare={
            companionInviteViewModel && companionsSuccess
              ? () => void shareCompanionFallback(companionsSuccess.tripName, companionInviteViewModel.inviteUrl)
              : undefined
          }
          onKakaoShare={
            companionInviteViewModel && companionsSuccess
              ? () => void shareCompanionToKakao(companionsSuccess.tripName, companionInviteViewModel.inviteUrl)
              : undefined
          }
          onRemoveParticipant={requestRemoveCompanion}
          onRetry={() => void loadCompanions()}
          participants={companionParticipants}
          removingParticipantId={removingCompanionId}
          visible={companionsOpen}
        />
      </View>
    </TripShellProvider>
  );
}

function shellFailureState(tripId: string, error: unknown): TripShellState {
  if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
    return { status: 'auth', tripId };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth', tripId };
    }
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return { status: 'notFound', tripId };
    }
  }
  return { status: 'error', tripId };
}

function companionFailureState(
  status: Exclude<CompanionsState['status'], 'idle' | 'loading' | 'success'>,
): CompanionsState {
  switch (status) {
    case 'auth':
      return { status, message: '다시 로그인해주세요.' };
    case 'invalid':
      return { status, message: '잘못된 여행 주소예요.' };
    case 'notFound':
      return { status, message: '삭제되었거나 접근할 수 없는 여행이에요.' };
    case 'error':
      return { status, message: '잠시 후 다시 시도해주세요.' };
    default: {
      const exhaustive: never = status;
      throw new Error(`Unsupported companions failure status: ${exhaustive}`);
    }
  }
}

function companionFailureMessage(state: CompanionsState): string | null {
  if (
    state.status === 'auth' ||
    state.status === 'invalid' ||
    state.status === 'notFound' ||
    state.status === 'error'
  ) {
    return state.message;
  }
  return null;
}

function companionInviteStatus(state: CompanionsInviteState): string | undefined {
  switch (state.status) {
    case 'creating':
      return '초대 링크를 만드는 중...';
    case 'ready':
      return state.viewModel.statusLabel;
    case 'idle':
    case 'error':
      return undefined;
    default: {
      const exhaustive: never = state;
      throw new Error(`Unsupported invite state: ${String(exhaustive)}`);
    }
  }
}

function companionShareBusyLabel(state: CompanionsShareBusyState): string | null {
  switch (state) {
    case 'copy':
      return '링크를 복사하는 중...';
    case 'kakao':
      return '카카오톡을 여는 중...';
    case 'fallback':
      return '공유를 여는 중...';
    case 'none':
      return null;
    default: {
      const exhaustive: never = state;
      throw new Error(`Unsupported share state: ${exhaustive}`);
    }
  }
}

function getApiErrorCode(error: ApiError): string | null {
  const body = error.body as { error?: { code?: string } } | undefined;
  return body?.error?.code ?? null;
}

const styles = StyleSheet.create({
  navigator: {
    flex: 1,
  },
  root: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
});
