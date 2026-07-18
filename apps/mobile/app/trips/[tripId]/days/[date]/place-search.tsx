import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../lib/auth/client';
import { theme } from '../../../../../lib/design';
import { GooglePlaceMapSearch } from '../../../../../lib/trip-ui/GooglePlaceMapSearch';
import {
  createGoogleDayLodgingPlace,
  createGooglePlaceScheduleItemsBatch,
  listTripPlaceBookmarks,
} from '../../../../../lib/places/client';
import { tripPlaceBookmarkToGoogleSearchRow } from '../../../../../lib/places/bookmarks';
import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemsBatchRequest,
  errorGooglePlaceAddState,
  googlePlaceAddFailureMessage,
  googlePlaceScheduleBatchMaxSelectionCount,
  idleGooglePlaceAddState,
  removeGooglePlaceScheduleBatchSelection,
  toggleGooglePlaceScheduleBatchSelection,
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
} from '../../../../../lib/places/google-search';
import {
  applySelectedPlaceToPlaceScheduleForm,
  buildPlaceScheduleDetailRoute,
  parsePlaceScheduleDetailParams,
  selectedPlaceFromGoogleSearchResult,
} from '../../../../../lib/places/place-schedule-detail';
import { resolveDayItineraryAddPlaceReturnNavigation } from '../../../../../lib/trips/day-itinerary-add-place-navigation';
import { buildGoogleDayLodgingPlaceRequest } from '../../../../../lib/trips/lodging-place';
import { useTripShellState } from '../../../../../lib/trips/trip-shell-context';

