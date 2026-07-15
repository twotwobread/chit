import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type GetDayScheduleItemsResponse,
  type SupportedCurrency,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { apiErrorStatus, clearStoredSessionOnAuthError, isApiStatus } from '../auth/errors';
import { createQuickExpense, createTripExpense, updateExpense } from '../trips/expense-api';
import { getTripDayItinerary, listTripScheduleItems } from '../trips/itinerary-api';
import { listTripParticipants } from '../trips/trip-api';
import { getScheduleItems } from '../trips/day-itinerary';
import { resolveTripShellDetail } from '../trips/trip-shell-detail';
import { useTripShellState } from '../trips/trip-shell-context';
import { buildTripItinerariesFromTripScheduleItems } from '../trips/trip-map';
import {
  buildCreateQuickExpenseRequest,
  buildCreateTripExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseManualSplitInputsFromRows,
  buildQuickExpenseMemoUpdateRequest,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  quickExpenseFailureMessage,
  resolveQuickExpenseItemDayId,
  resolveTodayQuickExpenseInitialItemId,
  resolveQuickExpenseReturnPath,
  toggleQuickExpenseSplitParticipant,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseSplitPolicy,
  type QuickExpenseViewModel,
} from '../trips/quick-expense';
import { localDateString } from '../trips/status';

export type QuickExpenseState =
  | { status: 'loading' }
  | {
      status: 'success';
      tripName: string;
      currency: SupportedCurrency;
      itinerary: GetDayScheduleItemsResponse;
      itineraries: GetDayScheduleItemsResponse[];
      participants: TripParticipantListItem[];
      mode: 'today' | 'settlement';
      shouldChooseItem: boolean;
    }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound'; message: string }
  | { status: 'error'; message: string };

