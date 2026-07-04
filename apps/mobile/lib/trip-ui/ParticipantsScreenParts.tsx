import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import { getKakaoShareFailureMessage } from '../trips/invite';
import { type ParticipantListViewModel, type ParticipantRowViewModel } from '../trips/participants';
import { type InviteState, type RemoveState, type ShareBusyState } from './useParticipantsController';
import { styles } from './ParticipantsScreenStyles';

export function InviteCard({
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
            <SecondaryButton
              disabled={busy}
              label="다른 앱으로 공유"
              onPress={() => onFallbackShare(viewModel.inviteUrl)}
            />
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

export function ParticipantListCard({
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
                  <Text style={participant.role === 'owner' ? styles.ownerBadgeText : styles.memberBadgeText}>
                    {participant.roleLabel}
                  </Text>
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

export function RemoveParticipantConfirmationModal({
  onCancel,
  onConfirm,
  removeState,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  removeState: RemoveState;
}) {
  const participant =
    removeState.status === 'confirming' || removeState.status === 'removing' ? removeState.participant : null;
  const isRemoving = removeState.status === 'removing';

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={participant !== null}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {participant ? `${participant.displayName}님을 여행에서 제거할까요?` : '참여자를 제거할까요?'}
          </Text>
          <Text style={styles.message}>
            제거되면 이 여행 목록과 일정에 더 이상 접근할 수 없어요. 다시 초대하면 재참여할 수 있어요.
          </Text>
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
