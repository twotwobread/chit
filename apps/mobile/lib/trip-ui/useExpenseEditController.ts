import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type Expense, type GetDayScheduleItemsResponse, type TripParticipantListItem } from '@i-um/api-contract';

import { clearStoredSessionOnAuthError, isApiStatus } from '../auth/errors';
import {
  deleteExpense,
  deleteTripExpense,
  getDayExpense,
  getTripExpense,
  updateExpense,
  updateTripExpense,
} from '../trips/expense-api';
import { listTripScheduleItems } from '../trips/itinerary-api';
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
import {
  resolveQuickExpenseItemDayId,
  toggleQuickExpenseSplitParticipant,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitPolicy,
} from '../trips/quick-expense';
import { tripItineraryDayPath, tripSettlePath } from '../trips/routes';
import { resolveTripShellDetail } from '../trips/trip-shell-detail';
import { useTripShellState } from '../trips/trip-shell-context';
import { buildTripItinerariesFromTripScheduleItems } from '../trips/trip-map';

export type ExpenseEditState =
  | { status: 'loading' }
  | {
      status: 'success';
      expense: Expense;
      itinerary: GetDayScheduleItemsResponse | null;
      itineraries: GetDayScheduleItemsResponse[];
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
  const shellState = useTripShellState();

  const [state, setState] = useState<ExpenseEditState>({ status: 'loading' });
  const [titleInput, setTitleInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [payerParticipantId, setPayerParticipantId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTripDayId, setSelectedTripDayId] = useState<string | null>(null);
  const [selectedSplitParticipantIds, setSelectedSplitParticipantIds] = useState<string[]>([]);
  const [splitPolicy, setSplitPolicy] = useState<QuickExpenseSplitPolicy>('equal');
  const [manualSplitInputs, setManualSplitInputs] = useState<QuickExpenseManualSplitInput[]>([]);
  const [includeInSettlement, setIncludeInSettlement] = useState(true);
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
    if (!tripId || !expenseId) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    setSaving(false);
    setDeleting(false);
    setErrors({});
    setFormMessage(null);

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(expenseEditShellFailureState(shellDetail.status));
      return;
    }

    try {
      const [expenseResponse, scheduleResponse, participantsResponse] = await Promise.all([
        date ? getDayExpense(tripId, date, expenseId) : getTripExpense(tripId, expenseId),
        listTripScheduleItems(tripId),
        listTripParticipants(tripId),
      ]);
      const expense = expenseResponse.expense;
      const itineraries = buildTripItinerariesFromTripScheduleItems(shellDetail.detail.days, scheduleResponse);
      const itinerary = date ? (itineraries.find((candidate) => candidate.day.id === date) ?? null) : null;
      const participantIDs = new Set(participantsResponse.participants.map((participant) => participant.participantId));
      const itemIDs = new Set(itineraries.flatMap((candidate) => candidate.scheduleItems.map((item) => item.id)));
      const selectedItemId =
        expense.scheduleItemId && itemIDs.has(expense.scheduleItemId) ? expense.scheduleItemId : null;
      setTitleInput(expense.title ?? (expense.anchorType === 'trip' ? expense.displayTitle : ''));
      setAmountInput(buildExpenseEditInitialAmountInput(expense));
      setMemoInput(expense.memo ?? '');
      setPayerParticipantId(
        expense.payer.participantId && participantIDs.has(expense.payer.participantId)
          ? expense.payer.participantId
          : null,
      );
      setSelectedItemId(selectedItemId);
      setSelectedTripDayId(resolveQuickExpenseItemDayId(itineraries, selectedItemId) ?? expense.tripDayId ?? null);
      setSelectedSplitParticipantIds(
        buildExpenseEditSelectedSplitParticipantIds(expense, participantsResponse.participants),
      );
      setSplitPolicy(expense.splitPolicy === 'manual' ? 'manual' : 'equal');
      setIncludeInSettlement(expense.includeInSettlement);
      setManualSplitInputs(
        buildExpenseEditInitialManualSplitInputs(expense, expense.currency, participantsResponse.participants),
      );
      setState({ status: 'success', expense, itinerary, itineraries, participants: participantsResponse.participants });
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
  }, [date, expenseId, handleAuthError, shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submitSave = useCallback(async () => {
    if (state.status !== 'success' || !tripId || !expenseId || saving || deleting) {
      return;
    }
    const isTripLevel = state.itinerary === null;
    if (!isTripLevel && !date) {
      return;
    }
    const tripDayId = date ?? '';

    const activeManualSplitInputs = manualSplitInputs.filter((input) =>
      selectedSplitParticipantIds.includes(input.participantId),
    );
    const validation = buildUpdateExpenseRequest({
      amountInput,
      currency: state.expense.currency,
      splitPolicy,
      payerParticipantId,
      memoInput,
      participantIds: buildExpenseEditParticipantIds(state.participants, selectedSplitParticipantIds),
      manualSplitInputs: activeManualSplitInputs,
      scheduleItemId: selectedItemId,
      titleInput,
      includeInSettlement,
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
      if (isTripLevel) {
        await updateTripExpense(tripId, expenseId, validation.request);
        router.replace(tripSettlePath(tripId));
      } else {
        const targetTripDayId =
          resolveQuickExpenseItemDayId(state.itineraries, selectedItemId) ?? selectedTripDayId ?? tripDayId;
        await updateExpense(tripId, targetTripDayId, expenseId, validation.request);
        router.replace(tripItineraryDayPath(tripId, targetTripDayId));
      }
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
    includeInSettlement,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    saving,
    selectedItemId,
    selectedSplitParticipantIds,
    selectedTripDayId,
    splitPolicy,
    state,
    titleInput,
    tripId,
  ]);

  const submitDelete = useCallback(async () => {
    if (state.status !== 'success' || !tripId || !expenseId || saving || deleting) {
      return;
    }
    const isTripLevel = state.itinerary === null;
    if (!isTripLevel && !date) {
      return;
    }
    const tripDayId = date ?? '';

    setDeleting(true);
    setFormMessage(null);
    try {
      if (isTripLevel) {
        await deleteTripExpense(tripId, expenseId);
        router.replace(tripSettlePath(tripId));
      } else {
        await deleteExpense(tripId, tripDayId, expenseId);
        router.replace(tripItineraryDayPath(tripId, tripDayId));
      }
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setFormMessage(expenseDeleteFailureMessage());
    } finally {
      setDeleting(false);
    }
  }, [date, deleting, expenseId, handleAuthError, saving, state, tripId]);

  const selectTripDay = useCallback((tripDayId: string) => {
    setSelectedTripDayId(tripDayId);
    setSelectedItemId(null);
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  }, []);

  const clearTripDay = useCallback(() => {
    setSelectedTripDayId(null);
    setSelectedItemId(null);
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  }, []);

  const selectItem = useCallback(
    (itemId: string | null) => {
      setSelectedItemId(itemId);
      if (state.status === 'success') {
        setSelectedTripDayId(resolveQuickExpenseItemDayId(state.itineraries, itemId) ?? selectedTripDayId);
      }
      setErrors((current) => ({ ...current, item: undefined }));
      setFormMessage(null);
    },
    [selectedTripDayId, state],
  );

  const toggleSplitParticipant = useCallback((participantId: string) => {
    setSelectedSplitParticipantIds((current) => toggleQuickExpenseSplitParticipant(current, participantId));
    setErrors((current) => ({ ...current, participants: undefined }));
    setFormMessage(null);
  }, []);

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
      itineraries: state.itineraries,
      memoInput,
      participants: state.participants,
      selectedItemId,
      selectedPayerParticipantId: payerParticipantId,
      selectedSplitParticipantIds,
      selectedTripDayId,
    });
  }

  return {
    amountInput,
    confirmDelete,
    deleting,
    errors,
    formMessage,
    goBack,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    saving,
    clearTripDay,
    selectItem,
    selectTripDay,
    selectedSplitParticipantIds,
    selectedTripDayId,
    setAmountInput,
    setIncludeInSettlement,
    setMemoInput,
    setPayerParticipantId,
    setSplitPolicy,
    setTitleInput,
    splitPolicy,
    state,
    submitSave,
    titleInput,
    toggleSplitParticipant,
    updateManualSplitInput,
    viewModel,
  };
}

function expenseEditShellFailureState(status: 'auth' | 'notFound' | 'error'): ExpenseEditState {
  if (status === 'auth') {
    return { status: 'auth' };
  }
  if (status === 'notFound') {
    return { status: 'notFound', message: '여행이나 지출을 더 이상 사용할 수 없어요. 다시 불러와주세요.' };
  }
  return { status: 'error', message: '지출 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.' };
}

function buildExpenseEditSelectedSplitParticipantIds(
  expense: Expense,
  participants: TripParticipantListItem[],
): string[] {
  const availableParticipantIds = new Set(participants.map((participant) => participant.participantId));
  const splitParticipantIds = expense.splits
    .map((split) => split.participant.participantId)
    .filter(
      (participantId): participantId is string => participantId !== null && availableParticipantIds.has(participantId),
    );
  return splitParticipantIds.length > 0 ? splitParticipantIds : buildExpenseEditParticipantIds(participants);
}
