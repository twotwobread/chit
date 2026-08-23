import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@i-um/api-contract';
import KakaoShareLink from 'react-native-kakao-share-link';

import { getStoredAuthUser, MobileAuthError } from '../../lib/auth/client';
import { clearStoredSession } from '../../lib/auth/session';
import { ErrorState, PrimaryButton, ScreenBackground, SecondaryButton, SkeletonCard, theme } from '../../lib/design';
import { getRootScreenContentTopPadding } from '../../lib/navigation/root-screen-layout';
import { createMeetingInvite, getMeeting, leaveMeeting, removeMeetingMember } from '../../lib/trips/meeting-api';
import {
  buildMeetingDetailViewModel,
  type MeetingDetailEventViewModel,
  type MeetingDetailMemberViewModel,
  type MeetingDetailSettlementTaskViewModel,
  type MeetingDetailViewModel,
} from '../../lib/trips/meeting-detail';
import {
  buildFallbackShareContent,
  buildInviteCopyText,
  buildKakaoInviteTemplate,
  getKakaoShareFailureMessage,
  toInviteViewModel,
  type InviteViewModel,
} from '../../lib/trips/invite';
import { getMySettlementSummary } from '../../lib/trips/settlement-api';
import { localDateString } from '../../lib/trips/status';

type MeetingDetailScreenState =
  | { status: 'loading' }
  | { status: 'error'; title: string; helper: string; retryLabel: string }
  | { status: 'ready'; viewModel: MeetingDetailViewModel };

type MeetingInviteState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'ready'; viewModel: InviteViewModel }
  | { status: 'error'; message: string };

export default function MeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meetingId?: string | string[] }>();
  const meetingId = Array.isArray(params.meetingId) ? params.meetingId[0] : params.meetingId;
  const [state, setState] = useState<MeetingDetailScreenState>({ status: 'loading' });
  const [inviteState, setInviteState] = useState<MeetingInviteState>({ status: 'idle' });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'copy' | 'fallback' | 'kakao' | 'leave' | 'remove' | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) {
      setState({
        status: 'error',
        title: '모임을 찾을 수 없어요.',
        helper: '홈에서 다시 열어주세요.',
        retryLabel: '홈으로 가기',
      });
      return;
    }

    setState({ status: 'loading' });
    setActionMessage(null);
    try {
      const [currentUser, detail, settlementSummary] = await Promise.all([
        getStoredAuthUser(),
        getMeeting(meetingId),
        getMySettlementSummary(),
      ]);
      setState({
        status: 'ready',
        viewModel: buildMeetingDetailViewModel({
          detail,
          settlementSummary,
          today: localDateString(),
          currentUserId: currentUser.id,
        }),
      });
    } catch (error) {
      if (await handleAuthError(error)) {
        router.replace('/login');
        return;
      }
      const notFound = error instanceof ApiError && error.status === 404;
      setState({
        status: 'error',
        title: notFound ? '모임을 찾을 수 없어요.' : '모임을 불러올 수 없어요.',
        helper: notFound ? '저장된 모임이 아니거나 접근할 수 없는 모임이에요.' : '잠시 후 다시 시도해주세요.',
        retryLabel: notFound ? '홈으로 가기' : '다시 시도',
      });
    }
  }, [meetingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createInvite = useCallback(async () => {
    if (!meetingId) {
      return;
    }
    setInviteState({ status: 'creating' });
    setActionMessage(null);
    try {
      const response = await createMeetingInvite(meetingId);
      setInviteState({ status: 'ready', viewModel: toInviteViewModel(response) });
    } catch (error) {
      if (await handleAuthError(error)) {
        router.replace('/login');
        return;
      }
      setInviteState({ status: 'error', message: '모임 초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.' });
    }
  }, [meetingId]);

  const copyInvite = useCallback(async (inviteUrl: string) => {
    setBusyAction('copy');
    setActionMessage(null);
    try {
      await Clipboard.setStringAsync(buildInviteCopyText(inviteUrl));
      setActionMessage('링크를 복사했어요.');
    } catch {
      setActionMessage('링크를 복사할 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusyAction(null);
    }
  }, []);

  const shareToKakao = useCallback((meetingName: string, inviteUrl: string) => {
    setBusyAction('kakao');
    setActionMessage(null);
    void KakaoShareLink.sendText(buildKakaoInviteTemplate({ title: meetingName, inviteUrl, scope: 'meeting' }))
      .catch(() => setActionMessage(getKakaoShareFailureMessage()))
      .finally(() => setBusyAction(null));
  }, []);

  const shareFallback = useCallback((meetingName: string, inviteUrl: string) => {
    setBusyAction('fallback');
    setActionMessage(null);
    void Share.share(buildFallbackShareContent({ title: meetingName, inviteUrl, scope: 'meeting' }))
      .catch(() => setActionMessage('공유를 열 수 없어요. 링크 복사를 사용해보세요.'))
      .finally(() => setBusyAction(null));
  }, []);

  const removeMember = useCallback(
    async (member: MeetingDetailMemberViewModel) => {
      if (!meetingId) {
        return;
      }
      setBusyAction('remove');
      setActionMessage(null);
      try {
        await removeMeetingMember(meetingId, member.id);
        await load();
        setActionMessage(`${member.displayName}님을 모임에서 내보냈어요.`);
      } catch (error) {
        if (await handleAuthError(error)) {
          router.replace('/login');
          return;
        }
        setActionMessage('멤버를 내보낼 수 없어요. 잠시 후 다시 시도해주세요.');
      } finally {
        setBusyAction(null);
      }
    },
    [load, meetingId],
  );

  const leave = useCallback(async () => {
    if (!meetingId) {
      return;
    }
    setBusyAction('leave');
    setActionMessage(null);
    try {
      await leaveMeeting(meetingId);
      router.replace('/');
    } catch (error) {
      if (await handleAuthError(error)) {
        router.replace('/login');
        return;
      }
      setActionMessage('모임을 나갈 수 없어요. 모임장은 아직 나갈 수 없어요.');
    } finally {
      setBusyAction(null);
    }
  }, [meetingId]);

  return (
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getRootScreenContentTopPadding(insets.top) }]}
        style={styles.scroll}
      >
        <MeetingDetailContent
          actionMessage={actionMessage}
          busyAction={busyAction}
          inviteState={inviteState}
          onCopyInvite={copyInvite}
          onCreateInvite={createInvite}
          onFallbackShare={shareFallback}
          onKakaoShare={shareToKakao}
          onLeaveMeeting={leave}
          onRemoveMember={removeMember}
          onRetry={load}
          state={state}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

