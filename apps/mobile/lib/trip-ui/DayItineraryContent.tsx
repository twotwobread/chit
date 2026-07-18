import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, findNodeHandle, Pressable, Text, View } from 'react-native';
import { ArrowRight, Trash2 } from 'lucide-react-native';

import { Badge, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  buildDayItineraryPlaceAccessibilityLabel,
  type DayItineraryRowViewModel,
  type DayItineraryViewModel,
} from '../trips/day-itinerary';
import { buildDayItineraryDetailPanel } from '../trips/day-itinerary-detail-panel';
import {
  buildDayItineraryEditSubmitState,
  hasDayItineraryEditFormChanges,
  type DayItineraryEditFormValues,
} from '../trips/day-itinerary-edit';
import {
  type DayItineraryMapActionFeedback,
  type DayItineraryMapActionInput,
} from '../trips/day-itinerary-map-actions';
import {
  buildDayItineraryDirtyClosePrompt,
  resolveDayItinerarySheetCloseAction,
  resolveDayItinerarySheetMode,
} from '../trips/day-itinerary-sheet';
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
import { BottomSheet } from './BottomSheet';
import { DayLodgingPanel } from './DayLodgingPanel';
import { EditPlacePanel } from './EditPlacePanel';
import { ReorderPlaceList } from './DayItineraryReorderList';
import { styles } from './DayItineraryEditorStyles';
import type {
  DayItineraryContentFocusRequest,
  DayItineraryLodgingPickerState,
  DayItineraryLodgingState,
  DayItineraryReorderState,
  EditPlacePanelState,
} from './DayItineraryEditorTypes';
import type { MoveState } from './DayItineraryEditorControllerTypes';
import { ItineraryTimeline, type ItineraryTimelineItem } from './ItineraryTimeline';

