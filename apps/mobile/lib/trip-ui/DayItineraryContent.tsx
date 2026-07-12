import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, findNodeHandle, Pressable, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { Badge, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  buildDayItineraryPlaceAccessibilityLabel,
  type DayItineraryRowViewModel,
  type DayItineraryViewModel,
} from '../trips/day-itinerary';
import { buildDayItineraryDetailPanel } from '../trips/day-itinerary-detail-panel';
import { type DayItineraryEditFormValues } from '../trips/day-itinerary-edit';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import { resolveDayItinerarySheetMode, shouldDismissDayItinerarySheet } from '../trips/day-itinerary-sheet';
import { type NonPlaceScheduleItemFormValues } from '../trips/non-place-schedule-item';
import { buildDayItineraryReorderAction, buildDayItineraryReorderSubmitState } from '../trips/reorder-itinerary';
import {
  ITINERARY_TAB_EMPTY_HELPER,
  ITINERARY_TAB_EMPTY_TITLE,
  buildItineraryTimelineItems,
} from '../trips/itinerary-tab';
import {
  buildDayLodgingPanel,
  type DayLodgingManualFormValues,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { buildDayItinerarySharedUpdateBanner } from '../trips/shared-itinerary-updates';
import { focusAccessibilityNode } from './accessibility-focus';
import { BottomSheet } from './BottomSheet';
import { DayLodgingPanel } from './DayLodgingPanel';
import { EditPlacePanel } from './EditPlacePanel';
import { NonPlaceScheduleItemPanel } from './NonPlaceScheduleItemPanel';
import { ReorderPlaceList } from './DayItineraryReorderList';
import { styles } from './DayItineraryEditorStyles';
import type {
  DayItineraryContentFocusRequest,
  DayItineraryLodgingPickerState,
  DayItineraryLodgingState,
  DayItineraryReorderState,
  EditPlacePanelState,
  NonPlaceScheduleItemPanelState,
} from './DayItineraryEditorTypes';
import { ItineraryTimeline, type ItineraryTimelineItem } from './ItineraryTimeline';

export function DayItineraryContent({
  editState,
  focusRequest,
  getReorderScrollOffsetY,
  lodgingPickerState,
  lodgingState,
  onFocusRequestHandled,
  onCancelLodgingPicker,
  onClearCurrentLodging,
  onCopyAddress,
  onCreateManualLodging,
  onDeletePlace,
  onCancelEdit,
  onCancelNonPlaceEditor,
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
  onSubmitEdit,
  onSubmitNonPlaceEditor,
  onUpdateEditValues,
  onUpdateManualLodgingValues,
  onUpdateNonPlaceEditorValues,
  mapActionFeedback,
  onReloadSharedUpdate,
  nonPlaceEditorState,
  reorderFeedback,
  reorderState,
  sharedUpdateBanner,
  sharedUpdateReloadDisabled,
  viewModel,
}: {
  editState: { status: 'idle' } | EditPlacePanelState;
  focusRequest: DayItineraryContentFocusRequest | null;
  getReorderScrollOffsetY: () => number;
  lodgingPickerState: DayItineraryLodgingPickerState;
  lodgingState: DayItineraryLodgingState;
  onFocusRequestHandled: () => void;
  onCancelLodgingPicker: () => void;
  onClearCurrentLodging: () => void;
  onCopyAddress: (item: DayItineraryRowViewModel) => void;
  onCreateManualLodging: () => void;
  onDeletePlace: (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => void;
  onCancelEdit: () => void;
  onCancelNonPlaceEditor: () => void;
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
  onSubmitEdit: () => void;
  onSubmitNonPlaceEditor: () => void;
  onUpdateEditValues: (values: DayItineraryEditFormValues) => void;
  onUpdateManualLodgingValues: (values: DayLodgingManualFormValues) => void;
  onUpdateNonPlaceEditorValues: (values: NonPlaceScheduleItemFormValues) => void;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  onReloadSharedUpdate: () => void;
  nonPlaceEditorState: { status: 'idle' } | NonPlaceScheduleItemPanelState;
  reorderFeedback: string | null;
  reorderState: DayItineraryReorderState;
  sharedUpdateBanner: ReturnType<typeof buildDayItinerarySharedUpdateBanner>;
  sharedUpdateReloadDisabled: boolean;
  viewModel: DayItineraryViewModel;
}) {
  const reorderAction = buildDayItineraryReorderAction(viewModel);
  const isReorderMode = reorderState.status === 'editing' || reorderState.status === 'saving';
  const reorderSubmitState = isReorderMode
    ? buildDayItineraryReorderSubmitState(reorderState.status === 'saving', reorderState.draft)
    : null;
  const emptyStateRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, Text | null>>({});
  const deleteTriggerRefs = useRef<Record<string, View | null>>({});
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);
  const timelineItems = buildItineraryTimelineItems(viewModel);
  const itineraryItemsById = new Map(
    viewModel.status === 'success' ? viewModel.items.map((item) => [item.id, item] as const) : [],
  );
  const selectedDetailItem = selectedDetailItemId ? (itineraryItemsById.get(selectedDetailItemId) ?? null) : null;
  const sheetMode = resolveDayItinerarySheetMode({
    selectedDetailItemId,
    editStatus: editState.status,
    nonPlaceEditorStatus: nonPlaceEditorState.status,
  });

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

  const closeDetailSheet = () => setSelectedDetailItemId(null);

  const closeActiveSheet = () => {
    if (
      !shouldDismissDayItinerarySheet({
        editStatus: editState.status,
        nonPlaceEditorStatus: nonPlaceEditorState.status,
      })
    ) {
      return;
    }
    if (editState.status !== 'idle') {
      onCancelEdit();
    }
    if (nonPlaceEditorState.status !== 'idle') {
      onCancelNonPlaceEditor();
    }
    setSelectedDetailItemId(null);
  };

  const handlePressTimelineItem = (timelineItem: ItineraryTimelineItem) => {
    const item = resolveTimelineItem(timelineItem);
    if (item) {
      setSelectedDetailItemId(item.id);
    }
  };

  const handleEditFromDetail = (item: DayItineraryRowViewModel) => {
    onEditPlace(item);
  };

  const renderTimelineSwipeAction = (timelineItem: ItineraryTimelineItem) => {
    const item = resolveTimelineItem(timelineItem);
    if (!item) {
      return null;
    }

    return (
      <Pressable
        ref={(node) => {
          deleteTriggerRefs.current[item.id] = node;
        }}
        accessibilityLabel={`${item.placeName} 삭제`}
        accessibilityRole="button"
        onPress={() => {
          closeDetailSheet();
          onDeletePlace(item, findNodeHandle(deleteTriggerRefs.current[item.id]));
        }}
        style={({ pressed }) => [styles.swipeDeleteButton, pressed ? styles.swipeDeleteButtonPressed : null]}
      >
        <View style={styles.swipeDeleteIconButton}>
          <Trash2 color={theme.color.onPrimary} size={20} strokeWidth={2.4} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
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
          <View style={styles.placeListHeader}>
            <Text style={styles.sectionTitle}>일정 목록</Text>
            {isReorderMode ? (
              <View style={styles.placeListHeaderActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={reorderState.status === 'saving'}
                  onPress={onExitReorderMode}
                  style={[
                    styles.headerSecondaryButton,
                    reorderState.status === 'saving' ? styles.secondaryButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.headerSecondaryButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: reorderSubmitState?.disabled ?? true }}
                  disabled={reorderSubmitState?.disabled ?? true}
                  onPress={onSaveReorder}
                  style={[styles.headerPrimaryButton, reorderSubmitState?.disabled ? styles.buttonDisabled : null]}
                >
                  {reorderState.status === 'saving' ? (
                    <ActivityIndicator color={theme.color.onPrimary} size="small" />
                  ) : null}
                  <Text style={styles.headerPrimaryButtonText}>{reorderSubmitState?.label ?? '저장'}</Text>
                </Pressable>
              </View>
            ) : reorderAction.status === 'enabled' ? (
              <Pressable accessibilityRole="button" onPress={onEnterReorderMode} style={styles.headerSecondaryButton}>
                <Text style={styles.headerSecondaryButtonText}>{reorderAction.label}</Text>
              </Pressable>
            ) : null}
          </View>

          {isReorderMode ? (
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
              onPressItem={handlePressTimelineItem}
              renderSwipeAction={renderTimelineSwipeAction}
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

        {isReorderMode ? (
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
          </>
        ) : null}
      </View>

      <DayItineraryItemSheet
        editState={editState}
        item={selectedDetailItem}
        mapActionFeedback={mapActionFeedback}
        nonPlaceEditorState={nonPlaceEditorState}
        onCancelEdit={onCancelEdit}
        onCancelNonPlaceEditor={onCancelNonPlaceEditor}
        onClose={closeActiveSheet}
        onCloseDetail={closeDetailSheet}
        onCopyAddress={onCopyAddress}
        onEdit={handleEditFromDetail}
        onOpenMap={onOpenMap}
        onSubmitEdit={onSubmitEdit}
        onSubmitNonPlaceEditor={onSubmitNonPlaceEditor}
        onUpdateEditValues={onUpdateEditValues}
        onUpdateNonPlaceEditorValues={onUpdateNonPlaceEditorValues}
        sheetMode={sheetMode}
      />
    </View>
  );
}

function DayItineraryItemSheet({
  editState,
  item,
  mapActionFeedback,
  nonPlaceEditorState,
  onCancelEdit,
  onCancelNonPlaceEditor,
  onClose,
  onCloseDetail,
  onCopyAddress,
  onEdit,
  onOpenMap,
  onSubmitEdit,
  onSubmitNonPlaceEditor,
  onUpdateEditValues,
  onUpdateNonPlaceEditorValues,
  sheetMode,
}: {
  editState: { status: 'idle' } | EditPlacePanelState;
  item: DayItineraryRowViewModel | null;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  nonPlaceEditorState: { status: 'idle' } | NonPlaceScheduleItemPanelState;
  onCancelEdit: () => void;
  onCancelNonPlaceEditor: () => void;
  onClose: () => void;
  onCloseDetail: () => void;
  onCopyAddress: (item: DayItineraryRowViewModel) => void;
  onEdit: (item: DayItineraryRowViewModel) => void;
  onOpenMap: (item: DayItineraryRowViewModel) => void;
  onSubmitEdit: () => void;
  onSubmitNonPlaceEditor: () => void;
  onUpdateEditValues: (values: DayItineraryEditFormValues) => void;
  onUpdateNonPlaceEditorValues: (values: NonPlaceScheduleItemFormValues) => void;
  sheetMode: ReturnType<typeof resolveDayItinerarySheetMode>;
}) {
  if (sheetMode.kind === 'closed') {
    return null;
  }

  if (sheetMode.kind === 'editPlace') {
    if (editState.status === 'idle') {
      return null;
    }

    return (
      <BottomSheet onClose={onClose} scrollable visible>
        <EditPlacePanel
          editState={editState}
          onCancel={onCancelEdit}
          onSubmit={onSubmitEdit}
          onUpdateValues={onUpdateEditValues}
          variant="sheet"
        />
      </BottomSheet>
    );
  }

  if (sheetMode.kind === 'editNonPlace') {
    if (nonPlaceEditorState.status === 'idle') {
      return null;
    }

    return (
      <BottomSheet onClose={onClose} scrollable visible>
        <NonPlaceScheduleItemPanel
          editorState={nonPlaceEditorState}
          onCancel={onCancelNonPlaceEditor}
          onSubmit={onSubmitNonPlaceEditor}
          onUpdateValues={onUpdateNonPlaceEditorValues}
          variant="sheet"
        />
      </BottomSheet>
    );
  }

  if (!item) {
    return null;
  }

  const panel = buildDayItineraryDetailPanel(item);

  return (
    <BottomSheet onClose={onClose} scrollable visible>
      <View style={styles.detailSheetBody}>
        <View style={styles.detailSheetHeader}>
          <Text style={styles.detailSheetTitle}>{panel.title}</Text>
          <View style={styles.detailMetaRow}>
            <Badge label={panel.categoryLabel} tone={item.itemType === 'non_place' ? 'primary' : 'neutral'} />
            {item.isLodging ? <Badge label="대표 숙소" tone="neutral" /> : null}
          </View>
          {panel.detailLabel ? <Text style={styles.detailSheetMeta}>{panel.detailLabel}</Text> : null}
        </View>

        {panel.address ? (
          <View style={styles.detailAddressBox}>
            <Text style={styles.label}>주소</Text>
            <Text style={styles.detailAddressText}>{panel.address}</Text>
          </View>
        ) : null}

        {panel.memo ? (
          <View style={styles.detailAddressBox}>
            <Text style={styles.label}>메모</Text>
            <Text style={styles.detailAddressText}>{panel.memo}</Text>
          </View>
        ) : null}

        <View style={styles.detailActionGroup}>
          {panel.actions.copyAddress ? (
            <Pressable
              accessibilityLabel={panel.actions.copyAddress.accessibilityLabel}
              accessibilityRole="button"
              onPress={() => onCopyAddress(item)}
              style={({ pressed }) => [styles.rowActionButton, pressed ? styles.rowActionButtonPressed : null]}
            >
              <Text style={styles.rowActionText}>{panel.actions.copyAddress.label}</Text>
            </Pressable>
          ) : null}
          {panel.actions.openMap ? (
            <Pressable
              accessibilityLabel={panel.actions.openMap.accessibilityLabel}
              accessibilityRole="button"
              onPress={() => onOpenMap(item)}
              style={({ pressed }) => [styles.rowActionButton, pressed ? styles.rowActionButtonPressed : null]}
            >
              <Text style={styles.rowActionText}>{panel.actions.openMap.label}</Text>
            </Pressable>
          ) : null}
        </View>

        {mapActionFeedback ? (
          <View style={mapActionFeedback.kind === 'error' ? styles.errorBox : styles.inlineSuccessNotice}>
            <Text style={styles.message}>{mapActionFeedback.message}</Text>
          </View>
        ) : null}

        <View style={styles.detailFooterActions}>
          <PrimaryButton
            accessibilityLabel={panel.actions.edit.accessibilityLabel}
            label={panel.actions.edit.label}
            onPress={() => onEdit(item)}
          />
          <SecondaryButton label="취소" onPress={onCloseDetail} />
        </View>
      </View>
    </BottomSheet>
  );
}
