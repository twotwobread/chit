import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { theme } from '../design';
import {
  DayItineraryContent,
  DeletePlaceConfirmationModal,
  EditPlacePanel,
  NonPlaceScheduleItemPanel,
} from './DayItineraryEditorParts';
import { styles } from './DayItineraryEditorStyles';
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
    beginCreateNonPlace,
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
  } = useDayItineraryEditorController({ tripId, date, initialAction });

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
              onAddPlace={addPlace}
              onAddNonPlace={beginCreateNonPlace}
              onCopyAddress={(item) => void copyPlaceAddress(item)}
              onDeletePlace={beginDelete}
              onEditPlace={beginEdit}
              onEnterReorderMode={() => beginReorder(state.viewModel)}
              onExitReorderMode={cancelReorder}
              lodgingPickerState={lodgingPickerState}
              lodgingState={lodgingState}
              onCancelLodgingPicker={cancelLodgingPicker}
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
      {isDeleteModalVisible && deleteState.status !== 'idle' ? (
        <DeletePlaceConfirmationModal
          deleteState={deleteState}
          onCancel={cancelDelete}
          onConfirm={() => void submitDelete()}
        />
      ) : null}
    </>
  );
}