export function DayItineraryContent({
  canMovePlaces,
  editState,
  focusRequest,
  getReorderScrollOffsetY,
  lodgingPickerState,
  lodgingState,
  onFocusRequestHandled,
  onCancelLodgingPicker,
  onClearCurrentLodging,
  onCopyAddress,
  onDeletePlace,
  onCancelEdit,
  onEditPlace,
  onMovePlace,
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
  onSubmitEdit,
  onUpdateEditValues,
  mapActionFeedback,
  moveFeedback,
  moveState,
  onReloadSharedUpdate,
  onCancelMove,
  onSelectMoveTarget,
  reorderFeedback,
  reorderState,
  sharedUpdateBanner,
  sharedUpdateReloadDisabled,
  viewModel,
}: {
  canMovePlaces: boolean;
  editState: { status: 'idle' } | EditPlacePanelState;
  focusRequest: DayItineraryContentFocusRequest | null;
  getReorderScrollOffsetY: () => number;
  lodgingPickerState: DayItineraryLodgingPickerState;
  lodgingState: DayItineraryLodgingState;
  onFocusRequestHandled: () => void;
  onCancelLodgingPicker: () => void;
  onClearCurrentLodging: () => void;
  onCopyAddress: (input: DayItineraryMapActionInput) => void;
  onDeletePlace: (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => void;
  onCancelEdit: () => void;
  onEditPlace: (item: DayItineraryRowViewModel) => void;
  onMovePlace: (item: DayItineraryRowViewModel) => void;
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
  onSubmitEdit: () => void;
  onUpdateEditValues: (values: DayItineraryEditFormValues) => void;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  moveFeedback: string | null;
  moveState: MoveState;
  onReloadSharedUpdate: () => void;
  onCancelMove: () => void;
  onSelectMoveTarget: (targetTripDayId: string) => void;
  reorderFeedback: string | null;
  reorderState: DayItineraryReorderState;
  sharedUpdateBanner: ReturnType<typeof buildDayItinerarySharedUpdateBanner>;
  sharedUpdateReloadDisabled: boolean;
  viewModel: DayItineraryViewModel;
}) {
  const reorderAction = buildDayItineraryReorderAction(viewModel);
  const isReorderMode = reorderState.status === 'editing' || reorderState.status === 'saving';
  const isMoveActive = moveState.status !== 'idle';
  const reorderSubmitState = isReorderMode
    ? buildDayItineraryReorderSubmitState(reorderState.status === 'saving', reorderState.draft)
    : null;
  const [isLodgingSheetVisible, setIsLodgingSheetVisible] = useState(false);
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

  const discardActiveSheetChanges = () => {
    if (editState.status !== 'idle') {
      onCancelEdit();
    }
    setSelectedDetailItemId(null);
  };

  const closeActiveSheet = () => {
    const closeAction = resolveDayItinerarySheetCloseAction({
      editStatus: editState.status,
      hasEditChanges:
        editState.status === 'idle' ? false : hasDayItineraryEditFormChanges(editState.original, editState.values),
    });

    if (closeAction.kind === 'blocked') {
      return;
    }
    if (closeAction.kind === 'promptSave') {
      const prompt = buildDayItineraryDirtyClosePrompt();
      Alert.alert(
        prompt.title,
        undefined,
        prompt.buttons.map((button) => {
          if (button.role === 'cancel') {
            return { text: button.label, style: button.style };
          }
          if (button.role === 'discard') {
            return { text: button.label, style: button.style, onPress: discardActiveSheetChanges };
          }
          return { text: button.label, onPress: onSubmitEdit };
        }),
      );
      return;
    }
    discardActiveSheetChanges();
  };

  const handlePressTimelineItem = (timelineItem: ItineraryTimelineItem) => {
    const item = resolveTimelineItem(timelineItem);
    if (item) {
      setSelectedDetailItemId(null);
      onEditPlace(item);
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
      <View style={styles.swipeActionGroup}>
        {canMovePlaces ? (
          <Pressable
            accessibilityLabel={`${item.placeName} 다른 Day로 이동`}
            accessibilityRole="button"
            disabled={isMoveActive || isReorderMode || editState.status !== 'idle'}
            onPress={() => {
              closeDetailSheet();
              onMovePlace(item);
            }}
            style={({ pressed }) => [styles.swipeDeleteButton, pressed ? styles.swipeDeleteButtonPressed : null]}
          >
            <View style={styles.swipeMoveIconButton}>
              <ArrowRight color={theme.color.onPrimary} size={20} strokeWidth={2.4} />
            </View>
          </Pressable>
        ) : null}
        <Pressable
          ref={(node) => {
            deleteTriggerRefs.current[item.id] = node;
          }}
          accessibilityLabel={`${item.placeName} 삭제`}
          accessibilityRole="button"
          disabled={isMoveActive || isReorderMode || editState.status !== 'idle'}
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
              onPressLodgingBadge={openLodgingSheet}
              renderSwipeAction={renderTimelineSwipeAction}
              swipeActionWidth={canMovePlaces ? 116 : undefined}
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

        {mapActionFeedback && sheetMode.kind === 'closed' ? (
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

        {moveFeedback ? (
          <View style={styles.reorderNotice}>
            <Text style={styles.message}>{moveFeedback}</Text>
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

      <DayItineraryMoveTargetSheet moveState={moveState} onCancel={onCancelMove} onSelectTarget={onSelectMoveTarget} />

      <DayItineraryItemSheet
        editState={editState}
        item={selectedDetailItem}
        mapActionFeedback={mapActionFeedback}
        onCancelEdit={onCancelEdit}
        onClose={closeActiveSheet}
        onCloseDetail={closeDetailSheet}
        onCopyAddress={onCopyAddress}
        onEdit={handleEditFromDetail}
        onOpenMap={onOpenMap}
        onSubmitEdit={onSubmitEdit}
        onUpdateEditValues={onUpdateEditValues}
        sheetMode={sheetMode}
      />
    </View>
  );
}

function DayItineraryMoveTargetSheet({
  moveState,
  onCancel,
  onSelectTarget,
}: {
  moveState: MoveState;
  onCancel: () => void;
  onSelectTarget: (targetTripDayId: string) => void;
}) {
  if (moveState.status === 'idle') {
    return null;
  }

  const isSaving = moveState.status === 'saving';

  return (
    <BottomSheet onClose={isSaving ? () => {} : onCancel} scrollable visible>
      <View style={styles.detailSheetBody}>
        <View style={styles.detailSheetHeader}>
          <Text style={styles.detailSheetTitle}>어느 Day로 이동할까요?</Text>
          <Text style={styles.detailSheetMeta}>{moveState.item.placeName} 일정을 선택한 Day 마지막으로 이동해요.</Text>
        </View>
        <View style={styles.chipList}>
          {moveState.targetOptions.map((option) => (
            <Pressable
              accessibilityLabel={`${option.dayLabel} ${option.formattedDate}로 이동`}
              accessibilityRole="button"
              disabled={isSaving}
              key={option.tripDayId}
              onPress={() => onSelectTarget(option.tripDayId)}
              style={[styles.chip, isSaving ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.chipText}>{option.dayLabel}</Text>
              <Text style={styles.fieldHelper}>{option.formattedDate}</Text>
            </Pressable>
          ))}
        </View>
        {moveState.status === 'pickingTarget' && moveState.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{moveState.error.title}</Text>
            <Text style={styles.message}>{moveState.error.helper}</Text>
          </View>
        ) : null}
        <View style={styles.sheetActionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={[styles.secondaryButton, styles.sheetActionButton, isSaving ? styles.secondaryButtonDisabled : null]}
          >
            <Text style={styles.secondaryButtonText}>취소</Text>
          </Pressable>
          {isSaving ? (
            <View style={[styles.button, styles.sheetActionButton]}>
              <ActivityIndicator color={theme.color.onPrimary} size="small" />
              <Text style={styles.buttonText}>이동 중...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

function DayItineraryItemSheet({
  editState,
  item,
  mapActionFeedback,
  onCancelEdit,
  onClose,
  onCloseDetail,
  onCopyAddress,
  onEdit,
  onOpenMap,
  onSubmitEdit,
  onUpdateEditValues,
  sheetMode,
}: {
  editState: { status: 'idle' } | EditPlacePanelState;
  item: DayItineraryRowViewModel | null;
  mapActionFeedback: DayItineraryMapActionFeedback | null;
  onCancelEdit: () => void;
  onClose: () => void;
  onCloseDetail: () => void;
  onCopyAddress: (input: DayItineraryMapActionInput) => void;
  onEdit: (item: DayItineraryRowViewModel) => void;
  onOpenMap: (item: DayItineraryRowViewModel) => void;
  onSubmitEdit: () => void;
  onUpdateEditValues: (values: DayItineraryEditFormValues) => void;
  sheetMode: ReturnType<typeof resolveDayItinerarySheetMode>;
}) {
  if (sheetMode.kind === 'closed') {
    return null;
  }

  if (sheetMode.kind === 'editPlace') {
    if (editState.status === 'idle') {
      return null;
    }

    const isSaving = editState.status === 'saving';
    const submitView = buildDayItineraryEditSubmitState(isSaving);

    return (
      <BottomSheet
        footer={
          <>
            <SecondaryButton disabled={isSaving} label="취소" onPress={onCancelEdit} />
            <PrimaryButton
              disabled={submitView.disabled}
              label={submitView.label}
              loading={isSaving}
              loadingLabel={submitView.label}
              onPress={onSubmitEdit}
            />
          </>
        }
        footerActionCount={2}
        onClose={onClose}
        scrollable
        visible
      >
        <EditPlacePanel
          editState={editState}
          onCancel={onCancelEdit}
          onSubmit={onSubmitEdit}
          onUpdateValues={onUpdateEditValues}
          showActions={false}
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
            <Badge label={panel.categoryLabel} tone="neutral" />
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
