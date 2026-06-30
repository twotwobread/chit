import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { searchGooglePlaces } from '../../../../lib/places/client';
import {
  buildGooglePlaceExplorationDetail,
  buildGooglePlaceSearchInputState,
  errorGooglePlaceSearchState,
  googlePlaceSearchLoadingState,
  successGooglePlaceSearchState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceSearchViewState,
} from '../../../../lib/places/google-search';
import { ListRow, PlacePin, PlaceTag, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { DayChips } from '../../../../lib/trip-ui/DayChips';
import { RouteMap } from '../../../../lib/trip-ui/RouteMap';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDayItinerary, getTripDetail } from '../../../../lib/trips/client';
import {
  type DayItineraryViewModel,
  buildDayItineraryViewModel,
  getScheduleItems,
} from '../../../../lib/trips/day-itinerary';
import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../../../../lib/trips/day-itinerary-map-actions';
import { tripItineraryPath } from '../../../../lib/trips/routes';
import { localDateString } from '../../../../lib/trips/status';
import {
  buildRouteMapPlaces,
  buildTripMapDayChips,
  resolveMapRouteSheetState,
  resolveTripMapSelectedDay,
  type MapRouteSheetState,
} from '../../../../lib/trips/trip-map';
import type { RouteMapPlace } from '../../../../lib/trip-ui/RouteMap';
import { buildTripTabUnavailableViewModel, type TripTabUnavailableViewModel } from '../../../../lib/trips/trip-tabs';

