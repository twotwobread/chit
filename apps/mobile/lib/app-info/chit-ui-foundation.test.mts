import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

const componentSources = [
  '../design/components.tsx',
  '../design/primitives.tsx',
  '../design/foundation/accessibility.ts',
  '../design/foundation/action-group.tsx',
  '../design/foundation/interactive-surface.tsx',
  '../design/foundation/responsive-label.tsx',
  '../design/foundation/surface-frame.tsx',
  '../design/components/card.tsx',
  '../design/components/button.tsx',
  '../design/components/icon-button.tsx',
  '../design/components/link.tsx',
  '../design/components/chip.tsx',
  '../design/components/row.tsx',
  '../design/components/badge.tsx',
  '../design/components/amount-text.tsx',
  '../design/components/avatar.tsx',
  '../design/components/place.tsx',
  '../design/components/segmented-control.tsx',
  '../design/patterns/form-field.tsx',
  '../design/patterns/hero.tsx',
  '../design/patterns/state-card.tsx',
  '../navigation/BottomMenu.tsx',
  '../navigation/TripTabBar.tsx',
  '../navigation/tab-selection.ts',
  '../trip-ui/AppBar.tsx',
  '../trip-ui/TripScreenScaffold.tsx',
  '../trip-ui/BottomSheet.tsx',
  '../trip-ui/ExpenseRow.tsx',
];

const coreJourneySources = [
  '../../app/index.tsx',
  '../../app/mypage.tsx',
  '../../app/trips/[tripId]/_layout.tsx',
  '../../app/trips/[tripId]/(tabs)/today.tsx',
  '../../app/trips/[tripId]/(tabs)/itinerary.tsx',
  '../../app/trips/[tripId]/(tabs)/map.tsx',
  '../home-ui/TripCards.tsx',
  '../trip-ui/DayItineraryEditorStyles.ts',
  '../trip-ui/MyPageParts.tsx',
  '../trip-ui/MyPageStyles.ts',
  '../trip-ui/NextPlaceHeroCard.tsx',
  '../trip-ui/TodaySpendCard.tsx',
  '../trip-ui/TripMapScreenParts.tsx',
  '../trip-ui/TripMapScreenStyles.ts',
];

const cardSource = readMobileSource('../design/components/card.tsx');
const actionGroupSource = readMobileSource('../design/foundation/action-group.tsx');
const badgeSource = readMobileSource('../design/components/badge.tsx');
const buttonSource = readMobileSource('../design/components/button.tsx');
const chipSource = readMobileSource('../design/components/chip.tsx');
const placePrimitiveSource = readMobileSource('../design/components/place.tsx');
const selectableCardSource = readMobileSource('../design/components/selectable-card.tsx');
const segmentedControlSource = readMobileSource('../design/components/segmented-control.tsx');
const heroSource = readMobileSource('../design/patterns/hero.tsx');
const tabButtonSource = readOptionalMobileSource('../design/components/tab-button.tsx');
const floatingActionButtonSource = readOptionalMobileSource('../design/components/floating-action-button.tsx');
const indexSource = readMobileSource('../design/index.ts');
const expensesSource = readMobileSource('../../app/trips/[tripId]/(tabs)/expenses.tsx');
const todaySpendSource = readMobileSource('../trip-ui/TodaySpendCard.tsx');
const representativeNextPlaceHeroSource = readMobileSource('../trip-ui/NextPlaceHeroCard.tsx');
const representativeMapPartsSource = readMobileSource('../trip-ui/TripMapScreenParts.tsx');
const representativePlaceSearchSource = readMobileSource('../../app/trips/[tripId]/days/[date]/place-search.tsx');

