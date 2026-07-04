import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { focusAccessibilityHandle } from './accessibility-focus';
import {
  dayItineraryApiStatus,
  handleDayItineraryAuthOrReloadError,
  isDayItineraryAuthError,
} from './day-itinerary-editor-errors';
import { type DayItineraryContentFocusRequest, type DayItineraryContentFocusTarget } from './DayItineraryEditorParts';
import {
  type DayItineraryState,
  type DeleteState,
  type EditState,
  type LodgingPlacePickerState,
  type LodgingState,
  type NonPlaceEditorState,
  type ReorderState,
} from './DayItineraryEditorControllerTypes';
import { createDayItineraryDeleteActions } from './day-itinerary-editor-delete-actions';
import { createDayItineraryEditActions } from './day-itinerary-editor-edit-actions';
import { createDayItineraryLodgingActions } from './day-itinerary-editor-lodging-actions';
import { createDayItineraryReorderActions } from './day-itinerary-editor-reorder-actions';
import { useDayItineraryMapActions } from './useDayItineraryMapActions';
import { useDayItineraryReorderAutoScroll } from './useDayItineraryReorderAutoScroll';
import { buildDayItineraryViewModel, dayItineraryFailureState } from '../trips/day-itinerary';
import { buildDayItineraryAddPlaceSearchRoute } from '../trips/day-itinerary-add-place-navigation';
import { tripItineraryDayPath, tripItineraryPath } from '../trips/routes';
import { getTripDayItinerary } from '../trips/itinerary-api';
import {
  DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS,
  DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION,
  buildDayItinerarySharedUpdateBanner,
  isDayItinerarySharedUpdateReloadDisabled,
  markDayItinerarySharedUpdateApplied,
  reduceDayItinerarySharedUpdateFromResponse,
  shouldReconcileDayItinerarySharedUpdate,
  type DayItinerarySharedUpdateLocalState,
  type DayItinerarySharedUpdateState,
} from '../trips/shared-itinerary-updates';

export type UseDayItineraryEditorControllerOptions = {
  tripId?: string;
  date?: string;
  initialAction?: string;
};

