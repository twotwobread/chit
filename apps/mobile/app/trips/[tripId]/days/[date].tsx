import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
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
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type TripPlaceType } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { theme } from '../../../../lib/design';
import {
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
  buildReorderDayItineraryItemsRequest,
  dayItineraryReorderFailureState,
  moveDayItineraryReorderItem,
  submitDayItineraryReorder,
  type DayItineraryReorderDraftViewModel,
} from '../../../../lib/trips/reorder-itinerary';
import {
  resolveDayItineraryDragAutoScrollOffset,
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
import { buildGooglePlaceSearchRoute } from '../../../../lib/places/google-search';
import {
  clearDayLodgingPlace,
  deleteDayItineraryItem,
  getTripDayItinerary,
  reorderDayItineraryItems,
  setDayLodgingPlace,
  updateDayItineraryItem,
} from '../../../../lib/trips/client';
import {
  buildDayLodgingRowViewModel,
  buildSetDayLodgingPlaceRequest,
  dayLodgingMutationFailureState,
  type DayLodgingSubmittingState,
} from '../../../../lib/trips/lodging-place';

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
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const [state, setState] = useState<DayItineraryState>({ status: 'loading' });
  const [editState, setEditState] = useState<EditState>({ status: 'idle' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const [reorderState, setReorderState] = useState<ReorderState>({ status: 'idle' });
  const [lodgingState, setLodgingState] = useState<LodgingState>({ status: 'idle' });
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);
  const [mapActionFeedback, setMapActionFeedback] = useState<DayItineraryMapActionFeedback | null>(null);
  const [contentFocusRequest, setContentFocusRequest] = useState<DayItineraryContentFocusRequest | null>(null);
  const [isReorderDragging, setIsReorderDragging] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollMetricsRef = useRef<DayItineraryScrollMetrics>({ offsetY: 0, viewportHeight: 0, contentHeight: 0 });
  const reorderDragPointerYRef = useRef<number | null>(null);
  const reorderAutoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reorderStateRef = useRef<ReorderState>({ status: 'idle' });
  const deleteOriginFocusTargetRef = useRef<number | null>(null);
  const focusRequestIdRef = useRef(0);

  useEffect(() => {
    reorderStateRef.current = reorderState;
  }, [reorderState]);

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
      setState({ status: 'notFound', title: notFound.title, helper: notFound.helper });
      return;
    }

    setMapActionFeedback(null);
    setState({ status: 'loading' });
    try {
      const response = await getTripDayItinerary(tripId, date);
      setState({ status: 'success', viewModel: buildDayItineraryViewModel(response) });
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
        const failure = dayItineraryFailureState(error.status);
        if (failure.status === 'notFound') {
          setState({ status: 'notFound', title: failure.title, helper: failure.helper });
          return;
        }
        setState({ status: 'error', title: failure.title, helper: failure.helper });
        return;
      }
      const failure = dayItineraryFailureState();
      setState({ status: 'error', title: failure.title, helper: failure.helper });
    }
  }, [date, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();

      return () => {
        setReorderDragActive(false);
        if (reorderStateRef.current.status === 'editing') {
          setReorderFeedback(null);
          setReorderState({ status: 'idle' });
        }
      };
    }, [load, setReorderDragActive]),
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

  const backToTripDetail = () => {
    if (tripId) {
      router.replace(`/trips/${tripId}`);
      return;
    }
    router.replace('/');
  };

  const beginEdit = (item: DayItineraryRowViewModel) => {
    discardReorder();
    const values = buildDayItineraryEditForm(item);
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);
    setEditState({ status: 'editing', item, original: values, values, errors: {} });
  };

  const beginReorder = (viewModel: DayItineraryViewModel) => {
    const draft = buildDayItineraryReorderDraft(viewModel);
    if (!draft) {
      return;
    }

    setReorderFeedback(null);
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    setMapActionFeedback(null);
    setReorderState({ status: 'editing', draft });
  };

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
      await updateDayItineraryItem(tripId, date, editState.item.id, validation.request);
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
    if (!buildReorderDayItineraryItemsRequest(draft)) {
      return;
    }

    const submittingState: ReorderState = { ...reorderState, status: 'saving', error: undefined };
    setReorderState(submittingState);
    try {
      const response = await submitDayItineraryReorder(draft, (request) =>
        reorderDayItineraryItems(tripId, date, request),
      );
      if (!response) {
        setReorderState({ status: 'editing', draft });
        return;
      }
      const success = buildDayItineraryReorderSuccessViewModel(response);
      setReorderFeedback(success.reorderFeedback);
      setReorderState(success.reorderState);
      setState({ status: 'success', viewModel: success.itinerary });
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
      await deleteDayItineraryItem(tripId, date, deleteState.item.id);
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
          <Text style={styles.screenTitle}>Day 일정</Text>
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
                  router.push(buildGooglePlaceSearchRoute(tripId, date));
                }
              }}
              onCopyAddress={(item) => void copyPlaceAddress(item)}
              onDeletePlace={beginDelete}
              onEditPlace={beginEdit}
              onEnterReorderMode={() => beginReorder(state.viewModel)}
              onExitReorderMode={cancelReorder}
              lodgingState={lodgingState}
              onClearLodging={(item) => void submitClearLodging(item)}
              onMoveReorderItem={moveReorderItem}
              onOpenMap={(item) => void openPlaceMap(item)}
              onReorderDragActiveChange={setReorderDragActive}
              onReorderDragMove={requestReorderAutoScroll}
              onSaveReorder={() => void submitReorder()}
              onSetLodging={(item) => void submitSetLodging(item)}
              mapActionFeedback={mapActionFeedback}
              reorderFeedback={reorderFeedback}
              reorderState={reorderState}
              viewModel={state.viewModel}
            />
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
            <Pressable accessibilityRole="button" onPress={backToTripDetail} style={styles.button}>
              <Text style={styles.buttonText}>여행 상세로</Text>
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
  lodgingState,
  onFocusRequestHandled,
  onAddPlace,
  onClearLodging,
  onCopyAddress,
  onDeletePlace,
  onEditPlace,
  onEnterReorderMode,
  onExitReorderMode,
  onMoveReorderItem,
  onOpenMap,
  onReorderDragActiveChange,
  onReorderDragMove,
  onSaveReorder,
  onSetLodging,
  mapActionFeedback,
  reorderFeedback,
  reorderState,
  viewModel,
}: {
  focusRequest: DayItineraryContentFocusRequest | null;
  getReorderScrollOffsetY: () => number;
  lodgingState: LodgingState;
  onFocusRequestHandled: () => void;
  onAddPlace: () => void;
  onClearLodging: (item: DayItineraryRowViewModel) => void;
  onCopyAddress: (item: DayItineraryRowViewModel) => void;
  onDeletePlace: (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => void;
  onEditPlace: (item: DayItineraryRowViewModel) => void;
  onEnterReorderMode: () => void;
  onExitReorderMode: () => void;
  onMoveReorderItem: (fromIndex: number, toIndex: number) => void;
  onOpenMap: (item: DayItineraryRowViewModel) => void;
  onReorderDragActiveChange: (isActive: boolean) => void;
  onReorderDragMove: (pointerY: number) => void;
  onSaveReorder: () => void;
  onSetLodging: (item: DayItineraryRowViewModel) => void;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  reorderFeedback: string | null;
  reorderState: ReorderState;
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
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{item.orderLabel}</Text>
                  </View>
                  <View style={styles.placeContent}>
                    <View style={styles.placeTitleRow}>
                      <Text
                        ref={(node) => {
                          rowRefs.current[item.id] = node;
                        }}
                        accessibilityLabel={`${item.orderLabel}번째 장소 ${item.placeName}. ${item.placeTypeLabel}. ${item.address}`}
                        style={styles.placeName}
                      >
                        {item.placeName}
                      </Text>
                      <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
                      {lodging.badgeLabel ? (
                        <View style={styles.lodgingBadge}>
                          <Text style={styles.lodgingBadgeText}>{lodging.badgeLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.address}>{item.address}</Text>
                    <View style={styles.rowActionGroup}>
                      <Pressable
                        accessibilityLabel={`${item.placeName} 지도 열기`}
                        accessibilityRole="button"
                        onPress={() => onOpenMap(item)}
                        style={styles.rowActionButton}
                      >
                        <Text style={styles.rowActionText}>{mapActions.map.label}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityHint={mapActions.copy.disabled ? mapActions.copy.disabledHelper : undefined}
                        accessibilityLabel={`${item.placeName} 주소 복사`}
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
            <Pressable accessibilityRole="button" onPress={onAddPlace} style={styles.button}>
              <Text style={styles.buttonText}>장소 추가</Text>
            </Pressable>
          </>
        )}
      </View>
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
      onPanResponderGrant: () => {
        dragRef.current = {
          itemId: item.id,
          currentIndex: index,
          startIndex: index,
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
        const dragOffsetY = gestureState.dy + getScrollOffsetY() - dragRef.current.startScrollOffsetY;
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
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{item.orderLabel}</Text>
        </View>
        <View style={styles.placeContent}>
          <View style={styles.placeTitleRow}>
            <Text style={styles.placeName}>{item.placeName}</Text>
            <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
          </View>
          <Text style={styles.address}>{item.address}</Text>
        </View>
        <View
          accessibilityHint="핸들을 잡고 위아래로 끌어서 순서를 바꿔요."
          accessibilityLabel={`${item.placeName} 드래그 핸들`}
          accessibilityRole="button"
          style={[styles.dragHandle, isActive ? styles.dragHandleActive : null]}
          {...responder.panHandlers}
        >
          <Text style={styles.dragHandleText}>{item.dragHandleLabel}</Text>
        </View>
      </View>
    );
  });
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
  orderBadge: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    height: theme.layout.controlHSm,
    justifyContent: 'center',
    width: theme.layout.controlHSm,
  },
  orderText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
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
  placeType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
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
  lodgingBadge: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  lodgingBadgeText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  rowDangerActionText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  dragHandle: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    minWidth: theme.layout.controlHSm,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  dragHandleActive: {
    borderColor: theme.color.primary,
  },
  dragHandleText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
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
