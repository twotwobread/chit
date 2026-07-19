import { useState, type ReactNode } from 'react';

import type { TripDay, TripDefaultTravelMode, TripDestination } from '@i-um/api-contract';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';
import { buildTripRootFabLayout, shouldShowTripRootFab } from '../trips/trip-root-fab-layout';
import { DayItineraryContent, DeletePlaceConfirmationModal } from './DayItineraryEditorParts';
import { KeyboardAwareFormScrollView } from './KeyboardAwareFormScrollView';
import { styles } from './DayItineraryEditorStyles';
import { TripRootFab } from './TripRootFab';
import { buildTripDefaultTravelModeSelectorViewModel } from '../trips/travel-mode';
import { useDayItineraryEditorController } from './useDayItineraryEditorController';

export type DayItineraryEditorProps = {
  tripId?: string;
  date?: string;
  initialAction?: string;
  showHeader?: boolean;
  headerContent?: ReactNode;
  tripDays?: TripDay[];
  tripDestinations?: TripDestination[];
  defaultTravelMode?: TripDefaultTravelMode;
  onDefaultTravelModeChange?: (mode: TripDefaultTravelMode) => void | Promise<void>;
  onRequestDayChange?: (dayId: string) => void;
};

export function DayItineraryEditor({
  tripId,
  date,
  initialAction,
  showHeader = true,
  headerContent,
  tripDays = [],
  tripDestinations = [],
  defaultTravelMode,
  onDefaultTravelModeChange,
  onRequestDayChange,
}: DayItineraryEditorProps) {
  const {
    addPlace,
    backToItinerary,
    beginDelete,
    beginEdit,
    beginMove,
    beginReorder,
    cancelDelete,
    cancelEdit,
    cancelLodgingPicker,
    cancelMove,
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
    moveFeedback,
    moveState,
    moveReorderItem,
    openLodgingSearchRegister,
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
    submitDelete,
    submitEdit,
    submitMoveToDay,
    submitReorder,
    submitSelectLodgingPlace,
    updateEditValues,
    updateScrollContentSize,
    updateScrollLayout,
    updateScrollOffset,
  } = useDayItineraryEditorController({ tripId, date, initialAction, tripDays, tripDestinations, onRequestDayChange });
  const [travelModeSaving, setTravelModeSaving] = useState(false);
  const [travelModeFeedback, setTravelModeFeedback] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const addFabLayout = buildTripRootFabLayout({ bottomInset: insets.bottom, rightInset: insets.right });
  const canMovePlaces = Boolean(date && tripDays.some((day) => day.id !== date));
  const showAddFab = shouldShowTripRootFab({
    hasAction: true,
    isBlocked:
      isDeleteModalVisible ||
      editState.status !== 'idle' ||
      reorderState.status !== 'idle' ||
      moveState.status !== 'idle',
    status: state.status === 'success' ? 'ready' : state.status,
  });
  const fabScrollExtraBottomSpacing = showAddFab
    ? Math.max(0, addFabLayout.scrollContent.paddingBottom - Math.max(0, insets.bottom))
    : 0;

  return (
    <View style={styles.root}>
      <KeyboardAwareFormScrollView
        ref={scrollViewRef}
        accessibilityElementsHidden={isDeleteModalVisible}
        contentContainerStyle={styles.scrollContent}
        importantForAccessibility={isDeleteModalVisible ? 'no-hide-descendants' : 'auto'}
        keyboardExtraBottomSpacing={fabScrollExtraBottomSpacing}
        onContentSizeChange={updateScrollContentSize}
        onLayout={updateScrollLayout}
        onScroll={updateScrollOffset}
        scrollEnabled={!isReorderDragging}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {headerContent ? <View style={styles.headerContent}>{headerContent}</View> : null}

        {showHeader ? (
          <View style={styles.header}>
            <Text style={styles.screenTitle}>일정</Text>
          </View>
        ) : null}

        {state.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>일정을 불러오는 중...</Text>
          </View>
        ) : null}

        {state.status === 'success' ? (
          <>
            {defaultTravelMode && onDefaultTravelModeChange ? (
              <DefaultTravelModeQuickSelector
                disabled={travelModeSaving}
                feedback={travelModeFeedback}
                mode={defaultTravelMode}
                onSelect={async (mode) => {
                  if (mode === defaultTravelMode) {
                    return;
                  }
                  setTravelModeSaving(true);
                  setTravelModeFeedback(null);
                  try {
                    await onDefaultTravelModeChange(mode);
                    setTravelModeFeedback('기본 이동 방식을 저장했어요.');
                  } catch {
                    setTravelModeFeedback('기본 이동 방식을 저장할 수 없어요. 잠시 후 다시 시도해주세요.');
                  } finally {
                    setTravelModeSaving(false);
                  }
                }}
              />
            ) : null}
            <DayItineraryContent
              canMovePlaces={canMovePlaces}
              editState={editState}
              focusRequest={contentFocusRequest}
              getReorderScrollOffsetY={getReorderScrollOffsetY}
              onFocusRequestHandled={clearContentFocusRequest}
              onCopyAddress={(item) => void copyPlaceAddress(item)}
              onDeletePlace={beginDelete}
              onCancelEdit={cancelEdit}
              onEditPlace={beginEdit}
              onMovePlace={beginMove}
              onEnterReorderMode={() => beginReorder(state.viewModel)}
              onExitReorderMode={cancelReorder}
              lodgingPickerState={lodgingPickerState}
              lodgingState={lodgingState}
              onCancelLodgingPicker={cancelLodgingPicker}
              onClearCurrentLodging={() => void submitClearCurrentLodging()}
              onMoveReorderItem={moveReorderItem}
              onOpenMap={(item) => void openPlaceMap(item)}
              onReorderDragActiveChange={setReorderDragActive}
              onReorderDragMove={requestReorderAutoScroll}
              onOpenLodgingSearchRegister={openLodgingSearchRegister}
              onSaveReorder={() => void submitReorder()}
              onSelectLodgingPlace={(option) => void submitSelectLodgingPlace(option)}
              onSubmitEdit={() => void submitEdit()}
              onUpdateEditValues={updateEditValues}
              mapActionFeedback={mapActionFeedback}
              moveFeedback={moveFeedback}
              moveState={moveState}
              onReloadSharedUpdate={requestSharedUpdateReload}
              onCancelMove={cancelMove}
              onSelectMoveTarget={submitMoveToDay}
              reorderFeedback={reorderFeedback}
              reorderState={reorderState}
              sharedUpdateBanner={sharedUpdateBanner}
              sharedUpdateReloadDisabled={sharedUpdateReloadDisabled}
              viewModel={state.viewModel}
            />
          </>
        ) : null}

        {state.status === 'auth' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <Pressable accessibilityRole="button" onPress={goToLogin} style={styles.button}>
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
      </KeyboardAwareFormScrollView>
      {showAddFab ? (
        <TripRootFab
          accessibilityHint="장소 검색으로 일정 추가를 시작합니다."
          accessibilityLabel="일정 추가"
          layout={addFabLayout.fab}
          onPress={addPlace}
        />
      ) : null}
      {isDeleteModalVisible && deleteState.status !== 'idle' ? (
        <DeletePlaceConfirmationModal
          deleteState={deleteState}
          onCancel={cancelDelete}
          onConfirm={() => void submitDelete()}
        />
      ) : null}
    </View>
  );
}

