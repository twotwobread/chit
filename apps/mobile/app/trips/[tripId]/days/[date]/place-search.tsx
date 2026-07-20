import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../lib/auth/client';
import { FilterChip, PrimaryButton, ScreenBackground, theme } from '../../../../../lib/design';
import { GooglePlaceMapSearch } from '../../../../../lib/trip-ui/GooglePlaceMapSearch';
import {
  createGoogleDayLodgingPlace,
  createGooglePlaceScheduleItemsBatch,
  createGoogleTripPlaceBookmark,
  deleteTripPlaceBookmark,
  listTripPlaceBookmarks,
} from '../../../../../lib/places/client';
import { tripPlaceBookmarkToGoogleSearchRow } from '../../../../../lib/places/bookmarks';
import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemsBatchRequest,
  errorGooglePlaceAddState,
  googlePlaceAddFailureMessage,
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
import {
  buildDayItineraryLodgingManagementRoute,
  resolveDayItineraryAddPlaceReturnNavigation,
} from '../../../../../lib/trips/day-itinerary-add-place-navigation';
import { buildGoogleDayLodgingPlaceRequest } from '../../../../../lib/trips/lodging-place';
import { buildTripMapLodgingResults } from '../../../../../lib/trips/trip-map';
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
  const [bookmarkActionState, setBookmarkActionState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
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
  const lodgingResults = useMemo(() => {
    if (tripShellState?.status !== 'success' || tripShellState.tripId !== tripId) {
      return [];
    }
    return buildTripMapLodgingResults(tripShellState.detail.days);
  }, [tripId, tripShellState]);
  const selectedBatchPlaceIds = useMemo(() => selectedBatchResults.map((result) => result.id), [selectedBatchResults]);
  const isSubmittingBatch = addState.status === 'adding' && addState.googlePlaceId === 'batch';

  const refreshBookmarks = useCallback(
    async (cancelled: () => boolean = () => false) => {
      if (!tripId) {
        setBookmarkResults([]);
        return;
      }
      try {
        const response = await listTripPlaceBookmarks(tripId);
        if (cancelled()) {
          return;
        }
        setBookmarkResults(
          response.bookmarks.flatMap((bookmark) => {
            const row = tripPlaceBookmarkToGoogleSearchRow(bookmark);
            return row ? [row] : [];
          }),
        );
      } catch {
        if (!cancelled()) {
          setBookmarkResults([]);
        }
      }
    },
    [tripId],
  );

  useEffect(() => {
    let cancelled = false;
    void refreshBookmarks(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [refreshBookmarks]);

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

  const createBookmark = async (result: GooglePlaceSearchRowViewModel) => {
    if (!tripId || bookmarkActionState.status === 'adding') {
      return;
    }
    setBookmarkActionState(addingGooglePlaceState(result.id));
    try {
      await createGoogleTripPlaceBookmark(tripId, { googlePlaceId: result.id });
      setBookmarkActionState(idleGooglePlaceAddState());
      await refreshBookmarks();
    } catch {
      setBookmarkActionState(errorGooglePlaceAddState());
    }
  };

  const deleteBookmark = async (result: GooglePlaceSearchRowViewModel) => {
    if (!tripId || !result.bookmarkId || bookmarkActionState.status === 'adding') {
      return;
    }
    setBookmarkActionState(addingGooglePlaceState(result.id));
    try {
      await deleteTripPlaceBookmark(tripId, result.bookmarkId);
      setBookmarkActionState(idleGooglePlaceAddState());
      await refreshBookmarks();
    } catch {
      setBookmarkActionState(errorGooglePlaceAddState());
    }
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

  const batchFooter =
    isScheduleAddMode && selectedBatchResults.length > 0 ? (
      <View style={styles.batchFooter}>
        <ScrollView
          contentContainerStyle={styles.batchChipList}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.batchChipScroll}
        >
          {selectedBatchResults.map((result) => (
            <FilterChip
              accessibilityLabel={`${result.placeName} 제거`}
              disabled={isSubmittingBatch}
              key={`selected-batch-${result.id}`}
              label={`${result.placeName} ×`}
              onPress={() => removeBatchResult(result.id)}
              selected
              style={styles.batchChip}
              tone="accent"
            />
          ))}
        </ScrollView>
        {batchFeedbackMessage ? <Text style={styles.batchFeedback}>{batchFeedbackMessage}</Text> : null}
        <PrimaryButton
          accessibilityLabel="선택된 장소 일정 등록"
          disabled={isSubmittingBatch}
          label={isSubmittingBatch ? '등록 중...' : '선택된 장소 일정 등록'}
          loading={isSubmittingBatch}
          loadingLabel="등록 중..."
          onPress={() => void submitBatch()}
          style={styles.batchSubmitButton}
          tone="lime"
        />
      </View>
    ) : null;

  if (!tripId || !date) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={styles.notFoundContent} style={styles.notFoundRoot}>
          <View style={styles.notFoundCard}>
            <Text style={styles.errorTitle}>일정을 찾을 수 없어요.</Text>
            <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행 일정이에요.</Text>
            <PrimaryButton label="일정으로" onPress={returnToDay} style={styles.notFoundAction} tone="lime" />
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <GooglePlaceMapSearch
      actionMode={isSelectorMode ? 'scheduleSelect' : isLodgingMode ? 'lodgingRegister' : 'scheduleAdd'}
      actionState={addState}
      bookmarkResults={bookmarkResults}
      dayId={date}
      favoriteActionState={bookmarkActionState}
      lodgingResults={lodgingResults}
      lodgingEmptyAction={
        !isLodgingMode
          ? {
              label: '숙소 등록하러 가기',
              onPress: () => router.push(buildDayItineraryLodgingManagementRoute(tripId, date)),
            }
          : undefined
      }
      notFoundAction={{ label: '일정으로', onPress: returnToDay }}
      onBookmarkDeleteResult={(result) => void deleteBookmark(result)}
      onBookmarkSelectResult={(result) => void createBookmark(result)}
      onPrimaryAction={(result, duplicateConfirmed) => void submitAdd(result, duplicateConfirmed)}
      onResetActionState={resetAddState}
      selectedBatchPlaceIds={isScheduleAddMode ? selectedBatchPlaceIds : []}
      stickyFooter={batchFooter}
      stickyFooterHeight={168}
      tripDestinations={tripDestinations}
      tripId={tripId}
    />
  );
}

const styles = StyleSheet.create({
  notFoundRoot: {
    flex: 1,
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
  notFoundAction: {
    alignSelf: 'stretch',
  },
  batchFooter: {
    gap: theme.space[3],
    width: '100%',
  },
  batchChipScroll: {
    marginHorizontal: -theme.space[1],
  },
  batchChipList: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[1],
  },
  batchChip: {
    maxWidth: 220,
    minHeight: theme.layout.tapMin,
  },
  batchFeedback: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
  },
  batchSubmitButton: {
    width: '100%',
  },
});
