import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type Expense, type GetDayScheduleItemsResponse, type TripParticipantListItem } from '@i-um/api-contract';

import { clearStoredSessionOnAuthError, isApiStatus } from '../auth/errors';
import { deleteExpense, getDayExpense, updateExpense } from '../trips/expense-api';
import { getTripDayItinerary } from '../trips/itinerary-api';
import { listTripParticipants } from '../trips/trip-api';
import {
  buildExpenseEditInitialAmountInput,
  buildExpenseEditInitialManualSplitInputs,
  buildExpenseEditParticipantIds,
  buildExpenseEditViewModel,
  buildUpdateExpenseRequest,
  expenseDeleteFailureMessage,
  expenseSaveFailureMessage,
  type ExpenseEditFormErrors,
  type ExpenseEditViewModel,
} from '../trips/expense-edit';
import { type QuickExpenseManualSplitInput, type QuickExpenseSplitPolicy } from '../trips/quick-expense';
import { tripItineraryDayPath } from '../trips/routes';

export type ExpenseEditState =
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

export function useExpenseEditController() {
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
  const [splitPolicy, setSplitPolicy] = useState<QuickExpenseSplitPolicy>('equal');
  const [manualSplitInputs, setManualSplitInputs] = useState<QuickExpenseManualSplitInput[]>([]);
  const [errors, setErrors] = useState<ExpenseEditFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (!(await clearStoredSessionOnAuthError(error))) {
      return false;
    }

    setState({ status: 'auth' });
    return true;
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
      setSplitPolicy(expense.splitPolicy === 'manual' ? 'manual' : 'equal');
      setManualSplitInputs(
        buildExpenseEditInitialManualSplitInputs(expense, expense.currency, participantsResponse.participants),
      );
      setState({ status: 'success', expense, itinerary, participants: participantsResponse.participants });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (isApiStatus(error, 403, 404)) {
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
      splitPolicy,
      payerParticipantId,
      memoInput,
      participantIds: buildExpenseEditParticipantIds(state.participants),
      manualSplitInputs,
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
      router.replace(tripItineraryDayPath(tripId, date));
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
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    saving,
    selectedItemId,
    splitPolicy,
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
      router.replace(tripItineraryDayPath(tripId, date));
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setFormMessage(expenseDeleteFailureMessage());
    } finally {
      setDeleting(false);
    }
  }, [date, deleting, expenseId, handleAuthError, saving, tripId]);

  const updateManualSplitInput = useCallback((participantId: string, amount: string) => {
    setManualSplitInputs((current) => {
      const existing = current.find((split) => split.participantId === participantId);
      if (!existing) {
        return [...current, { participantId, amountInput: amount }];
      }
      return current.map((split) =>
        split.participantId === participantId ? { ...split, amountInput: amount } : split,
      );
    });
    setErrors((current) => ({ ...current, participants: undefined }));
    setFormMessage(null);
  }, []);

  const confirmDelete = useCallback(() => {
    Alert.alert('이 지출을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void submitDelete() },
    ]);
  }, [submitDelete]);

  const goBack = () => {
    router.back();
  };

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

  return {
    amountInput,
    confirmDelete,
    deleting,
    errors,
    formMessage,
    goBack,
    load,
    manualSplitInputs,
    memoInput,
    saving,
    setAmountInput,
    setMemoInput,
    setPayerParticipantId,
    setSelectedItemId,
    setSplitPolicy,
    splitPolicy,
    state,
    submitSave,
    updateManualSplitInput,
    viewModel,
  };
}
