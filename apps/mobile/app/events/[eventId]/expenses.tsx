import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GetEventResponse, GetEventSettlementResponse, ListEventExpensesResponse } from '@i-um/api-contract';

import {
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
  SectionCard,
  theme,
} from '../../../lib/design';
import { createEventExpense, getEvent, getEventSettlement, listEventExpenses } from '../../../lib/trips/meeting-api';
import {
  buildCreateEventExpenseRequest,
  buildEventLedgerViewModel,
  buildEventSettlementSummaryLabels,
  eventParticipantIds,
  firstEventParticipantId,
} from '../../../lib/trips/event-ledger';

export default function EventExpensesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';
  const [eventResponse, setEventResponse] = useState<GetEventResponse | null>(null);
  const [expensesResponse, setExpensesResponse] = useState<ListEventExpensesResponse | null>(null);
  const [settlementResponse, setSettlementResponse] = useState<GetEventSettlementResponse | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setError('약속 정보를 찾을 수 없어요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [eventResult, expensesResult, settlementResult] = await Promise.all([
        getEvent(eventId),
        listEventExpenses(eventId),
        getEventSettlement(eventId),
      ]);
      setEventResponse(eventResult);
      setExpensesResponse(expensesResult);
      setSettlementResponse(settlementResult);
    } catch {
      setError('약속 장부를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!eventResponse || !eventId) {
      return;
    }
    const payerParticipantId = firstEventParticipantId(eventResponse.participants);
    const participantIds = eventParticipantIds(eventResponse.participants);
    if (!payerParticipantId || participantIds.length === 0) {
      setError('참여자 정보를 확인할 수 없어요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createEventExpense(
        eventId,
        buildCreateEventExpenseRequest({
          title: titleInput,
          expenseDate: eventResponse.event.startDate,
          amountText: amountInput,
          currency: eventResponse.event.defaultCurrency,
          payerParticipantId,
          participantIds,
        }),
      );
      setTitleInput('');
      setAmountInput('');
      await load();
    } catch {
      setError('지출을 저장하지 못했어요. 제목과 금액을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  }, [amountInput, eventId, eventResponse, load, titleInput]);

  if (loading) {
    return (
      <ScreenBackground style={[styles.stateContent, { paddingTop: insets.top + theme.space[6] }]}>
        <LoadingState body="약속 지출과 정산을 확인하고 있어요." title="약속 장부를 불러오는 중" />
      </ScreenBackground>
    );
  }

  if (error && (!eventResponse || !expensesResponse || !settlementResponse)) {
    return (
      <ScreenBackground style={[styles.stateContent, { paddingTop: insets.top + theme.space[6] }]}>
        <ErrorState
          action={{ label: '약속으로 돌아가기', onPress: () => router.back() }}
          body={error}
          title="약속 장부 오류"
        />
      </ScreenBackground>
    );
  }

  if (!eventResponse || !expensesResponse || !settlementResponse) {
    return null;
  }

  const viewModel = buildEventLedgerViewModel(expensesResponse);
  const settlementLabels = buildEventSettlementSummaryLabels(settlementResponse);
  const canSave =
    titleInput.trim().length > 0 && amountInput.trim().length > 0 && eventResponse.participants.length > 0;

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.space[8] }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>이벤트 장부</Text>
          <Text style={styles.title}>{eventResponse.event.title}</Text>
          <Text style={styles.subtitle}>약속에서 쓴 돈을 한곳에 기록하고 바로 정산해요.</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <SectionCard title="이번 약속 합계">
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>{viewModel.totalLabel}</Text>
            <Text style={styles.totalCaption}>기록은 정확하게, 기억은 다정하게.</Text>
          </View>
        </SectionCard>

        <SectionCard title="지출 추가">
          <View style={styles.formStack}>
            <TextInput
              accessibilityLabel="지출 제목"
              onChangeText={setTitleInput}
              placeholder="예: 저녁 식사"
              placeholderTextColor={theme.color.textMuted}
              style={styles.input}
              value={titleInput}
            />
            <TextInput
              accessibilityLabel="지출 금액"
              keyboardType="number-pad"
              onChangeText={setAmountInput}
              placeholder="금액"
              placeholderTextColor={theme.color.textMuted}
              style={styles.input}
              value={amountInput}
            />
            <PrimaryButton disabled={!canSave} label="지출 저장" loading={saving} onPress={onSave} />
          </View>
        </SectionCard>

        <SectionCard title="지출 내역">
          {viewModel.rows.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{viewModel.emptyTitle}</Text>
              <Text style={styles.emptyBody}>{viewModel.emptyBody}</Text>
            </View>
          ) : (
            <View style={styles.rowStack}>
              {viewModel.rows.map((row) => (
                <View key={row.id} style={styles.expenseRow}>
                  <View style={styles.rowTextStack}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    <Text style={styles.rowDetail}>{row.payerLabel}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{row.amountLabel}</Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard title="정산 미리보기">
          {settlementLabels.length === 0 ? (
            <Text style={styles.emptyBody}>아직 주고받을 금액이 없어요.</Text>
          ) : (
            <View style={styles.rowStack}>
              {settlementLabels.map((label) => (
                <Text key={label} style={styles.settlementLabel}>
                  {label}
                </Text>
              ))}
            </View>
          )}
        </SectionCard>

        <SecondaryButton label="약속 상세로" onPress={() => router.back()} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  emptyBody: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  emptyBox: {
    gap: theme.space[2],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
  },
  expenseRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    padding: theme.space[4],
  },
  eyebrow: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  formStack: {
    gap: theme.space[3],
  },
  header: {
    gap: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  rowAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  rowDetail: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  rowStack: {
    gap: theme.space[3],
  },
  rowTextStack: {
    flex: 1,
    gap: theme.space[1],
  },
  rowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  scrollContent: {
    gap: theme.space[5],
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[6],
  },
  settlementLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
  },
  stateContent: {
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
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
  totalCaption: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  totalCard: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  totalLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
});