export default function GooglePlaceSearchScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    returnTo: returnToParam,
    mode: modeParam,
    title: titleParam,
    titleTouched: titleTouchedParam,
    startTime: startTimeParam,
    endTime: endTimeParam,
    memo: memoParam,
    googlePlaceId: googlePlaceIdParam,
    placeName: placeNameParam,
    address: addressParam,
    typeHint: typeHintParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    returnTo?: string | string[];
    mode?: string | string[];
    title?: string | string[];
    titleTouched?: string | string[];
    startTime?: string | string[];
    endTime?: string | string[];
    memo?: string | string[];
    googlePlaceId?: string | string[];
    placeName?: string | string[];
    address?: string | string[];
    typeHint?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const isSelectorMode = mode === 'select';
  const isLodgingMode = mode === 'lodging';
  const isScheduleAddMode = !isSelectorMode && !isLodgingMode;
  const [addState, setAddState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
  const [bookmarkResults, setBookmarkResults] = useState<GooglePlaceSearchRowViewModel[]>([]);
  const [selectedBatchResults, setSelectedBatchResults] = useState<GooglePlaceSearchRowViewModel[]>([]);
  const [batchFeedbackMessage, setBatchFeedbackMessage] = useState<string | null>(null);
  const tripShellState = useTripShellState();
  const tripDestinations = useMemo(() => {
    if (tripShellState?.status !== 'success' || tripShellState.tripId !== tripId) {
      return [];
    }
    return tripShellState.detail.trip.destinations;
  }, [tripId, tripShellState]);
  const selectedBatchPlaceIds = useMemo(() => selectedBatchResults.map((result) => result.id), [selectedBatchResults]);
  const isSubmittingBatch = addState.status === 'adding' && addState.googlePlaceId === 'batch';

  useEffect(() => {
    let cancelled = false;
    if (!tripId) {
      setBookmarkResults([]);
      return;
    }
    listTripPlaceBookmarks(tripId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBookmarkResults(
          response.bookmarks.flatMap((bookmark) => {
            const row = tripPlaceBookmarkToGoogleSearchRow(bookmark);
            return row ? [row] : [];
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setBookmarkResults([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const returnToDay = () => {
    if (!tripId || !date) {
      router.replace('/');
      return;
    }

    const navigation = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: returnToParam });
    if (navigation.kind === 'dismissToDay') {
      router.dismissTo(navigation.href);
      return;
    }
    router.replace(navigation.href);
  };

  const resetAddState = () => {
    setAddState(idleGooglePlaceAddState());
    setBatchFeedbackMessage(null);
  };

  const selectBatchResult = (result: GooglePlaceSearchRowViewModel) => {
    if (!isScheduleAddMode || addState.status === 'adding') {
      return;
    }
    const update = toggleGooglePlaceScheduleBatchSelection(selectedBatchResults, result);
    setSelectedBatchResults(update.selectedResults);
    setBatchFeedbackMessage(update.message);
    setAddState(idleGooglePlaceAddState());
  };

  const removeBatchResult = (googlePlaceId: string) => {
    if (addState.status === 'adding') {
      return;
    }
    setSelectedBatchResults(removeGooglePlaceScheduleBatchSelection(selectedBatchResults, googlePlaceId));
    setBatchFeedbackMessage(null);
    setAddState(idleGooglePlaceAddState());
  };

  const submitBatch = async () => {
    if (!isScheduleAddMode || addState.status === 'adding' || !tripId || !date || selectedBatchResults.length === 0) {
      return;
    }

    setAddState(addingGooglePlaceState('batch'));
    setBatchFeedbackMessage(null);
    try {
      await createGooglePlaceScheduleItemsBatch(
        tripId,
        date,
        buildCreateGooglePlaceScheduleItemsBatchRequest(selectedBatchResults),
      );
      returnToDay();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          router.replace('/login');
          return;
        }
      }
      setBatchFeedbackMessage(googlePlaceAddFailureMessage);
      setAddState(idleGooglePlaceAddState());
    }
  };

  const submitAdd = async (result: GooglePlaceSearchRowViewModel, _duplicateConfirmed: boolean) => {
    if (addState.status === 'adding' || !tripId || !date) {
      return;
    }

    if (isSelectorMode) {
      const values = parsePlaceScheduleDetailParams({
        title: titleParam,
        titleTouched: titleTouchedParam,
        startTime: startTimeParam,
        endTime: endTimeParam,
        memo: memoParam,
        googlePlaceId: googlePlaceIdParam,
        placeName: placeNameParam,
        address: addressParam,
        typeHint: typeHintParam,
      });
      router.replace(
        buildPlaceScheduleDetailRoute(
          tripId,
          date,
          applySelectedPlaceToPlaceScheduleForm(values, selectedPlaceFromGoogleSearchResult(result)),
        ),
      );
      return;
    }

    if (isScheduleAddMode) {
      selectBatchResult(result);
      return;
    }

    setAddState(addingGooglePlaceState(result.id));
    try {
      if (isLodgingMode) {
        await createGoogleDayLodgingPlace(tripId, date, buildGoogleDayLodgingPlaceRequest(result.id));
      }
      returnToDay();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          router.replace('/login');
          return;
        }
      }
      setAddState(errorGooglePlaceAddState());
    }
  };

  const batchFooter = isScheduleAddMode ? (
    <View style={styles.batchFooter}>
      <View style={styles.batchFooterHeader}>
        <Text style={styles.batchFooterTitle}>선택한 장소 {selectedBatchResults.length}개</Text>
        <Text style={styles.batchFooterMeta}>최대 {googlePlaceScheduleBatchMaxSelectionCount}개</Text>
      </View>
      {selectedBatchResults.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.batchChipList}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.batchChipScroll}
        >
          {selectedBatchResults.map((result, index) => (
            <Pressable
              accessibilityLabel={`${index + 1}번째 선택 장소 ${result.placeName} 제거`}
              accessibilityRole="button"
              disabled={isSubmittingBatch}
              key={`selected-batch-${result.id}`}
              onPress={() => removeBatchResult(result.id)}
              style={({ pressed }) => [
                styles.batchChip,
                pressed && !isSubmittingBatch ? styles.batchChipPressed : null,
                isSubmittingBatch ? styles.batchChipDisabled : null,
              ]}
            >
              <Text style={styles.batchChipIndex}>{index + 1}</Text>
              <Text numberOfLines={1} style={styles.batchChipText}>
                {result.placeName}
              </Text>
              <Text style={styles.batchChipRemove}>×</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.batchHint}>검색 결과에서 일정에 담을 장소를 선택해 주세요.</Text>
      )}
      {batchFeedbackMessage ? <Text style={styles.batchFeedback}>{batchFeedbackMessage}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={isSubmittingBatch || selectedBatchResults.length === 0}
        onPress={() => void submitBatch()}
        style={({ pressed }) => [
          styles.batchSubmitButton,
          (isSubmittingBatch || selectedBatchResults.length === 0) && styles.batchSubmitButtonDisabled,
          pressed && !isSubmittingBatch && selectedBatchResults.length > 0 ? styles.batchSubmitButtonPressed : null,
        ]}
      >
        <Text style={styles.batchSubmitButtonText}>
          {isSubmittingBatch
            ? '등록 중...'
            : selectedBatchResults.length > 0
              ? `${selectedBatchResults.length}개 일정에 등록`
              : '장소를 선택해 주세요'}
        </Text>
      </Pressable>
    </View>
  ) : null;

  if (!tripId || !date) {
    return (
      <ScrollView contentContainerStyle={styles.notFoundContent} style={styles.notFoundRoot}>
        <View style={styles.notFoundCard}>
          <Text style={styles.errorTitle}>일정을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행 일정이에요.</Text>
          <Pressable accessibilityRole="button" onPress={returnToDay} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>일정으로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <GooglePlaceMapSearch
      actionMode={isSelectorMode ? 'scheduleSelect' : isLodgingMode ? 'lodgingRegister' : 'scheduleAdd'}
      actionState={addState}
      bookmarkResults={bookmarkResults}
      bottomSheetFooter={batchFooter}
      dayId={date}
      notFoundAction={{ label: '일정으로', onPress: returnToDay }}
      onPrimaryAction={(result, duplicateConfirmed) => void submitAdd(result, duplicateConfirmed)}
      onResetActionState={resetAddState}
      selectedBatchPlaceIds={isScheduleAddMode ? selectedBatchPlaceIds : []}
      tripDestinations={tripDestinations}
      tripId={tripId}
    />
  );
}

const styles = StyleSheet.create({
  notFoundRoot: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  notFoundContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  notFoundCard: {
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
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  primaryButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  batchFooter: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    gap: theme.space[4],
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[5],
    paddingBottom: theme.space[6],
  },
  batchFooterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  batchFooterTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  batchFooterMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  batchChipScroll: {
    marginHorizontal: -theme.space[1],
  },
  batchChipList: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[1],
  },
  batchChip: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    maxWidth: 220,
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[3],
  },
  batchChipPressed: {
    opacity: 0.72,
  },
  batchChipDisabled: {
    opacity: 0.48,
  },
  batchChipIndex: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  batchChipText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
  },
  batchChipRemove: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  batchHint: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
  },
  batchFeedback: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
  },
  batchSubmitButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  batchSubmitButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  batchSubmitButtonDisabled: {
    backgroundColor: theme.color.borderStrong,
  },
  batchSubmitButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
