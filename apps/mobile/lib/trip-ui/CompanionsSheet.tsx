import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Copy, Info, Link2, Share2, UserMinus, UserPlus } from 'lucide-react-native';

import { Avatar, Badge, theme } from '../design';
import { BottomSheet } from './BottomSheet';

export type Participant = {
  id: string;
  name: string;
  color?: string;
  role: 'owner' | 'member';
  isMe?: boolean;
};

export type InviteCardProps = {
  inviteUrl?: string | null;
  expiryLabel?: string;
  statusLabel?: string;
  feedbackMessage?: string | null;
  createLabel?: string;
  actionBusy?: boolean;
  onCopyInvite?: () => void;
  onFallbackShare?: () => void;
  onKakaoShare?: () => void;
  onCreateInvite?: () => void;
};

export type ParticipantRowProps = {
  participant: Participant;
  canRemove?: boolean;
  removing?: boolean;
  onRemove?: (participantId: string) => void;
  first?: boolean;
};

export type CompanionsSheetProps = {
  visible: boolean;
  participants: Participant[];
  inviteUrl?: string | null;
  expiryLabel?: string;
  inviteStatusLabel?: string;
  feedbackMessage?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  removingParticipantId?: string | null;
  actionBusy?: boolean;
  canManage?: boolean;
  onClose: () => void;
  onCopyInvite?: () => void;
  onFallbackShare?: () => void;
  onKakaoShare?: () => void;
  onCreateInvite?: () => void;
  onRetry?: () => void;
  onRemoveParticipant?: (participantId: string) => void;
};

