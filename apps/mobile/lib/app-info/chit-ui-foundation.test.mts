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
const buttonSource = readMobileSource('../design/components/button.tsx');
const chipSource = readMobileSource('../design/components/chip.tsx');
const segmentedControlSource = readMobileSource('../design/components/segmented-control.tsx');
const heroSource = readMobileSource('../design/patterns/hero.tsx');
const indexSource = readMobileSource('../design/index.ts');
const expensesSource = readMobileSource('../../app/trips/[tripId]/(tabs)/expenses.tsx');
const todaySpendSource = readMobileSource('../trip-ui/TodaySpendCard.tsx');
const representativeNextPlaceHeroSource = readMobileSource('../trip-ui/NextPlaceHeroCard.tsx');
const representativeMapPartsSource = readMobileSource('../trip-ui/TripMapScreenParts.tsx');

test('Issue 395 representative surfaces adopt Hero and shared action primitives', () => {
  assert.match(representativeNextPlaceHeroSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroHeader/);
  assert.doesNotMatch(representativeNextPlaceHeroSource, /<Pressable/);
  assert.match(todaySpendSource, /import \{[\s\S]*HeroActions[\s\S]*HeroCard[\s\S]*HeroMetricPanel/);
  assert.match(todaySpendSource, /tone: 'lime'|tone="lime"/);
  assert.match(expensesSource, /import \{[\s\S]*FilterChip[\s\S]*InlineAction[\s\S]*TextLink/);
  assert.doesNotMatch(expensesSource, /function FilterChip\(/);
  assert.match(representativeMapPartsSource, /import \{[\s\S]*FilterChip[\s\S]*PrimaryButton/);
  assert.match(representativeMapPartsSource, /tone="lime"/);
});

test('Chit foundation components do not introduce raw hex colors outside theme tokens', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of componentSources) {
    const source = readMobileSource(relativePath);
    assert.doesNotMatch(source, rawHexPattern, `${relativePath} should use theme tokens instead of raw hex colors`);
  }
});

test('Issue 385 theme exposes clean matte dark shell and off-white content tokens', () => {
  assert.equal(theme.color.bg, theme.color.chit.matteCharcoal);
  assert.equal(theme.color.surface, theme.color.chit.offWhiteElevated);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.offWhiteSubtle);
  assert.equal(theme.color.borderDefault, theme.color.chit.offWhiteBorder);
  assert.equal(theme.color.shell, theme.color.chit.matteCharcoal);
  assert.equal(theme.color.primaryTextOnLight, theme.color.chit.charcoal);
  assert.equal(theme.color.brandAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphite);
  assert.equal(theme.color.shellHighest, theme.color.chit.graphite);
  assert.equal(theme.color.uiAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.uiAccentSoft, theme.color.chit.acidLimeSofter);
  assert.notEqual(theme.color.actionPrimary, theme.color.brandAccent);
  assert.notEqual(theme.color.surface, theme.color.chit.warmPaper);
});

test('Issue 385 shared components provide BrandStamp, ScreenBackground, and card variants', () => {
  assert.match(
    cardSource,
    /export type CardVariant = Extract<SurfaceFrameVariant, 'content' \| 'hero' \| 'dark' \| 'shelf'>/,
  );
  assert.match(cardSource, /variant = 'content'/);
  assert.match(cardSource, /export function BrandStamp/);
  assert.match(cardSource, /styles\.brandStamp/);
  assert.match(cardSource, /transform: \[\{ rotate: '-3deg' \}\]/);
  assert.match(cardSource, /export function ScreenBackground/);
  assert.match(cardSource, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.doesNotMatch(cardSource, /LinearGradient|screenBackgroundLimeWash/);
  assert.doesNotMatch(cardSource, /shellGradient|shellGlow/);
  assert.match(indexSource, /BrandStamp/);
  assert.match(indexSource, /ScreenBackground/);
});

test('Issue 385 core screens adopt dark shell and brand stamp primitives', () => {
  const loginSource = readMobileSource('../../app/login.tsx');
  const homeSource = readMobileSource('../../app/index.tsx');
  const mypageSource = readMobileSource('../../app/mypage.tsx');
  const tripScreenSource = readMobileSource('../trip-ui/TripScreenScaffold.tsx');

  assert.match(loginSource, /import \{ BrandStamp, Card, PrimaryButton, SecondaryButton, ScreenBackground, theme \}/);
  assert.match(loginSource, /<ScreenBackground/);
  assert.match(loginSource, /<BrandStamp/);
  assert.match(homeSource, /import \{ BrandStamp, Card, PrimaryButton, ScreenBackground, SecondaryButton, theme \}/);
  assert.match(homeSource, /<ScreenBackground/);
  assert.match(homeSource, /<BrandStamp/);
  assert.match(mypageSource, /import \{ PrimaryButton, ScreenBackground, SecondaryButton, theme \}/);
  assert.match(mypageSource, /<ScreenBackground/);
  assert.match(tripScreenSource, /import \{ Card, PrimaryButton, ScreenBackground, SecondaryButton, theme \}/);
  assert.match(tripScreenSource, /<ScreenBackground/);
});

test('shared primary and secondary buttons use enterprise Chit action hierarchy', () => {
  assert.match(buttonSource, /primaryButtonGraphite:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(buttonSource, /primaryButtonText:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.match(buttonSource, /primaryButtonLime:[\s\S]*backgroundColor: theme\.color\.uiAccent/);
  assert.match(buttonSource, /primaryButtonTextLime:[\s\S]*color: theme\.color\.onUiAccent/);
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

test('selected bottom and trip tab surfaces preserve existing primary fill until follow-up migration', () => {
  const tabSelectionSource = readMobileSource('../navigation/tab-selection.ts');
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');

  assert.match(tabSelectionSource, /backgroundColor: theme\.color\.primary/);
  assert.match(tabSelectionSource, /theme\.shadow\.xs/);
  assert.match(bottomMenuSource, /focused \? theme\.color\.onPrimary : theme\.color\.textFaint/);
  assert.match(bottomMenuSource, /selectedLabel:[\s\S]*color: theme\.color\.onPrimary/);
  assert.match(tripTabBarSource, /focused \? theme\.color\.onPrimary : theme\.color\.textFaint/);
  assert.match(tripTabBarSource, /labelActive:[\s\S]*color: theme\.color\.onPrimary/);
});

test('key tab and chip primitives expose explicit accessibility labels with selected state', () => {
  const bottomMenuSource = readMobileSource('../navigation/BottomMenu.tsx');
  const tripTabBarSource = readMobileSource('../navigation/TripTabBar.tsx');
  const dayChipsSource = readMobileSource('../trip-ui/DayChips.tsx');

  assert.match(bottomMenuSource, /accessibilityLabel=\{tab\.label\}/);
  assert.match(bottomMenuSource, /accessibilityState=\{\{ selected: focused \}\}/);
  assert.match(tripTabBarSource, /accessibilityLabel=\{label\}/);
  assert.match(tripTabBarSource, /accessibilityState=\{\{ selected: focused \}\}/);
  assert.match(chipSource, /accessibilityLabel=\{label\}/);
  assert.match(segmentedControlSource, /accessibilityLabel=\{option\}/);
  assert.match(dayChipsSource, /accessibilityLabel=\{buildDayChipAccessibilityLabel\(day\)\}/);
  assert.match(dayChipsSource, /accessibilityState=\{\{ selected \}\}/);
});

test('Issue 372 core journey surfaces do not introduce raw hex colors outside theme tokens', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of coreJourneySources) {
    const source = readMobileSource(relativePath);
    assert.doesNotMatch(source, rawHexPattern, `${relativePath} should use theme tokens instead of raw hex colors`);
  }
});

test('Issue 395 high-emphasis journey heroes use Graphite Hero and Lime CTA primitives', () => {
  const tripCardsSource = readMobileSource('../home-ui/TripCards.tsx');

  assertStyleContains(tripCardsSource, 'hero', /backgroundColor: theme\.color\.chit\.charcoal/);
  assertStyleContains(tripCardsSource, 'heroCta', /backgroundColor: theme\.color\.primary/);
  assertStyleContains(tripCardsSource, 'heroCtaText', /color: theme\.color\.onPrimary/);
  assertStyleContains(tripCardsSource, 'upcomingHomeHero', /backgroundColor: theme\.color\.chit\.charcoal/);

  assert.match(representativeNextPlaceHeroSource, /<HeroCard[\s\S]*variant="graphite"/);
  assert.match(representativeNextPlaceHeroSource, /<HeroActions[\s\S]*tone: 'lime'/);
  assert.doesNotMatch(representativeNextPlaceHeroSource, /actionGreen|actionTextLight/);
});

test('Issue 395 Today spend summary uses Hero panel and Lime add action', () => {
  assert.match(todaySpendSource, /HeroMetricPanel/);
  assert.match(todaySpendSource, /<HeroCard[\s\S]*variant="panel"/);
  assert.match(todaySpendSource, /<HeroActions[\s\S]*tone: 'lime'/);
  assert.doesNotMatch(todaySpendSource, /card:\s*\{[\s\S]*?backgroundColor: theme\.color\.accentSoft/);
});

test('Today tab compact row actions preserve the 44pt touch target floor', () => {
  const source = readMobileSource('../../app/trips/[tripId]/(tabs)/today.tsx');

  assertStyleContains(source, 'rowButton', /minHeight: theme\.layout\.tapMin/);
});

test('Issue 372 My Page uses foundation buttons for simple state and section actions', () => {
  const screenSource = readMobileSource('../../app/mypage.tsx');
  const partsSource = readMobileSource('../trip-ui/MyPageParts.tsx');

  assert.match(
    screenSource,
    /import \{ PrimaryButton, ScreenBackground, SecondaryButton, theme \} from '\.\.\/lib\/design';/,
  );
  assert.match(screenSource, /<PrimaryButton[\s\S]*label="로그인하기"[\s\S]*router\.replace\('\/login'\)/);
  assert.match(screenSource, /<SecondaryButton[\s\S]*label="다시 시도"[\s\S]*onPress=\{load\}/);

  assert.match(partsSource, /import \{ PrimaryButton, SecondaryButton, theme \} from '\.\.\/design';/);
  assert.match(partsSource, /<SecondaryButton[\s\S]*label="다시 시도"[\s\S]*onPress=\{onRetry\}/);
  assert.match(partsSource, /<PrimaryButton[\s\S]*label="새 여행 만들기"/);
});

test('Issue 395 itinerary and map selected actions use Chit action hierarchy', () => {
  const itineraryStylesSource = readMobileSource('../trip-ui/DayItineraryEditorStyles.ts');

  assertStyleContains(itineraryStylesSource, 'defaultTravelModeChipSelected', /backgroundColor: theme\.color\.primary/);
  assertStyleContains(itineraryStylesSource, 'defaultTravelModeChipTextSelected', /color: theme\.color\.onPrimary/);
  assertStyleContains(itineraryStylesSource, 'chipSelected', /backgroundColor: theme\.color\.primary/);
  assertStyleContains(itineraryStylesSource, 'chipTextSelected', /color: theme\.color\.onPrimary/);

  assert.match(representativeMapPartsSource, /import \{ FilterChip, PrimaryButton, theme \} from '\.\.\/design';/);
  assert.match(
    representativeMapPartsSource,
    /<PrimaryButton[\s\S]*disabled=\{isSubmitting \|\| \(choosingDay && !targetDay\)\}[\s\S]*label=\{submitLabel\}[\s\S]*loading=\{isSubmitting\}[\s\S]*tone="lime"/,
  );
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

function assertStyleContains(source: string, styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = source.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