export function useQuickExpenseController() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    itemId: itemIdParam,
    returnTo: returnToParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    itemId?: string | string[];
    returnTo?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const routeItemId = Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
  const shellState = useTripShellState();

  const [state, setState] = useState<QuickExpenseState>({ status: 'loading' });
  const [titleInput, setTitleInput] = useState('');
  const [expenseDateInput, setExpenseDateInput] = useState(localDateString());
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTripDayId, setSelectedTripDayId] = useState<string | null>(null);
  const [payerParticipantId, setPayerParticipantId] = useState<string | null>(null);
  const [selectedSplitParticipantIds, setSelectedSplitParticipantIds] = useState<string[]>([]);
  const [splitPolicy, setSplitPolicy] = useState<QuickExpenseSplitPolicy>('equal');
  const [manualSplitInputs, setManualSplitInputs] = useState<QuickExpenseManualSplitInput[]>([]);
  const [includeInSettlement, setIncludeInSettlement] = useState(true);
  const [errors, setErrors] = useState<QuickExpenseFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<QuickExpenseSavedSplitSummary | null>(null);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (!(await clearStoredSessionOnAuthError(error))) {
      return false;
    }

    setState({ status: 'auth' });
    return true;
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

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(quickExpenseShellFailureState(shellDetail.status));
      return;
    }

    try {
      const participantsResponse = await listTripParticipants(tripId);
      const tripDetail = shellDetail.detail;
      const itineraries =
        returnTo === 'settle'
          ? buildTripItinerariesFromTripScheduleItems(tripDetail.days, await listTripScheduleItems(tripId))
          : [await getTripDayItinerary(tripId, date)];
      const itinerary = itineraries.find((candidate) => candidate.day.id === date) ?? itineraries[0];
      if (!itinerary) {
        setState({ status: 'invalid' });
        return;
      }
      const isSettlementMode = returnTo === 'settle';
      const scheduleItems = itineraries.flatMap((candidate) => getScheduleItems(candidate));
      const selectedItemId = isSettlementMode
        ? routeItemId && scheduleItems.some((item) => item.id === routeItemId)
          ? routeItemId
          : null
        : resolveTodayQuickExpenseInitialItemId(scheduleItems, routeItemId);
      const initialTripDayId = isSettlementMode
        ? resolveQuickExpenseItemDayId(itineraries, selectedItemId)
        : (resolveQuickExpenseItemDayId(itineraries, selectedItemId) ?? itinerary.day.id);
      const participants = participantsResponse.participants;
      setSelectedItemId(selectedItemId);
      setSelectedTripDayId(initialTripDayId);
      setPayerParticipantId(participants.length === 1 ? participants[0].participantId : null);
      setSelectedSplitParticipantIds(buildDefaultSplitParticipantIds(participants));
      setSplitPolicy('equal');
      setManualSplitInputs([]);
      setIncludeInSettlement(true);
      setTitleInput('');
      setExpenseDateInput(localDateString());
      setAmountInput('');
      setMemoInput('');
      setState({
        status: 'success',
        tripName: tripDetail.trip.name,
        currency: tripDetail.trip.defaultCurrency,
        itinerary,
        itineraries,
        mode: isSettlementMode ? 'settlement' : 'today',
        participants,
        shouldChooseItem: !isSettlementMode && selectedItemId === null,
      });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (isApiStatus(error, 403, 404)) {
        setState({ status: 'notFound', message: quickExpenseFailureMessage(apiErrorStatus(error)) });
        return;
      }
      setState({
        status: 'error',
        message: quickExpenseFailureMessage(apiErrorStatus(error)),
      });
    }
  }, [date, handleAuthError, returnTo, routeItemId, shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateTitleInput = (value: string) => {
    setTitleInput(value);
    setErrors((current) => ({ ...current, title: undefined }));
    setFormMessage(null);
  };

  const updateExpenseDateInput = (value: string) => {
    setExpenseDateInput(value);
    setErrors((current) => ({ ...current, expenseDate: undefined }));
    setFormMessage(null);
  };

  const updateAmountInput = (value: string) => {
    setAmountInput(value);
    setErrors((current) => ({ ...current, amount: undefined }));
    setFormMessage(null);
  };

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    if (state.status === 'success') {
      setSelectedTripDayId(resolveQuickExpenseItemDayId(state.itineraries, itemId) ?? selectedTripDayId);
    }
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  };

  const selectTripDay = (tripDayId: string) => {
    setSelectedTripDayId(tripDayId);
    setSelectedItemId(null);
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  };

  const clearTripDay = () => {
    setSelectedTripDayId(null);
    setSelectedItemId(null);
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

  const toggleIncludeInSettlement = () => {
    setIncludeInSettlement((current) => !current);
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

    setSaving(true);
    setFormMessage(null);
    setErrors({});
    try {
      const response =
        state.mode === 'settlement'
          ? await submitSettlementExpense({ activeManualSplitInputs, state })
          : await submitTodayQuickExpense({ activeManualSplitInputs, state });
      setSavedSummary(
        buildSavedEqualSplitSummary({
          amountMinor: response.expense.amountMinor,
          currency: response.expense.currency,
          splits: response.expense.splits,
        }),
      );
    } catch (error) {
      if (error instanceof QuickExpenseValidationAbort) {
        return;
      }
      if (await handleAuthError(error)) {
        return;
      }
      if (isApiStatus(error, 409)) {
        setFormMessage(quickExpenseFailureMessage(apiErrorStatus(error)));
        await load();
        return;
      }
      if (isApiStatus(error, 403, 404)) {
        setFormMessage(quickExpenseFailureMessage(apiErrorStatus(error)));
        return;
      }
      setFormMessage(quickExpenseFailureMessage(apiErrorStatus(error)));
    } finally {
      setSaving(false);
    }
  };

  const submitSettlementExpense = async ({
    activeManualSplitInputs,
    state,
  }: {
    activeManualSplitInputs: QuickExpenseManualSplitInput[];
    state: Extract<QuickExpenseState, { status: 'success' }>;
  }) => {
    const validation = buildCreateTripExpenseRequest({
      titleInput,
      expenseDate: expenseDateInput,
      amountInput,
      currency: state.currency,
      selectedTripDayId,
      scheduleItemId: selectedItemId,
      splitPolicy,
      participantIds: selectedSplitParticipantIds,
      manualSplitInputs: activeManualSplitInputs,
      payerParticipantId,
      memoInput,
      includeInSettlement,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      throw new QuickExpenseValidationAbort();
    }
    return createTripExpense(tripId!, validation.request);
  };

  const submitTodayQuickExpense = async ({
    activeManualSplitInputs,
    state,
  }: {
    activeManualSplitInputs: QuickExpenseManualSplitInput[];
    state: Extract<QuickExpenseState, { status: 'success' }>;
  }) => {
    const validation = buildCreateQuickExpenseRequest({
      amountInput,
      currency: state.currency,
      scheduleItemId: selectedItemId,
      splitPolicy,
      participantIds: selectedSplitParticipantIds,
      manualSplitInputs: activeManualSplitInputs,
      payerParticipantId,
      includeInSettlement,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      throw new QuickExpenseValidationAbort();
    }

    const expenseTripDayId = resolveQuickExpenseItemDayId(state.itineraries, selectedItemId) ?? date!;
    const response = await createQuickExpense(tripId!, expenseTripDayId, validation.request);
    const memoUpdateRequest = buildQuickExpenseMemoUpdateRequest({ createRequest: validation.request, memoInput });
    if (memoUpdateRequest) {
      await updateExpense(tripId!, expenseTripDayId, response.expense.id, memoUpdateRequest);
    }
    return response;
  };

  const backToDay = () => {
    if (!tripId || !date) {
      router.replace('/');
      return;
    }
    router.replace(resolveQuickExpenseReturnPath({ tripId, date, returnTo: returnToParam }));
  };

  const goToLogin = () => {
    router.replace('/login');
  };

  const viewModel =
    state.status === 'success'
      ? buildQuickExpenseViewModel({
          amountInput,
          currency: state.currency,
          itinerary: state.itinerary,
          itineraries: state.itineraries,
          participants: state.participants,
          selectedItemId,
          selectedSplitParticipantIds,
          selectedTripDayId,
          shouldChooseItem: state.shouldChooseItem || selectedItemId === null,
        })
      : null;

  return {
    amountInput,
    backToDay,
    clearTripDay,
    errors,
    expenseDateInput,
    formMessage,
    goToLogin,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    savedSummary,
    saving,
    selectItem,
    selectPayer,
    selectTripDay,
    selectSplitPolicy,
    selectedItemId,
    selectedSplitParticipantIds,
    selectedTripDayId,
    setMemoInput,
    splitPolicy,
    state,
    submit,
    titleInput,
    toggleIncludeInSettlement,
    toggleSplitParticipant,
    updateAmountInput,
    updateExpenseDateInput,
    updateManualSplitInput,
    updateTitleInput,
    viewModel,
  };
}

class QuickExpenseValidationAbort extends Error {}

function quickExpenseShellFailureState(status: 'auth' | 'notFound' | 'error'): QuickExpenseState {
  if (status === 'notFound') {
    return { status: 'notFound', message: quickExpenseFailureMessage(404) };
  }
  if (status === 'error') {
    return { status: 'error', message: quickExpenseFailureMessage() };
  }
  return { status };
}
