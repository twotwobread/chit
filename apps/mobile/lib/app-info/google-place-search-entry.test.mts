import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const placeSearchSource = readFileSync(
  new URL('../../app/trips/[tripId]/days/[date]/place-search.tsx', import.meta.url),
  'utf8',
);
const mapSearchSource = readFileSync(new URL('../trip-ui/GooglePlaceMapSearch.tsx', import.meta.url), 'utf8');
const confirmationModalSource = readFileSync(new URL('../trip-ui/ConfirmationModal.tsx', import.meta.url), 'utf8');
const googleSearchSource = readFileSync(new URL('../places/google-search.ts', import.meta.url), 'utf8');
const tripMapPartsSource = readFileSync(new URL('../trip-ui/TripMapScreenParts.tsx', import.meta.url), 'utf8');
const tripMapControllerSource = readFileSync(new URL('../trip-ui/useTripMapController.ts', import.meta.url), 'utf8');
const tripMapTabSource = readFileSync(new URL('../../app/trips/[tripId]/(tabs)/map.tsx', import.meta.url), 'utf8');
const itineraryTabSource = readFileSync(
  new URL('../../app/trips/[tripId]/(tabs)/itinerary.tsx', import.meta.url),
  'utf8',
);
const dayItineraryContentSource = readFileSync(new URL('../trip-ui/DayItineraryContent.tsx', import.meta.url), 'utf8');
const dayLodgingPanelSource = readFileSync(new URL('../trip-ui/DayLodgingPanel.tsx', import.meta.url), 'utf8');

