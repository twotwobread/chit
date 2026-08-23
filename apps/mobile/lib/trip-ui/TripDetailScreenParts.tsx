import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { type GetTripDetailResponse, type TripParticipantListItem } from '@i-um/api-contract';

import { apiErrorStatus, isMobileAuthSessionError } from '../auth/errors';
import { Badge, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  beginTripDelete,
  cancelTripDelete,
  deleteTripFailureState,
  openTripDeleteConfirmation,
  type TripDeleteState,
} from '../trips/delete-flow';
import { formatTripDayDate } from '../trips/days';
import { buildTripDetailPrimaryAction } from '../trips/trip-detail';
import { deleteTrip } from '../trips/trip-api';
import { styles } from './TripDetailScreenStyles';

export function TripDetailCard({
  currentUserId,
  detail,
  participants,
  participantsLoadFailed,
}: {
  currentUserId?: string;
  detail: GetTripDetailResponse;
  participants: TripParticipantListItem[];
  participantsLoadFailed: boolean;
}) {
  const canManage = currentUserId === detail.trip.createdBy;
  const primaryAction = buildTripDetailPrimaryAction(detail.trip.id);
  const [deleteState, setDeleteState] = useState<TripDeleteState>({ status: 'idle' });
  const deletingRef = useRef(false);

  const confirmDelete = async () => {
    const nextState = beginTripDelete(deleteState);
    if (nextState.status !== 'deleting' || deletingRef.current) {
      return;
    }

    deletingRef.current = true;
    setDeleteState(nextState);
    try {
      await deleteTrip(detail.trip.id);
      router.replace('/mypage');
    } catch (error) {
      if (isMobileAuthSessionError(error)) {
        setDeleteState(deleteTripFailureState(401));
        return;
      }
      const status = apiErrorStatus(error);
      if (typeof status === 'number') {
        setDeleteState(deleteTripFailureState(status));
        return;
      }
      setDeleteState(deleteTripFailureState());
    } finally {
      deletingRef.current = false;
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.tripName}>{detail.trip.name}</Text>
      <View style={styles.infoList}>
        <InfoRow
          label="기간"
          value={`${formatTripDayDate(detail.trip.startDate)} ~ ${formatTripDayDate(detail.trip.endDate)}`}
        />
        <InfoRow label="기본 통화" value={detail.trip.defaultCurrency} />
        <InfoRow label="참여자" value={`참여자 ${detail.participantSummary.totalCount}명`} />
      </View>
      <ParticipantSection
        fallbackSummary={detail.participantSummary}
        loadFailed={participantsLoadFailed}
        participants={participants}
      />
      <PrimaryButton label={primaryAction.label} onPress={() => router.push(primaryAction.route)} />
      {canManage ? (
        <>
          <SecondaryButton label="여행 정보 수정" onPress={() => router.push(`/trips/${detail.trip.id}/edit`)} />
          {deleteState.status === 'idle' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setDeleteState(openTripDeleteConfirmation(deleteState))}
              style={styles.dangerOutlineButton}
            >
              <Text style={styles.dangerOutlineButtonText}>여행 삭제</Text>
            </Pressable>
          ) : null}
          <Modal
            animationType="fade"
            onRequestClose={() => setDeleteState(cancelTripDelete(deleteState))}
            transparent
            visible={deleteState.status === 'confirming'}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.deleteTitle}>여행을 삭제할까요?</Text>
                <Text style={styles.message}>이 여행은 모든 참여자에게서 삭제되고 되돌릴 수 없어요.</Text>
                <View style={styles.actionRow}>
                  <SecondaryButton
                    label="취소"
                    onPress={() => setDeleteState(cancelTripDelete(deleteState))}
                    style={styles.secondaryActionButton}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void confirmDelete()}
                    style={styles.dangerButton}
                  >
                    <Text style={styles.buttonText}>삭제하기</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          {deleteState.status === 'deleting' ? (
            <View style={styles.dangerPanel}>
              <ActivityIndicator color={theme.color.danger} />
              <Text style={styles.message}>여행을 삭제하는 중...</Text>
            </View>
          ) : null}
          {deleteState.status === 'auth' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
            </View>
          ) : null}
          {deleteState.status === 'safeFailure' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <PrimaryButton label="마이페이지로" onPress={() => router.replace('/mypage')} />
            </View>
          ) : null}
          {deleteState.status === 'error' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <SecondaryButton
                label="다시 시도"
                onPress={() => setDeleteState(openTripDeleteConfirmation(deleteState))}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ParticipantSection({
  fallbackSummary,
  loadFailed,
  participants,
}: {
  fallbackSummary: GetTripDetailResponse['participantSummary'];
  loadFailed: boolean;
  participants: TripParticipantListItem[];
}) {
  const rows = participants.length > 0 ? participants : fallbackParticipants(fallbackSummary);

  return (
    <View style={styles.participantSection}>
      <View style={styles.participantSectionHeader}>
        <Text style={styles.sectionTitle}>참여자</Text>
        <Text style={styles.sectionHelper}>
          {loadFailed ? '전체 참여자 목록을 불러오지 못해 요약 정보를 보여줘요.' : `총 ${fallbackSummary.totalCount}명`}
        </Text>
      </View>
      <View style={styles.participantList}>
        {rows.map((participant, index) => (
          <View
            key={`${participant.participantId}-${index}`}
            style={[styles.participantRow, index === 0 ? null : styles.participantDivider]}
          >
            <View style={styles.participantAvatar}>
              <Text style={styles.participantAvatarText}>{participant.displayName.trim().slice(0, 1) || '여'}</Text>
            </View>
            <Text style={styles.participantName}>{participant.displayName.trim() || '여행자'}</Text>
            {participant.role === 'owner' ? <Badge label="주최자" tone="primary" /> : <Badge label="동행자" />}
          </View>
        ))}
      </View>
    </View>
  );
}

function fallbackParticipants(summary: GetTripDetailResponse['participantSummary']): TripParticipantListItem[] {
  const previewRows = summary.previewNames.map((name, index) => ({
    displayName: name.trim() || '여행자',
    joinedAt: '',
    participantId: `preview-${index}`,
    userId: `preview-user-${index}`,
    role: 'member' as const,
  }));

  if (summary.overflowCount <= 0) {
    return previewRows;
  }

  return [
    ...previewRows,
    {
      displayName: `외 ${summary.overflowCount}명`,
      joinedAt: '',
      participantId: 'preview-overflow',
      userId: 'preview-user-overflow',
      role: 'member' as const,
    },
  ];
}
