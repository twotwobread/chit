import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';

import {
  ApiError,
  type Expense,
  type GetDayScheduleItemsResponse,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../../lib/auth/client';
import { clearStoredSession } from '../../../../../../../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../../lib/design';
import {
  deleteExpense,
  getDayExpense,
  getTripDayItinerary,
  listTripParticipants,
  updateExpense,
} from '../../../../../../../lib/trips/client';
import {
  buildExpenseEditInitialAmountInput,
  buildExpenseEditParticipantIds,
  buildExpenseEditViewModel,
  buildUpdateExpenseRequest,
  expenseDeleteFailureMessage,
  expenseSaveFailureMessage,
  type ExpenseEditFormErrors,
  type ExpenseEditViewModel,
} from '../../../../../../../lib/trips/expense-edit';

const dayRoute = (tripId: string, date: string): Href => `/trips/${tripId}/days/${date}` as Href;

type ExpenseEditState =
  | { status: 'loading' }
  | {
      status: 'success';
      expense: Expense;
      itinerary: GetDayScheduleItemsResponse;
      participants: TripParticipantListItem[];
    }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound'; message: string }
  | { status: 'error'; message: string };

export default function ExpenseEditScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    expenseId: expenseIdParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    expenseId?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const expenseId = Array.isArray(expenseIdParam) ? expenseIdParam[0] : expenseIdParam;

  const [state, setState] = useState<ExpenseEditState>({ status: 'loading' });
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [payerParticipantId, setPayerParticipantId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ExpenseEditFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

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
    if (!tripId || !date || !expenseId) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    setSaving(false);
    setDeleting(false);
    setErrors({});
    setFormMessage(null);
    try {
      const [expenseResponse, itinerary, participantsResponse] = await Promise.all([
        getDayExpense(tripId, date, expenseId),
        getTripDayItinerary(tripId, date),
        listTripParticipants(tripId),
      ]);
      const expense = expenseResponse.expense;
      const participantIDs = new Set(participantsResponse.participants.map((participant) => participant.participantId));
      const itemIDs = new Set(itinerary.scheduleItems.map((item) => item.id));
      setAmountInput(buildExpenseEditInitialAmountInput(expense));
      setMemoInput(expense.memo ?? '');
      setPayerParticipantId(
        expense.payer.participantId && participantIDs.has(expense.payer.participantId)
          ? expense.payer.participantId
          : null,
      );
      setSelectedItemId(expense.scheduleItemId && itemIDs.has(expense.scheduleItemId) ? expense.scheduleItemId : null);
      setState({ status: 'success', expense, itinerary, participants: participantsResponse.participants });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setState({ status: 'notFound', message: '여행이나 지출을 더 이상 사용할 수 없어요. 다시 불러와주세요.' });
        return;
      }
      setState({ status: 'error', message: '지출 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.' });
    }
  }, [date, expenseId, handleAuthError, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submitSave = useCallback(async () => {
    if (state.status !== 'success' || !tripId || !date || !expenseId || saving || deleting) {
      return;
    }

    const validation = buildUpdateExpenseRequest({
      amountInput,
      currency: state.expense.currency,
      payerParticipantId,
      memoInput,
      participantIds: buildExpenseEditParticipantIds(state.participants),
      scheduleItemId: selectedItemId,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      setFormMessage(null);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormMessage(null);
    try {
      await updateExpense(tripId, date, expenseId, validation.request);
      router.replace(dayRoute(tripId, date));
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setFormMessage(expenseSaveFailureMessage());
    } finally {
      setSaving(false);
    }
  }, [
    amountInput,
    date,
    deleting,
    expenseId,
    handleAuthError,
    memoInput,
    payerParticipantId,
    saving,
    selectedItemId,
    state,
    tripId,
  ]);

  const submitDelete = useCallback(async () => {
    if (!tripId || !date || !expenseId || saving || deleting) {
      return;
    }

    setDeleting(true);
    setFormMessage(null);
    try {
      await deleteExpense(tripId, date, expenseId);
      router.replace(dayRoute(tripId, date));
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setFormMessage(expenseDeleteFailureMessage());
    } finally {
      setDeleting(false);
    }
  }, [date, deleting, expenseId, handleAuthError, saving, tripId]);

  const confirmDelete = useCallback(() => {
    Alert.alert('이 지출을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void submitDelete() },
    ]);
  }, [submitDelete]);

  let viewModel: ExpenseEditViewModel | null = null;
  if (state.status === 'success') {
    viewModel = buildExpenseEditViewModel({
      amountInput,
      expense: state.expense,
      itinerary: state.itinerary,
      memoInput,
      participants: state.participants,
      selectedItemId,
      selectedPayerParticipantId: payerParticipantId,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>지출 수정</Text>

      {state.status === 'loading' ? (
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>지출 정보를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'auth' ? (
        <Card>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <Text style={styles.message}>로그인이 만료되었어요.</Text>
        </Card>
      ) : null}

      {state.status === 'invalid' ? (
        <Card>
          <Text style={styles.errorTitle}>잘못된 지출 수정 주소예요.</Text>
          <SecondaryButton label="돌아가기" onPress={() => router.back()} />
        </Card>
      ) : null}

      {state.status === 'notFound' || state.status === 'error' ? (
        <Card>
          <Text style={styles.errorTitle}>
            {state.status === 'notFound' ? '지출을 찾을 수 없어요.' : '불러올 수 없어요.'}
          </Text>
          <Text style={styles.message}>{state.message}</Text>
          <SecondaryButton label="다시 시도" onPress={() => void load()} />
        </Card>
      ) : null}

      {state.status === 'success' && viewModel ? (
        <ExpenseEditForm
          amountInput={amountInput}
          deleting={deleting}
          errors={errors}
          formMessage={formMessage}
          memoInput={memoInput}
          onAmountChange={setAmountInput}
          onDelete={confirmDelete}
          onMemoChange={setMemoInput}
          onPayerChange={setPayerParticipantId}
          onPlaceChange={setSelectedItemId}
          onSave={() => void submitSave()}
          saving={saving}
          viewModel={viewModel}
        />
      ) : null}
    </ScrollView>
  );
}

function ExpenseEditForm({
  amountInput,
  deleting,
  errors,
  formMessage,
  memoInput,
  onAmountChange,
  onDelete,
  onMemoChange,
  onPayerChange,
  onPlaceChange,
  onSave,
  saving,
  viewModel,
}: {
  amountInput: string;
  deleting: boolean;
  errors: ExpenseEditFormErrors;
  formMessage: string | null;
  memoInput: string;
  onAmountChange: (value: string) => void;
  onDelete: () => void;
  onMemoChange: (value: string) => void;
  onPayerChange: (value: string) => void;
  onPlaceChange: (value: string | null) => void;
  onSave: () => void;
  saving: boolean;
  viewModel: ExpenseEditViewModel;
}) {
  return (
    <Card>
      <View style={styles.headerBlock}>
        <Text style={styles.sectionTitle}>{viewModel.dayLabel}</Text>
        <Text style={styles.message}>{viewModel.formattedDate}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>금액</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onAmountChange}
          placeholder={viewModel.amountLabel}
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, errors.amount ? styles.inputError : null]}
          value={amountInput}
        />
        {errors.amount ? <Text style={styles.validationText}>{errors.amount}</Text> : null}
        <Text style={styles.readOnlyText}>
          통화: {viewModel.currency} · {viewModel.currencyLabel}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>결제자</Text>
        <View style={styles.optionList}>
          {viewModel.payerOptions.map((option) => (
            <Pressable
              key={option.participantId}
              accessibilityRole="button"
              onPress={() => onPayerChange(option.participantId)}
              style={[styles.optionChip, option.selected ? styles.optionChipSelected : null]}
            >
              <Text style={[styles.optionText, option.selected ? styles.optionTextSelected : null]}>
                {option.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.payer ? <Text style={styles.validationText}>{errors.payer}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>연결 장소</Text>
        <View style={styles.optionListVertical}>
          {viewModel.placeOptions.map((option) => (
            <Pressable
              key={option.itemId ?? 'none'}
              accessibilityRole="button"
              onPress={() => onPlaceChange(option.itemId)}
              style={[styles.placeOption, option.selected ? styles.placeOptionSelected : null]}
            >
              <Text style={[styles.optionText, option.selected ? styles.optionTextSelected : null]}>
                {option.label}
              </Text>
              <Text style={styles.optionDetail}>{option.detail}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          multiline
          onChangeText={onMemoChange}
          placeholder="메모를 입력해주세요."
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.memoInput, errors.memo ? styles.inputError : null]}
          value={memoInput}
        />
        {errors.memo ? <Text style={styles.validationText}>{errors.memo}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분담 미리보기</Text>
        {viewModel.splitPreviewMessage ? (
          <Text style={styles.validationText}>{viewModel.splitPreviewMessage}</Text>
        ) : null}
        {viewModel.splitPreviewRows.length > 0 ? (
          <View style={styles.splitList}>
            {viewModel.splitPreviewRows.map((row) => (
              <View key={row.participantId ?? row.displayName} style={styles.splitRow}>
                <Text style={styles.message}>{row.displayName}</Text>
                <Text style={styles.amountText}>{row.amountLabel}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.message}>금액을 입력하면 현재 참여자 기준으로 나눠 보여줘요.</Text>
        )}
      </View>

      {formMessage ? <Text style={styles.validationText}>{formMessage}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton label={viewModel.saveLabel} loading={saving} loadingLabel="저장 중..." onPress={onSave} />
        <SecondaryButton
          disabled={saving || deleting}
          label={deleting ? '삭제 중...' : viewModel.deleteLabel}
          onPress={onDelete}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    gap: theme.space[5],
    minHeight: '100%',
    padding: theme.space[5],
  },
  screenTitle: {
    alignSelf: 'stretch',
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    maxWidth: theme.layout.cardMaxW,
  },
  headerBlock: {
    gap: theme.space[1],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  errorTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  memoInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.color.danger,
  },
  readOnlyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  validationText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  optionListVertical: {
    gap: theme.space[2],
  },
  optionChip: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  optionChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  optionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionTextSelected: {
    color: theme.color.primary,
  },
  optionDetail: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  placeOption: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[4],
  },
  placeOptionSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  splitList: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  splitRow: {
    alignItems: 'center',
    borderBottomColor: theme.color.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.space[3],
  },
  amountText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  actions: {
    gap: theme.space[3],
  },
});