function MeetingDetailContent({
  actionMessage,
  busyAction,
  inviteState,
  onCopyInvite,
  onCreateInvite,
  onFallbackShare,
  onKakaoShare,
  onLeaveMeeting,
  onRemoveMember,
  onRetry,
  state,
}: {
  actionMessage: string | null;
  busyAction: 'copy' | 'fallback' | 'kakao' | 'leave' | 'remove' | null;
  inviteState: MeetingInviteState;
  onCopyInvite: (inviteUrl: string) => void;
  onCreateInvite: () => void;
  onFallbackShare: (meetingName: string, inviteUrl: string) => void;
  onKakaoShare: (meetingName: string, inviteUrl: string) => void;
  onLeaveMeeting: () => void;
  onRemoveMember: (member: MeetingDetailMemberViewModel) => void;
  onRetry: () => void;
  state: MeetingDetailScreenState;
}) {
  if (state.status === 'loading') {
    return <SkeletonCard body="모임 일정과 멤버를 불러오는 중이에요." title="모임을 불러오고 있어요" />;
  }

  if (state.status === 'error') {
    const action = state.retryLabel === '홈으로 가기' ? () => router.replace('/') : onRetry;
    return <ErrorState action={{ label: state.retryLabel, onPress: action }} body={state.helper} title={state.title} />;
  }

  return (
    <MeetingDetailReady
      actionMessage={actionMessage}
      busyAction={busyAction}
      inviteState={inviteState}
      onCopyInvite={onCopyInvite}
      onCreateInvite={onCreateInvite}
      onFallbackShare={onFallbackShare}
      onKakaoShare={onKakaoShare}
      onLeaveMeeting={onLeaveMeeting}
      onRemoveMember={onRemoveMember}
      viewModel={state.viewModel}
    />
  );
}