type TripMapState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDayId: string;
      viewModel: DayItineraryViewModel;
      mapPlaces: RouteMapPlace[];
    }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripMapTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const selectedDayIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        setState({ status: 'notFound' });
        return;
      }

      setFeedback(null);
      setState({ status: 'loading' });
      try {
        const detail = await getTripDetail(tripId);
        const selectedDay = resolveTripMapSelectedDay({
          days: detail.days,
          preferredDayId,
          today: localDateString(),
        });
        if (!selectedDay) {
          selectedDayIdRef.current = null;
          setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('map', tripId) });
          return;
        }

        const itinerary = await getTripDayItinerary(tripId, selectedDay.id);
        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayChips: buildTripMapDayChips(detail.days),
          selectedDayId: selectedDay.id,
          viewModel: buildDayItineraryViewModel(itinerary),
          mapPlaces: buildRouteMapPlaces(getScheduleItems(itinerary)),
        });
      } catch (error) {
        setState(mapFailureState(error));
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMap = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
      setFeedback(dayItineraryMapActionSuccessState('map'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('map'));
    }
  }, []);

  const copyAddress = useCallback(async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setFeedback(dayItineraryMapActionSuccessState('copy'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('copy'));
    }
  }, []);

  return (
    <TripScreen>
      <TripScreenHeader helper="Day별 이동할 장소와 지도 열기 동선을 한곳에서 확인해요." title="지도" />

      {state.status === 'loading' ? <TripStateCard loading title="지도 정보를 불러오는 중..." /> : null}
      {state.status === 'auth' ? (
        <TripStateCard
          primaryAction={{ label: '로그인하기', onPress: () => router.replace('/login') }}
          title="다시 로그인해주세요."
        />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="삭제되었거나 접근할 수 없는 여행이에요."
          primaryAction={{ label: '홈으로', onPress: () => router.replace('/') }}
          title="여행을 찾을 수 없어요."
        />
      ) : null}
      {state.status === 'error' ? (
        <TripStateCard
          helper="잠시 후 다시 시도해주세요."
          primaryAction={{ label: '다시 시도', onPress: () => void load() }}
          title="지도 정보를 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'unavailable' ? <UnavailableState viewModel={state.viewModel} /> : null}
      {state.status === 'success' ? (
        <MapContent
          copyAddress={copyAddress}
          feedback={feedback}
          onSelectDay={(dayId) => void load(dayId)}
          openMap={openMap}
          selectedDayId={state.selectedDayId}
          dayChips={state.dayChips}
          tripId={tripId ?? ''}
          viewModel={state.viewModel}
          mapPlaces={state.mapPlaces}
        />
      ) : null}
    </TripScreen>
  );
}

function MapContent({
  copyAddress,
  dayChips,
  feedback,
  onSelectDay,
  openMap,
  selectedDayId,
  tripId,
  viewModel,
  mapPlaces,
}: {
  viewModel: DayItineraryViewModel;
  mapPlaces: RouteMapPlace[];
  tripId: string;
  dayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  feedback: DayItineraryMapActionFeedback | null;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
  onSelectDay: (dayId: string) => void;
}) {
  const [sheetState, setSheetState] = useState<MapRouteSheetState>('collapsed');
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchState, setPlaceSearchState] = useState<GooglePlaceSearchViewState>(() =>
    buildGooglePlaceSearchInputState(''),
  );
  const [selectedSearchResult, setSelectedSearchResult] = useState<GooglePlaceSearchRowViewModel | null>(null);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
        onPanResponderRelease: (_, gestureState) => {
          setSheetState((current) => resolveMapRouteSheetState(current, gestureState.dy));
        },
      }),
    [],
  );
  const expanded = sheetState === 'expanded';
  const isPlaceSearchLoading = placeSearchState.status === 'loading';

  const updatePlaceSearchQuery = (value: string) => {
    setPlaceSearchQuery(value);
    setPlaceSearchState(buildGooglePlaceSearchInputState(value));
    setSelectedSearchResult(null);
  };

  const runPlaceSearch = async () => {
    const inputState = buildGooglePlaceSearchInputState(placeSearchQuery);
    if (inputState.status === 'minQuery' || inputState.status === 'initial') {
      setPlaceSearchState(inputState);
      return;
    }

    setPlaceSearchState(googlePlaceSearchLoadingState());
    setSelectedSearchResult(null);
    try {
      const response = await searchGooglePlaces(tripId, selectedDayId, placeSearchQuery);
      setPlaceSearchState(successGooglePlaceSearchState(response.results));
    } catch (error) {
      setPlaceSearchState(errorGooglePlaceSearchState(error instanceof ApiError ? error.status : undefined));
    }
  };

  return (
    <>
      <DayChips days={dayChips} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
      <View style={styles.mapSheetWrap}>
        <RouteMap
          emptyHelper="좌표가 있는 장소를 추가하면 지도에 핀이 표시돼요."
          emptyTitle={`${viewModel.dayLabel}에 표시할 좌표가 없어요`}
          places={mapPlaces}
          style={[styles.map, expanded ? styles.mapExpanded : styles.mapCollapsed]}
        />
        <View style={[styles.routeSheet, expanded ? styles.routeSheetExpanded : styles.routeSheetCollapsed]}>
          <Pressable
            accessibilityLabel={expanded ? '지도 동선 목록 접기' : '지도 동선 목록 펼치기'}
            accessibilityRole="button"
            onPress={() => setSheetState(expanded ? 'collapsed' : 'expanded')}
            style={styles.sheetHandleArea}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{`${viewModel.dayLabel} 지도 동선`}</Text>
            <Text style={styles.sheetHelper}>
              {expanded
                ? '아래로 스와이프하면 지도를 크게 볼 수 있어요.'
                : '위로 스와이프하면 날짜별 동선을 볼 수 있어요.'}
            </Text>
          </Pressable>
          {expanded ? (
            <>
              <PlaceSearchPanel
                isLoading={isPlaceSearchLoading}
                onOpenMap={openMap}
                onSearch={() => void runPlaceSearch()}
                onSelectResult={setSelectedSearchResult}
                onUpdateQuery={updatePlaceSearchQuery}
                query={placeSearchQuery}
                selectedResult={selectedSearchResult}
                state={placeSearchState}
              />
              {viewModel.status === 'empty' ? (
                <TripStateCard
                  helper="선택한 Day에 장소를 추가하면 지도에서 바로 열 수 있어요."
                  primaryAction={{ label: '일정 보기', onPress: () => router.push(tripItineraryPath(tripId)) }}
                  title={`${viewModel.dayLabel}에 등록된 장소가 없어요.`}
                />
              ) : (
                <SelectedDayList
                  copyAddress={copyAddress}
                  items={viewModel.items}
                  openMap={openMap}
                  summary={`${viewModel.formattedDate} · 일정 ${viewModel.items.length}개 · 지도 ${mapPlaces.length}곳`}
                  title={`${viewModel.dayLabel} 지도 동선`}
                />
              )}
            </>
          ) : null}
        </View>
      </View>
      {feedback ? (
        <TripStateCard helper={feedback.kind === 'error' ? undefined : feedback.message} title={feedback.message} />
      ) : null}
    </>
  );
}

