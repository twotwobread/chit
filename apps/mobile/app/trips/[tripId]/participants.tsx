import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import KakaoShareLink from 'react-native-kakao-share-link';

import { ApiError } from '@i-um/api-contract';

import { getMeWithRefresh, MobileAuthError } from '../../../lib/auth/client';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../../lib/design';
import { createTripInvite, getTripDetail, listTripParticipants, removeTripParticipant } from '../../../lib/trips/client';
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
  buildParticipantListViewModel,
  participantListFailureStatus,
  participantRemovalFailureMessage,
  participantRemovalFailureStatus,
  removeParticipantFromViewModel,
  type ParticipantListFailureStatus,
  type ParticipantListViewModel,
  type ParticipantRowViewModel,
} from '../../../lib/trips/participants';

type ParticipantsState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: ParticipantListViewModel; canInvite: boolean; tripName: string }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound' }
  | { status: 'error' };

type InviteState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'ready'; viewModel: InviteViewModel }
  | { status: 'error'; message: string };

type RemoveState =
  | { status: 'idle' }
  | { status: 'confirming'; participant: ParticipantRowViewModel }
  | { status: 'removing'; participant: ParticipantRowViewModel }
  | { status: 'error'; message: string };

type ShareBusyState = 'none' | 'copy' | 'kakao' | 'fallback';