test('Issue 395 representative surfaces adopt Hero and shared action primitives', () => {
  assert.match(representativeNextPlaceHeroSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroHeader/);
  assert.doesNotMatch(representativeNextPlaceHeroSource, /<Pressable/);
  assert.match(todaySpendSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroMetricPanel/);
  assert.doesNotMatch(todaySpendSource, /tone: 'lime'|tone="lime"/);
  assert.match(expensesSource, /import \{[\s\S]*FilterChip[\s\S]*InlineAction[\s\S]*TextLink/);
  assert.doesNotMatch(expensesSource, /function FilterChip\(/);
  assert.match(representativeMapPartsSource, /import \{[\s\S]*FilterChip[\s\S]*PrimaryButton/);
  assert.doesNotMatch(representativeMapPartsSource, /tone="lime"|tone: 'lime'/);
});

test('Chit foundation components do not introduce raw hex colors outside theme tokens', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of componentSources) {
    const source = readMobileSource(relativePath);
    assert.doesNotMatch(source, rawHexPattern, `${relativePath} should use theme tokens instead of raw hex colors`);
  }
});

test('Issue 385 theme exposes Ledger Memory surface tokens', () => {
  assert.equal(theme.color.bg, theme.color.chit.receiptCream);
  assert.equal(theme.color.surface, theme.color.chit.paperWhite);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.softGray);
  assert.equal(theme.color.borderDefault, theme.color.chit.warmLine);
  assert.equal(theme.color.shell, theme.color.chit.receiptCream);
  assert.equal(theme.color.primaryTextOnLight, theme.color.chit.ledgerInk);
  assert.equal(theme.color.brandAccent, theme.color.chit.coral);
  assert.equal(theme.color.actionPrimary, theme.color.chit.actionCoral);
  assert.equal(theme.color.shellHighest, theme.color.chit.ledgerInk);
  assert.equal(theme.color.uiAccent, theme.color.chit.coral);
  assert.equal(theme.color.uiAccentSoft, theme.color.chit.coralSoft);
  assert.notEqual(theme.color.actionPrimary, theme.color.success);
  assert.notEqual(theme.color.brandAccent, theme.color.danger);
  assert.equal(theme.color.memorySurface, theme.color.chit.receiptCream);
  assert.equal(theme.color.ledgerSurface, theme.color.chit.paperWhite);
});

