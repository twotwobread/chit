import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';
import { buildTripRootFabLayout, shouldShowTripRootFab } from '../trips/trip-root-fab-layout';
import {
  DayItineraryContent,
  DeletePlaceConfirmationModal,
  EditPlacePanel,
  NonPlaceScheduleItemPanel,
} from './DayItineraryEditorParts';
import { styles } from './DayItineraryEditorStyles';
import { TripRootFab } from './TripRootFab';
import { useDayItineraryEditorController } from './useDayItineraryEditorController';

export type DayItineraryEditorProps = {
  tripId?: string;
  date?: string;
  initialAction?: string;
  showHeader?: boolean;
  headerContent?: ReactNode;
};

export function DayItineraryEditor({
  tripId,
  date,
  initialAction,
  showHeader = true,
  headerContent,
}: DayItineraryEditorProps) {
  const {
    addPlace,
    backToItinerary,
    beginDelete,
    beginEdit,
    beginReorder,
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
    submitDelete,
    submitEdit,
    submitManualLodging,
    submitNonPlaceEditor,
    submitReorder,
    submitSelectLodgingPlace,
    updateEditValues,
    updateManualLodgingValues,
    updateNonPlaceEditorValues,
    updateScrollContentSize,
    updateScrollLayout,
    updateScrollOffset,
  } = useDayItineraryEditorController({ tripId, date, initialAction });
  const insets = useSafeAreaInsets();
  const addFabLayout = buildTripRootFabLayout({ bottomInset: insets.bottom, rightInset: insets.right });
  const showAddFab = shouldShowTripRootFab({
    hasAction: true,
    isBlocked:
      isDeleteModalVisible ||
      editState.status !== 'idle' ||
      nonPlaceEditorState.status !== 'idle' ||
      reorderState.status !== 'idle',
    status: state.status === 'success' ? 'ready' : state.status,
  });

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollViewRef}
        accessibilityElementsHidden={isDeleteModalVisible}
        contentContainerStyle={[styles.scrollContent, showAddFab ? addFabLayout.scrollContent : null]}
        importantForAccessibility={isDeleteModalVisible ? 'no-hide-descendants' : 'auto'}
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
            <DayItineraryContent
              focusRequest={contentFocusRequest}
              getReorderScrollOffsetY={getReorderScrollOffsetY}
              onFocusRequestHandled={clearContentFocusRequest}
              onCopyAddress={(item) => void copyPlaceAddress(item)}
              onDeletePlace={beginDelete}
              onEditPlace={beginEdit}
              onEnterReorderMode={() => beginReorder(state.viewModel)}
              onExitReorderMode={cancelReorder}
              lodgingPickerState={lodgingPickerState}
              lodgingState={lodgingState}
              onCancelLodgingPicker={cancelLodgingPicker}
              onClearCurrentLodging={() => void submitClearCurrentLodging()}
              onCreateManualLodging={() => void submitManualLodging()}
              onMoveReorderItem={moveReorderItem}
              onOpenMap={(item) => void openPlaceMap(item)}
              onReorderDragActiveChange={setReorderDragActive}
              onReorderDragMove={requestReorderAutoScroll}
              onOpenLodgingPlaceSelection={() => void openLodgingPlaceSelection()}
              onOpenManualLodgingForm={openManualLodgingForm}
              onSaveReorder={() => void submitReorder()}
              onSelectLodgingPlace={(option) => void submitSelectLodgingPlace(option)}
              onUpdateManualLodgingValues={updateManualLodgingValues}
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
                onCancel={cancelNonPlaceEditor}
                onSubmit={() => void submitNonPlaceEditor()}
                onUpdateValues={updateNonPlaceEditorValues}
              />
            ) : null}
            {editState.status === 'editing' || editState.status === 'saving' ? (
              <EditPlacePanel
                editState={editState}
                onCancel={cancelEdit}
                onSubmit={() => void submitEdit()}
                onUpdateValues={updateEditValues}
              />
            ) : null}
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
      </ScrollView>
      {showAddFab ? (
        <TripRootFab
          accessibilityHint="장소 검색 또는 장소 없는 일정 추가를 시작합니다."
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
