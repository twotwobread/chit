import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCategory, MeetingListItem, MeetingMember } from '@i-um/api-contract';

import { getStoredAuthUser } from '../../lib/auth/client';
import {
  ChoiceChip,
  EmptyState,
  ErrorState,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
  SectionCard,
  SelectableListRow,
  TextInputField,
  theme,
} from '../../lib/design';
import { createEvent, getMeeting, listMeetings } from '../../lib/trips/meeting-api';
import {
  buildCreateOutingEventRequest,
  outingCategoryOptions,
  validateOutingEventForm,
  type OutingMeetingContextSelection,
} from '../../lib/trips/outing-event';
import { eventPath } from '../../lib/trips/routes';
import { todayString } from '../../lib/trips/date';
import {
  buildDefaultEventParticipantMemberIds,
  buildEventParticipantSelectionRows,
  toggleEventParticipantMemberId,
} from '../../lib/trips/event-participants';

const initialMeetingContext: OutingMeetingContextSelection = { mode: 'one_off' };

export default function NewOutingEventScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => todayString());
  const [startTime, setStartTime] = useState('');
  const [category, setCategory] = useState<EventCategory>('custom');
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [meetingContext, setMeetingContext] = useState<OutingMeetingContextSelection>(initialMeetingContext);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetingMembers, setMeetingMembers] = useState<MeetingMember[]>([]);
  const [meetingMembersLoading, setMeetingMembersLoading] = useState(false);
  const [meetingMembersError, setMeetingMembersError] = useState<string | null>(null);
  const [participantMemberIds, setParticipantMemberIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setMeetingsLoading(true);
    setMeetingsError(null);
    Promise.all([listMeetings(), getStoredAuthUser()])
      .then(([response, user]) => {
        if (!active) {
          return;
        }
        setCurrentUserId(user.id);
        setMeetings(response.meetings.filter((meeting) => meeting.visibility === 'saved'));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setMeetings([]);
        setMeetingsError('모임 목록을 불러오지 못했어요. 이번만 함께하기나 새 모임으로 계속할 수 있어요.');
      })
      .finally(() => {
        if (active) {
          setMeetingsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (meetingContext.mode !== 'existing') {
      setMeetingMembers([]);
      setParticipantMemberIds([]);
      setMeetingMembersError(null);
      return;
    }
    let active = true;
    setMeetingMembersLoading(true);
    setMeetingMembersError(null);
    getMeeting(meetingContext.meetingId)
      .then((response) => {
        if (!active) {
          return;
        }
        setMeetingMembers(response.members);
        setParticipantMemberIds(buildDefaultEventParticipantMemberIds(response.members));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setMeetingMembers([]);
        setParticipantMemberIds([]);
        setMeetingMembersError('모임 멤버를 불러오지 못했어요. 다른 모임을 선택하거나 이번만 함께하기로 계속해주세요.');
      })
      .finally(() => {
        if (active) {
          setMeetingMembersLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [meetingContext]);

  const submit = async () => {
    const form = {
      title,
      date,
      startTime,
      category,
      placeName,
      placeAddress,
      meetingContext,
      participantMemberIds: meetingContext.mode === 'existing' ? participantMemberIds : undefined,
    };
    const validationError = validateOutingEventForm(form, meetingMembers, currentUserId);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await createEvent(buildCreateOutingEventRequest(form));
      Alert.alert('약속을 만들었어요', '가벼운 일정으로 기록과 기억을 시작해요.');
      router.replace(eventPath(result.event.id));
    } catch {
      setError('약속을 만들지 못했어요. 입력 내용을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectMeetingContext = (selection: OutingMeetingContextSelection) => {
    setMeetingContext(selection);
    setError(null);
  };

  const participantRows = buildEventParticipantSelectionRows(meetingMembers, participantMemberIds, currentUserId);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.space[8] }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>약속 일정</Text>
          <Text style={styles.title}>약속 만들기</Text>
          <Text style={styles.subtitle}>여행이 아니어도 모임과 함께 기록해요.</Text>
        </View>

        <SectionCard title="기본 정보">
          <View style={styles.fieldStack}>
            <TextInputField
              label="약속 이름"
              onChangeText={setTitle}
              placeholder="예: 성수 저녁"
              required
              value={title}
            />
            <TextInputField label="날짜" onChangeText={setDate} placeholder="YYYY-MM-DD" required value={date} />
            <TextInputField label="시간" onChangeText={setStartTime} placeholder="HH:mm" value={startTime} />
            <View style={styles.chipWrap}>
              {outingCategoryOptions().map((option) => (
                <ChoiceChip
                  key={option.value}
                  label={option.label}
                  onPress={() => setCategory(option.value)}
                  selected={category === option.value}
                  tone="accent"
                />
              ))}
            </View>
          </View>
        </SectionCard>

        <SectionCard title="장소">
          <View style={styles.fieldStack}>
            <TextInputField
              label="장소 이름"
              onChangeText={setPlaceName}
              placeholder="예: 성수 식당"
              value={placeName}
            />
            <TextInputField label="주소" onChangeText={setPlaceAddress} placeholder="선택 입력" value={placeAddress} />
          </View>
        </SectionCard>

        <SectionCard title="함께할 모임">
          <View style={styles.contextStack}>
            <SelectableListRow
              actionLabel="이번만"
              onPress={() => selectMeetingContext({ mode: 'one_off' })}
              selected={meetingContext.mode === 'one_off'}
              subtitle="저장 모임 목록에는 남기지 않아요."
              title="이번만 함께하기"
            />
            <SelectableListRow
              actionLabel="새 모임"
              onPress={() => selectMeetingContext({ mode: 'new_saved', meetingName: title })}
              selected={meetingContext.mode === 'new_saved'}
              subtitle="약속 이름으로 새 모임을 저장해요."
              title="새 모임으로 저장"
            />
            {meetingContext.mode === 'new_saved' ? (
              <TextInputField
                label="새 모임 이름"
                onChangeText={(meetingName) => setMeetingContext({ mode: 'new_saved', meetingName })}
                placeholder={title || '모임 이름'}
                value={meetingContext.meetingName}
              />
            ) : null}
            {meetingsLoading ? <Text style={styles.helperText}>모임 목록을 불러오는 중이에요…</Text> : null}
            {meetingsError ? <ErrorState body={meetingsError} title="모임 목록 오류" /> : null}
            {meetings.length === 0 && !meetingsLoading ? (
              <EmptyState body="저장된 모임은 홈의 내 모임에 표시돼요." title="아직 저장 모임이 없어요." />
            ) : null}
            {meetings.map((meeting) => (
              <SelectableListRow
                actionLabel={`${meeting.memberCount}명`}
                key={meeting.id}
                onPress={() => selectMeetingContext({ mode: 'existing', meetingId: meeting.id })}
                selected={meetingContext.mode === 'existing' && meetingContext.meetingId === meeting.id}
                subtitle="저장 모임 멤버 중 약속 참여자를 고를 수 있어요."
                title={meeting.name}
              />
            ))}
          </View>
        </SectionCard>

        {meetingContext.mode === 'existing' ? (
          <SectionCard title="참여자">
            <View style={styles.contextStack}>
              {meetingMembersLoading ? <Text style={styles.helperText}>참여자를 불러오는 중이에요…</Text> : null}
              {meetingMembersError ? <ErrorState body={meetingMembersError} title="참여자 오류" /> : null}
              {participantRows.map((row) => (
                <SelectableListRow
                  actionLabel={row.isCurrentUser ? '나' : row.selected ? '참여' : '제외'}
                  disabled={row.disabled}
                  key={row.memberId}
                  onPress={() =>
                    setParticipantMemberIds(
                      toggleEventParticipantMemberId(participantMemberIds, row.memberId, meetingMembers),
                    )
                  }
                  selected={row.selected}
                  subtitle={row.roleLabel}
                  title={row.displayName}
                />
              ))}
            </View>
          </SectionCard>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="약속 만들기" loading={submitting} loadingLabel="약속 만드는 중" onPress={submit} />
        <SecondaryButton label="돌아가기" onPress={() => router.back()} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  contextStack: {
    gap: theme.space[3],
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  eyebrow: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  fieldStack: {
    gap: theme.space[4],
  },
  header: {
    gap: theme.space[2],
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  scrollContent: {
    gap: theme.space[5],
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[6],
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
});