test('Issue 385 shared components provide clean BrandStamp, ScreenBackground, and Ledger Memory card variants', () => {
  assert.match(cardSource, /export type CardVariant = Extract<[\s\S]*'memory' \| 'ledger' \| 'receipt'[\s\S]*>/);
  assert.match(cardSource, /variant = 'content'/);
  assert.match(cardSource, /export function BrandStamp/);
  assert.match(cardSource, /styles\.brandStampText/);
  assert.match(cardSource, /styles\.brandStampDot/);
  assert.doesNotMatch(cardSource, /rotate\(|stroke-dasharray/);
  assert.match(cardSource, /export function ScreenBackground/);
  assert.match(cardSource, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.doesNotMatch(cardSource, /LinearGradient|screenBackgroundLimeWash/);
  assert.doesNotMatch(cardSource, /shellGradient|shellGlow/);
  assert.match(indexSource, /BrandStamp/);
  assert.match(indexSource, /ScreenBackground/);
});

test('Issue 385 core screens adopt shared shell and brand stamp primitives', () => {
  const loginSource = readMobileSource('../../app/login.tsx');
  const homeSource = readMobileSource('../../app/index.tsx');
  const mypageSource = readMobileSource('../../app/mypage.tsx');
  const tripScreenSource = readMobileSource('../trip-ui/TripScreenScaffold.tsx');

  assert.match(loginSource, /import \{ BrandStamp, Card, PrimaryButton, SecondaryButton, ScreenBackground, theme \}/);
  assert.match(loginSource, /<ScreenBackground/);
  assert.match(loginSource, /<BrandStamp/);
  for (const expected of [
    'BrandStamp',
    'EmptyState',
    'ErrorState',
    'ScreenBackground',
    'SecondaryButton',
    'SkeletonCard',
  ]) {
    assert.match(homeSource, new RegExp(expected));
  }
  assert.match(homeSource, /<ScreenBackground/);
  assert.match(homeSource, /<BrandStamp/);
  for (const expected of ['EmptyState', 'ErrorState', 'ScreenBackground', 'SkeletonCard']) {
    assert.match(mypageSource, new RegExp(expected));
  }
  assert.match(mypageSource, /<ScreenBackground/);
  assert.match(
    tripScreenSource,
    /import \{ Card, PrimaryButton, ScreenBackground, SecondaryButton, SkeletonCard, theme \}/,
  );
  assert.match(tripScreenSource, /<ScreenBackground/);
});

test('shared primary and secondary buttons use Ledger Memory action hierarchy', () => {
  assert.match(buttonSource, /export type PrimaryButtonTone = 'coral' \| 'ink'/);
  assert.match(buttonSource, /tone = 'coral'/);
  assert.match(buttonSource, /primaryButtonCoral:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(buttonSource, /primaryButtonInk:[\s\S]*backgroundColor: theme\.color\.shellHighest/);
  assert.match(buttonSource, /primaryButtonText:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.doesNotMatch(buttonSource, /primaryButtonLime|onUiAccent/);
  assert.match(buttonSource, /secondaryButton:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.match(buttonSource, /secondaryButton:[\s\S]*borderColor: theme\.color\.borderDefault/);
  assert.match(buttonSource, /secondaryButtonText:[\s\S]*color: theme\.color\.textStrong/);
});

test('compact interactive controls keep the 44pt Chit touch target floor', () => {
  assert.ok(
    theme.layout.controlHSm >= theme.layout.tapMin,
    `compact controls must be at least ${theme.layout.tapMin}pt, got ${theme.layout.controlHSm}pt`,
  );
  assertStyleContains(segmentedControlSource, 'segmentItem', /minHeight: theme\.layout\.tapMin/);
});

test('selected bottom and trip tab surfaces use soft paper with a Coral edge', () => {
  const tabSelectionSource = readMobileSource('../navigation/tab-selection.ts');
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');

  assert.match(tabSelectionSource, /backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabSelectionSource, /borderBottomColor: theme\.color\.brandAccent/);
  assert.doesNotMatch(tabSelectionSource, /backgroundColor: theme\.color\.primary/);
  assert.match(tabButtonSource, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabButtonSource, /tabButtonSelected:[\s\S]*borderBottomColor: theme\.color\.brandAccent/);
  assert.doesNotMatch(tabButtonSource, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.primary/);
  assert.match(tabButtonSource, /iconColor = selected \? theme\.color\.brandAccent : theme\.color\.textFaint/);
  assert.match(tabButtonSource, /labelSelected:[\s\S]*color: theme\.color\.textStrong/);
  assert.match(bottomMenuSource, /<TabButton/);
  assert.match(tripTabBarSource, /<TabButton/);
});

test('Issue 399 navigation chrome adopts shared interactive primitives without route drift', () => {
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');
  const appBarSource = readMobileSource('../trip-ui/AppBar.tsx');
  const tripRootFabSource = readMobileSource('../trip-ui/TripRootFab.tsx');

  assert.match(indexSource, /TabButton/);
  assert.match(indexSource, /FloatingActionButton/);
  assert.match(bottomMenuSource, /import \{ TabButton, theme \} from '\.\.\/design';/);
  assert.doesNotMatch(bottomMenuSource, /<Pressable/);
  assert.match(bottomMenuSource, /<TabButton[\s\S]*accessibilityRole="button"[\s\S]*selected=\{focused\}/);
  assert.match(bottomMenuSource, /markExplicitHomeIntent\(\)/);
  assert.match(bottomMenuSource, /router\.replace\('\/'\)/);
  assert.match(bottomMenuSource, /router\.replace\('\/mypage'\)/);

  assert.match(tripTabBarSource, /import \{ TabButton, theme \} from '\.\.\/design';/);
  assert.doesNotMatch(tripTabBarSource, /<Pressable/);
  assert.match(tripTabBarSource, /<TabButton[\s\S]*accessibilityRole="tab"[\s\S]*selected=\{focused\}/);
  assert.match(
    tripTabBarSource,
    /navigation\.emit\(\{ canPreventDefault: true, target: route\.key, type: 'tabPress' \}\)/,
  );
  assert.match(tripTabBarSource, /router\.replace\([\s\S]*tripTabPathWithState\(tripId, route\.name, route\.params/);
  assert.match(tripTabBarSource, /navigation\.navigate\(route\.name\)/);

  assert.match(appBarSource, /import \{ AvatarGroup, IconButton, theme \} from '\.\.\/design';/);
  assert.match(appBarSource, /InteractiveSurface/);
  assert.doesNotMatch(appBarSource, /<Pressable/);
  assert.match(appBarSource, /accessibilityHint=\{leadingHint\}/);
  assert.match(appBarSource, /accessibilityHint="다른 여행으로 전환합니다\."/);
  assert.match(appBarSource, /accessibilityHint="항공권 목록을 엽니다\."/);
  assert.match(appBarSource, /accessibilityHint="동행자 목록을 엽니다\."/);
  assert.match(appBarSource, /router\.replace\('\/'\)/);

  assert.match(tripRootFabSource, /import \{ FloatingActionButton, theme \} from '\.\.\/design';/);
  assert.doesNotMatch(tripRootFabSource, /<Pressable/);
  assert.match(
    tripRootFabSource,
    /<FloatingActionButton[\s\S]*accessibilityHint=\{accessibilityHint\}[\s\S]*accessibilityLabel=\{accessibilityLabel\}/,
  );
  assert.doesNotMatch(tripRootFabSource, /tone="lime"/);
  assert.match(tripRootFabSource, /<Plus color=\{theme\.color\.uiAccent\}/);
  assert.match(floatingActionButtonSource, /export type FloatingActionButtonTone = 'coral' \| 'ink'/);
  assert.match(floatingActionButtonSource, /tone = 'ink'/);
  assert.match(
    floatingActionButtonSource,
    /floatingActionButtonCoral:[\s\S]*backgroundColor: theme\.color\.actionPrimary/,
  );
  assert.match(
    floatingActionButtonSource,
    /floatingActionButtonInk:[\s\S]*backgroundColor: theme\.color\.shellHighest/,
  );
});

test('shared primitives encode stable secondary-label and action layout defaults', () => {
  const dayChipsSource = readMobileSource('../trip-ui/DayChips.tsx');

  assert.match(chipSource, /statusPlacement\?: 'auto' \| 'below'/);
  assert.match(chipSource, /statusPlacement = 'below'/);
  assert.match(chipSource, /statusPlacement === 'below'/);
  assert.match(chipSource, /styles\.filterChipStatusBelow/);
  assert.doesNotMatch(dayChipsSource, /statusPlacement="below"/);

  assert.match(actionGroupSource, /buildResponsiveTextProfile/);
  assert.match(actionGroupSource, /direction === 'row' && profile\.prefersStackedContent/);
  assert.match(heroSource, /<ActionGroup[\s\S]*direction=\{secondary \? 'row' : 'column'\}/);

  assert.match(buttonSource, /styles\.loadingStack/);
  assert.doesNotMatch(buttonSource, /loadingRow:[\s\S]*flexWrap: 'wrap'/);

  assert.match(segmentedControlSource, /numberOfLines=\{2\}/);
  assert.match(segmentedControlSource, /styles\.segmentTextBounded/);

  assert.match(selectableCardSource, /metaPlacement = 'below'/);
  assert.match(selectableCardSource, /metaPlacement\?: 'below' \| 'inline'/);
  assert.match(selectableCardSource, /styles\.selectableCardMetaBelow/);

  assert.doesNotMatch(badgeSource, /pill:[\s\S]*flexWrap: 'wrap'/);
  assert.doesNotMatch(placePrimitiveSource, /placeTag:[\s\S]*flexWrap: 'wrap'/);

  assert.match(representativeMapPartsSource, /labelNumberOfLines=\{1\}/);
  assert.match(representativeMapPartsSource, /style=\{styles\.scheduleAddSelectedChip\}/);
  assert.match(representativePlaceSearchSource, /labelNumberOfLines=\{1\}/);
  assert.match(representativePlaceSearchSource, /style=\{styles\.batchSelectedChip\}/);
});

test('key tab and chip primitives expose explicit accessibility labels with selected state', () => {
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');
  const dayChipsSource = readMobileSource('../trip-ui/DayChips.tsx');

  assert.match(bottomMenuSource, /accessibilityLabel=\{tab\.label\}/);
  assert.match(bottomMenuSource, /selected=\{focused\}/);
  assert.match(tripTabBarSource, /accessibilityLabel=\{label\}/);
  assert.match(tripTabBarSource, /selected=\{focused\}/);
  assert.match(chipSource, /accessibilityLabel=\{label\}/);
  assert.match(segmentedControlSource, /accessibilityLabel=\{option\}/);
  assert.match(dayChipsSource, /accessibilityLabel=\{buildDayChipAccessibilityLabel\(day\)\}/);
  assert.match(dayChipsSource, /selected=\{selected\}/);
});

test('Issue 372 core journey surfaces do not introduce raw hex colors outside theme tokens', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of coreJourneySources) {
    const source = readMobileSource(relativePath);
    assert.doesNotMatch(source, rawHexPattern, `${relativePath} should use theme tokens instead of raw hex colors`);
  }
});

test('Issue 395 high-emphasis journey heroes use Ledger Memory Hero and Coral action hierarchy', () => {
  const tripCardsSource = readMobileSource('../home-ui/TripCards.tsx');

  assertStyleContains(tripCardsSource, 'hero', /backgroundColor: theme\.color\.chit\.charcoal/);
  assertStyleContains(tripCardsSource, 'heroCta', /backgroundColor: theme\.color\.actionPrimary/);
  assertStyleContains(tripCardsSource, 'heroCtaText', /color: theme\.color\.onActionPrimary/);
  assertStyleContains(tripCardsSource, 'upcomingHomeHero', /backgroundColor: theme\.color\.chit\.charcoal/);

  assert.match(representativeNextPlaceHeroSource, /<HeroCard[\s\S]*variant="graphite"/);
  assert.match(representativeNextPlaceHeroSource, /HeroActions/);
  assert.doesNotMatch(representativeNextPlaceHeroSource, /actionGreen|actionTextLight/);
});

test('Issue 395 Today spend summary uses Hero panel and shared action hierarchy', () => {
  assert.match(todaySpendSource, /HeroMetricPanel/);
  assert.match(todaySpendSource, /<HeroCard[\s\S]*variant="panel"/);
  assert.match(todaySpendSource, /HeroActions/);
  assert.doesNotMatch(todaySpendSource, /card:\s*\{[\s\S]*?backgroundColor: theme\.color\.accentSoft/);
});

test('Issue 401 itinerary/list rows use shared action primitives without losing accessibility semantics', () => {
  const dayChipsSource = readMobileSource('../trip-ui/DayChips.tsx');
  const itineraryContentSource = readMobileSource('../trip-ui/DayItineraryContent.tsx');
  const timelineSource = readMobileSource('../trip-ui/ItineraryTimeline.tsx');
  const lodgingPanelSource = readMobileSource('../trip-ui/DayLodgingPanel.tsx');
  const expenseRowSource = readMobileSource('../trip-ui/ExpenseRow.tsx');
  const compactActionRowSource = readMobileSource('../trip-ui/CompactActionRow.tsx');

  assert.match(dayChipsSource, /import \{ FilterChip, theme \} from '\.\.\/design';/);
  assert.match(dayChipsSource, /<FilterChip[\s\S]*accessibilityRole="tab"[\s\S]*selected=\{selected\}/);

  assert.match(
    itineraryContentSource,
    /import \{[^}]*FilterChip[^}]*IconButton[^}]*InlineAction[^}]*PrimaryButton[^}]*SecondaryButton[^}]*theme[^}]*\} from '\.\.\/design';/,
  );
  assert.match(
    itineraryContentSource,
    /<IconButton[\s\S]*accessibilityLabel=\{`\$\{item\.placeName\} 다른 Day로 이동`\}/,
  );
  assert.match(itineraryContentSource, /<IconButton[\s\S]*accessibilityLabel=\{`\$\{item\.placeName\} 삭제`\}/);
  assert.match(
    itineraryContentSource,
    /<FilterChip[\s\S]*accessibilityLabel=\{`\$\{option\.dayLabel\} \$\{option\.formattedDate\}로 이동`\}/,
  );
  assert.match(
    itineraryContentSource,
    /<InlineAction[\s\S]*accessibilityLabel=\{panel\.actions\.copyAddress\.accessibilityLabel\}/,
  );
  assert.match(
    itineraryContentSource,
    /<InlineAction[\s\S]*accessibilityLabel=\{panel\.actions\.openMap\.accessibilityLabel\}/,
  );

  assert.match(timelineSource, /import \{ Badge, InlineAction, PlaceTag, theme \} from '\.\.\/design';/);
  assert.match(timelineSource, /import \{ CompactActionRow \} from '\.\/CompactActionRow';/);
  assert.doesNotMatch(timelineSource, /<Pressable/);
  assert.match(timelineSource, /<InlineAction[\s\S]*accessibilityLabel=\{`\$\{item\.name\} 대표 숙소 관리`\}/);

  assert.match(lodgingPanelSource, /import \{ ActionRow, Badge, InlineAction, SecondaryButton \} from '\.\.\/design';/);
  assert.doesNotMatch(lodgingPanelSource, /<Pressable/);
  assert.match(lodgingPanelSource, /<ActionRow[\s\S]*selected=\{highlighted\}/);
  assert.match(lodgingPanelSource, /<InlineAction[\s\S]*tone="danger"/);

  assert.match(expenseRowSource, /import \{ CompactActionRow \} from '\.\/CompactActionRow';/);
  assert.match(expenseRowSource, /<CompactActionRow[\s\S]*accessibilityLabel=\{resolvedAccessibilityLabel\}/);
  assert.match(expenseRowSource, /accessibilityLabel=\{`\$\{categoryMeta\.label\} 카테고리`\}/);

  assert.match(compactActionRowSource, /InteractiveSurface/);
  assert.match(compactActionRowSource, /theme\.layout\.tapMin/);
  assert.match(compactActionRowSource, /selected=\{selected\}/);
});

