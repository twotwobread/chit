import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, findNodeHandle, Pressable, Text, View } from 'react-native';

import { theme } from '../design';
import {
  buildDayItineraryPlaceAccessibilityLabel,
  type DayItineraryRowViewModel,
  type DayItineraryViewModel,
} from '../trips/day-itinerary';
import {
  buildDayItineraryMapRowActions,
  type DayItineraryMapActionFeedback,
  type DayItineraryMapActionInput,
} from '../trips/day-itinerary-map-actions';
import { buildDayItineraryReorderAction, buildDayItineraryReorderSubmitState } from '../trips/reorder-itinerary';
import {
  ITINERARY_TAB_EMPTY_HELPER,
  ITINERARY_TAB_EMPTY_TITLE,
  buildItineraryTimelineItems,
} from '../trips/itinerary-tab';
import {
  buildDayLodgingPanel,
  runDayLodgingSearchRegisterAction,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { buildDayItinerarySharedUpdateBanner } from '../trips/shared-itinerary-updates';
import { focusAccessibilityNode } from './accessibility-focus';
import { DayLodgingPanel } from './DayLodgingPanel';
import { ReorderPlaceList } from './DayItineraryReorderList';
import { styles } from './DayItineraryEditorStyles';
import type {
  DayItineraryContentFocusRequest,
  DayItineraryLodgingPickerState,
  DayItineraryLodgingState,
  DayItineraryReorderState,
} from './DayItineraryEditorTypes';
import { ItineraryTimeline, type ItineraryTimelineItem } from './ItineraryTimeline';

export function DayItineraryContent({
  focusRequest,
  getReorderScrollOffsetY,
  lodgingPickerState,
  lodgingState,
  onFocusRequestHandled,
  onCancelLodgingPicker,
  onClearCurrentLodging,
  onCopyAddress,
  onDeletePlace,
  onEditPlace,
  onEditTime,
  onEnterReorderMode,
  onExitReorderMode,
  onMoveReorderItem,
  onOpenLodgingPlaceSelection,
  onOpenLodgingSearchRegister,
  onOpenMap,
  onReorderDragActiveChange,
  onReorderDragMove,
  onSaveReorder,
  onSelectLodgingPlace,
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
  lodgingPickerState: DayItineraryLodgingPickerState;
  lodgingState: DayItineraryLodgingState;
  onFocusRequestHandled: () => void;
  onCancelLodgingPicker: () => void;
  onClearCurrentLodging: () => void;
  onCopyAddress: (input: DayItineraryMapActionInput) => void;
  onDeletePlace: (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => void;
  onEditPlace: (item: DayItineraryRowViewModel) => void;
  onEditTime: (item: DayItineraryRowViewModel) => void;
  onEnterReorderMode: () => void;
  onExitReorderMode: () => void;
  onMoveReorderItem: (fromIndex: number, toIndex: number) => void;
  onOpenLodgingPlaceSelection: () => void;
  onOpenLodgingSearchRegister: () => void;
  onOpenMap: (item: DayItineraryRowViewModel) => void;
  onReorderDragActiveChange: (isActive: boolean) => void;
  onReorderDragMove: (pointerY: number) => void;
  onSaveReorder: () => void;
  onSelectLodgingPlace: (option: DayLodgingPlaceOptionViewModel) => void;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  onReloadSharedUpdate: () => void;
  reorderFeedback: string | null;
  reorderState: DayItineraryReorderState;
  sharedUpdateBanner: ReturnType<typeof buildDayItinerarySharedUpdateBanner>;
  sharedUpdateReloadDisabled: boolean;
  viewModel: DayItineraryViewModel;
}) {
  const reorderAction = buildDayItineraryReorderAction(viewModel);
  const reorderSubmitState =
    reorderState.status === 'editing' || reorderState.status === 'saving'
      ? buildDayItineraryReorderSubmitState(reorderState.status === 'saving', reorderState.draft)
      : null;
  const [isLodgingSheetVisible, setIsLodgingSheetVisible] = useState(false);
  const emptyStateRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, Text | null>>({});
  const deleteTriggerRefs = useRef<Record<string, View | null>>({});
  const timelineItems = buildItineraryTimelineItems(viewModel);
  const itineraryItemsById = new Map(
    viewModel.status === 'success' ? viewModel.items.map((item) => [item.id, item] as const) : [],
  );

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const focusFallback = () => {
      if (viewModel.status === 'success') {
        for (const item of viewModel.items) {
          if (focusAccessibilityNode(rowRefs.current[item.id])) {
            return;
          }
        }
      }
      focusAccessibilityNode(emptyStateRef.current);
    };

    if (focusRequest.target.kind === 'deleteTrigger') {
      if (!focusAccessibilityNode(deleteTriggerRefs.current[focusRequest.target.itemId])) {
        focusAccessibilityNode(rowRefs.current[focusRequest.target.itemId]);
      }
      onFocusRequestHandled();
      return;
    }

    if (focusRequest.target.kind === 'placeRow') {
      if (!focusAccessibilityNode(rowRefs.current[focusRequest.target.itemId])) {
        focusFallback();
      }
      onFocusRequestHandled();
      return;
    }

    if (focusRequest.target.kind === 'emptyState') {
      if (!focusAccessibilityNode(emptyStateRef.current)) {
        focusFallback();
      }
      onFocusRequestHandled();
      return;
    }

    focusFallback();
    onFocusRequestHandled();
  }, [focusRequest, onFocusRequestHandled, viewModel]);

  const resolveTimelineItem = (timelineItem: ItineraryTimelineItem): DayItineraryRowViewModel | null =>
    itineraryItemsById.get(timelineItem.id) ?? null;

  const handlePressTimelineTime = (timelineItem: ItineraryTimelineItem) => {
    const item = resolveTimelineItem(timelineItem);
    if (item) {
      onEditTime(item);
    }
  };

  const renderTimelineActions = (timelineItem: ItineraryTimelineItem) => {
    const item = resolveTimelineItem(timelineItem);
    if (!item) {
      return null;
    }

    const mapActions = buildDayItineraryMapRowActions(item);

    return (
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
              style={[styles.rowActionButton, mapActions.copy.disabled ? styles.rowActionButtonDisabled : null]}
            >
              <Text style={styles.rowActionText}>{mapActions.copy.label}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => onEditPlace(item)} style={styles.rowActionButton}>
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
    );
  };

  const openLodgingSheet = () => setIsLodgingSheetVisible(true);
  const closeLodgingSheet = () => setIsLodgingSheetVisible(false);
  const copyCurrentLodgingAddress = () => {
    if (!viewModel.lodgingPlace) {
      return;
    }
    onCopyAddress({ placeName: viewModel.lodgingPlace.name, address: viewModel.lodgingPlace.address });
  };
  const openLodgingSearchRegisterFromSheet = () =>
    runDayLodgingSearchRegisterAction({
      closeSheet: closeLodgingSheet,
      openSearchRegister: onOpenLodgingSearchRegister,
    });

  return (
    <View style={styles.card}>
      <DayLodgingPanel
        isSheetVisible={isLodgingSheetVisible}
        lodgingState={lodgingState}
        onCancelPicker={onCancelLodgingPicker}
        onClear={onClearCurrentLodging}
        onCloseSheet={closeLodgingSheet}
        onCopyAddress={copyCurrentLodgingAddress}
        onOpenSearchRegister={openLodgingSearchRegisterFromSheet}
        onOpenSelection={onOpenLodgingPlaceSelection}
        onOpenSheet={openLodgingSheet}
        onSelectPlace={onSelectLodgingPlace}
        pickerState={lodgingPickerState}
        viewModel={buildDayLodgingPanel(viewModel.lodgingPlace)}
      />

      {viewModel.status === 'empty' ? (
        <View
          ref={emptyStateRef}
          accessible
          accessibilityLabel={`${ITINERARY_TAB_EMPTY_TITLE}. ${ITINERARY_TAB_EMPTY_HELPER}`}
        >
          <ItineraryTimeline
            emptyHelper={ITINERARY_TAB_EMPTY_HELPER}
            emptyTitle={ITINERARY_TAB_EMPTY_TITLE}
            items={timelineItems}
          />
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
            <ItineraryTimeline
              getItemAccessibilityLabel={(timelineItem) => {
                const item = itineraryItemsById.get(timelineItem.id);
                return item ? buildDayItineraryPlaceAccessibilityLabel(item) : timelineItem.name;
              }}
              items={timelineItems}
              onItemNameRef={(timelineItem, node) => {
                rowRefs.current[timelineItem.id] = node;
              }}
              onPressTime={handlePressTimelineTime}
              onPressLodgingBadge={openLodgingSheet}
              renderActions={renderTimelineActions}
            />
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
        ) : reorderAction.status === 'enabled' ? (
          <Pressable accessibilityRole="button" onPress={onEnterReorderMode} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{reorderAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
