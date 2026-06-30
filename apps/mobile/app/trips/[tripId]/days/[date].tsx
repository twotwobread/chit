import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState,
  findNodeHandle,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  ApiError,
  type CreateNonPlaceScheduleItemRequest,
  type NonPlaceTransportMode,
  type TripPlaceType,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { Badge, PlacePin, PlaceTag, theme } from '../../../../lib/design';
import {
  buildDayItineraryPlaceAccessibilityLabel,
  buildDayItineraryViewModel,
  dayItineraryFailureState,
  type DayItineraryRowViewModel,
  type DayItineraryViewModel,
} from '../../../../lib/trips/day-itinerary';
import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../../../../lib/trips/day-itinerary-map-actions';
import {
  buildDayItineraryReorderAction,
  buildDayItineraryReorderConflictViewModel,
  buildDayItineraryReorderDraft,
  buildDayItineraryReorderSuccessViewModel,
  buildDayItineraryReorderSubmitState,
  buildReorderScheduleItemsRequest,
  dayItineraryReorderFailureState,
  moveDayItineraryReorderItem,
  submitDayItineraryReorder,
  type DayItineraryReorderDraftViewModel,
} from '../../../../lib/trips/reorder-itinerary';
import {
  resolveDayItineraryDragAutoScrollOffset,
  resolveDayItineraryDragOffsetY,
  resolveDayItineraryDragTargetIndex,
} from '../../../../lib/trips/reorder-itinerary-drag';
import {
  buildDayItineraryDeleteConfirmation,
  buildDayItineraryDeleteSubmitState,
  buildDayItineraryEditForm,
  buildDayItineraryEditSubmitState,
  canDismissDayItineraryDeleteModal,
  canSubmitDayItineraryDelete,
  dayItineraryMutationFailureState,
  resolveDayItineraryDeleteSuccessFocusTarget,
  validateDayItineraryEditForm,
  type DayItineraryDeleteFocusTarget,
  type DayItineraryEditFormErrors,
  type DayItineraryEditFormValues,
} from '../../../../lib/trips/day-itinerary-edit';
import { manualPlaceTypeOptions } from '../../../../lib/trips/manual-place';
import {
  buildNonPlaceScheduleItemEditForm,
  buildNonPlaceScheduleItemSubmitState,
  emptyNonPlaceScheduleItemForm,
  nonPlaceCategoryOptions,
  nonPlaceTransportModeOptions,
  validateCreateNonPlaceScheduleItemForm,
  validateUpdateNonPlaceScheduleItemForm,
  type NonPlaceScheduleItemFormErrors,
  type NonPlaceScheduleItemFormValues,
} from '../../../../lib/trips/non-place-schedule-item';
import { buildDayItineraryAddPlaceSearchRoute } from '../../../../lib/trips/day-itinerary-add-place-navigation';
import { tripItineraryPath } from '../../../../lib/trips/routes';
import {
  clearDayLodgingPlace,
  createManualDayLodgingPlace,
  createNonPlaceScheduleItem,
  deleteScheduleItem,
  getTripDayItinerary,
  listTripPlaces,
  reorderScheduleItems,
  setDayLodgingPlace,
  updateScheduleItem,
} from '../../../../lib/trips/client';
import {
  buildDayLodgingPanel,
  buildDayLodgingPlaceOptions,
  buildDayLodgingRowViewModel,
  buildManualDayLodgingPlaceSubmitState,
  buildSetDayLodgingPlaceRequest,
  dayLodgingCopy,
  dayLodgingMutationFailureState,
  validateManualDayLodgingPlaceForm,
  type DayLodgingManualFormErrors,
  type DayLodgingManualFormValues,
  type DayLodgingPlaceOptionViewModel,
  type DayLodgingSubmittingState,
} from '../../../../lib/trips/lodging-place';
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
} from '../../../../lib/trips/shared-itinerary-updates';

type DayItineraryState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayItineraryViewModel }
  | { status: 'auth' }
  | { status: 'notFound'; title: string; helper: string }
  | { status: 'error'; title: string; helper: string };

type EditState =
  | { status: 'idle' }
  | {
      status: 'editing' | 'saving';
      item: DayItineraryRowViewModel;
      original: DayItineraryEditFormValues;
      values: DayItineraryEditFormValues;
      errors: DayItineraryEditFormErrors;
      error?: { title: string; helper: string };
    };

type NonPlaceEditorState =
  | { status: 'idle' }
  | {
      status: 'editing' | 'saving';
      mode: 'create';
      values: NonPlaceScheduleItemFormValues;
      errors: NonPlaceScheduleItemFormErrors;
      error?: { title: string; helper: string };
    }
  | {
      status: 'editing' | 'saving';
      mode: 'edit';
      item: DayItineraryRowViewModel;
      original: NonPlaceScheduleItemFormValues;
      values: NonPlaceScheduleItemFormValues;
      errors: NonPlaceScheduleItemFormErrors;
      error?: { title: string; helper: string };
    };

type DeleteState =
  | { status: 'idle' }
  | { status: 'confirming' | 'deleting'; item: DayItineraryRowViewModel; error?: { title: string; helper: string } };

type ReorderState =
  | { status: 'idle' }
  | {
      status: 'editing' | 'saving';
      draft: DayItineraryReorderDraftViewModel;
      error?: { title: string; helper: string };
    };

type LodgingState =
  | { status: 'idle' }
  | { status: 'setting' | 'clearing'; itemId: string }
  | { status: 'error'; error: { title: string; helper: string } };

type LodgingPlacePickerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'selecting'; options: DayLodgingPlaceOptionViewModel[] }
  | { status: 'manual' | 'creating'; values: DayLodgingManualFormValues; errors: DayLodgingManualFormErrors };

type DayItineraryContentFocusTarget = DayItineraryDeleteFocusTarget | { kind: 'deleteTrigger'; itemId: string };

type DayItineraryContentFocusRequest = {
  id: number;
  target: DayItineraryContentFocusTarget;
};

type DayItineraryScrollMetrics = {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
};

type AccessibilityFocusable = Parameters<typeof findNodeHandle>[0];

const accessibilityFocusDelayMs = 120;

function focusAccessibilityHandle(handle?: number | null): boolean {
  if (typeof handle !== 'number') {
    return false;
  }

  setTimeout(() => {
    AccessibilityInfo.setAccessibilityFocus(handle);
  }, accessibilityFocusDelayMs);
  return true;
}

function focusAccessibilityNode(node: AccessibilityFocusable): boolean {
  return focusAccessibilityHandle(findNodeHandle(node));
}