type DefaultTravelModeQuickSelectorProps = {
  disabled: boolean;
  feedback: string | null;
  mode: TripDefaultTravelMode;
  onSelect: (mode: TripDefaultTravelMode) => void;
};

function DefaultTravelModeQuickSelector({ disabled, feedback, mode, onSelect }: DefaultTravelModeQuickSelectorProps) {
  const viewModel = buildTripDefaultTravelModeSelectorViewModel(mode);

  return (
    <View style={styles.defaultTravelModeCard}>
      <View style={styles.defaultTravelModeTextGroup}>
        <Text style={styles.defaultTravelModeTitle}>기본 이동 방식</Text>
        <Text style={styles.defaultTravelModeHelper}>이 Day와 오늘 화면의 길찾기 기준으로 사용해요.</Text>
      </View>
      <View style={styles.defaultTravelModeOptions}>
        {viewModel.options.map((option) => (
          <Pressable
            accessibilityLabel={option.accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={option.accessibilityState}
            disabled={disabled}
            key={option.mode}
            onPress={() => onSelect(option.mode)}
            style={[
              styles.defaultTravelModeChip,
              option.selected ? styles.defaultTravelModeChipSelected : null,
              disabled ? styles.defaultTravelModeChipDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.defaultTravelModeChipText,
                option.selected ? styles.defaultTravelModeChipTextSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {feedback ? <Text style={styles.defaultTravelModeFeedback}>{feedback}</Text> : null}
    </View>
  );
}
