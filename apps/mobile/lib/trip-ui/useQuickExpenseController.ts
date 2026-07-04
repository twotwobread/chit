import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type GetDayScheduleItemsResponse,
  type SupportedCurrency,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { apiErrorStatus, clearStoredSessionOnAuthError, isApiStatus } from '../auth/errors';
import { createQuickExpense, updateExpense } from '../trips/expense-api';
import { getTripDayItinerary } from '../trips/itinerary-api';
import { getTripDetail, listTripParticipants } from '../trips/trip-api';
import { getScheduleItems } from '../trips/day-itinerary';
import {
  buildCreateQuickExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseManualSplitInputsFromRows,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  quickExpenseFailureMessage,
  resolveQuickExpenseReturnPath,
  toggleQuickExpenseSplitParticipant,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseSplitPolicy,
  type QuickExpenseViewModel,
} from '../trips/quick-expense';

export type QuickExpenseState =
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
      if (isApiStatus(error, 403, 404)) {
        setState({ status: 'notFound', message: quickExpenseFailureMessage(apiErrorStatus(error)) });
        return;
      }
      setState({
        status: 'error',
        message: quickExpenseFailureMessage(apiErrorStatus(error)),
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
          participants: state.participants,
          selectedItemId,
          selectedSplitParticipantIds,
          shouldChooseItem: state.shouldChooseItem,
        })
      : null;

  return {
    amountInput,
    backToDay,
    errors,
    formMessage,
    goToLogin,
    load,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    savedSummary,
    saving,
    selectItem,
    selectPayer,
    selectSplitPolicy,
    selectedItemId,
    selectedSplitParticipantIds,
    setMemoInput,
    splitPolicy,
    state,
    submit,
    toggleSplitParticipant,
    updateAmountInput,
    updateManualSplitInput,
    viewModel,
  };
}
