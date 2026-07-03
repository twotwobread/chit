import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  ApiError,
  type GetDayScheduleItemsResponse,
  type SupportedCurrency,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../lib/auth/client';
import { clearStoredSession } from '../../../../../../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../lib/design';
import {
  createQuickExpense,
  getTripDayItinerary,
  getTripDetail,
  listTripParticipants,
  updateExpense,
} from '../../../../../../lib/trips/client';
import { getScheduleItems } from '../../../../../../lib/trips/day-itinerary';
import { tripItineraryDayPath } from '../../../../../../lib/trips/routes';
import {
  buildCreateQuickExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseManualSplitInputsFromRows,
  buildQuickExpenseManualSplitSummary,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  formatMoney,
  quickExpenseFailureMessage,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitPolicy,
  toggleQuickExpenseSplitParticipant,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseViewModel,
} from '../../../../../../lib/trips/quick-expense';

type QuickExpenseState =
  | { status: 'loading' }
  | {
      status: 'success';
      tripName: string;
      currency: SupportedCurrency;
      itinerary: GetDayScheduleItemsResponse;
      participants: TripParticipantListItem[];
      shouldChooseItem: boolean;
    }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound'; message: string }
  | { status: 'error'; message: string };

export default function QuickExpenseScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    itemId: itemIdParam,
  } = useLocalSearchParams<{ tripId?: string | string[]; date?: string | string[]; itemId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const routeItemId = Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;

  const [state, setState] = useState<QuickExpenseState>({ status: 'loading' });
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [payerParticipantId, setPayerParticipantId] = useState<string | null>(null);
  const [selectedSplitParticipantIds, setSelectedSplitParticipantIds] = useState<string[]>([]);
  const [splitPolicy, setSplitPolicy] = useState<QuickExpenseSplitPolicy>('equal');
  const [manualSplitInputs, setManualSplitInputs] = useState<QuickExpenseManualSplitInput[]>([]);
  const [errors, setErrors] = useState<QuickExpenseFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<QuickExpenseSavedSplitSummary | null>(null);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
      await clearStoredSession();
      setState({ status: 'auth' });
      return true;
    }
    if (error instanceof ApiError && error.status === 401) {
      await clearStoredSession();
      setState({ status: 'auth' });
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    if (!tripId || !date) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    setSaving(false);
    setErrors({});
    setFormMessage(null);
    setSavedSummary(null);
    try {
      const [tripDetail, itinerary, participantsResponse] = await Promise.all([
        getTripDetail(tripId),
        getTripDayItinerary(tripId, date),
        listTripParticipants(tripId),
      ]);
      const validRouteItem =
        routeItemId && getScheduleItems(itinerary).some((item) => item.id === routeItemId) ? routeItemId : null;
      const participants = participantsResponse.participants;
      setSelectedItemId(validRouteItem);
      setPayerParticipantId(participants.length === 1 ? participants[0].participantId : null);
      setSelectedSplitParticipantIds(buildDefaultSplitParticipantIds(participants));
      setSplitPolicy('equal');
      setManualSplitInputs([]);
      setAmountInput('');
      setMemoInput('');
      setState({
        status: 'success',
        tripName: tripDetail.trip.name,
        currency: tripDetail.trip.defaultCurrency,
        itinerary,
        participants,
        shouldChooseItem: validRouteItem === null,
      });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setState({ status: 'notFound', message: quickExpenseFailureMessage(error.status) });
        return;
      }
      setState({
        status: 'error',
        message: quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined),
      });
    }
  }, [date, handleAuthError, routeItemId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateAmountInput = (value: string) => {
    setAmountInput(value);
    setErrors((current) => ({ ...current, amount: undefined }));
    setFormMessage(null);
  };

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  };

  const selectPayer = (participantId: string) => {
    setPayerParticipantId(participantId);
    setErrors((current) => ({ ...current, payer: undefined }));
    setFormMessage(null);
  };

  const toggleSplitParticipant = (participantId: string) => {
    setSelectedSplitParticipantIds((current) => toggleQuickExpenseSplitParticipant(current, participantId));
    setErrors((current) => ({ ...current, participants: undefined }));
    setFormMessage(null);
  };

  const selectSplitPolicy = (
    policy: QuickExpenseSplitPolicy,
    previewRows: QuickExpenseViewModel['splitPreviewRows'],
  ) => {
    setSplitPolicy(policy);
    if (policy === 'manual' && manualSplitInputs.length === 0) {
      const currency = state.status === 'success' ? state.currency : 'KRW';
      setManualSplitInputs(buildQuickExpenseManualSplitInputsFromRows(previewRows, currency));
    }
    setErrors((current) => ({ ...current, participants: undefined }));
    setFormMessage(null);
  };

  const updateManualSplitInput = (participantId: string, amount: string) => {
    setManualSplitInputs((current) => {
      const index = current.findIndex((split) => split.participantId === participantId);
      if (index < 0) {
        return [...current, { participantId, amountInput: amount }];
      }
      return current.map((split) =>
        split.participantId === participantId ? { ...split, amountInput: amount } : split,
      );
    });
    setErrors((current) => ({ ...current, participants: undefined }));
    setFormMessage(null);
  };

  const submit = async () => {
    if (state.status !== 'success' || !tripId || !date || saving) {
      return;
    }

    const activeManualSplitInputs = manualSplitInputs.filter((input) =>
      selectedSplitParticipantIds.includes(input.participantId),
    );
    const validation = buildCreateQuickExpenseRequest({
      amountInput,
      currency: state.currency,
      scheduleItemId: selectedItemId,
      splitPolicy,
      participantIds: selectedSplitParticipantIds,
      manualSplitInputs: activeManualSplitInputs,
      payerParticipantId,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setFormMessage(null);
    setErrors({});
    try {
      const response = await createQuickExpense(tripId, date, validation.request);
      const memo = memoInput.trim();
      if (memo) {
        await updateExpense(tripId, date, response.expense.id, {
          amountMinor: validation.request.amountMinor,
          payerParticipantId: validation.request.payerParticipantId,
          splitPolicy: validation.request.splitPolicy,
          ...(validation.request.participantIds ? { participantIds: validation.request.participantIds } : {}),
          ...(validation.request.splits ? { splits: validation.request.splits } : {}),
          memo,
          scheduleItemId: validation.request.scheduleItemId,
        });
      }
      setSavedSummary(
        buildSavedEqualSplitSummary({
          amountMinor: response.expense.amountMinor,
          currency: response.expense.currency,
          splits: response.expense.splits,
        }),
      );
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFormMessage(quickExpenseFailureMessage(error.status));
        await load();
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setFormMessage(quickExpenseFailureMessage(error.status));
        return;
      }
      setFormMessage(quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined));
    } finally {
      setSaving(false);
    }
  };

  const backToDay = () => {
    if (!tripId || !date) {
      router.replace('/');
      return;
    }
    router.replace(tripItineraryDayPath(tripId, date));
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>지출 등록</Text>
        <Text style={styles.subtitle}>금액과 결제자만 입력하면 함께 나눠요.</Text>
      </View>

      {state.status === 'loading' ? (
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>지출 등록 정보를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'success' && savedSummary ? (
        <QuickExpenseSavedSummaryCard onDone={backToDay} summary={savedSummary} />
      ) : null}

      {state.status === 'success' && !savedSummary ? (
        <QuickExpenseForm
          amountInput={amountInput}
          errors={errors}
          formMessage={formMessage}
          onBack={backToDay}
          onSelectItem={selectItem}
          onSelectPayer={selectPayer}
          onSelectSplitPolicy={selectSplitPolicy}
          onSubmit={() => void submit()}
          onToggleSplitParticipant={toggleSplitParticipant}
          onUpdateAmount={updateAmountInput}
          onUpdateMemo={setMemoInput}
          onUpdateManualSplitInput={updateManualSplitInput}
          payerParticipantId={payerParticipantId}
          saving={saving}
          selectedItemId={selectedItemId}
          selectedSplitParticipantIds={selectedSplitParticipantIds}
          splitPolicy={splitPolicy}
          manualSplitInputs={manualSplitInputs}
          memoInput={memoInput}
          tripName={state.tripName}
          viewModel={buildQuickExpenseViewModel({
            amountInput,
            currency: state.currency,
            itinerary: state.itinerary,
            participants: state.participants,
            selectedItemId,
            selectedSplitParticipantIds,
            shouldChooseItem: state.shouldChooseItem,
          })}
        />
      ) : null}

      {state.status === 'auth' ? (
        <Card>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
        </Card>
      ) : null}

      {state.status === 'invalid' ? (
        <Card>
          <Text style={styles.errorTitle}>잘못된 지출 등록 주소예요.</Text>
          <PrimaryButton label="일정으로 돌아가기" onPress={backToDay} />
        </Card>
      ) : null}

      {state.status === 'notFound' || state.status === 'error' ? (
        <Card>
          <Text style={styles.errorTitle}>
            {state.status === 'notFound' ? '지출을 저장할 수 없어요.' : '불러올 수 없어요.'}
          </Text>
          <Text style={styles.message}>{state.message}</Text>
          <PrimaryButton label="다시 시도" onPress={() => void load()} />
          <SecondaryButton label="일정으로 돌아가기" onPress={backToDay} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function QuickExpenseForm({
  amountInput,
  errors,
  formMessage,
  onBack,
  onSelectItem,
  onSelectPayer,
  onSelectSplitPolicy,
  onSubmit,
  onToggleSplitParticipant,
  onUpdateAmount,
  onUpdateMemo,
  onUpdateManualSplitInput,
  payerParticipantId,
  saving,
  selectedItemId,
  selectedSplitParticipantIds,
  splitPolicy,
  manualSplitInputs,
  memoInput,
  tripName,
  viewModel,
}: {
  amountInput: string;
  errors: QuickExpenseFormErrors;
  formMessage: string | null;
  onBack: () => void;
  onSelectItem: (itemId: string) => void;
  onSelectPayer: (participantId: string) => void;
  onSelectSplitPolicy: (
    policy: QuickExpenseSplitPolicy,
    previewRows: QuickExpenseViewModel['splitPreviewRows'],
  ) => void;
  onSubmit: () => void;
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateAmount: (value: string) => void;
  onUpdateMemo: (value: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  payerParticipantId: string | null;
  saving: boolean;
  selectedItemId: string | null;
  selectedSplitParticipantIds: string[];
  splitPolicy: QuickExpenseSplitPolicy;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  memoInput: string;
  tripName: string;
  viewModel: QuickExpenseViewModel;
}) {
  const activeManualSplitInputs = manualSplitInputs.filter((input) =>
    selectedSplitParticipantIds.includes(input.participantId),
  );
  const validation = buildCreateQuickExpenseRequest({
    amountInput,
    currency: viewModel.currency,
    scheduleItemId: selectedItemId,
    splitPolicy,
    participantIds: selectedSplitParticipantIds,
    manualSplitInputs: activeManualSplitInputs,
    payerParticipantId,
  });
  const canSubmit = validation.ok && !saving && !viewModel.emptyMessage;
  const selectedPayerOptions = viewModel.payerOptions.map((option) => ({
    ...option,
    selected: option.participantId === payerParticipantId,
  }));

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.tripName}>{tripName}</Text>
        <Text style={styles.dayText}>
          {viewModel.dayLabel} · {viewModel.formattedDate}
        </Text>
      </View>

      {viewModel.emptyMessage ? (
        <View style={styles.noticeBox}>
          <Text style={styles.message}>{viewModel.emptyMessage}</Text>
        </View>
      ) : null}

      {viewModel.helper ? <Text style={styles.helper}>{viewModel.helper}</Text> : null}

      {viewModel.showItemSelector && viewModel.itemOptions.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>연결할 일정</Text>
          <View style={styles.optionList}>
            {viewModel.itemOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: option.itemId === selectedItemId }}
                key={option.itemId}
                onPress={() => onSelectItem(option.itemId)}
                style={[styles.optionCard, option.itemId === selectedItemId ? styles.optionCardSelected : null]}
              >
                <View style={styles.placeMetaRow}>
                  <Text style={styles.orderBadge}>{option.orderLabel}</Text>
                  <Text style={styles.placeType}>{option.placeTypeLabel}</Text>
                </View>
                <Text style={styles.optionTitle}>{option.placeName}</Text>
                {option.timeLabel ? <Text style={styles.timeLabel}>{option.timeLabel}</Text> : null}
                {option.address ? <Text style={styles.address}>{option.address}</Text> : null}
              </Pressable>
            ))}
          </View>
          {errors.item ? <Text style={styles.errorMessage}>{errors.item}</Text> : null}
        </View>
      ) : null}

      {viewModel.selectedItem ? (
        <View style={styles.selectedPlaceBox}>
          <Text style={styles.label}>선택된 일정</Text>
          <Text style={styles.optionTitle}>{viewModel.selectedItem.placeName}</Text>
          {viewModel.selectedItem.timeLabel ? (
            <Text style={styles.timeLabel}>{viewModel.selectedItem.timeLabel}</Text>
          ) : null}
          {viewModel.selectedItem.address ? <Text style={styles.address}>{viewModel.selectedItem.address}</Text> : null}
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>금액</Text>
        <View style={styles.amountInputBox}>
          <TextInput
            accessibilityLabel="금액"
            editable={!saving && !viewModel.emptyMessage}
            keyboardType={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
            onChangeText={onUpdateAmount}
            placeholder={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? '18500' : '12.34'}
            placeholderTextColor={theme.color.textFaint}
            style={styles.amountInput}
            value={amountInput}
          />
          <Text style={styles.currencyLabel}>{viewModel.currencyLabel}</Text>
        </View>
        {errors.amount ? <Text style={styles.errorMessage}>{errors.amount}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>결제자</Text>
        <View style={styles.optionList}>
          {selectedPayerOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.selected }}
              disabled={saving || Boolean(viewModel.emptyMessage)}
              key={option.participantId}
              onPress={() => onSelectPayer(option.participantId)}
              style={[styles.payerChip, option.selected ? styles.optionCardSelected : null]}
            >
              <Text style={option.selected ? styles.payerChipTextSelected : styles.payerChipText}>
                {option.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.payer ? <Text style={styles.errorMessage}>{errors.payer}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분할 방식</Text>
        <View style={styles.modeRow}>
          {(['equal', 'manual'] as const).map((policy) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: splitPolicy === policy }}
              disabled={saving || Boolean(viewModel.emptyMessage)}
              key={policy}
              onPress={() => onSelectSplitPolicy(policy, viewModel.splitPreviewRows)}
              style={[styles.modeChip, splitPolicy === policy ? styles.optionCardSelected : null]}
            >
              <Text style={splitPolicy === policy ? styles.payerChipTextSelected : styles.payerChipText}>
                {policy === 'equal' ? '1/N 분할' : '직접 분할'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {splitPolicy === 'equal' ? (
        <>
          <View style={styles.fieldGroup}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>분할 대상</Text>
              <Text style={styles.splitHelper}>
                체크한 사람에게만 아래 금액으로 나눠져요. 결제자도 제외할 수 있어요.
              </Text>
            </View>
            <View style={styles.optionList}>
              {viewModel.splitParticipantOptions.map((option) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: option.selected }}
                  disabled={saving || Boolean(viewModel.emptyMessage)}
                  key={option.participantId}
                  onPress={() => onToggleSplitParticipant(option.participantId)}
                  style={[styles.payerChip, option.selected ? styles.optionCardSelected : null]}
                >
                  <Text style={option.selected ? styles.payerChipTextSelected : styles.payerChipText}>
                    {option.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.participants || viewModel.splitParticipantError ? (
              <Text style={styles.errorMessage}>{errors.participants ?? viewModel.splitParticipantError}</Text>
            ) : null}
          </View>

          {viewModel.splitPreviewRows.length > 0 ? (
            <SplitRowsSection
              helper="저장하면 선택한 참여자에게 아래 금액으로 나눠져요."
              rows={viewModel.splitPreviewRows}
              title="1/N 분할"
            />
          ) : null}
        </>
      ) : (
        <ManualSplitSection
          amountInput={amountInput}
          currency={viewModel.currency}
          disabled={saving || Boolean(viewModel.emptyMessage)}
          errorMessage={errors.participants ?? null}
          manualSplitInputs={manualSplitInputs}
          onToggleSplitParticipant={onToggleSplitParticipant}
          onUpdateManualSplitInput={onUpdateManualSplitInput}
          participants={viewModel.splitParticipantOptions}
        />
      )}

      {viewModel.splitPreviewMessage ? <Text style={styles.errorMessage}>{viewModel.splitPreviewMessage}</Text> : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!saving && !viewModel.emptyMessage}
          multiline
          onChangeText={onUpdateMemo}
          placeholder="선택 입력"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.memoInput]}
          textAlignVertical="top"
          value={memoInput}
        />
      </View>

      {formMessage ? <Text style={styles.errorMessage}>{formMessage}</Text> : null}

      <PrimaryButton
        disabled={!canSubmit}
        label="저장하기"
        loading={saving}
        loadingLabel="저장 중..."
        onPress={onSubmit}
      />
      <SecondaryButton disabled={saving} label="오늘로 돌아가기" onPress={onBack} />
    </Card>
  );
}

function QuickExpenseSavedSummaryCard({
  onDone,
  summary,
}: {
  onDone: () => void;
  summary: QuickExpenseSavedSplitSummary;
}) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.successTitle}>지출을 저장했어요.</Text>
        <Text style={styles.message}>총 {summary.amountLabel}</Text>
      </View>
      <SplitRowsSection helper="서버에 저장된 결과 기준이에요." rows={summary.splitRows} title="실제 저장된 분할" />
      <PrimaryButton label="확인" onPress={onDone} />
    </Card>
  );
}

