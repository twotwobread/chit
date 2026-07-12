import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../lib/auth/client';
import { theme } from '../../../../../lib/design';
import { GooglePlaceMapSearch } from '../../../../../lib/trip-ui/GooglePlaceMapSearch';
import { createGoogleDayLodgingPlace, createGooglePlaceScheduleItem } from '../../../../../lib/places/client';
import {
  addingGooglePlaceState,
  confirmingDuplicateGooglePlaceState,
  errorGooglePlaceAddState,
  idleGooglePlaceAddState,
  isDuplicateDayPlaceConfirmationError,
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
  const [addState, setAddState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());

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

  const submitAdd = async (result: GooglePlaceSearchRowViewModel, duplicateConfirmed: boolean) => {
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

    setAddState(addingGooglePlaceState(result.id));
    try {
      if (isLodgingMode) {
        await createGoogleDayLodgingPlace(tripId, date, buildGoogleDayLodgingPlaceRequest(result.id));
      } else {
        await createGooglePlaceScheduleItem(tripId, date, result.id, duplicateConfirmed, result.placeName);
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
        if (error.status === 409 && isDuplicateDayPlaceConfirmationError(error.body)) {
          setAddState(confirmingDuplicateGooglePlaceState(result));
          return;
        }
      }
      setAddState(errorGooglePlaceAddState());
    }
  };

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
      dayId={date}
      notFoundAction={{ label: '일정으로', onPress: returnToDay }}
      onPrimaryAction={(result, duplicateConfirmed) => void submitAdd(result, duplicateConfirmed)}
      onResetActionState={() => setAddState(idleGooglePlaceAddState())}
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
});
