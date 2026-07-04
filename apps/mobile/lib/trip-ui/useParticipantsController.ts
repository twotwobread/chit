import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import KakaoShareLink from 'react-native-kakao-share-link';

import { ApiError } from '@i-um/api-contract';

import { getMeWithRefresh, MobileAuthError } from '../auth/client';
import { apiErrorCode } from '../auth/errors';
import { createTripInvite, getTripDetail, listTripParticipants, removeTripParticipant } from '../trips/trip-api';
import {
  buildFallbackShareContent,
  buildInviteCopyText,
  buildKakaoInviteTemplate,
  canCreateTripInvite,
  getInviteActionErrorMessage,
  getKakaoShareFailureMessage,
  toInviteViewModel,
  type InviteViewModel,
} from '../trips/invite';
import {
  buildParticipantListViewModel,
  participantListFailureStatus,
  participantRemovalFailureMessage,
  participantRemovalFailureStatus,
  removeParticipantFromViewModel,
  type ParticipantListFailureStatus,
  type ParticipantListViewModel,
  type ParticipantRowViewModel,
} from '../trips/participants';

export type ParticipantsState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: ParticipantListViewModel; canInvite: boolean; tripName: string }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound' }
  | { status: 'error' };

export type InviteState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'ready'; viewModel: InviteViewModel }
  | { status: 'error'; message: string };

export type RemoveState =
  | { status: 'idle' }
  | { status: 'confirming'; participant: ParticipantRowViewModel }
  | { status: 'removing'; participant: ParticipantRowViewModel }
  | { status: 'error'; message: string };

export type ShareBusyState = 'none' | 'copy' | 'kakao' | 'fallback';

export function useParticipantsController() {
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
        viewModel: buildParticipantListViewModel(participantsResponse.participants, {
          canRemoveMembers: canManageParticipants,
        }),
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
        const code = apiErrorCode(error);
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

  const goHome = () => {
    router.replace('/');
  };

  const goLogin = () => {
    router.replace('/login');
  };

  return {
    cancelRemove,
    confirmRemove,
    copyInvite,
    createInvite,
    goHome,
    goLogin,
    inviteState,
    load,
    removeErrorMessage: removeState.status === 'error' ? removeState.message : null,
    removeState,
    removingParticipantId: removeState.status === 'removing' ? removeState.participant.participantId : null,
    requestRemove,
    shareBusy,
    shareFallback,
    shareMessage,
    shareToKakao,
    state,
  };
}

function setFailureState(setState: (state: ParticipantsState) => void, status: ParticipantListFailureStatus) {
  setState({ status });
}

function handleRemoveFailure(
  input: { httpStatus?: number; mobileAuthCode?: string },
  setState: (state: ParticipantsState) => void,
  setRemoveState: (state: RemoveState) => void,
) {
  const status = participantRemovalFailureStatus(input);
  if (status === 'auth') {
    setFailureState(setState, status);
    return;
  }
  setRemoveState({ status: 'error', message: participantRemovalFailureMessage(input) });
}