function ManualSplitSection({
  amountInput,
  currency,
  disabled,
  errorMessage,
  manualSplitInputs,
  onToggleSplitParticipant,
  onUpdateManualSplitInput,
  participants,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  disabled: boolean;
  errorMessage: string | null;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  participants: QuickExpenseViewModel['splitParticipantOptions'];
}) {
  const selectedParticipants = participants.filter((participant) => participant.selected);
  const activeManualSplitInputs = manualSplitInputs.filter((input) =>
    selectedParticipants.some((participant) => participant.participantId === input.participantId),
  );
  const summary = buildQuickExpenseManualSplitSummary({
    amountInput,
    currency,
    manualSplitInputs: activeManualSplitInputs,
  });
  const inputByParticipantId = new Map(manualSplitInputs.map((split) => [split.participantId, split.amountInput]));
  const differenceLabel = manualSplitDifferenceLabel(summary.differenceMinor, currency);
  return (
    <View style={styles.splitSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>직접 분할</Text>
        <Text style={styles.splitHelper}>분할할 참여자를 선택하고 각 부담 금액을 입력해주세요.</Text>
      </View>
      <View style={styles.optionList}>
        {participants.map((participant) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: participant.selected }}
            disabled={disabled}
            key={participant.participantId}
            onPress={() => onToggleSplitParticipant(participant.participantId)}
            style={[styles.payerChip, participant.selected ? styles.optionCardSelected : null]}
          >
            <Text style={participant.selected ? styles.payerChipTextSelected : styles.payerChipText}>
              {participant.displayName}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.splitRowList}>
        {selectedParticipants.map((participant) => (
          <View key={participant.participantId} style={styles.manualSplitRow}>
            <Text style={styles.splitName}>{participant.displayName}</Text>
            <TextInput
              accessibilityLabel={`${participant.displayName} 부담 금액`}
              editable={!disabled}
              keyboardType={currency === 'KRW' || currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
              onChangeText={(value) => onUpdateManualSplitInput(participant.participantId, value)}
              placeholder="0"
              placeholderTextColor={theme.color.textFaint}
              style={styles.manualSplitInput}
              value={inputByParticipantId.get(participant.participantId) ?? ''}
            />
          </View>
        ))}
      </View>
      <Text style={styles.splitHelper}>
        입력 합계 {formatMoney(summary.splitAmountMinor, currency)} / 총액{' '}
        {summary.totalAmountMinor === null ? '-' : formatMoney(summary.totalAmountMinor, currency)}
      </Text>
      {differenceLabel ? <Text style={styles.splitHelper}>{differenceLabel}</Text> : null}
      {errorMessage || summary.validationMessage ? (
        <Text style={styles.errorMessage}>{errorMessage ?? summary.validationMessage}</Text>
      ) : null}
    </View>
  );
}

function manualSplitDifferenceLabel(differenceMinor: number | null, currency: SupportedCurrency): string | null {
  if (differenceMinor === null || differenceMinor === 0) {
    return null;
  }
  if (differenceMinor > 0) {
    return `남은 금액 ${formatMoney(differenceMinor, currency)}`;
  }
  return `초과 금액 ${formatMoney(Math.abs(differenceMinor), currency)}`;
}

function SplitRowsSection({
  helper,
  rows,
  title,
}: {
  helper: string;
  rows: QuickExpenseViewModel['splitPreviewRows'];
  title: string;
}) {
  return (
    <View style={styles.splitSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.splitHelper}>{helper}</Text>
      </View>
      <View style={styles.splitRowList}>
        {rows.map((row, index) => (
          <View key={`${row.participantId ?? 'removed'}-${index}`} style={styles.splitRow}>
            <Text style={styles.splitName}>{row.displayName}</Text>
            <Text style={styles.splitAmount}>{row.amountLabel}</Text>
          </View>
        ))}
      </View>
    </View>
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
    gap: theme.space[2],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  sectionHeader: {
    gap: theme.space[2],
  },
  timeLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  helper: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  successTitle: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  noticeBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  splitSection: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  splitHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  splitRowList: {
    gap: theme.space[3],
  },
  splitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  manualSplitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  manualSplitInput: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minWidth: 120,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    textAlign: 'right',
  },
  splitName: {
    color: theme.color.textBody,
    flex: 1,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  splitAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  optionList: {
    gap: theme.space[3],
  },
  memoInput: {
    minHeight: 88,
    paddingTop: theme.space[3],
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  modeChip: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  optionCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  optionCardSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  selectedPlaceBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  placeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  orderBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  placeType: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  amountInput: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
  },
  amountInputBox: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  input: {
    flex: 1,
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  currencyLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  payerChip: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  payerChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  payerChipTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