function PlaceSearchPanel({
  isLoading,
  onOpenMap,
  onSearch,
  onSelectResult,
  onUpdateQuery,
  query,
  selectedResult,
  state,
}: {
  isLoading: boolean;
  onOpenMap: (url: string) => void;
  onSearch: () => void;
  onSelectResult: (result: GooglePlaceSearchRowViewModel) => void;
  onUpdateQuery: (value: string) => void;
  query: string;
  selectedResult: GooglePlaceSearchRowViewModel | null;
  state: GooglePlaceSearchViewState;
}) {
  const detail = selectedResult ? buildGooglePlaceExplorationDetail(selectedResult) : null;

  return (
    <TripListCard>
      <View style={styles.searchSection}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>장소 검색</Text>
          <Text style={styles.summaryHelper}>도착한 여행지 근처 식당, 카페, 명소를 검색해 보세요.</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            autoCapitalize="none"
            editable={!isLoading}
            onChangeText={onUpdateQuery}
            onSubmitEditing={onSearch}
            placeholder="예: 맛집, 카페, 장소명"
            placeholderTextColor={theme.color.textFaint}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={onSearch}
            style={[styles.searchButton, isLoading ? styles.searchButtonDisabled : null]}
          >
            {isLoading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
            <Text style={styles.searchButtonText}>검색</Text>
          </Pressable>
        </View>
        {'message' in state && state.message ? <Text style={styles.summaryHelper}>{state.message}</Text> : null}
        {'title' in state ? (
          <View style={styles.searchNotice}>
            <Text style={styles.searchNoticeTitle}>{state.title}</Text>
            <Text style={styles.summaryHelper}>{state.helper}</Text>
          </View>
        ) : null}
        {state.status === 'success' ? (
          <View style={styles.searchResultList}>
            {state.results.map((result) => (
              <Pressable
                accessibilityRole="button"
                key={result.id}
                onPress={() => onSelectResult(result)}
                style={[
                  styles.searchResultCard,
                  selectedResult?.id === result.id ? styles.searchResultCardSelected : null,
                ]}
              >
                <Text style={styles.optionTitle}>{result.placeName}</Text>
                <Text style={styles.placeType}>{result.typeHint}</Text>
                <Text style={styles.address}>{result.address}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {detail ? (
          <View style={styles.placeDetailCard}>
            <Text style={styles.optionTitle}>{detail.placeName}</Text>
            <Text style={styles.address}>{detail.address}</Text>
            <Text style={styles.searchNoticeTitle}>{detail.photoReviewTitle}</Text>
            <Text style={styles.summaryHelper}>{detail.photoReviewHelper}</Text>
            <SecondaryButton
              label={detail.mapSearchLabel}
              onPress={() =>
                onOpenMap(
                  buildDayItineraryMapRowActions({ address: detail.address, placeName: detail.placeName }).map.url,
                )
              }
            />
          </View>
        ) : null}
      </View>
    </TripListCard>
  );
}

function SelectedDayList({
  copyAddress,
  items,
  openMap,
  summary,
  title,
}: {
  items: Extract<DayItineraryViewModel, { status: 'success' }>['items'];
  title: string;
  summary: string;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
}) {
  return (
    <TripListCard>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryHelper}>{summary}</Text>
      </View>
      {items.map((item, index) => {
        const actions = buildDayItineraryMapRowActions({ address: item.address, placeName: item.placeName });

        return (
          <ListRow
            first={index === 0}
            key={item.id}
            leading={<PlacePin order={Number(item.orderLabel)} type={item.placeType} />}
            subtitle={
              <View style={styles.rowSubtitle}>
                <PlaceTag type={item.placeType} />
                <Text style={styles.address}>{item.address || '주소 정보가 없어요.'}</Text>
              </View>
            }
            title={item.placeName}
            trailing={
              <View style={styles.actionColumn}>
                <PrimaryButton
                  label={actions.map.label}
                  onPress={() => openMap(actions.map.url)}
                  style={styles.rowButton}
                />
                <SecondaryButton
                  accessibilityLabel={actions.copy.accessibilityLabel}
                  disabled={actions.copy.disabled}
                  label={actions.copy.label}
                  onPress={() => {
                    if (actions.copy.address) {
                      copyAddress(actions.copy.address);
                    }
                  }}
                  style={styles.rowButton}
                />
              </View>
            }
          />
        );
      })}
    </TripListCard>
  );
}

function UnavailableState({ viewModel }: { viewModel: TripTabUnavailableViewModel }) {
  return (
    <TripStateCard
      helper={viewModel.helper}
      primaryAction={{
        label: viewModel.primaryAction.label,
        onPress: () => router.push(viewModel.primaryAction.route),
      }}
      secondaryAction={{
        label: viewModel.secondaryAction.label,
        onPress: () => router.push(viewModel.secondaryAction.route),
      }}
      title={viewModel.title}
    />
  );
}

function mapFailureState(error: unknown): TripMapState {
  if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
    return { status: 'auth' };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth' };
    }
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return { status: 'notFound' };
    }
  }
  return { status: 'error' };
}

const styles = StyleSheet.create({
  actionColumn: {
    gap: theme.space[2],
    minWidth: 88,
  },
  address: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  optionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  placeDetailCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  placeType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  map: {
    width: '100%',
  },
  mapCollapsed: {
    height: 520,
  },
  mapExpanded: {
    height: 260,
  },
  mapSheetWrap: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    maxWidth: theme.layout.cardMaxW,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  routeSheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    ...theme.shadow.md,
  },
  routeSheetCollapsed: {
    maxHeight: 104,
  },
  routeSheetExpanded: {
    maxHeight: '78%',
    position: 'relative',
  },
  rowButton: {
    minHeight: 34,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowSubtitle: {
    gap: theme.space[2],
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  searchButtonDisabled: {
    opacity: 0.55,
  },
  searchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  searchInput: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  searchNotice: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  searchNoticeTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  searchResultCard: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  searchResultCardSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  searchResultList: {
    gap: theme.space[3],
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  searchSection: {
    gap: theme.space[4],
    paddingBottom: theme.space[4],
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    height: 4,
    width: 42,
  },
  sheetHandleArea: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  sheetHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summary: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  summaryHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