test('Today tab compact row actions preserve the 44pt touch target floor', () => {
  const source = readMobileSource('../../app/trips/[tripId]/(tabs)/today.tsx');

  assertStyleContains(source, 'rowButton', /minHeight: theme\.layout\.tapMin/);
});

test('Issue 372 My Page uses foundation primitives for simple state and section actions', () => {
  const screenSource = readMobileSource('../../app/mypage.tsx');
  const partsSource = readMobileSource('../trip-ui/MyPageParts.tsx');

  assert.match(screenSource, /EmptyState/);
  assert.match(screenSource, /ErrorState/);
  assert.match(screenSource, /SkeletonCard/);
  assert.match(screenSource, /label: '로그인하기'[\s\S]*router\.replace\('\/login'\)/);
  assert.match(screenSource, /label: '다시 시도'[\s\S]*onPress: load/);

  assert.match(partsSource, /EmptyState/);
  assert.match(partsSource, /ErrorState/);
  assert.match(partsSource, /SkeletonCard/);
  assert.match(partsSource, /label: '다시 시도'[\s\S]*onPress: onRetry/);
  assert.match(partsSource, /label: '새 여행 만들기'/);
});

test('Issue 395 itinerary and map selected actions use Chit action hierarchy', () => {
  const itineraryStylesSource = readMobileSource('../trip-ui/DayItineraryEditorStyles.ts');

  assertStyleContains(
    itineraryStylesSource,
    'defaultTravelModeChipSelected',
    /backgroundColor: theme\.color\.surfaceSoft/,
  );
  assertStyleContains(itineraryStylesSource, 'defaultTravelModeChipSelected', /borderColor: theme\.color\.uiAccent/);
  assertStyleContains(itineraryStylesSource, 'defaultTravelModeChipTextSelected', /color: theme\.color\.textStrong/);
  assertStyleContains(itineraryStylesSource, 'chipSelected', /backgroundColor: theme\.color\.surfaceSoft/);
  assertStyleContains(itineraryStylesSource, 'chipSelected', /borderColor: theme\.color\.uiAccent/);
  assertStyleContains(itineraryStylesSource, 'chipTextSelected', /color: theme\.color\.textStrong/);

  assert.match(representativeMapPartsSource, /import \{ FilterChip, PrimaryButton, theme \} from '\.\.\/design';/);
  assert.match(
    representativeMapPartsSource,
    /<PrimaryButton[\s\S]*disabled=\{isSubmitting \|\| \(choosingDay && !targetDay\)\}[\s\S]*label=\{submitLabel\}[\s\S]*loading=\{isSubmitting\}/,
  );
  assert.doesNotMatch(representativeMapPartsSource, /tone="lime"|tone: 'lime'/);
});

test('expense rows keep explicit category icon markers and accessible category labels', () => {
  const source = readMobileSource('../trip-ui/ExpenseRow.tsx');

  assert.match(source, /getExpenseCategoryMarkerMeta\(category\)/);
  assert.match(source, /CATEGORY_ICON\[categoryMeta\.iconName\]/);
  assert.match(source, /accessibilityLabel=\{`\$\{categoryMeta\.label\} 카테고리`\}/);
  assert.match(source, /<CategoryIcon/);
});

test('keyboard-aware forms are backed by the production keyboard controller with Expo Go fallback', () => {
  const source = readMobileSource('../trip-ui/KeyboardAwareFormScrollView.tsx');

  assert.match(source, /require\('react-native-keyboard-controller'\)/);
  assert.match(source, /FallbackKeyboardAwareScrollView/);
  assert.match(source, /bottomOffset=\{keyboardConfig\.keyboardBottomOffset\}/);
  assert.match(source, /disableScrollOnKeyboardHide/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function readOptionalMobileSource(relativePath: string): string {
  try {
    return readMobileSource(relativePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function assertStyleContains(source: string, styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = source.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