export function InviteCard({
  actionBusy = false,
  createLabel = '초대 링크 만들기',
  expiryLabel,
  feedbackMessage,
  inviteUrl,
  onCopyInvite,
  onCreateInvite,
  onFallbackShare,
  onKakaoShare,
  statusLabel,
}: InviteCardProps) {
  const hasInvite = Boolean(inviteUrl);

  return (
    <View style={styles.invite}>
      <View style={styles.inviteHead}>
        <UserPlus color={theme.color.green[300]} size={18} strokeWidth={2} />
        <Text style={styles.inviteTitle}>동행자 초대하기</Text>
      </View>
      <Text style={styles.inviteBody}>링크를 받은 사람은 이 여행의 일정과 정산을 함께 볼 수 있어요.</Text>

      <View style={styles.urlRow}>
        <Link2 color={theme.color.green[200]} size={16} strokeWidth={2} />
        <Text numberOfLines={1} style={styles.urlText}>
          {hasInvite ? inviteUrl : '초대 링크를 만들면 여기에 표시돼요'}
        </Text>
      </View>

      <View style={styles.inviteActions}>
        {hasInvite ? (
          <>
            {onKakaoShare ? (
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={onKakaoShare}
                style={({ pressed }) => [
                  styles.inviteButton,
                  styles.kakaoButton,
                  actionBusy ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Share2 color={theme.providerColor.kakaoText} size={16} strokeWidth={2.2} />
                <Text style={styles.kakaoText}>카카오 공유</Text>
              </Pressable>
            ) : null}
            {onFallbackShare ? (
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={onFallbackShare}
                style={({ pressed }) => [
                  styles.inviteButton,
                  styles.copyButton,
                  actionBusy ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Share2 color={theme.color.onPrimary} size={16} strokeWidth={2.2} />
                <Text style={styles.copyText}>다른 앱 공유</Text>
              </Pressable>
            ) : null}
            {onCopyInvite ? (
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={onCopyInvite}
                style={({ pressed }) => [
                  styles.inviteButton,
                  styles.copyButton,
                  actionBusy ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Copy color={theme.color.onPrimary} size={16} strokeWidth={2.2} />
                <Text style={styles.copyText}>링크 복사</Text>
              </Pressable>
            ) : null}
          </>
        ) : onCreateInvite ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionBusy}
            onPress={onCreateInvite}
            style={({ pressed }) => [
              styles.inviteButton,
              styles.copyButton,
              styles.inviteCreateButton,
              actionBusy ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <UserPlus color={theme.color.onPrimary} size={16} strokeWidth={2.2} />
            <Text style={styles.copyText}>{createLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {statusLabel ? <Text style={styles.inviteStatusText}>{statusLabel}</Text> : null}
      {feedbackMessage ? <Text style={styles.feedbackText}>{feedbackMessage}</Text> : null}
      {expiryLabel ? <Text style={styles.expiryText}>{expiryLabel}</Text> : null}
    </View>
  );
}

export function ParticipantRow({
  canRemove = false,
  first = false,
  onRemove,
  participant,
  removing = false,
}: ParticipantRowProps) {
  const isOwner = participant.role === 'owner';

  return (
    <View style={[styles.participantRow, first ? null : styles.participantDivider]}>
      <Avatar color={participant.color} name={participant.name} size={34} />
      <View style={styles.participantBody}>
        <View style={styles.participantNameRow}>
          <Text style={styles.participantName}>{participant.name}</Text>
          {participant.isMe ? <Text style={styles.meLabel}>(나)</Text> : null}
        </View>
        <Badge label={isOwner ? '주최자' : '동행자'} tone={isOwner ? 'success' : 'neutral'} />
      </View>
      {canRemove && onRemove ? (
        <Pressable
          accessibilityLabel={`${participant.name} 내보내기`}
          accessibilityRole="button"
          disabled={removing}
          hitSlop={8}
          onPress={() => onRemove(participant.id)}
          style={({ pressed }) => [
            styles.removeButton,
            removing ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {removing ? (
            <ActivityIndicator color={theme.color.textMuted} size="small" />
          ) : (
            <UserMinus color={theme.color.textMuted} size={18} strokeWidth={2.2} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function CompanionsSheet({
  actionBusy = false,
  canManage = false,
  errorMessage,
  expiryLabel,
  feedbackMessage,
  inviteStatusLabel,
  inviteUrl,
  loading = false,
  onClose,
  onCopyInvite,
  onCreateInvite,
  onFallbackShare,
  onKakaoShare,
  onRemoveParticipant,
  onRetry,
  participants,
  removingParticipantId,
  visible,
}: CompanionsSheetProps) {
  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <View style={styles.sheetHead}>
        <View>
          <Text style={styles.sheetTitle}>동행자</Text>
          <Text style={styles.sheetSub}>{participants.length}명이 함께하고 있어요</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        {canManage ? (
          <InviteCard
            actionBusy={actionBusy}
            createLabel={inviteStatusLabel ?? '초대 링크 만들기'}
            expiryLabel={expiryLabel}
            feedbackMessage={feedbackMessage}
            inviteUrl={inviteUrl}
            onCopyInvite={onCopyInvite}
            onCreateInvite={onCreateInvite}
            onFallbackShare={onFallbackShare}
            onKakaoShare={onKakaoShare}
            statusLabel={inviteUrl ? inviteStatusLabel : undefined}
          />
        ) : feedbackMessage ? (
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        ) : null}

        {loading ? (
          <View style={styles.emptyParticipants}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.emptyHelper}>동행자를 불러오는 중...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyParticipants}>
            <Text style={styles.emptyTitle}>동행자를 불러올 수 없어요</Text>
            <Text style={styles.emptyHelper}>{errorMessage}</Text>
            {onRetry ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={({ pressed }) => [styles.inviteButton, styles.copyButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.copyText}>다시 시도</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.listLabel}>참여자 {participants.length}명</Text>
            {participants.length === 0 ? (
              <View style={styles.emptyParticipants}>
                <Text style={styles.emptyTitle}>아직 동행자가 없어요</Text>
                <Text style={styles.emptyHelper}>초대 링크를 공유해 함께 여행할 사람을 초대해보세요.</Text>
              </View>
            ) : (
              <View style={styles.participantList}>
                {participants.map((participant, index) => (
                  <ParticipantRow
                    canRemove={canManage && participant.role === 'member'}
                    first={index === 0}
                    key={participant.id}
                    onRemove={onRemoveParticipant}
                    participant={participant}
                    removing={removingParticipantId === participant.id}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.noteRow}>
          <Info color={theme.color.textFaint} size={15} strokeWidth={2} />
          <Text style={styles.noteText}>
            주최자만 동행자를 내보낼 수 있어요. 내보낸 동행자의 지출 기록은 정산에 그대로 남아요.
          </Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  copyButton: {
    backgroundColor: theme.color.primary,
  },
  copyText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  disabled: {
    opacity: 0.55,
  },
  emptyHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    textAlign: 'center',
  },
  emptyParticipants: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.lg,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  expiryText: {
    color: theme.color.green[200],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    marginTop: theme.space[3],
  },
  invite: {
    backgroundColor: theme.color.green[900],
    borderRadius: theme.radius.xl,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  inviteBody: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
  },
  inviteButton: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  inviteCreateButton: {
    flex: 1,
    justifyContent: 'center',
  },
  feedbackText: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  inviteHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  inviteStatusText: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  inviteTitle: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  kakaoButton: {
    backgroundColor: theme.providerColor.kakaoBg,
  },
  kakaoText: {
    color: theme.providerColor.kakaoText,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  listLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  meLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  noteText: {
    color: theme.color.textFaint,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  participantBody: {
    flex: 1,
    gap: theme.space[2],
  },
  participantDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  participantList: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  participantName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  participantNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[1],
  },
  participantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    padding: theme.space[4],
  },
  pressed: {
    opacity: 0.72,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sheetBody: {
    gap: theme.space[4],
    paddingBottom: theme.space[3],
  },
  sheetHead: {
    marginBottom: theme.space[4],
  },
  sheetSub: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    marginTop: theme.space[1],
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  urlRow: {
    alignItems: 'center',
    backgroundColor: theme.color.green[800],
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    padding: theme.space[3],
  },
  urlText: {
    color: theme.color.green[100],
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
});