export function useDayItineraryEditorController({
  tripId,
  date,
  initialAction,
}: UseDayItineraryEditorControllerOptions) {
  const [state, setState] = useState<DayItineraryState>({ status: 'loading' });
  const [editState, setEditState] = useState<EditState>({ status: 'idle' });
  const [nonPlaceEditorState, setNonPlaceEditorState] = useState<NonPlaceEditorState>({ status: 'idle' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const [reorderState, setReorderState] = useState<ReorderState>({ status: 'idle' });
  const [lodgingState, setLodgingState] = useState<LodgingState>({ status: 'idle' });
  const [lodgingPickerState, setLodgingPickerState] = useState<LodgingPlacePickerState>({ status: 'idle' });
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);
  const [contentFocusRequest, setContentFocusRequest] = useState<DayItineraryContentFocusRequest | null>(null);
  const [sharedUpdateState, setSharedUpdateState] = useState<DayItinerarySharedUpdateState>({
    baselineSignature: null,
    pendingSignature: null,
  });
  const [isAppActive, setIsAppActive] = useState(() => AppState.currentState === 'active');
  const {
    getReorderScrollOffsetY,
    isReorderDragging,
    requestReorderAutoScroll,
    scrollViewRef,
    setReorderDragActive,
    updateScrollContentSize,
    updateScrollLayout,
    updateScrollOffset,
  } = useDayItineraryReorderAutoScroll();
  const editStateRef = useRef<EditState>({ status: 'idle' });
  const nonPlaceEditorStateRef = useRef<NonPlaceEditorState>({ status: 'idle' });
  const deleteStateRef = useRef<DeleteState>({ status: 'idle' });
  const reorderStateRef = useRef<ReorderState>({ status: 'idle' });
  const lodgingStateRef = useRef<LodgingState>({ status: 'idle' });
  const lodgingPickerStateRef = useRef<LodgingPlacePickerState>({ status: 'idle' });
  const sharedUpdateStateRef = useRef<DayItinerarySharedUpdateState>({
    baselineSignature: null,
    pendingSignature: null,
  });
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appActiveRef = useRef(AppState.currentState === 'active');
  const screenFocusedRef = useRef(false);
  const sharedUpdatePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sharedUpdatePollInFlightRef = useRef(false);
  const itineraryRequestSequenceRef = useRef(0);
  const latestHandledItineraryRequestRef = useRef(0);
  const deleteOriginFocusTargetRef = useRef<number | null>(null);
  const focusRequestIdRef = useRef(0);
  const handledInitialActionRef = useRef<string | null>(null);

  const updateSharedUpdateState = useCallback((nextState: DayItinerarySharedUpdateState) => {
    sharedUpdateStateRef.current = nextState;
    setSharedUpdateState(nextState);
  }, []);

  const getSharedUpdateLocalState = useCallback(
    (): DayItinerarySharedUpdateLocalState => ({
      reorderStatus: reorderStateRef.current.status,
      createStatus: nonPlaceEditorStateRef.current.status,
      editStatus: editStateRef.current.status,
      deleteStatus: deleteStateRef.current.status,
      lodgingStatus: lodgingStateRef.current.status,
      lodgingPickerStatus: lodgingPickerStateRef.current.status,
    }),
    [],
  );

  const nextItineraryRequestSequence = useCallback(() => {
    itineraryRequestSequenceRef.current += 1;
    return itineraryRequestSequenceRef.current;
  }, []);

  const applyItineraryResponse = useCallback(
    (response: Awaited<ReturnType<typeof getTripDayItinerary>>, requestSequence?: number) => {
      const sequence = requestSequence ?? nextItineraryRequestSequence();
      if (sequence < latestHandledItineraryRequestRef.current) {
        return false;
      }

      latestHandledItineraryRequestRef.current = sequence;
      updateSharedUpdateState(markDayItinerarySharedUpdateApplied(response));
      setState({ status: 'success', viewModel: buildDayItineraryViewModel(response) });
      return true;
    },
    [nextItineraryRequestSequence, updateSharedUpdateState],
  );

  const handleItineraryFetchError = useCallback((error: unknown, options: { background: boolean }) => {
    if (isDayItineraryAuthError(error)) {
      setState({ status: 'auth' });
      return;
    }

    const apiStatus = dayItineraryApiStatus(error);
    if (apiStatus) {
      const failure = dayItineraryFailureState(apiStatus);
      if (failure.status === 'notFound') {
        setState({ status: 'notFound', title: failure.title, helper: failure.helper });
        return;
      }
      if (!options.background) {
        setState({ status: 'error', title: failure.title, helper: failure.helper });
      }
      return;
    }

    if (!options.background) {
      const failure = dayItineraryFailureState();
      setState({ status: 'error', title: failure.title, helper: failure.helper });
    }
  }, []);

  const enterAuthState = useCallback(() => {
    setState({ status: 'auth' });
  }, []);

  const handleRecoverableMutationError = useCallback(
    async (error: unknown, onReload: () => Promise<void>, onAuth: () => void = enterAuthState) =>
      handleDayItineraryAuthOrReloadError(error, { onAuth, onReload }),
    [enterAuthState],
  );

  useEffect(() => {
    editStateRef.current = editState;
  }, [editState]);

  useEffect(() => {
    nonPlaceEditorStateRef.current = nonPlaceEditorState;
  }, [nonPlaceEditorState]);

  useEffect(() => {
    deleteStateRef.current = deleteState;
  }, [deleteState]);

  useEffect(() => {
    reorderStateRef.current = reorderState;
  }, [reorderState]);

  useEffect(() => {
    lodgingStateRef.current = lodgingState;
  }, [lodgingState]);

  useEffect(() => {
    lodgingPickerStateRef.current = lodgingPickerState;
  }, [lodgingPickerState]);

  const discardReorder = useCallback(() => {
    setReorderDragActive(false);
    setReorderFeedback(null);
    setReorderState({ status: 'idle' });
  }, [setReorderDragActive]);

  const { clearMapActionFeedback, copyPlaceAddress, mapActionFeedback, openPlaceMap } = useDayItineraryMapActions({
    discardReorder,
  });

  const load = useCallback(async () => {
    if (!tripId || !date) {
      const notFound = dayItineraryFailureState(404);
      updateSharedUpdateState({ baselineSignature: null, pendingSignature: null });
      setState({ status: 'notFound', title: notFound.title, helper: notFound.helper });
      return;
    }

    const requestSequence = nextItineraryRequestSequence();
    clearMapActionFeedback();
    setState({ status: 'loading' });
    try {
      const response = await getTripDayItinerary(tripId, date);
      applyItineraryResponse(response, requestSequence);
    } catch (error) {
      if (requestSequence < latestHandledItineraryRequestRef.current) {
        return;
      }
      latestHandledItineraryRequestRef.current = requestSequence;
      handleItineraryFetchError(error, { background: false });
    }
  }, [
    applyItineraryResponse,
    clearMapActionFeedback,
    date,
    handleItineraryFetchError,
    nextItineraryRequestSequence,
    tripId,
    updateSharedUpdateState,
  ]);

  const refetchSharedItinerary = useCallback(async () => {
    if (!tripId || !date || sharedUpdatePollInFlightRef.current) {
      return;
    }

    sharedUpdatePollInFlightRef.current = true;
    const requestSequence = nextItineraryRequestSequence();
    try {
      const response = await getTripDayItinerary(tripId, date);
      if (!screenFocusedRef.current || !appActiveRef.current || requestSequence < itineraryRequestSequenceRef.current) {
        return;
      }

      const reduction = reduceDayItinerarySharedUpdateFromResponse(
        sharedUpdateStateRef.current,
        response,
        getSharedUpdateLocalState(),
      );
      latestHandledItineraryRequestRef.current = requestSequence;

      if (reduction.decision === 'autoApply') {
        applyItineraryResponse(response, requestSequence);
        return;
      }

      updateSharedUpdateState(reduction.state);
    } catch (error) {
      if (!screenFocusedRef.current || !appActiveRef.current || requestSequence < itineraryRequestSequenceRef.current) {
        return;
      }
      handleItineraryFetchError(error, { background: true });
    } finally {
      sharedUpdatePollInFlightRef.current = false;
    }
  }, [
    applyItineraryResponse,
    date,
    getSharedUpdateLocalState,
    handleItineraryFetchError,
    nextItineraryRequestSequence,
    tripId,
    updateSharedUpdateState,
  ]);

  const stopSharedUpdatePolling = useCallback(() => {
    if (sharedUpdatePollIntervalRef.current) {
      clearInterval(sharedUpdatePollIntervalRef.current);
      sharedUpdatePollIntervalRef.current = null;
    }
  }, []);

  const startSharedUpdatePolling = useCallback(() => {
    if (!tripId || !date || !appActiveRef.current || sharedUpdatePollIntervalRef.current) {
      return;
    }

    sharedUpdatePollIntervalRef.current = setInterval(() => {
      void refetchSharedItinerary();
    }, DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS);
  }, [date, refetchSharedItinerary, tripId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appStateRef.current === 'active';
      const nextIsActive = nextAppState === 'active';
      appStateRef.current = nextAppState;
      appActiveRef.current = nextIsActive;
      setIsAppActive(nextIsActive);

      if (!nextIsActive) {
        stopSharedUpdatePolling();
        return;
      }

      if (screenFocusedRef.current) {
        startSharedUpdatePolling();
        if (!wasActive) {
          void refetchSharedItinerary();
        }
      }
    });

    return () => subscription.remove();
  }, [refetchSharedItinerary, startSharedUpdatePolling, stopSharedUpdatePolling]);

  useEffect(() => {
    if (!tripId || !date || !screenFocusedRef.current || !isAppActive) {
      return;
    }

    if (!shouldReconcileDayItinerarySharedUpdate(sharedUpdateState, getSharedUpdateLocalState())) {
      return;
    }

    void refetchSharedItinerary();
  }, [
    date,
    nonPlaceEditorState.status,
    editState.status,
    deleteState.status,
    getSharedUpdateLocalState,
    isAppActive,
    lodgingPickerState.status,
    lodgingState.status,
    refetchSharedItinerary,
    reorderState.status,
    sharedUpdateState,
    tripId,
  ]);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      void load();
      if (appActiveRef.current) {
        startSharedUpdatePolling();
      }

      return () => {
        screenFocusedRef.current = false;
        stopSharedUpdatePolling();
        updateSharedUpdateState({ baselineSignature: null, pendingSignature: null });
        setReorderDragActive(false);
        if (reorderStateRef.current.status === 'editing') {
          setReorderFeedback(null);
          setReorderState({ status: 'idle' });
        }
      };
    }, [load, setReorderDragActive, startSharedUpdatePolling, stopSharedUpdatePolling, updateSharedUpdateState]),
  );

  const requestContentFocus = useCallback((target: DayItineraryContentFocusTarget) => {
    focusRequestIdRef.current += 1;
    setContentFocusRequest({ id: focusRequestIdRef.current, target });
  }, []);

  const clearContentFocusRequest = useCallback(() => {
    setContentFocusRequest(null);
  }, []);

  const focusDeleteOrigin = useCallback(
    (itemId: string) => {
      const originFocusTarget = deleteOriginFocusTargetRef.current;
      deleteOriginFocusTargetRef.current = null;
      if (focusAccessibilityHandle(originFocusTarget)) {
        return;
      }
      requestContentFocus({ kind: 'deleteTrigger', itemId });
    },
    [requestContentFocus],
  );

  const discardDayScreenLocalState = useCallback(() => {
    setReorderDragActive(false);
    setEditState({ status: 'idle' });
    setNonPlaceEditorState({ status: 'idle' });
    setDeleteState({ status: 'idle' });
    setReorderState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setLodgingPickerState({ status: 'idle' });
    setReorderFeedback(null);
    clearMapActionFeedback();
    setContentFocusRequest(null);
    deleteOriginFocusTargetRef.current = null;
  }, [clearMapActionFeedback, setReorderDragActive]);

  const reloadLatestSharedUpdate = useCallback(async () => {
    discardDayScreenLocalState();
    await load();
  }, [discardDayScreenLocalState, load]);

  const requestSharedUpdateReload = useCallback(() => {
    const localState = getSharedUpdateLocalState();
    if (isDayItinerarySharedUpdateReloadDisabled(localState)) {
      return;
    }

    Alert.alert(
      DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION.title,
      DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION.helper,
      [
        {
          text: DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION.cancelLabel,
          style: 'cancel',
        },
        {
          text: DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION.confirmLabel,
          style: 'destructive',
          onPress: () => {
            void reloadLatestSharedUpdate();
          },
        },
      ],
    );
  }, [getSharedUpdateLocalState, reloadLatestSharedUpdate]);

  const backToItinerary = () => {
    if (tripId && date) {
      router.replace(tripItineraryDayPath(tripId, date));
      return;
    }
    if (tripId) {
      router.replace(tripItineraryPath(tripId));
      return;
    }
    router.replace('/');
  };

  const {
    beginCreateNonPlace,
    beginEdit,
    cancelEdit,
    cancelNonPlaceEditor,
    submitEdit,
    submitNonPlaceEditor,
    updateEditValues,
    updateNonPlaceEditorValues,
  } = createDayItineraryEditActions({
    clearMapActionFeedback,
    date,
    deleteOriginFocusTargetRef,
    discardReorder,
    editState,
    handleRecoverableMutationError,
    load,
    nonPlaceEditorState,
    setDeleteState,
    setEditState,
    setLodgingState,
    setNonPlaceEditorState,
    tripId,
  });

  const { beginReorder, moveReorderItem, submitReorder } = createDayItineraryReorderActions({
    applyItineraryResponse,
    clearMapActionFeedback,
    date,
    deleteOriginFocusTargetRef,
    handleRecoverableMutationError,
    load,
    reorderState,
    setDeleteState,
    setEditState,
    setLodgingState,
    setNonPlaceEditorState,
    setReorderFeedback,
    setReorderState,
    tripId,
  });

  useEffect(() => {
    if (!initialAction || handledInitialActionRef.current === initialAction || state.status !== 'success') {
      return;
    }

    if (initialAction === 'nonPlace') {
      handledInitialActionRef.current = initialAction;
      beginCreateNonPlace();
      return;
    }

    if (initialAction === 'reorder') {
      handledInitialActionRef.current = initialAction;
      beginReorder(state.viewModel);
    }
    // The entry functions intentionally use latest local state setters and are recreated per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction, state]);

  const cancelReorder = () => {
    discardReorder();
  };

  const { beginDelete, cancelDelete, submitDelete } = createDayItineraryDeleteActions({
    clearMapActionFeedback,
    date,
    deleteOriginFocusTargetRef,
    deleteState,
    discardReorder,
    enterAuthState,
    focusDeleteOrigin,
    handleRecoverableMutationError,
    load,
    requestContentFocus,
    setDeleteState,
    setEditState,
    setLodgingState,
    setNonPlaceEditorState,
    state,
    tripId,
  });

  const {
    cancelLodgingPicker,
    openLodgingPlaceSelection,
    openManualLodgingForm,
    submitClearCurrentLodging,
    submitClearLodging,
    submitManualLodging,
    submitSelectLodgingPlace,
    submitSetLodging,
    updateManualLodgingValues,
  } = createDayItineraryLodgingActions({
    clearMapActionFeedback,
    date,
    deleteOriginFocusTargetRef,
    discardReorder,
    enterAuthState,
    handleRecoverableMutationError,
    load,
    lodgingPickerState,
    lodgingState,
    setDeleteState,
    setEditState,
    setLodgingPickerState,
    setLodgingState,
    state,
    tripId,
  });

  const sharedUpdateLocalState: DayItinerarySharedUpdateLocalState = {
    reorderStatus: reorderState.status,
    createStatus: nonPlaceEditorState.status,
    editStatus: editState.status,
    deleteStatus: deleteState.status,
    lodgingStatus: lodgingState.status,
    lodgingPickerStatus: lodgingPickerState.status,
  };
  const sharedUpdateBanner = buildDayItinerarySharedUpdateBanner(sharedUpdateState);
  const sharedUpdateReloadDisabled = isDayItinerarySharedUpdateReloadDisabled(sharedUpdateLocalState);
  const isDeleteModalVisible = deleteState.status === 'confirming' || deleteState.status === 'deleting';

  const addPlace = () => {
    if (tripId && date) {
      router.push(buildDayItineraryAddPlaceSearchRoute(tripId, date));
    }
  };

  const goToLogin = () => {
    router.replace('/login');
  };

  return {
    addPlace,
    backToItinerary,
    cancelDelete,
    cancelEdit,
    cancelLodgingPicker,
    cancelNonPlaceEditor,
    cancelReorder,
    clearContentFocusRequest,
    contentFocusRequest,
    copyPlaceAddress,
    deleteState,
    editState,
    getReorderScrollOffsetY,
    goToLogin,
    isDeleteModalVisible,
    isReorderDragging,
    load,
    lodgingPickerState,
    lodgingState,
    mapActionFeedback,
    moveReorderItem,
    nonPlaceEditorState,
    openLodgingPlaceSelection,
    openManualLodgingForm,
    openPlaceMap,
    reorderFeedback,
    reorderState,
    requestReorderAutoScroll,
    requestSharedUpdateReload,
    scrollViewRef,
    setReorderDragActive,
    sharedUpdateBanner,
    sharedUpdateReloadDisabled,
    state,
    submitClearCurrentLodging,
    submitClearLodging,
    submitDelete,
    submitEdit,
    submitManualLodging,
    submitNonPlaceEditor,
    submitReorder,
    submitSelectLodgingPlace,
    submitSetLodging,
    updateEditValues,
    updateManualLodgingValues,
    updateNonPlaceEditorValues,
    updateScrollContentSize,
    updateScrollLayout,
    updateScrollOffset,
    beginCreateNonPlace,
    beginDelete,
    beginEdit,
    beginReorder,
  };
}
