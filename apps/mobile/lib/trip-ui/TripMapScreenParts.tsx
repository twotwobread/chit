import { useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { searchGooglePlaces } from '../places/client';
import {
  buildGooglePlaceExplorationDetail,
  buildGooglePlaceSearchInputState,
  errorGooglePlaceSearchState,
  googlePlaceSearchLoadingState,
  successGooglePlaceSearchState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceSearchViewState,
} from '../places/google-search';
import { ListRow, PlacePin, PlaceTag, PrimaryButton, SecondaryButton, theme } from '../design';
import { buildDayItineraryMapRowActions, type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import { type DayItineraryViewModel } from '../trips/day-itinerary';
import { tripItineraryPath } from '../trips/routes';
import { buildTripMapDayChips, resolveMapRouteSheetState, type MapRouteSheetState } from '../trips/trip-map';
import { type TripTabUnavailableViewModel } from '../trips/trip-tabs';
import { DayChips } from './DayChips';
import { RouteMap, type RouteMapPlace } from './RouteMap';
import { TripListCard, TripStateCard } from './TripScreenScaffold';
import { styles } from './TripMapScreenStyles';

export function MapContent({
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

export function PlaceSearchPanel({
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

export function SelectedDayList({
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

export function UnavailableState({ viewModel }: { viewModel: TripTabUnavailableViewModel }) {
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