export default function TripDayItineraryScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    action: actionParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    action?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const initialAction = Array.isArray(actionParam) ? actionParam[0] : actionParam;
  const [state, setState] = useState<DayItineraryState>({ status: 'loading' });
  const [editState, setEditState] = useState<EditState>({ status: 'idle' });
  const [nonPlaceEditorState, setNonPlaceEditorState] = useState<NonPlaceEditorState>({ status: 'idle' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const [reorderState, setReorderState] = useState<ReorderState>({ status: 'idle' });
  const [lodgingState, setLodgingState] = useState<LodgingState>({ status: 'idle' });
  const [lodgingPickerState, setLodgingPickerState] = useState<LodgingPlacePickerState>({ status: 'idle' });
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);
  const [mapActionFeedback, setMapActionFeedback] = useState<DayItineraryMapActionFeedback | null>(null);
  const [contentFocusRequest, setContentFocusRequest] = useState<DayItineraryContentFocusRequest | null>(null);
  const [isReorderDragging, setIsReorderDragging] = useState(false);
  const [sharedUpdateState, setSharedUpdateState] = useState<DayItinerarySharedUpdateState>({
    baselineSignature: null,
    pendingSignature: null,
  });
  const [isAppActive, setIsAppActive] = useState(() => AppState.currentState === 'active');
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollMetricsRef = useRef<DayItineraryScrollMetrics>({ offsetY: 0, viewportHeight: 0, contentHeight: 0 });
  const reorderDragPointerYRef = useRef<number | null>(null);
  const reorderAutoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
      setState({ status: 'auth' });
      return;
    }
    if (error instanceof ApiError) {
      if (error.status === 401) {
        setState({ status: 'auth' });
        return;
      }
      const failure = dayItineraryFailureState(error.status);
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

  const updateScrollOffset = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollMetricsRef.current.offsetY = event.nativeEvent.contentOffset.y;
  }, []);

  const updateScrollLayout = useCallback((event: LayoutChangeEvent) => {
    scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
  }, []);

  const updateScrollContentSize = useCallback((_width: number, height: number) => {
    scrollMetricsRef.current.contentHeight = height;
  }, []);

  const getReorderScrollOffsetY = useCallback(() => scrollMetricsRef.current.offsetY, []);

  const applyReorderAutoScroll = useCallback((pointerY: number) => {
    const metrics = scrollMetricsRef.current;
    const nextOffsetY = resolveDayItineraryDragAutoScrollOffset({
      pointerY,
      viewportHeight: metrics.viewportHeight,
      contentHeight: metrics.contentHeight,
      currentOffsetY: metrics.offsetY,
    });
    if (nextOffsetY === null) {
      return;
    }

    scrollMetricsRef.current.offsetY = nextOffsetY;
    scrollViewRef.current?.scrollTo({ y: nextOffsetY, animated: false });
  }, []);

  const stopReorderAutoScroll = useCallback(() => {
    if (reorderAutoScrollTimerRef.current) {
      clearInterval(reorderAutoScrollTimerRef.current);
      reorderAutoScrollTimerRef.current = null;
    }
    reorderDragPointerYRef.current = null;
  }, []);

  const startReorderAutoScroll = useCallback(() => {
    if (reorderAutoScrollTimerRef.current) {
      return;
    }

    reorderAutoScrollTimerRef.current = setInterval(() => {
      const pointerY = reorderDragPointerYRef.current;
      if (pointerY !== null) {
        applyReorderAutoScroll(pointerY);
      }
    }, 16);
  }, [applyReorderAutoScroll]);

  const setReorderDragActive = useCallback(
    (isActive: boolean) => {
      setIsReorderDragging(isActive);
      if (isActive) {
        startReorderAutoScroll();
        return;
      }

      stopReorderAutoScroll();
    },
    [startReorderAutoScroll, stopReorderAutoScroll],
  );

  const requestReorderAutoScroll = useCallback(
    (pointerY: number) => {
      reorderDragPointerYRef.current = pointerY;
      applyReorderAutoScroll(pointerY);
      startReorderAutoScroll();
    },
    [applyReorderAutoScroll, startReorderAutoScroll],
  );

  const load = useCallback(async () => {
    if (!tripId || !date) {
      const notFound = dayItineraryFailureState(404);
      updateSharedUpdateState({ baselineSignature: null, pendingSignature: null });
      setState({ status: 'notFound', title: notFound.title, helper: notFound.helper });
      return;
    }

    const requestSequence = nextItineraryRequestSequence();
    setMapActionFeedback(null);
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

  const discardReorder = useCallback(() => {
    setReorderDragActive(false);
    setReorderFeedback(null);
    setReorderState({ status: 'idle' });
  }, [setReorderDragActive]);

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
    setMapActionFeedback(null);
    setContentFocusRequest(null);
    deleteOriginFocusTargetRef.current = null;
  }, [setReorderDragActive]);

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
    if (tripId) {
      router.replace(tripItineraryPath(tripId));
      return;
    }
    router.replace('/');
  };

  const beginCreateNonPlace = () => {
    discardReorder();
    deleteOriginFocusTargetRef.current = null;
    setEditState({ status: 'idle' });
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);
    setNonPlaceEditorState({ status: 'editing', mode: 'create', values: emptyNonPlaceScheduleItemForm(), errors: {} });
  };

  const beginEdit = (item: DayItineraryRowViewModel) => {
    discardReorder();
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);

    if (item.itemType === 'non_place') {
      const values = buildNonPlaceScheduleItemEditForm(item);
      setEditState({ status: 'idle' });
      setNonPlaceEditorState({ status: 'editing', mode: 'edit', item, original: values, values, errors: {} });
      return;
    }

    const values = buildDayItineraryEditForm(item);
    setNonPlaceEditorState({ status: 'idle' });
    setEditState({ status: 'editing', item, original: values, values, errors: {} });
  };

  const beginReorder = (viewModel: DayItineraryViewModel) => {
    const draft = buildDayItineraryReorderDraft(viewModel);
    if (!draft) {
      return;
    }

    setReorderFeedback(null);
    setEditState({ status: 'idle' });
    setNonPlaceEditorState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);
    setReorderState({ status: 'editing', draft });
  };

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

  const moveReorderItem = (fromIndex: number, toIndex: number) => {
    setReorderState((current) => {
      if (current.status !== 'editing') {
        return current;
      }

      return {
        ...current,
        draft: moveDayItineraryReorderItem(current.draft, fromIndex, toIndex),
        error: undefined,
      };
    });
  };

  const updateEditValues = (values: DayItineraryEditFormValues) => {
    setEditState((current) => {
      if (current.status !== 'editing' && current.status !== 'saving') {
        return current;
      }
      return { ...current, values, errors: {}, error: undefined };
    });
  };

  const updateNonPlaceEditorValues = (values: NonPlaceScheduleItemFormValues) => {
    setNonPlaceEditorState((current) => {
      if (current.status !== 'editing' && current.status !== 'saving') {
        return current;
      }
      return { ...current, values, errors: {}, error: undefined };
    });
  };

  const submitNonPlaceEditor = async () => {
    if (
      !tripId ||
      !date ||
      (nonPlaceEditorState.status !== 'editing' && nonPlaceEditorState.status !== 'saving') ||
      nonPlaceEditorState.status === 'saving'
    ) {
      return;
    }

    const validation =
      nonPlaceEditorState.mode === 'create'
        ? validateCreateNonPlaceScheduleItemForm(nonPlaceEditorState.values)
        : validateUpdateNonPlaceScheduleItemForm(nonPlaceEditorState.original, nonPlaceEditorState.values);
    if (!validation.ok) {
      setNonPlaceEditorState({ ...nonPlaceEditorState, errors: validation.errors, error: undefined });
      return;
    }

    const submittingState: NonPlaceEditorState = {
      ...nonPlaceEditorState,
      status: 'saving',
      errors: {},
      error: undefined,
    };
    setNonPlaceEditorState(submittingState);
    try {
      if (nonPlaceEditorState.mode === 'create') {
        await createNonPlaceScheduleItem(tripId, date, validation.request as CreateNonPlaceScheduleItemRequest);
      } else {
        await updateScheduleItem(tripId, date, nonPlaceEditorState.item.id, validation.request);
      }
      setNonPlaceEditorState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setNonPlaceEditorState({ status: 'idle' });
          await load();
          return;
        }
      }
      setNonPlaceEditorState({
        ...submittingState,
        status: 'editing',
        error: {
          title: nonPlaceEditorState.mode === 'create' ? '일정을 추가할 수 없어요.' : '일정 정보를 저장할 수 없어요.',
          helper: '잠시 후 다시 시도해주세요.',
        },
      });
    }
  };

  const submitEdit = async () => {
    if (
      !tripId ||
      !date ||
      (editState.status !== 'editing' && editState.status !== 'saving') ||
      editState.status === 'saving'
    ) {
      return;
    }

    const validation = validateDayItineraryEditForm(editState.original, editState.values);
    if (!validation.ok) {
      setEditState({ ...editState, errors: validation.errors, error: undefined });
      return;
    }

    const submittingState: EditState = { ...editState, status: 'saving', errors: {}, error: undefined };
    setEditState(submittingState);
    try {
      await updateScheduleItem(tripId, date, editState.item.id, validation.request);
      setEditState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setEditState({ status: 'idle' });
          await load();
          return;
        }
      }
      const failure = dayItineraryMutationFailureState('update');
      setEditState({ ...submittingState, status: 'editing', error: { title: failure.title, helper: failure.helper } });
    }
  };

  const beginDelete = (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => {
    discardReorder();
    deleteOriginFocusTargetRef.current = typeof originFocusTarget === 'number' ? originFocusTarget : null;
    setEditState({ status: 'idle' });
    setNonPlaceEditorState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);
    setDeleteState({ status: 'confirming', item });
  };

  const cancelDelete = () => {
    if (deleteState.status !== 'confirming' || !canDismissDayItineraryDeleteModal(deleteState.status)) {
      return;
    }

    const itemId = deleteState.item.id;
    setDeleteState({ status: 'idle' });
    focusDeleteOrigin(itemId);
  };

  const submitReorder = async () => {
    if (
      !tripId ||
      !date ||
      (reorderState.status !== 'editing' && reorderState.status !== 'saving') ||
      reorderState.status === 'saving'
    ) {
      return;
    }

    const draft = reorderState.draft;
    if (!buildReorderScheduleItemsRequest(draft)) {
      return;
    }

    const submittingState: ReorderState = { ...reorderState, status: 'saving', error: undefined };
    setReorderState(submittingState);
    try {
      const response = await submitDayItineraryReorder(draft, (request) => reorderScheduleItems(tripId, date, request));
      if (!response) {
        setReorderState({ status: 'editing', draft });
        return;
      }
      const success = buildDayItineraryReorderSuccessViewModel(response);
      setReorderFeedback(success.reorderFeedback);
      setReorderState(success.reorderState);
      applyItineraryResponse(response);
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setReorderState({ status: 'idle' });
          await load();
          return;
        }
        if (error.status === 409) {
          const conflictViewModel = buildDayItineraryReorderConflictViewModel();
          setReorderState(conflictViewModel.reorderState);
          setReorderFeedback(conflictViewModel.reorderFeedback);
          await load();
          return;
        }
      }

      const failure = dayItineraryReorderFailureState();
      setReorderState({
        ...submittingState,
        status: 'editing',
        error: { title: failure.title, helper: failure.helper },
      });
    }
  };

  const submitSetLodging = async (item: DayItineraryRowViewModel) => {
    if (!tripId || !date || !item.placeId || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setMapActionFeedback(null);
    setLodgingState({ status: 'setting', itemId: item.id });
    try {
      await setDayLodgingPlace(tripId, date, buildSetDayLodgingPlaceRequest(item.placeId));
      setLodgingState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setLodgingState({ status: 'idle' });
          await load();
          return;
        }
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const submitClearLodging = async (item: DayItineraryRowViewModel) => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setMapActionFeedback(null);
    setLodgingState({ status: 'clearing', itemId: item.id });
    try {
      await clearDayLodgingPlace(tripId, date);
      setLodgingState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setLodgingState({ status: 'idle' });
          await load();
          return;
        }
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const submitClearCurrentLodging = async () => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setLodgingState({
      status: 'clearing',
      itemId: state.status === 'success' ? (state.viewModel.lodgingPlace?.id ?? 'current') : 'current',
    });
    try {
      await clearDayLodgingPlace(tripId, date);
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setLodgingState({ status: 'idle' });
          await load();
          return;
        }
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const openLodgingPlaceSelection = async () => {
    if (!tripId) {
      return;
    }

    discardReorder();
    setLodgingPickerState({ status: 'loading' });
    try {
      const places = await listTripPlaces(tripId);
      const currentPlaceId = state.status === 'success' ? state.viewModel.lodgingPlace?.id : null;
      setLodgingPickerState({ status: 'selecting', options: buildDayLodgingPlaceOptions(places, currentPlaceId) });
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: 'auth' });
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
      setLodgingPickerState({ status: 'idle' });
    }
  };

  const submitSelectLodgingPlace = async (option: DayLodgingPlaceOptionViewModel) => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    setLodgingState({ status: 'setting', itemId: option.id });
    try {
      await setDayLodgingPlace(tripId, date, buildSetDayLodgingPlaceRequest(option.id));
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setLodgingState({ status: 'idle' });
          await load();
          return;
        }
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const openManualLodgingForm = () => {
    discardReorder();
    setLodgingPickerState({ status: 'manual', values: { name: '', address: '' }, errors: {} });
  };

  const submitManualLodging = async () => {
    if (!tripId || !date || lodgingPickerState.status !== 'manual') {
      return;
    }
    const validation = validateManualDayLodgingPlaceForm(lodgingPickerState.values);
    if (!validation.ok) {
      setLodgingPickerState({ ...lodgingPickerState, errors: validation.errors });
      return;
    }

    const submittingState = { status: 'creating' as const, values: lodgingPickerState.values, errors: {} };
    setLodgingPickerState(submittingState);
    try {
      await createManualDayLodgingPlace(tripId, date, validation.request);
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setLodgingPickerState({ status: 'idle' });
          await load();
          return;
        }
      }
      const failure = dayLodgingMutationFailureState();
      setLodgingPickerState({ ...submittingState, status: 'manual', errors: { form: failure.title } });
    }
  };

  const openPlaceMap = async (item: DayItineraryRowViewModel) => {
    discardReorder();
    const actions = buildDayItineraryMapRowActions(item);
    setMapActionFeedback(null);

    try {
      await Linking.openURL(actions.map.url);
    } catch {
      setMapActionFeedback(dayItineraryMapActionFailureState('map'));
    }
  };

  const copyPlaceAddress = async (item: DayItineraryRowViewModel) => {
    discardReorder();
    const actions = buildDayItineraryMapRowActions(item);
    if (actions.copy.disabled || !actions.copy.address) {
      return;
    }

    setMapActionFeedback(null);
    try {
      await Clipboard.setStringAsync(actions.copy.address);
      setMapActionFeedback(dayItineraryMapActionSuccessState('copy'));
    } catch {
      setMapActionFeedback(dayItineraryMapActionFailureState('copy'));
    }
  };

  const submitDelete = async () => {
    if (!tripId || !date || deleteState.status !== 'confirming' || !canSubmitDayItineraryDelete(deleteState.status)) {
      return;
    }

    const successFocusTarget: DayItineraryDeleteFocusTarget =
      state.status === 'success' && state.viewModel.status === 'success'
        ? resolveDayItineraryDeleteSuccessFocusTarget(state.viewModel.items, deleteState.item.id)
        : { kind: 'dayHeading' };
    const deletingState: DeleteState = { ...deleteState, status: 'deleting', error: undefined };
    setDeleteState(deletingState);
    try {
      await deleteScheduleItem(tripId, date, deleteState.item.id);
      await load();
      setDeleteState({ status: 'idle' });
      deleteOriginFocusTargetRef.current = null;
      requestContentFocus(successFocusTarget);
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setDeleteState({ status: 'idle' });
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setDeleteState({ status: 'idle' });
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setDeleteState({ status: 'idle' });
          await load();
          return;
        }
      }
      const failure = dayItineraryMutationFailureState('delete');
      setDeleteState({
        ...deletingState,
        status: 'confirming',
        error: { title: failure.title, helper: failure.helper },
      });
    }
  };

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

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        accessibilityElementsHidden={isDeleteModalVisible}
        contentContainerStyle={styles.scrollContent}
        importantForAccessibility={isDeleteModalVisible ? 'no-hide-descendants' : 'auto'}
        onContentSizeChange={updateScrollContentSize}
        onLayout={updateScrollLayout}
        onScroll={updateScrollOffset}
        scrollEnabled={!isReorderDragging}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>일정</Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>일정을 불러오는 중...</Text>
          </View>
        ) : null}

        {state.status === 'success' ? (
          <>
            <DayItineraryContent
              focusRequest={contentFocusRequest}
              getReorderScrollOffsetY={getReorderScrollOffsetY}
              onFocusRequestHandled={clearContentFocusRequest}
              onAddPlace={() => {
                if (tripId && date) {
                  router.push(buildDayItineraryAddPlaceSearchRoute(tripId, date));
                }
              }}
              onAddNonPlace={beginCreateNonPlace}
              onCopyAddress={(item) => void copyPlaceAddress(item)}
              onDeletePlace={beginDelete}
              onEditPlace={beginEdit}
              onEnterReorderMode={() => beginReorder(state.viewModel)}
              onExitReorderMode={cancelReorder}
              lodgingPickerState={lodgingPickerState}
              lodgingState={lodgingState}
              onCancelLodgingPicker={() => setLodgingPickerState({ status: 'idle' })}
              onClearCurrentLodging={() => void submitClearCurrentLodging()}
              onClearLodging={(item) => void submitClearLodging(item)}
              onCreateManualLodging={() => void submitManualLodging()}
              onMoveReorderItem={moveReorderItem}
              onOpenMap={(item) => void openPlaceMap(item)}
              onReorderDragActiveChange={setReorderDragActive}
              onReorderDragMove={requestReorderAutoScroll}
              onOpenLodgingPlaceSelection={() => void openLodgingPlaceSelection()}
              onOpenManualLodgingForm={openManualLodgingForm}
              onSaveReorder={() => void submitReorder()}
              onSelectLodgingPlace={(option) => void submitSelectLodgingPlace(option)}
              onSetLodging={(item) => void submitSetLodging(item)}
              onUpdateManualLodgingValues={(values) =>
                setLodgingPickerState((current) =>
                  current.status === 'manual' || current.status === 'creating'
                    ? { ...current, values, errors: {} }
                    : current,
                )
              }
              mapActionFeedback={mapActionFeedback}
              onReloadSharedUpdate={requestSharedUpdateReload}
              reorderFeedback={reorderFeedback}
              reorderState={reorderState}
              sharedUpdateBanner={sharedUpdateBanner}
              sharedUpdateReloadDisabled={sharedUpdateReloadDisabled}
              viewModel={state.viewModel}
            />
            {nonPlaceEditorState.status === 'editing' || nonPlaceEditorState.status === 'saving' ? (
              <NonPlaceScheduleItemPanel
                editorState={nonPlaceEditorState}
                onCancel={() => setNonPlaceEditorState({ status: 'idle' })}
                onSubmit={() => void submitNonPlaceEditor()}
                onUpdateValues={updateNonPlaceEditorValues}
              />
            ) : null}
            {editState.status === 'editing' || editState.status === 'saving' ? (
              <EditPlacePanel
                editState={editState}
                onCancel={() => setEditState({ status: 'idle' })}
                onSubmit={() => void submitEdit()}
                onUpdateValues={updateEditValues}
              />
            ) : null}
          </>
        ) : null}

        {state.status === 'auth' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'notFound' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>{state.title}</Text>
            <Text style={styles.message}>{state.helper}</Text>
            <Pressable accessibilityRole="button" onPress={backToItinerary} style={styles.button}>
              <Text style={styles.buttonText}>일정으로</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>{state.title}</Text>
            <Text style={styles.message}>{state.helper}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.button}>
              <Text style={styles.buttonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {isDeleteModalVisible ? (
        <DeletePlaceConfirmationModal
          deleteState={deleteState}
          onCancel={cancelDelete}
          onConfirm={() => void submitDelete()}
        />
      ) : null}
    </>
  );
}