export default function TripParticipantsScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<ParticipantsState>({ status: 'loading' });
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'idle' });
  const [removeState, setRemoveState] = useState<RemoveState>({ status: 'idle' });
  const [shareBusy, setShareBusy] = useState<ShareBusyState>('none');
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    setInviteState({ status: 'idle' });
    setRemoveState({ status: 'idle' });
    setShareMessage(null);
    try {
      const [currentUser, participantsResponse, tripDetail] = await Promise.all([
        getMeWithRefresh(),
        listTripParticipants(tripId),
        getTripDetail(tripId),
      ]);
      const canManageParticipants = canCreateTripInvite(tripDetail, currentUser.user.id);
      setState({
        status: 'success',
        viewModel: buildParticipantListViewModel(participantsResponse.participants, { canRemoveMembers: canManageParticipants }),
        canInvite: canManageParticipants,
        tripName: tripDetail.trip.name,
      });
    } catch (error) {
      if (error instanceof MobileAuthError) {
        setFailureState(setState, participantListFailureStatus({ mobileAuthCode: error.code }));
        return;
      }
      if (error instanceof ApiError) {
        setFailureState(setState, participantListFailureStatus({ httpStatus: error.status }));
        return;
      }
      setState({ status: 'error' });
    }
  }, [tripId]);

  const createInvite = useCallback(async () => {
    if (!tripId) {
      return;
    }

    setInviteState({ status: 'creating' });
    setShareMessage(null);
    try {
      const response = await createTripInvite(tripId);
      setInviteState({ status: 'ready', viewModel: toInviteViewModel(response) });
    } catch (error) {
      if (error instanceof ApiError) {
        const code = getApiErrorCode(error);
        setInviteState({ status: 'error', message: getInviteActionErrorMessage(code ? { code } : error) });
        return;
      }
      if (error instanceof MobileAuthError) {
        setInviteState({ status: 'error', message: getInviteActionErrorMessage({ code: error.code }) });
        return;
      }
      setInviteState({ status: 'error', message: getInviteActionErrorMessage(error) });
    }
  }, [tripId]);

  const requestRemove = useCallback((participant: ParticipantRowViewModel) => {
    setRemoveState({ status: 'confirming', participant });
  }, []);

  const cancelRemove = useCallback(() => {
    setRemoveState((current) => (current.status === 'confirming' ? { status: 'idle' } : current));
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!tripId || removeState.status !== 'confirming') {
      return;
    }

    const target = removeState.participant;
    setRemoveState({ status: 'removing', participant: target });
    try {
      await removeTripParticipant(tripId, target.participantId);
      setState((current) => {
        if (current.status !== 'success') {
          return current;
        }
        return {
          ...current,
          viewModel: removeParticipantFromViewModel(current.viewModel, target.participantId),
        };
      });
      setRemoveState({ status: 'idle' });
    } catch (error) {
      if (error instanceof MobileAuthError) {
        handleRemoveFailure({ mobileAuthCode: error.code }, setState, setRemoveState);
        return;
      }
      if (error instanceof ApiError) {
        handleRemoveFailure({ httpStatus: error.status }, setState, setRemoveState);
        return;
      }
      setRemoveState({ status: 'error', message: participantRemovalFailureMessage({}) });
    }
  }, [removeState, tripId]);

  const copyInvite = useCallback(async (inviteUrl: string) => {
    setShareBusy('copy');
    setShareMessage(null);
    try {
      await Clipboard.setStringAsync(buildInviteCopyText(inviteUrl));
      setShareMessage('링크를 복사했어요.');
    } catch {
      setShareMessage('링크를 복사할 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setShareBusy('none');
    }
  }, []);

  const shareToKakao = useCallback(async (tripName: string, inviteUrl: string) => {
    setShareBusy('kakao');
    setShareMessage(null);
    try {
      await KakaoShareLink.sendText(buildKakaoInviteTemplate({ tripName, inviteUrl }));
    } catch {
      setShareMessage(getKakaoShareFailureMessage());
    } finally {
      setShareBusy('none');
    }
  }, []);

  const shareFallback = useCallback(async (tripName: string, inviteUrl: string) => {
    setShareBusy('fallback');
    try {
      await Share.share(buildFallbackShareContent({ tripName, inviteUrl }));
    } catch {
      setShareMessage('공유를 열 수 없어요. 링크 복사를 사용해보세요.');
    } finally {
      setShareBusy('none');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const removingParticipantId = removeState.status === 'removing' ? removeState.participant.participantId : null;
  const removeErrorMessage = removeState.status === 'error' ? removeState.message : null;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>참여자</Text>
      </View>

      {state.status === 'loading' ? (
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>참여자를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'success' ? (
        <>
          {state.canInvite ? (
            <InviteCard
              inviteState={inviteState}
              onCopy={(inviteUrl) => void copyInvite(inviteUrl)}
              onCreate={() => void createInvite()}
              onFallbackShare={(inviteUrl) => void shareFallback(state.tripName, inviteUrl)}
              onKakaoShare={(inviteUrl) => void shareToKakao(state.tripName, inviteUrl)}
              shareBusy={shareBusy}
              shareMessage={shareMessage}
            />
          ) : null}
          <ParticipantListCard
            onRequestRemove={requestRemove}
            removeErrorMessage={removeErrorMessage}
            removingParticipantId={removingParticipantId}
            viewModel={state.viewModel}
          />
          <RemoveParticipantConfirmationModal onCancel={cancelRemove} onConfirm={() => void confirmRemove()} removeState={removeState} />
        </>
      ) : null}

      {state.status === 'auth' ? (
        <Card>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
        </Card>
      ) : null}

      {state.status === 'invalid' ? (
        <Card>
          <Text style={styles.errorTitle}>잘못된 여행 주소예요.</Text>
          <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
        </Card>
      ) : null}

      {state.status === 'notFound' ? (
        <Card>
          <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
          <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <Text style={styles.errorTitle}>참여자 목록을 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <PrimaryButton label="다시 시도" onPress={() => void load()} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function setFailureState(setState: (state: ParticipantsState) => void, status: ParticipantListFailureStatus) {
  setState({ status });
}

function handleRemoveFailure(
  input: { httpStatus?: number; mobileAuthCode?: string },
  setState: (state: ParticipantsState) => void,
  setRemoveState: (state: RemoveState) => void,
) {
  if (participantRemovalFailureStatus(input) === 'auth') {
    setRemoveState({ status: 'idle' });
    setState({ status: 'auth' });
    return;
  }
  setRemoveState({ status: 'error', message: participantRemovalFailureMessage(input) });
}

function getApiErrorCode(error: ApiError): string | null {
  const body = error.body as { error?: { code?: string } } | undefined;
  return body?.error?.code ?? null;
}

function InviteCard({
  inviteState,
  onCopy,
  onCreate,
  onFallbackShare,
  onKakaoShare,
  shareBusy,
  shareMessage,
}: {
  inviteState: InviteState;
  onCopy: (inviteUrl: string) => void;
  onCreate: () => void;
  onFallbackShare: (inviteUrl: string) => void;
  onKakaoShare: (inviteUrl: string) => void;
  shareBusy: ShareBusyState;
  shareMessage: string | null;
}) {
  const viewModel = inviteState.status === 'ready' ? inviteState.viewModel : null;
  const busy = inviteState.status === 'creating' || shareBusy !== 'none';
  const shareMessageStyle = shareMessage === '링크를 복사했어요.' ? styles.successMessage : styles.errorMessage;

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>초대 링크</Text>
        <Text style={styles.message}>동행자에게 보낼 링크를 만들 수 있어요.</Text>
      </View>

      {inviteState.status === 'error' ? <Text style={styles.errorMessage}>{inviteState.message}</Text> : null}

      {viewModel ? (
        <View style={styles.inviteResult}>
          <Text style={styles.successMessage}>{viewModel.statusLabel}</Text>
          <Text style={styles.inviteUrl} numberOfLines={2} selectable>
            {viewModel.inviteUrl}
          </Text>
          <Text style={styles.message}>{viewModel.expiryLabel}</Text>
        </View>
      ) : null}

      {shareMessage ? <Text style={shareMessageStyle}>{shareMessage}</Text> : null}

      {viewModel ? (
        <View style={styles.buttonStack}>
          <PrimaryButton
            disabled={busy}
            label="카카오톡으로 공유"
            loading={shareBusy === 'kakao'}
            loadingLabel="카카오톡 여는 중..."
            onPress={() => onKakaoShare(viewModel.inviteUrl)}
          />
          <SecondaryButton disabled={busy} label="링크 복사" onPress={() => onCopy(viewModel.inviteUrl)} />
          {shareMessage === getKakaoShareFailureMessage() ? (
            <SecondaryButton disabled={busy} label="다른 앱으로 공유" onPress={() => onFallbackShare(viewModel.inviteUrl)} />
          ) : null}
        </View>
      ) : (
        <PrimaryButton
          disabled={busy}
          label="초대 링크 만들기"
          loading={inviteState.status === 'creating'}
          loadingLabel="초대 링크 만드는 중..."
          onPress={onCreate}
        />
      )}
    </Card>
  );
}

function ParticipantListCard({
  onRequestRemove,
  removeErrorMessage,
  removingParticipantId,
  viewModel,
}: {
  onRequestRemove: (participant: ParticipantRowViewModel) => void;
  removeErrorMessage: string | null;
  removingParticipantId: string | null;
  viewModel: ParticipantListViewModel;
}) {
  return (
    <Card>
      {removeErrorMessage ? <Text style={styles.errorMessage}>{removeErrorMessage}</Text> : null}
      {removingParticipantId ? <Text style={styles.message}>참여자를 제거하는 중...</Text> : null}
      <View style={styles.participantList}>
        {viewModel.rows.map((participant) => {
          const isRemoving = removingParticipantId === participant.participantId;
          return (
            <View key={participant.participantId} style={styles.participantRow}>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{participant.displayName}</Text>
                <View style={participant.role === 'owner' ? styles.ownerBadge : styles.memberBadge}>
                  <Text style={participant.role === 'owner' ? styles.ownerBadgeText : styles.memberBadgeText}>{participant.roleLabel}</Text>
                </View>
              </View>
              {participant.canRemove ? (
                <Pressable
                  accessibilityLabel={`${participant.displayName} 참여자 제거`}
                  accessibilityRole="button"
                  disabled={Boolean(removingParticipantId)}
                  onPress={() => onRequestRemove(participant)}
                  style={[styles.removeButton, isRemoving || removingParticipantId ? styles.disabled : null]}
                >
                  <Text style={styles.removeButtonText}>제거</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function RemoveParticipantConfirmationModal({
  onCancel,
  onConfirm,
  removeState,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  removeState: RemoveState;
}) {
  const participant = removeState.status === 'confirming' || removeState.status === 'removing' ? removeState.participant : null;
  const isRemoving = removeState.status === 'removing';

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={participant !== null}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{participant ? `${participant.displayName}님을 여행에서 제거할까요?` : '참여자를 제거할까요?'}</Text>
          <Text style={styles.message}>제거되면 이 여행 목록과 일정에 더 이상 접근할 수 없어요. 다시 초대하면 재참여할 수 있어요.</Text>
          <View style={styles.actionRow}>
            <SecondaryButton disabled={isRemoving} label="취소" onPress={onCancel} style={styles.modalActionButton} />
            <Pressable
              accessibilityRole="button"
              disabled={isRemoving}
              onPress={onConfirm}
              style={[styles.dangerButton, styles.modalActionButton, isRemoving ? styles.disabled : null]}
            >
              {isRemoving ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.color.onPrimary} />
                  <Text style={styles.dangerButtonText}>참여자를 제거하는 중...</Text>
                </View>
              ) : (
                <Text style={styles.dangerButtonText}>제거하기</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[5],
    justifyContent: 'center',
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  sectionHeader: {
    gap: theme.space[2],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  inviteResult: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  inviteUrl: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  buttonStack: {
    gap: theme.space[3],
  },
  participantList: {
    gap: theme.space[3],
  },
  participantRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  participantInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  participantName: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  ownerBadge: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  memberBadge: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  ownerBadgeText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  memberBadgeText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  removeButton: {
    alignItems: 'center',
    borderColor: theme.color.danger,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  removeButtonText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  modalCard: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[5],
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  modalTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  modalActionButton: {
    flex: 1,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  dangerButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  disabled: {
    opacity: 0.5,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  successMessage: {
    color: theme.color.success,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