function MeetingDetailReady({
  actionMessage,
  busyAction,
  inviteState,
  onCopyInvite,
  onCreateInvite,
  onFallbackShare,
  onKakaoShare,
  onLeaveMeeting,
  onRemoveMember,
  viewModel,
}: {
  actionMessage: string | null;
  busyAction: 'copy' | 'fallback' | 'kakao' | 'leave' | 'remove' | null;
  inviteState: MeetingInviteState;
  onCopyInvite: (inviteUrl: string) => void;
  onCreateInvite: () => void;
  onFallbackShare: (meetingName: string, inviteUrl: string) => void;
  onKakaoShare: (meetingName: string, inviteUrl: string) => void;
  onLeaveMeeting: () => void;
  onRemoveMember: (member: MeetingDetailMemberViewModel) => void;
  viewModel: MeetingDetailViewModel;
}) {
  return (
    <View style={styles.body}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>내 모임</Text>
        <Text style={styles.title}>{viewModel.title}</Text>
        <Text style={styles.subtitle}>{viewModel.subtitle}</Text>
        {viewModel.memberPreviewLabel ? <Text style={styles.memberPreview}>{viewModel.memberPreviewLabel}</Text> : null}
      </View>

      {viewModel.canCreateInvite ? (
        <MeetingInviteSection
          busyAction={busyAction}
          inviteState={inviteState}
          meetingName={viewModel.title}
          onCopyInvite={onCopyInvite}
          onCreateInvite={onCreateInvite}
          onFallbackShare={onFallbackShare}
          onKakaoShare={onKakaoShare}
        />
      ) : null}
      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

      <MeetingEventsSection
        emptyTitle="다가오는 일정이 없어요."
        events={viewModel.upcomingEvents}
        title="다가오는 일정"
      />
      <SettlementSection tasks={viewModel.settlementTasks} />
      <MembersSection busyAction={busyAction} members={viewModel.members} onRemoveMember={onRemoveMember} />
      {viewModel.canLeaveMeeting ? (
        <SecondaryButton
          disabled={busyAction === 'leave'}
          label={busyAction === 'leave' ? '모임 나가는 중...' : '모임 나가기'}
          onPress={onLeaveMeeting}
        />
      ) : null}
      <MeetingEventsSection emptyTitle="지난 일정이 아직 없어요." events={viewModel.pastEvents} title="지난 일정" />
      <SecondaryButton label="홈으로" onPress={() => router.push('/')} />
    </View>
  );
}

function MeetingEventsSection({
  emptyTitle,
  events,
  title,
}: {
  emptyTitle: string;
  events: MeetingDetailEventViewModel[];
  title: string;
}) {
  return (
    <Section title={title}>
      {events.length === 0 ? (
        <InfoCard body="이 모임에 연결된 일정이 생기면 여기에 보여요." title={emptyTitle} />
      ) : (
        <View style={styles.listCard}>
          {events.map((event, index) => (
            <EventRow event={event} first={index === 0} key={event.id} />
          ))}
        </View>
      )}
    </Section>
  );
}

