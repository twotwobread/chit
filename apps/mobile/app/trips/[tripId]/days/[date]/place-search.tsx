import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../lib/auth/client';
import { theme } from '../../../../../lib/design';
import { resolveDayItineraryAddPlaceReturnNavigation } from '../../../../../lib/trips/day-itinerary-add-place-navigation';
import { createGooglePlaceScheduleItem, searchGooglePlaces } from '../../../../../lib/places/client';
import {
  applySelectedPlaceToPlaceScheduleForm,
  buildPlaceScheduleDetailRoute,
  parsePlaceScheduleDetailParams,
  selectedPlaceFromGoogleSearchResult,
} from '../../../../../lib/places/place-schedule-detail';
import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemRequest,
  buildGooglePlaceSearchInputState,
  canSearchGooglePlaces,
  confirmingDuplicateGooglePlaceState,
  errorGooglePlaceAddState,
  errorGooglePlaceSearchState,
  googlePlaceSearchLoadingState,
  idleGooglePlaceAddState,
  isDuplicateDayPlaceConfirmationError,
  normalizeGooglePlaceSearchQuery,
  successGooglePlaceSearchState,
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceSearchViewState,
} from '../../../../../lib/places/google-search';

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
  const [query, setQuery] = useState('');
  const [state, setState] = useState<GooglePlaceSearchViewState>(buildGooglePlaceSearchInputState(''));
  const [addState, setAddState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
  const isSelectorMode = (Array.isArray(modeParam) ? modeParam[0] : modeParam) === 'select';
  const isLoading = state.status === 'loading';
  const isAdding = addState.status === 'adding';
  const isBusy = isLoading || (!isSelectorMode && isAdding);

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

  const runSearch = async () => {
    if (isBusy) {
      return;
    }
    if (!tripId || !date) {
      setState(errorGooglePlaceSearchState(404));
      return;
    }

    const inputState = buildGooglePlaceSearchInputState(query);
    if (!canSearchGooglePlaces(query)) {
      setState(inputState);
      return;
    }

    setAddState(idleGooglePlaceAddState());
    setState(googlePlaceSearchLoadingState());
    try {
      const response = await searchGooglePlaces(tripId, date, normalizeGooglePlaceSearchQuery(query));
      setState(successGooglePlaceSearchState(response.results));
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
        setState(errorGooglePlaceSearchState(error.status));
        return;
      }
      setState(errorGooglePlaceSearchState());
    }
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    if (!isBusy) {
      setAddState(idleGooglePlaceAddState());
      setState(buildGooglePlaceSearchInputState(nextQuery));
    }
  };

  const returnSelectedPlace = (result: GooglePlaceSearchRowViewModel) => {
    if (!tripId || !date) {
      return;
    }
    const currentValues = parsePlaceScheduleDetailParams({
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
    const nextValues = applySelectedPlaceToPlaceScheduleForm(
      currentValues,
      selectedPlaceFromGoogleSearchResult(result),
    );
    router.replace(buildPlaceScheduleDetailRoute(tripId, date, nextValues));
  };

  const submitAdd = async (result: GooglePlaceSearchRowViewModel, duplicateConfirmed: boolean) => {
    if (isBusy || !tripId || !date) {
      return;
    }

    if (isSelectorMode) {
      returnSelectedPlace(result);
      return;
    }

    setAddState(addingGooglePlaceState(result.id));
    try {
      await createGooglePlaceScheduleItem(
        tripId,
        date,
        buildCreateGooglePlaceScheduleItemRequest({
          googlePlaceId: result.id,
          duplicateConfirmed,
          title: result.placeName,
        }),
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
        if (error.status === 403 || error.status === 404) {
          setAddState(idleGooglePlaceAddState());
          setState(errorGooglePlaceSearchState(error.status));
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

  if (!tripId || !date || state.status === 'notFound') {
    const title = state.status === 'notFound' ? state.title : '일정을 찾을 수 없어요.';
    const helper = state.status === 'notFound' ? state.helper : '삭제되었거나 접근할 수 없는 여행 일정이에요.';
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>일정 추가</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.message}>{helper}</Text>
          <Pressable accessibilityRole="button" onPress={returnToDay} style={styles.button}>
            <Text style={styles.buttonText}>일정으로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>장소 검색</Text>
        <Text style={styles.screenHelper}>
          {isSelectorMode ? '일정에 연결할 장소를 선택해 주세요.' : '이 일정에 연결할 장소를 검색해 보세요.'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>장소 이름</Text>
          <TextInput
            editable={!isBusy}
            onChangeText={updateQuery}
            onSubmitEditing={() => void runSearch()}
            placeholder="예: 도톤보리, 우메다 카페"
            placeholderTextColor={theme.color.textFaint}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {'message' in state && state.message ? (
            <Text style={state.status === 'minQuery' ? styles.fieldError : styles.helperText}>{state.message}</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => void runSearch()}
          style={[styles.button, isBusy ? styles.buttonDisabled : null]}
        >
          {isLoading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{isLoading ? '장소를 검색하는 중...' : '검색'}</Text>
        </Pressable>
      </View>

      {state.status === 'empty' ? (
        <View style={styles.card}>
          <Text style={styles.message}>{state.message}</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void runSearch()}
            style={[styles.secondaryButton, isBusy ? styles.secondaryButtonDisabled : null]}
          >
            <Text style={styles.secondaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {addState.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>장소를 추가할 수 없어요.</Text>
          <Text style={styles.message}>{addState.message}</Text>
        </View>
      ) : null}

      {addState.status === 'confirmingDuplicate' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>이미 추가된 장소예요.</Text>
          <Text style={styles.message}>{addState.message}</Text>
          <View style={styles.confirmationActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void submitAdd(addState.result, true)}
              style={[styles.button, isBusy ? styles.buttonDisabled : null]}
            >
              {isAdding ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{isAdding ? '추가 중...' : '한 번 더 추가'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => setAddState(idleGooglePlaceAddState())}
              style={[styles.secondaryButton, isBusy ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {state.status === 'success' ? (
        <View style={styles.resultList}>
          {state.results.map((result) => {
            const isAddingThisResult = addState.status === 'adding' && addState.googlePlaceId === result.id;
            return (
              <View key={result.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultName}>{result.placeName}</Text>
                  <Text style={styles.resultType}>{result.typeHint}</Text>
                </View>
                <Text style={styles.resultAddress}>{result.address}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => void submitAdd(result, false)}
                  style={[styles.secondaryButton, isBusy ? styles.secondaryButtonDisabled : null]}
                >
                  {isAddingThisResult ? <ActivityIndicator color={theme.color.primary} /> : null}
                  <Text style={styles.secondaryButtonText}>
                    {isAddingThisResult ? '추가 중...' : isSelectorMode ? '선택' : '추가'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" disabled={isBusy} onPress={returnToDay} style={styles.backLink}>
        <Text style={styles.backLinkText}>일정으로</Text>
      </Pressable>
    </ScrollView>
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
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
    gap: theme.space[3],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  screenHelper: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
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
    marginBottom: theme.space[5],
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  input: {
    minHeight: theme.layout.controlH,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    paddingHorizontal: theme.space[4],
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
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
  buttonDisabled: {
    backgroundColor: theme.color.textFaint,
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonDisabled: {
    backgroundColor: theme.color.surfaceSunken,
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  confirmationActions: {
    gap: theme.space[3],
  },
  resultList: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[4],
    marginBottom: theme.space[5],
  },
  resultCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.layout.padCard,
    ...theme.shadow.xs,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  resultName: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  resultType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  resultAddress: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  backLink: {
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
  },
  backLinkText: {
    color: theme.color.textLink,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
});