describe('google place search native module entry setup', () => {
  it('does not statically import native gesture bottom-sheet modules so Expo Go can fall back safely', () => {
    assert.doesNotMatch(placeSearchSource, /^import .*@gorhom\/bottom-sheet/m);
    assert.doesNotMatch(placeSearchSource, /^import .*react-native-gesture-handler/m);
  });

  it('disables native bottom-sheet dynamic sizing so the minimized map search handle can mount without content height', () => {
    assert.match(mapSearchSource, /enableDynamicSizing=\{false\}/);
  });

  it('passes the reserved top inset to the native bottom sheet so focused search stays below map overlays', () => {
    assert.match(
      mapSearchSource,
      /const resolvedSheetTopInset = resolveGooglePlaceSearchSheetTopInset\(sheetTopInset\);/,
    );
    assert.match(mapSearchSource, /topInset=\{resolvedSheetTopInset\}/);
  });

  it('renders the always-visible top search overlay outside collapsed sheet content', () => {
    assert.match(mapSearchSource, /styles\.topSearchOverlay/);
    assert.match(mapSearchSource, /accessibilityLabel="장소 검색어 입력"/);
    assert.match(mapSearchSource, /buildGooglePlaceSearchFirstEntryLayoutState\(sheetState\)/);
    assert.match(mapSearchSource, /sheetLayout\.sheetContentVisible \? \(/);
  });

  it('renders bottom sheet candidate tabs for trip bookmarks and lodging while keeping search results outside tabs', () => {
    assert.match(mapSearchSource, /buildGooglePlaceSearchSheetTabs\(selectedSheetTab\)/);
    assert.match(mapSearchSource, /selectedSheetTab === 'searchResults'/);
    assert.match(mapSearchSource, /buildGooglePlaceSearchSheetLodgingListState/);
    assert.match(googleSearchSource, /label: '찜한 장소'/);
    assert.match(googleSearchSource, /label: '내 숙소'/);
    assert.doesNotMatch(googleSearchSource, /label: '검색 결과'/);
  });

  it('keeps bookmark and lodging markers visible after their candidate tab was opened and the sheet is lowered', () => {
    assert.match(mapSearchSource, /bookmarkMarkerResults\?: GooglePlaceSearchRowViewModel\[\];/);
    assert.match(mapSearchSource, /bookmarkMarkerResults = bookmarkResults/);
    assert.match(mapSearchSource, /activeCandidateMarkerTab, setActiveCandidateMarkerTab/);
    assert.match(
      mapSearchSource,
      /if \(sheetContentVisible && isCandidateSheetTab\(selectedSheetTab\)\) \{\s*setActiveCandidateMarkerTab\(selectedSheetTab\);\s*}/,
    );
    assert.match(
      mapSearchSource,
      /visibleBookmarkMarkerResults = useMemo\(\s*\(\) => \(activeCandidateMarkerTab === 'bookmarks' \? bookmarkMarkerResults : \[\]\)/,
    );
    assert.match(
      mapSearchSource,
      /visibleLodgingMarkerResults = useMemo\(\s*\(\) => \(activeCandidateMarkerTab === 'lodging' \? effectiveLodgingMarkerResults : \[\]\)/,
    );
    assert.doesNotMatch(mapSearchSource, /activeCandidateMarkerTab === 'bookmarks' && sheetContentVisible/);
    assert.doesNotMatch(mapSearchSource, /activeCandidateMarkerTab === 'lodging' && sheetContentVisible/);
    assert.match(mapSearchSource, /buildGooglePlaceSearchMarkerViewModels\(visibleBookmarkMarkerResults/);
    assert.match(mapSearchSource, /buildGooglePlaceSearchMarkerViewModels\(visibleLodgingMarkerResults/);
  });

  it('removes the map-tab floating bookmark layer toggle and lets the search surface span the screen', () => {
    assert.doesNotMatch(tripMapPartsSource, /bookmarkLayerFloatingButton/);
    assert.doesNotMatch(tripMapPartsSource, /onToggleBookmarkLayer/);
    assert.doesNotMatch(tripMapTabSource, /toggleBookmarkLayer/);
    assert.doesNotMatch(tripMapPartsSource, /topSearchTrailingInset=\{44 \+ theme\.space\[2\]\}/);
    assert.match(tripMapPartsSource, /bookmarkMarkerResults=\{bookmarkLayer\.allBookmarkResults\}/);
    assert.match(tripMapPartsSource, /bookmarkResults=\{bookmarkLayer\.allBookmarkResults\}/);
  });

  it('keeps map-tab bookmark refresh fallback independent from required schedule loading', () => {
    assert.match(
      tripMapControllerSource,
      /const allBookmarkResultsRef = useRef<GooglePlaceSearchRowViewModel\[\]>\(\[\]\);/,
    );
    assert.match(tripMapControllerSource, /Promise\.allSettled\(\[/);
    assert.match(
      tripMapControllerSource,
      /resolveTripMapBookmarkRefreshFailure\(\s*allBookmarkResultsRef\.current,\s*bookmarkLayerVisibleRef\.current,\s*\)/,
    );
    assert.doesNotMatch(
      tripMapControllerSource,
      /bookmarkResults: bookmarkLayerVisibleRef\.current \? bookmarkResults : \[\]/,
    );
  });

  it('guards bookmark-mode search result actions with current bookmarkResults before invoking create flow', () => {
    assert.match(mapSearchSource, /canBookmarkGooglePlaceSearchResult/);
    assert.match(
      mapSearchSource,
      /if \(actionMode === 'bookmark'\) \{\s*if \(canBookmarkGooglePlaceSearchResult\(result, bookmarkResults\)\) \{\s*onBookmarkSelectResult\?\.\(result\);\s*}\s*return;\s*}/,
    );
  });

  it('renders already-bookmarked actions as disabled while schedule selections remain toggleable', () => {
    assert.match(
      mapSearchSource,
      /actionView=\{buildGooglePlaceSearchResultActionView\(\{\s*addState: actionState,\s*bookmarkResults,\s*mode: actionMode,\s*result: item,\s*selectedBatchPlaceIds,\s*}\)\}/,
    );
    assert.match(
      mapSearchSource,
      /const isPrimaryActionDisabled = isBusy \|\| actionView\.primaryAction\?\.disabled === true;/,
    );
    assert.match(mapSearchSource, /onToggleFavorite/);
    assert.match(mapSearchSource, /stickyFooter/);
    assert.match(mapSearchSource, /styles\.resultPrimaryActionButton/);
    assert.match(mapSearchSource, /const isPrimaryActionSelected = actionView\.primaryAction\?\.label === '선택됨';/);
    assert.match(mapSearchSource, /styles\.resultPrimaryActionButtonSelected/);
    assert.match(
      mapSearchSource,
      /<PrimaryButton[\s\S]*disabled=\{isPrimaryActionDisabled\}[\s\S]*selected=\{isPrimaryActionSelected\}/,
    );
    assert.match(mapSearchSource, /styles\.topSearchClearButton/);
    assert.doesNotMatch(mapSearchSource, /styles\.searchResultsCloseButton/);
  });

  it('keeps icon-only map search actions at the 44pt touch target floor', () => {
    assertStyleContains(mapSearchSource, 'topSearchClearButton', /minHeight: theme\.layout\.tapMin/);
    assertStyleContains(mapSearchSource, 'topSearchClearButton', /minWidth: theme\.layout\.tapMin/);
    assertStyleContains(mapSearchSource, 'favoriteButton', /minHeight: theme\.layout\.tapMin/);
    assertStyleContains(mapSearchSource, 'favoriteButton', /minWidth: theme\.layout\.tapMin/);
  });

  it('keeps the top search margin equal to the horizontal screen margin', () => {
    assert.match(mapSearchSource, /paddingHorizontal: theme\.space\[3\]/);
    assert.match(mapSearchSource, /paddingTop: theme\.space\[3\]/);
    assert.doesNotMatch(mapSearchSource, /paddingTop: insets\.top/);
  });

  it('renders a lodging empty state with an itinerary lodging-management CTA from map and day search entries', () => {
    assert.match(mapSearchSource, /lodgingEmptyAction\?: \{ label: string; onPress: \(\) => void \};/);
    assert.match(mapSearchSource, /등록된 숙소가 없어요\./);
    assert.match(mapSearchSource, /lodgingEmptyAction\.label/);
    assert.match(tripMapPartsSource, /buildDayItineraryLodgingManagementRoute/);
    assert.match(tripMapPartsSource, /lodgingEmptyAction=\{\{/);
    assert.match(placeSearchSource, /buildDayItineraryLodgingManagementRoute/);
    assert.match(placeSearchSource, /lodgingEmptyAction=\{\s*!isLodgingMode/);
    assert.match(placeSearchSource, /숙소 등록하러 가기/);
    assert.doesNotMatch(tripMapPartsSource, /lodgingEmptyAction=\{\{[\s\S]*buildDayItineraryLodgingPlaceSearchRoute/);
    assert.doesNotMatch(placeSearchSource, /lodgingEmptyAction=\{[\s\S]*buildDayItineraryLodgingPlaceSearchRoute/);
  });

  it('supports opening the itinerary tab with the lodging summary highlighted before direct map search', () => {
    assert.match(itineraryTabSource, /initialAction: initialActionParam/);
    assert.match(itineraryTabSource, /initialAction=\{initialAction\}/);
    assert.match(dayItineraryContentSource, /focusRequest\.target\.kind === 'lodgingPanel'/);
    assert.match(dayLodgingPanelSource, /selected=\{highlighted\}/);
    assert.match(
      dayLodgingPanelSource,
      /onPress=\{viewModel\.sheet\.placeName \? onOpenSheet : onOpenSearchRegister\}/,
    );
    assert.match(dayItineraryContentSource, /onSummaryRef/);
  });

  it('routes existing lodging changes through the lodging map search instead of the existing-place picker', () => {
    assert.doesNotMatch(dayLodgingPanelSource, /onOpenSelection/);
    assert.doesNotMatch(dayLodgingPanelSource, /action\.kind === 'change' \? onOpenSelection : onOpenSearchRegister/);
    assert.match(dayLodgingPanelSource, /onPress=\{onOpenSearchRegister\}/);
    assert.doesNotMatch(dayItineraryContentSource, /onOpenLodgingPlaceSelection/);
  });

  it('refreshes trip detail inside map loading so lodging markers do not depend on stale shell days', () => {
    assert.match(tripMapControllerSource, /import \{ getTripDetail \} from '..\/trips\/trip-api';/);
    assert.match(
      tripMapControllerSource,
      /const \[detailResult, scheduleResult, bookmarkResult\] = await Promise\.allSettled\(\[\s*getTripDetail\(tripId\),\s*listTripScheduleItems\(tripId\),\s*listTripPlaceBookmarks\(tripId\),\s*\] as const\);/,
    );
    assert.match(tripMapControllerSource, /const detail = detailResult\.value;/);
    assert.doesNotMatch(tripMapControllerSource, /const detail = shellDetail\.detail;/);
    assert.match(tripMapControllerSource, /lodgingResults: buildTripMapLodgingResults\(detail\.days\)/);
  });

  it('retries marker-driven row focus after the bottom sheet and row layout settle', () => {
    assert.match(mapSearchSource, /const focusResultInList = useCallback/);
    assert.match(mapSearchSource, /pendingResultFocusRef\.current = \{ id: result\.id, tab: nextTab \};/);
    assert.match(mapSearchSource, /setTimeout\(\(\) => focusResultInList\(pending\.id, pending\.tab\), 80\)/);
    assert.match(mapSearchSource, /sheetContentVisible/);
  });

  it('renders selected-place trays as bottom-attached surfaces with only chips and a full-width register button', () => {
    assert.match(mapSearchSource, /styles\.stickyFooterContainer, \{ paddingBottom: insets\.bottom }/);
    assert.match(mapSearchSource, /backgroundColor: theme\.color\.surface/);
    assert.match(tripMapPartsSource, /selectedScheduleResults\.length > 0/);
    assert.match(tripMapPartsSource, /선택된 장소 일정 등록/);
    assert.doesNotMatch(tripMapPartsSource, /선택 \{results\.length\}/);
    assert.doesNotMatch(tripMapPartsSource, /scheduleAddTrayHeader/);
    assert.match(placeSearchSource, /선택된 장소 일정 등록/);
    assert.doesNotMatch(placeSearchSource, /선택 \{selectedBatchResults\.length\}/);
    assert.doesNotMatch(placeSearchSource, /batchFooterHeader/);
  });

  it('Issue 402 map and day place search controls use shared primitives with selected and touch-target semantics', () => {
    assert.match(
      placeSearchSource,
      /import \{[^}]*FilterChip[^}]*PrimaryButton[^}]*ScreenBackground[^}]*theme[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/design';/s,
    );
    assert.match(
      placeSearchSource,
      /<FilterChip[\s\S]*accessibilityLabel=\{`\$\{result\.placeName\} 제거`\}[\s\S]*selected[\s\S]*tone="accent"/,
    );
    assert.match(
      placeSearchSource,
      /<PrimaryButton[\s\S]*label=\{isSubmittingBatch \? '등록 중\.\.\.' : '선택된 장소 일정 등록'\}[\s\S]*loading=\{isSubmittingBatch\}/,
    );
    assert.doesNotMatch(placeSearchSource, /tone="lime"|tone: 'lime'/);

    assert.match(
      mapSearchSource,
      /import \{[^}]*FilterChip[^}]*IconButton[^}]*InlineAction[^}]*PrimaryButton[^}]*SecondaryButton[^}]*theme[^}]*\} from '\.\.\/design';/s,
    );
    assert.match(mapSearchSource, /<IconButton[\s\S]*accessibilityLabel="검색어 지우기"/);
    assert.match(
      mapSearchSource,
      /<FilterChip[\s\S]*accessibilityLabel=\{chip\.accessibilityLabel\}[\s\S]*selected=\{chip\.selected\}/,
    );
    assert.match(mapSearchSource, /<FilterChip[\s\S]*accessibilityRole="tab"[\s\S]*selected=\{tab\.selected\}/);
    assert.match(
      mapSearchSource,
      /<IconButton[\s\S]*accessibilityLabel=\{favoriteSelected \? '찜 해제' : '찜하기'\}[\s\S]*selected=\{favoriteSelected\}/,
    );
    assert.match(
      mapSearchSource,
      /<PrimaryButton[\s\S]*label=\{actionButtonLabel \?\? ''\}[\s\S]*selected=\{isPrimaryActionSelected\}/,
    );
    assert.match(mapSearchSource, /<InlineAction[\s\S]*label=\{detail\.mapSearchLabel\}/);
    assert.match(mapSearchSource, /<ConfirmationModal[\s\S]*cancelLabel=\{duplicateConfirmation\.cancelLabel\}/);
    assert.match(confirmationModalSource, /<SecondaryButton[\s\S]*label=\{cancelLabel\}/);
    assert.doesNotMatch(
      mapSearchSource,
      /accessibilityState=\{\{ disabled: isPrimaryActionDisabled, selected: isPrimaryActionSelected \}\}/,
    );
  });
});

function assertStyleContains(source: string, styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = source.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