function EventRow({ event, first }: { event: MeetingDetailEventViewModel; first: boolean }) {
  const disabled = !event.route;
  return (
    <Pressable
      accessibilityRole={disabled ? undefined : 'button'}
      disabled={disabled}
      onPress={() => {
        if (event.route) {
          router.push(event.route);
        }
      }}
      style={({ pressed }) => [styles.row, first ? null : styles.rowDivider, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {event.title}
        </Text>
        <Text style={styles.rowMeta}>{event.dateRangeLabel}</Text>
        <View style={styles.pillRow}>
          <Text style={styles.metaPill}>{event.eventTypeLabel}</Text>
          <Text style={styles.metaPill}>{event.statusLabel}</Text>
        </View>
      </View>
      {event.route ? <Text style={styles.rowAction}>열기</Text> : <Text style={styles.rowMutedAction}>준비 중</Text>}
    </Pressable>
  );
}

function SettlementSection({ tasks }: { tasks: MeetingDetailSettlementTaskViewModel[] }) {
  return (
    <Section title="정산할 일">
      {tasks.length === 0 ? (
        <InfoCard body="보내거나 받을 금액이 있는 일정이 생기면 알려드릴게요." title="정산할 일이 없어요." />
      ) : (
        <View style={styles.listCard}>
          {tasks.map((task, index) => (
            <Pressable
              accessibilityRole="button"
              key={task.tripId}
              onPress={() => router.push(task.route)}
              style={({ pressed }) => [
                styles.row,
                index === 0 ? null : styles.rowDivider,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.rowBody}>
                <Text numberOfLines={2} style={styles.rowTitle}>
                  {task.tripName}
                </Text>
                <Text style={styles.rowMeta}>{task.dateRangeLabel}</Text>
                <View style={styles.pillRow}>
                  {task.summaryLabels.map((label) => (
                    <Text key={label} style={styles.metaPill}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
              <Text style={styles.rowAction}>정산 보기</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Section>
  );
}

function MeetingInviteSection({
  busyAction,
  inviteState,
  meetingName,
  onCopyInvite,
  onCreateInvite,
  onFallbackShare,
  onKakaoShare,
}: {
  busyAction: 'copy' | 'fallback' | 'kakao' | 'leave' | 'remove' | null;
  inviteState: MeetingInviteState;
  meetingName: string;
  onCopyInvite: (inviteUrl: string) => void;
  onCreateInvite: () => void;
  onFallbackShare: (meetingName: string, inviteUrl: string) => void;
  onKakaoShare: (meetingName: string, inviteUrl: string) => void;
}) {
  const viewModel = inviteState.status === 'ready' ? inviteState.viewModel : null;
  const busy =
    inviteState.status === 'creating' || busyAction === 'copy' || busyAction === 'fallback' || busyAction === 'kakao';
  return (
    <Section title="모임 초대 링크">
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>다음 일정도 다시 초대하지 않아도 돼요.</Text>
        <Text style={styles.infoBody}>
          이 링크를 수락하면 모임 멤버가 되고, 이후 이 모임에 만든 일정에 함께 들어와요.
        </Text>
        {inviteState.status === 'error' ? <Text style={styles.errorText}>{inviteState.message}</Text> : null}
        {viewModel ? (
          <View style={styles.inviteResult}>
            <Text numberOfLines={2} selectable style={styles.inviteUrl}>
              {viewModel.inviteUrl}
            </Text>
            <Text style={styles.infoBody}>{viewModel.expiryLabel}</Text>
            <PrimaryButton
              disabled={busy}
              label={busyAction === 'kakao' ? '카카오톡 여는 중...' : '카카오톡으로 공유'}
              onPress={() => onKakaoShare(meetingName, viewModel.inviteUrl)}
            />
            <SecondaryButton disabled={busy} label="링크 복사" onPress={() => onCopyInvite(viewModel.inviteUrl)} />
            <SecondaryButton
              disabled={busy}
              label="다른 앱으로 공유"
              onPress={() => onFallbackShare(meetingName, viewModel.inviteUrl)}
            />
          </View>
        ) : (
          <PrimaryButton
            disabled={busy}
            label={inviteState.status === 'creating' ? '초대 링크 만드는 중...' : '초대 링크 만들기'}
            onPress={onCreateInvite}
          />
        )}
      </View>
    </Section>
  );
}

function MembersSection({
  busyAction,
  members,
  onRemoveMember,
}: {
  busyAction: 'copy' | 'fallback' | 'kakao' | 'leave' | 'remove' | null;
  members: MeetingDetailMemberViewModel[];
  onRemoveMember: (member: MeetingDetailMemberViewModel) => void;
}) {
  return (
    <Section title="멤버">
      {members.length === 0 ? (
        <InfoCard body="모임 멤버 정보가 아직 없어요." title="멤버를 불러올 수 없어요." />
      ) : (
        <View style={styles.listCard}>
          {members.map((member, index) => (
            <View key={member.id} style={[styles.memberRow, index === 0 ? null : styles.rowDivider]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{member.displayName.trim().slice(0, 1) || '멤'}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{member.displayName}</Text>
                <Text style={styles.rowMeta}>
                  {member.isCurrentUser ? `${member.roleLabel} · 나` : member.roleLabel}
                </Text>
              </View>
              {member.canRemove ? (
                <Pressable
                  accessibilityLabel={`${member.displayName} 멤버 내보내기`}
                  accessibilityRole="button"
                  disabled={busyAction === 'remove'}
                  onPress={() => onRemoveMember(member)}
                  style={({ pressed }) => [styles.memberRemoveButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.memberRemoveText}>내보내기</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoCard({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

async function handleAuthError(error: unknown): Promise<boolean> {
  if (error instanceof MobileAuthError && (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')) {
    await clearStoredSession();
    return true;
  }
  if (error instanceof ApiError && error.status === 401) {
    await clearStoredSession();
    return true;
  }
  return false;
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: theme.color.uiAccentSoft,
    borderRadius: theme.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionMessage: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  avatarText: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  body: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[4],
    padding: theme.space[7],
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  eyebrow: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  heroCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  infoBody: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[4],
  },
  infoTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  inviteResult: {
    gap: theme.space[2],
  },
  inviteUrl: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  listCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  memberPreview: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  memberRemoveButton: {
    borderColor: theme.color.danger,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  memberRemoveText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  metaPill: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[1],
  },
  pressed: {
    opacity: 0.82,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  rowAction: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rowBody: {
    flex: 1,
    gap: theme.space[1],
  },
  rowDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  rowMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  rowMutedAction: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  section: {
    gap: theme.space[3],
  },
  sectionTitle: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  title: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
});