function DayItineraryContent({
  focusRequest,
  getReorderScrollOffsetY,
  lodgingPickerState,
  lodgingState,
  onFocusRequestHandled,
  onAddPlace,
  onAddNonPlace,
  onCancelLodgingPicker,
  onClearCurrentLodging,
  onClearLodging,
  onCopyAddress,
  onCreateManualLodging,
  onDeletePlace,
  onEditPlace,
  onEnterReorderMode,
  onExitReorderMode,
  onMoveReorderItem,
  onOpenLodgingPlaceSelection,
  onOpenManualLodgingForm,
  onOpenMap,
  onReorderDragActiveChange,
  onReorderDragMove,
  onSaveReorder,
  onSelectLodgingPlace,
  onSetLodging,
  onUpdateManualLodgingValues,
  mapActionFeedback,
  onReloadSharedUpdate,
  reorderFeedback,
  reorderState,
  sharedUpdateBanner,
  sharedUpdateReloadDisabled,
  viewModel,
}: {
  focusRequest: DayItineraryContentFocusRequest | null;
  getReorderScrollOffsetY: () => number;
  lodgingPickerState: LodgingPlacePickerState;
  lodgingState: LodgingState;
  onFocusRequestHandled: () => void;
  onAddPlace: () => void;
  onAddNonPlace: () => void;
  onCancelLodgingPicker: () => void;
  onClearCurrentLodging: () => void;
  onClearLodging: (item: DayItineraryRowViewModel) => void;
  onCopyAddress: (item: DayItineraryRowViewModel) => void;
  onCreateManualLodging: () => void;
  onDeletePlace: (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => void;
  onEditPlace: (item: DayItineraryRowViewModel) => void;
  onEnterReorderMode: () => void;
  onExitReorderMode: () => void;
  onMoveReorderItem: (fromIndex: number, toIndex: number) => void;
  onOpenLodgingPlaceSelection: () => void;
  onOpenManualLodgingForm: () => void;
  onOpenMap: (item: DayItineraryRowViewModel) => void;
  onReorderDragActiveChange: (isActive: boolean) => void;
  onReorderDragMove: (pointerY: number) => void;
  onSaveReorder: () => void;
  onSelectLodgingPlace: (option: DayLodgingPlaceOptionViewModel) => void;
  onSetLodging: (item: DayItineraryRowViewModel) => void;
  onUpdateManualLodgingValues: (values: DayLodgingManualFormValues) => void;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  onReloadSharedUpdate: () => void;
  reorderFeedback: string | null;
  reorderState: ReorderState;
  sharedUpdateBanner: ReturnType<typeof buildDayItinerarySharedUpdateBanner>;
  sharedUpdateReloadDisabled: boolean;
  viewModel: DayItineraryViewModel;
}) {
  const reorderAction = buildDayItineraryReorderAction(viewModel);
  const reorderSubmitState =
    reorderState.status === 'editing' || reorderState.status === 'saving'
      ? buildDayItineraryReorderSubmitState(reorderState.status === 'saving', reorderState.draft)
      : null;
  const lodgingSubmittingState: DayLodgingSubmittingState | null =
    lodgingState.status === 'setting'
      ? { kind: 'set', itemId: lodgingState.itemId }
      : lodgingState.status === 'clearing'
        ? { kind: 'clear', itemId: lodgingState.itemId }
        : null;
  const dayHeadingRef = useRef<Text>(null);
  const emptyStateRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, Text | null>>({});
  const deleteTriggerRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (focusRequest.target.kind === 'deleteTrigger') {
      if (!focusAccessibilityNode(deleteTriggerRefs.current[focusRequest.target.itemId])) {
        focusAccessibilityNode(rowRefs.current[focusRequest.target.itemId]);
      }
      onFocusRequestHandled();
      return;
    }

    if (focusRequest.target.kind === 'placeRow') {
      if (!focusAccessibilityNode(rowRefs.current[focusRequest.target.itemId])) {
        focusAccessibilityNode(dayHeadingRef.current);
      }
      onFocusRequestHandled();
      return;
    }

    if (focusRequest.target.kind === 'emptyState') {
      if (!focusAccessibilityNode(emptyStateRef.current)) {
        focusAccessibilityNode(dayHeadingRef.current);
      }
      onFocusRequestHandled();
      return;
    }

    focusAccessibilityNode(dayHeadingRef.current);
    onFocusRequestHandled();
  }, [focusRequest, onFocusRequestHandled]);

  return (
    <View style={styles.card}>
      <View style={styles.dayHeader}>
        <Text ref={dayHeadingRef} accessibilityRole="header" style={styles.dayLabel}>
          {viewModel.dayLabel}
        </Text>
        <Text style={styles.dayDate}>{viewModel.formattedDate}</Text>
      </View>

      <DayLodgingPanel
        lodgingState={lodgingState}
        onCancelPicker={onCancelLodgingPicker}
        onClear={onClearCurrentLodging}
        onCreateManual={onCreateManualLodging}
        onOpenManual={onOpenManualLodgingForm}
        onOpenSelection={onOpenLodgingPlaceSelection}
        onSelectPlace={onSelectLodgingPlace}
        onUpdateManualValues={onUpdateManualLodgingValues}
        pickerState={lodgingPickerState}
        viewModel={buildDayLodgingPanel(viewModel.lodgingPlace)}
      />

      {viewModel.status === 'empty' ? (
        <View
          ref={emptyStateRef}
          accessible
          accessibilityLabel={`${viewModel.title}. ${viewModel.helper}`}
          style={styles.emptyBox}
        >
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
      ) : null}

      {viewModel.status === 'success' ? (
        <View style={styles.placeList}>
          {reorderState.status === 'editing' || reorderState.status === 'saving' ? (
            <ReorderPlaceList
              draft={reorderState.draft}
              getScrollOffsetY={getReorderScrollOffsetY}
              isDisabled={reorderState.status === 'saving'}
              onDragActiveChange={onReorderDragActiveChange}
              onDragMove={onReorderDragMove}
              onMoveItem={onMoveReorderItem}
            />
          ) : (
            viewModel.items.map((item) => {
              const lodging = buildDayLodgingRowViewModel(item, lodgingSubmittingState);
              const mapActions = buildDayItineraryMapRowActions(item);
              return (
                <View key={item.id} style={styles.placeRow}>
                  <PlacePin order={item.orderLabel} type={item.placeType} />
                  <View style={styles.placeContent}>
                    <View style={styles.placeTitleRow}>
                      <Text
                        ref={(node) => {
                          rowRefs.current[item.id] = node;
                        }}
                        accessibilityLabel={buildDayItineraryPlaceAccessibilityLabel(item)}
                        style={styles.placeName}
                      >
                        {item.placeName}
                      </Text>
                      {item.itemType === 'non_place' ? (
                        <Badge label={item.placeTypeLabel} tone="primary" />
                      ) : (
                        <PlaceTag type={item.placeType} />
                      )}
                      {item.statusLabel ? <Badge label={item.statusLabel} tone="neutral" /> : null}
                      {lodging.badgeLabel && item.itemType !== 'non_place' ? (
                        <Badge label={lodging.badgeLabel} tone="primary" />
                      ) : null}
                    </View>
                    {item.timeLabel ? <Text style={styles.timeLabel}>{item.timeLabel}</Text> : null}
                    {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
                    <View style={styles.rowActionGroup}>
                      {item.itemType !== 'non_place' ? (
                        <>
                          <Pressable
                            accessibilityLabel={mapActions.map.accessibilityLabel}
                            accessibilityRole="button"
                            onPress={() => onOpenMap(item)}
                            style={styles.rowActionButton}
                          >
                            <Text style={styles.rowActionText}>{mapActions.map.label}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityHint={mapActions.copy.disabled ? mapActions.copy.disabledHelper : undefined}
                            accessibilityLabel={mapActions.copy.accessibilityLabel}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: mapActions.copy.disabled }}
                            disabled={mapActions.copy.disabled}
                            onPress={() => onCopyAddress(item)}
                            style={[
                              styles.rowActionButton,
                              mapActions.copy.disabled ? styles.rowActionButtonDisabled : null,
                            ]}
                          >
                            <Text style={styles.rowActionText}>{mapActions.copy.label}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            disabled={lodging.action.disabled}
                            onPress={() => (lodging.action.kind === 'set' ? onSetLodging(item) : onClearLodging(item))}
                            style={[
                              styles.rowActionButton,
                              lodging.action.disabled ? styles.rowActionButtonDisabled : null,
                            ]}
                          >
                            {lodging.action.isSubmitting ? <ActivityIndicator color={theme.color.primary} /> : null}
                            <Text style={styles.rowActionText}>{lodging.action.label}</Text>
                          </Pressable>
                        </>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onEditPlace(item)}
                        style={styles.rowActionButton}
                      >
                        <Text style={styles.rowActionText}>수정</Text>
                      </Pressable>
                      <Pressable
                        ref={(node) => {
                          deleteTriggerRefs.current[item.id] = node;
                        }}
                        accessibilityLabel={`${item.placeName} 삭제`}
                        accessibilityRole="button"
                        onPress={() => onDeletePlace(item, findNodeHandle(deleteTriggerRefs.current[item.id]))}
                        style={styles.rowDangerActionButton}
                      >
                        <Text style={styles.rowDangerActionText}>삭제</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        {sharedUpdateBanner ? (
          <View style={styles.sharedUpdateNotice}>
            <Text style={styles.message}>{sharedUpdateBanner.message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: sharedUpdateReloadDisabled }}
              disabled={sharedUpdateReloadDisabled}
              onPress={onReloadSharedUpdate}
              style={[styles.secondaryButton, sharedUpdateReloadDisabled ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>{sharedUpdateBanner.actionLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        {mapActionFeedback ? (
          <View style={mapActionFeedback.kind === 'error' ? styles.errorBox : styles.reorderNotice}>
            <Text style={styles.message}>{mapActionFeedback.message}</Text>
          </View>
        ) : null}

        {lodgingState.status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{lodgingState.error.title}</Text>
            <Text style={styles.message}>{lodgingState.error.helper}</Text>
          </View>
        ) : null}

        {reorderFeedback ? (
          <View style={styles.reorderNotice}>
            <Text style={styles.message}>{reorderFeedback}</Text>
          </View>
        ) : null}

        {reorderState.status === 'editing' || reorderState.status === 'saving' ? (
          <>
            <View style={styles.reorderNotice}>
              <Text style={styles.message}>{reorderState.draft.helper}</Text>
            </View>
            {reorderState.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{reorderState.error.title}</Text>
                <Text style={styles.message}>{reorderState.error.helper}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={reorderSubmitState?.disabled ?? true}
              onPress={onSaveReorder}
              style={[styles.button, reorderSubmitState?.disabled ? styles.buttonDisabled : null]}
            >
              {reorderState.status === 'saving' ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{reorderSubmitState?.label ?? '저장'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={reorderState.status === 'saving'}
              onPress={onExitReorderMode}
              style={[styles.secondaryButton, reorderState.status === 'saving' ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </>
        ) : (
          <>
            {reorderAction.status === 'enabled' ? (
              <Pressable accessibilityRole="button" onPress={onEnterReorderMode} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{reorderAction.label}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onAddNonPlace} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>장소 없는 일정 추가</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onAddPlace} style={styles.button}>
              <Text style={styles.buttonText}>일정 추가</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function DayLodgingPanel({
  lodgingState,
  onCancelPicker,
  onClear,
  onCreateManual,
  onOpenManual,
  onOpenSelection,
  onSelectPlace,
  onUpdateManualValues,
  pickerState,
  viewModel,
}: {
  lodgingState: LodgingState;
  pickerState: LodgingPlacePickerState;
  viewModel: ReturnType<typeof buildDayLodgingPanel>;
  onCancelPicker: () => void;
  onClear: () => void;
  onCreateManual: () => void;
  onOpenManual: () => void;
  onOpenSelection: () => void;
  onSelectPlace: (option: DayLodgingPlaceOptionViewModel) => void;
  onUpdateManualValues: (values: DayLodgingManualFormValues) => void;
}) {
  const isMutating = lodgingState.status === 'setting' || lodgingState.status === 'clearing';
  const isCreating = pickerState.status === 'creating';
  const manualSubmit = buildManualDayLodgingPlaceSubmitState(isCreating);

  return (
    <View style={styles.lodgingBox}>
      <View style={styles.placeTitleRow}>
        <Text style={styles.placeName}>{viewModel.label}</Text>
        {viewModel.canClear ? <Badge label={dayLodgingCopy.badge} tone="primary" /> : null}
      </View>
      {viewModel.placeName ? <Text style={styles.lodgingPlaceName}>{viewModel.placeName}</Text> : null}
      {viewModel.address ? <Text style={styles.address}>{viewModel.address}</Text> : null}
      {viewModel.helper ? <Text style={styles.message}>{viewModel.helper}</Text> : null}

      <View style={styles.rowActionGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={onOpenSelection}
          style={styles.rowActionButton}
        >
          <Text style={styles.rowActionText}>{dayLodgingCopy.selectExistingAction}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={onOpenManual}
          style={styles.rowActionButton}
        >
          <Text style={styles.rowActionText}>{dayLodgingCopy.manualRegisterAction}</Text>
        </Pressable>
        {viewModel.canClear ? (
          <Pressable
            accessibilityRole="button"
            disabled={isMutating}
            onPress={onClear}
            style={[styles.rowDangerActionButton, isMutating ? styles.rowActionButtonDisabled : null]}
          >
            <Text style={styles.rowDangerActionText}>
              {lodgingState.status === 'clearing' ? dayLodgingCopy.clearing : dayLodgingCopy.clearAction}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {pickerState.status === 'loading' ? <Text style={styles.message}>{dayLodgingCopy.loadingPlaces}</Text> : null}

      {pickerState.status === 'selecting' ? (
        <View style={styles.lodgingPickerBox}>
          {pickerState.options.length === 0 ? <Text style={styles.message}>{dayLodgingCopy.emptyPlaces}</Text> : null}
          {pickerState.options.map((option) => (
            <Pressable
              accessibilityRole="button"
              disabled={isMutating || option.selected}
              key={option.id}
              onPress={() => onSelectPlace(option)}
              style={[styles.lodgingOption, option.selected ? styles.lodgingOptionSelected : null]}
            >
              <View style={styles.placeTitleRow}>
                <Text style={styles.placeName}>{option.name}</Text>
                {option.selected ? <Badge label="선택됨" tone="primary" /> : null}
              </View>
              <Text style={styles.address}>{option.address}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onCancelPicker} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>닫기</Text>
          </Pressable>
        </View>
      ) : null}

      {pickerState.status === 'manual' || pickerState.status === 'creating' ? (
        <View style={styles.lodgingPickerBox}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>숙소명</Text>
            <TextInput
              editable={!isCreating}
              onChangeText={(name) => onUpdateManualValues({ ...pickerState.values, name })}
              placeholder="예: 호텔 니코 오사카"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={pickerState.values.name}
            />
            {pickerState.errors.name ? <Text style={styles.fieldError}>{pickerState.errors.name}</Text> : null}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>주소</Text>
            <TextInput
              editable={!isCreating}
              multiline
              onChangeText={(address) => onUpdateManualValues({ ...pickerState.values, address })}
              placeholder="예: Nishi-Shinsaibashi"
              placeholderTextColor={theme.color.textFaint}
              style={[styles.input, styles.addressInput]}
              textAlignVertical="top"
              value={pickerState.values.address}
            />
            {pickerState.errors.address ? <Text style={styles.fieldError}>{pickerState.errors.address}</Text> : null}
            {pickerState.errors.form ? <Text style={styles.fieldError}>{pickerState.errors.form}</Text> : null}
          </View>
          <View style={styles.rowActionGroup}>
            <Pressable
              accessibilityRole="button"
              disabled={manualSubmit.disabled}
              onPress={onCreateManual}
              style={[styles.button, manualSubmit.disabled ? styles.buttonDisabled : null]}
            >
              {isCreating ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{manualSubmit.label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isCreating}
              onPress={onCancelPicker}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ReorderPlaceList({
  draft,
  getScrollOffsetY,
  isDisabled,
  onDragActiveChange,
  onDragMove,
  onMoveItem,
}: {
  draft: DayItineraryReorderDraftViewModel;
  getScrollOffsetY: () => number;
  isDisabled: boolean;
  onDragActiveChange: (isActive: boolean) => void;
  onDragMove: (pointerY: number) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
}) {
  const rowHeightsRef = useRef<Record<string, number>>({});
  const dragRef = useRef<{
    itemId: string;
    currentIndex: number;
    startIndex: number;
    startPointerY: number;
    startScrollOffsetY: number;
    snapshotHeights: number[];
  } | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const updateRowHeight = (itemId: string, event: LayoutChangeEvent) => {
    rowHeightsRef.current[itemId] = event.nativeEvent.layout.height;
  };

  const finishDrag = () => {
    dragRef.current = null;
    setActiveItemId(null);
    onDragActiveChange(false);
  };

  return draft.items.map((item, index) => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => !isDisabled,
      onStartShouldSetPanResponderCapture: () => !isDisabled,
      onMoveShouldSetPanResponder: () => !isDisabled,
      onMoveShouldSetPanResponderCapture: () => !isDisabled,
      onPanResponderGrant: (_, gestureState) => {
        dragRef.current = {
          itemId: item.id,
          currentIndex: index,
          startIndex: index,
          startPointerY: gestureState.y0,
          startScrollOffsetY: getScrollOffsetY(),
          snapshotHeights: draft.items.map((draftItem) => rowHeightsRef.current[draftItem.id] ?? theme.layout.controlH),
        };
        setActiveItemId(item.id);
        onDragActiveChange(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!dragRef.current || dragRef.current.itemId !== item.id) {
          return;
        }

        onDragMove(gestureState.moveY);
        const dragOffsetY = resolveDayItineraryDragOffsetY({
          pointerY: gestureState.moveY,
          startPointerY: dragRef.current.startPointerY,
          currentScrollOffsetY: getScrollOffsetY(),
          startScrollOffsetY: dragRef.current.startScrollOffsetY,
        });
        const targetIndex = resolveDayItineraryDragTargetIndex({
          startIndex: dragRef.current.startIndex,
          dragOffsetY,
          rowHeights: dragRef.current.snapshotHeights,
          fallbackRowHeight: theme.layout.controlH,
        });
        if (targetIndex === dragRef.current.currentIndex) {
          return;
        }

        onMoveItem(dragRef.current.currentIndex, targetIndex);
        dragRef.current.currentIndex = targetIndex;
      },
      onPanResponderReject: finishDrag,
      onPanResponderRelease: finishDrag,
      onPanResponderTerminate: finishDrag,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });

    const isActive = activeItemId === item.id;

    return (
      <View
        key={item.id}
        onLayout={(event) => updateRowHeight(item.id, event)}
        style={[styles.placeRow, isActive ? styles.placeRowActive : null]}
      >
        <PlacePin order={item.orderLabel} type={item.placeType} />
        <View style={styles.placeContent}>
          <View style={styles.placeTitleRow}>
            <Text style={styles.placeName}>{item.placeName}</Text>
            {item.itemType === 'non_place' ? (
              <Badge label={item.placeTypeLabel} tone="primary" />
            ) : (
              <PlaceTag type={item.placeType} />
            )}
            {item.statusLabel ? <Badge label={item.statusLabel} tone="neutral" /> : null}
          </View>
          {item.timeLabel ? <Text style={styles.timeLabel}>{item.timeLabel}</Text> : null}
          {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
        </View>
        <View
          accessibilityHint="핸들을 잡고 위아래로 끌어서 순서를 바꿔요."
          accessibilityLabel={`${item.placeName} ${item.dragHandleLabel} 핸들`}
          accessibilityRole="button"
          style={[styles.dragHandle, isActive ? styles.dragHandleActive : null]}
          {...responder.panHandlers}
        >
          <View style={styles.dragHandleBar} />
          <View style={styles.dragHandleBar} />
          <View style={styles.dragHandleBar} />
        </View>
      </View>
    );
  });
}

function NonPlaceScheduleItemPanel({
  editorState,
  onCancel,
  onSubmit,
  onUpdateValues,
}: {
  editorState: Extract<NonPlaceEditorState, { status: 'editing' | 'saving' }>;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: NonPlaceScheduleItemFormValues) => void;
}) {
  const isSaving = editorState.status === 'saving';
  const submitView = buildNonPlaceScheduleItemSubmitState(isSaving, editorState.mode);
  const update = (patch: Partial<NonPlaceScheduleItemFormValues>) =>
    onUpdateValues({ ...editorState.values, ...patch });

  return (
    <View style={styles.card}>
      <Text style={styles.panelTitle}>
        {editorState.mode === 'create' ? '장소 없는 일정 추가' : '장소 없는 일정 수정'}
      </Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분류</Text>
        <View style={styles.chipList}>
          {nonPlaceCategoryOptions.map((option) => {
            const selected = editorState.values.category === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => update({ category: option.value })}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>제목</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(title) => update({ title })}
          placeholder="예: 체크아웃, 공항 이동"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editorState.values.title}
        />
        {editorState.errors.title ? <Text style={styles.fieldError}>{editorState.errors.title}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>시간</Text>
        <View style={styles.timeFieldRow}>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="시작 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(startTime) => update({ startTime })}
              placeholder="시작 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.startTime}
            />
            {editorState.errors.startTime ? (
              <Text style={styles.fieldError}>{editorState.errors.startTime}</Text>
            ) : null}
          </View>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="종료 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(endTime) => update({ endTime })}
              placeholder="종료 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.endTime}
            />
            {editorState.errors.endTime ? <Text style={styles.fieldError}>{editorState.errors.endTime}</Text> : null}
          </View>
        </View>
        <Text style={styles.fieldHelper}>비워두면 순서만 있는 일정으로 저장돼요.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(memo) => update({ memo })}
          placeholder="선택 입력"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editorState.values.memo}
        />
        {editorState.errors.memo ? <Text style={styles.fieldError}>{editorState.errors.memo}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>링크</Text>
        <TextInput
          autoCapitalize="none"
          editable={!isSaving}
          keyboardType="url"
          onChangeText={(link) => update({ link })}
          placeholder="https://..."
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editorState.values.link}
        />
        {editorState.errors.link ? <Text style={styles.fieldError}>{editorState.errors.link}</Text> : null}
      </View>

      {editorState.values.category === 'transport' ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>이동 수단</Text>
            <View style={styles.chipList}>
              {nonPlaceTransportModeOptions.map((option) => {
                const selected = editorState.values.transportMode === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    key={option.value}
                    onPress={() => update({ transportMode: option.value as NonPlaceTransportMode })}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {editorState.errors.transportMode ? (
              <Text style={styles.fieldError}>{editorState.errors.transportMode}</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>출발/도착</Text>
            <View style={styles.timeFieldRow}>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(originText) => update({ originText })}
                  placeholder="출발지"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.originText}
                />
                {editorState.errors.originText ? (
                  <Text style={styles.fieldError}>{editorState.errors.originText}</Text>
                ) : null}
              </View>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(destinationText) => update({ destinationText })}
                  placeholder="도착지"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.destinationText}
                />
                {editorState.errors.destinationText ? (
                  <Text style={styles.fieldError}>{editorState.errors.destinationText}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>예약/탑승 정보</Text>
            <TextInput
              editable={!isSaving}
              onChangeText={(referenceNumber) => update({ referenceNumber })}
              placeholder="편명/열차번호"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.referenceNumber}
            />
            {editorState.errors.referenceNumber ? (
              <Text style={styles.fieldError}>{editorState.errors.referenceNumber}</Text>
            ) : null}
            <TextInput
              editable={!isSaving}
              onChangeText={(bookingReference) => update({ bookingReference })}
              placeholder="예약번호"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.bookingReference}
            />
            {editorState.errors.bookingReference ? (
              <Text style={styles.fieldError}>{editorState.errors.bookingReference}</Text>
            ) : null}
            <View style={styles.timeFieldRow}>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(terminalText) => update({ terminalText })}
                  placeholder="터미널"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.terminalText}
                />
                {editorState.errors.terminalText ? (
                  <Text style={styles.fieldError}>{editorState.errors.terminalText}</Text>
                ) : null}
              </View>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(gateText) => update({ gateText })}
                  placeholder="게이트"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.gateText}
                />
                {editorState.errors.gateText ? (
                  <Text style={styles.fieldError}>{editorState.errors.gateText}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </>
      ) : null}

      {editorState.errors.form ? <Text style={styles.fieldError}>{editorState.errors.form}</Text> : null}
      {editorState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editorState.error.title}</Text>
          <Text style={styles.message}>{editorState.error.helper}</Text>
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={submitView.disabled}
          onPress={onSubmit}
          style={[styles.button, submitView.disabled ? styles.buttonDisabled : null]}
        >
          {isSaving ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{submitView.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditPlacePanel({
  editState,
  onCancel,
  onSubmit,
  onUpdateValues,
}: {
  editState: Extract<EditState, { status: 'editing' | 'saving' }>;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: DayItineraryEditFormValues) => void;
}) {
  const isSaving = editState.status === 'saving';
  const submitView = buildDayItineraryEditSubmitState(isSaving);

  return (
    <View style={styles.card}>
      <Text style={styles.panelTitle}>장소 수정</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소명</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(name) => onUpdateValues({ ...editState.values, name })}
          placeholder="예: 우메다 공중정원"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editState.values.name}
        />
        {editState.errors.name ? <Text style={styles.fieldError}>{editState.errors.name}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>주소</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(address) => onUpdateValues({ ...editState.values, address })}
          placeholder="예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editState.values.address}
        />
        {editState.errors.address ? <Text style={styles.fieldError}>{editState.errors.address}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>시간</Text>
        <View style={styles.timeFieldRow}>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="시작 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(startTime) => onUpdateValues({ ...editState.values, startTime })}
              placeholder="시작 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editState.values.startTime}
            />
            {editState.errors.startTime ? <Text style={styles.fieldError}>{editState.errors.startTime}</Text> : null}
          </View>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="종료 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(endTime) => onUpdateValues({ ...editState.values, endTime })}
              placeholder="종료 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editState.values.endTime}
            />
            {editState.errors.endTime ? <Text style={styles.fieldError}>{editState.errors.endTime}</Text> : null}
          </View>
        </View>
        <Text style={styles.fieldHelper}>비워두면 순서만 있는 일정으로 유지돼요.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소 타입</Text>
        <View style={styles.chipList}>
          {manualPlaceTypeOptions.map((option) => {
            const selected = editState.values.placeType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => onUpdateValues({ ...editState.values, placeType: option.value as TripPlaceType })}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {editState.errors.placeType ? <Text style={styles.fieldError}>{editState.errors.placeType}</Text> : null}
        {editState.errors.form ? <Text style={styles.fieldError}>{editState.errors.form}</Text> : null}
      </View>

      {editState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editState.error.title}</Text>
          <Text style={styles.message}>{editState.error.helper}</Text>
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={submitView.disabled}
          onPress={onSubmit}
          style={[styles.button, submitView.disabled ? styles.buttonDisabled : null]}
        >
          {isSaving ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{submitView.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DeletePlaceConfirmationModal({
  deleteState,
  onCancel,
  onConfirm,
}: {
  deleteState: Extract<DeleteState, { status: 'confirming' | 'deleting' }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeleting = deleteState.status === 'deleting';
  const confirmation = buildDayItineraryDeleteConfirmation(deleteState.item);
  const submitView = buildDayItineraryDeleteSubmitState(isDeleting);
  const titleRef = useRef<Text>(null);
  const errorRef = useRef<View>(null);

  useEffect(() => {
    if (isDeleting) {
      return;
    }

    if (deleteState.error) {
      focusAccessibilityNode(errorRef.current);
      AccessibilityInfo.announceForAccessibility(`${deleteState.error.title}. ${deleteState.error.helper}`);
      return;
    }

    focusAccessibilityNode(titleRef.current);
  }, [deleteState.error, deleteState.item.id, isDeleting]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (canDismissDayItineraryDeleteModal(deleteState.status)) {
          onCancel();
        }
      }}
      transparent
      visible
    >
      <View style={styles.modalBackdrop}>
        <View accessibilityViewIsModal importantForAccessibility="yes" style={styles.modalCard}>
          <Text ref={titleRef} accessibilityRole="header" style={styles.modalTitle}>
            {confirmation.title}
          </Text>
          <View style={styles.deleteTargetBox}>
            <Text style={styles.deleteTargetText}>{confirmation.itemLabel}</Text>
            <Text style={styles.deleteTargetContext}>{confirmation.contextLabel}</Text>
          </View>
          <Text style={styles.message}>{confirmation.helper}</Text>
          {deleteState.error ? (
            <View
              ref={errorRef}
              accessible
              accessibilityLabel={`${deleteState.error.title}. ${deleteState.error.helper}`}
              accessibilityLiveRegion="assertive"
              style={styles.errorBox}
            >
              <Text style={styles.errorTitle}>{deleteState.error.title}</Text>
              <Text style={styles.message}>{deleteState.error.helper}</Text>
            </View>
          ) : null}
          <View style={styles.actionGroup}>
            <Pressable
              accessibilityRole="button"
              disabled={submitView.disabled}
              onPress={onConfirm}
              style={[styles.dangerButton, submitView.disabled ? styles.buttonDisabled : null]}
            >
              {isDeleting ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{submitView.label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={[styles.secondaryButton, isDeleting ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    justifyContent: 'center',
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  sectionCard: {
    marginTop: theme.space[5],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  modalCard: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  modalTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  deleteTargetBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  deleteTargetText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  deleteTargetContext: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  dayHeader: {
    alignItems: 'center',
    gap: theme.space[2],
  },
  dayLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayDate: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  placeList: {
    gap: theme.space[3],
  },
  lodgingBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  lodgingPlaceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  lodgingPickerBox: {
    gap: theme.space[3],
  },
  lodgingOption: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[3],
  },
  lodgingOptionSelected: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primarySoft,
  },
  placeRow: {
    alignItems: 'flex-start',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    padding: theme.space[4],
  },
  placeRowActive: {
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primarySoft,
  },
  placeContent: {
    flex: 1,
    gap: theme.space[2],
  },
  placeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  placeName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  timeLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  rowActionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  rowActionButton: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowActionButtonDisabled: {
    opacity: 0.6,
  },
  rowDangerActionButton: {
    borderColor: theme.color.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowActionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  rowDangerActionText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  expenseStatusBox: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  expenseList: {
    gap: theme.space[3],
  },
  expenseRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  expensePlaceName: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  expenseAmount: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  expenseErrorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  dragHandle: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: theme.layout.controlHSm,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  dragHandleActive: {
    borderColor: theme.color.primary,
  },
  dragHandleBar: {
    backgroundColor: theme.color.textMuted,
    borderRadius: theme.radius.pill,
    height: 2,
    width: 18,
  },
  emptyBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  panelTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
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
  addressInput: {
    minHeight: theme.layout.controlHLg,
  },
  timeFieldRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  timeField: {
    flex: 1,
    gap: theme.space[2],
  },
  fieldHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  chip: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  chipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  chipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  chipTextSelected: {
    color: theme.color.primary,
  },
  errorBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  reorderNotice: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.space[4],
  },
  sharedUpdateNotice: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  actionGroup: {
    gap: theme.space[3],
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  buttonDisabled: {
    backgroundColor: theme.color.textFaint,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
});
