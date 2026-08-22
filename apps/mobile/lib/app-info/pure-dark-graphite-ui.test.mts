import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

test('Ledger Memory tokens make receipt cream the shell and paper white the ledger surface', () => {
  assert.equal(theme.color.bg, theme.color.chit.receiptCream);
  assert.equal(theme.color.shell, theme.color.chit.receiptCream);
  assert.equal(theme.color.shellElevated, theme.color.chit.paperWhite);
  assert.equal(theme.color.surface, theme.color.chit.paperWhite);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.softGray);
  assert.equal(theme.color.memorySurface, theme.color.chit.receiptCream);
  assert.equal(theme.color.ledgerSurface, theme.color.chit.paperWhite);
  assert.equal(theme.color.actionPrimary, theme.color.chit.actionCoral);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.paperWhite);
  assert.equal(theme.color.brandAccent, theme.color.chit.coral);
  assert.equal(theme.color.shellHighest, theme.color.chit.ledgerInk);
  assert.notEqual(theme.color.brandAccent, theme.color.success);
  assert.notEqual(theme.color.brandAccent, theme.color.danger);
});

test('Ledger Memory keeps semantic state colors separate from Coral', () => {
  assert.equal(theme.color.textStrong, theme.color.chit.ledgerInk);
  assert.equal(theme.color.textBody, '#44474F');
  assert.equal(theme.color.textMuted, theme.color.chit.mutedInk);
  assert.equal(theme.color.lightEscape, theme.color.chit.paperWhite);
  assert.equal(theme.color.success, theme.color.chit.clearGreen);
  assert.equal(theme.color.danger, theme.color.chit.alertRed);
  assert.equal(theme.color.info, theme.color.chit.infoBlue);
});

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('mobile UI rule documents Ledger Memory and Coral semantic boundaries', () => {
  const rule = read('../../../../.harness/rules/code/mobile-ui.md');
  assert.match(rule, /Ledger × Memory/);
  assert.match(rule, /기록은 정확하게, 기억은 다정하게/);
  assert.match(rule, /Chit Coral[\s\S]*not use Coral to mean financial success, unpaid, error, or completion/i);
  assert.match(rule, /placeholder-quality place cards/);
});

test('shared surfaces expose memory, ledger, and receipt frame variants', () => {
  const surfaceFrame = read('../design/foundation/surface-frame.tsx');
  const card = read('../design/components/card.tsx');
  const hero = read('../design/patterns/hero.tsx');

  assert.match(
    surfaceFrame,
    /SurfaceFrameVariant = 'content' \| 'hero' \| 'dark' \| 'shelf' \| 'graphite' \| 'memory' \| 'ledger' \| 'receipt'/,
  );
  assert.match(surfaceFrame, /memory:[\s\S]*backgroundColor: theme\.color\.memorySurface/);
  assert.match(surfaceFrame, /ledger:[\s\S]*backgroundColor: theme\.color\.ledgerSurface/);
  assert.match(surfaceFrame, /receipt:[\s\S]*backgroundColor: theme\.color\.receiptSurface/);
  assert.match(card, /CardVariant[\s\S]*'memory' \| 'ledger' \| 'receipt'/);
  assert.match(card, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.match(hero, /HeroActions/);
  assert.doesNotMatch(hero, /tone: 'lime' as PrimaryButtonTone, \.\.\.primary/);
});

test('routine nav and floating actions avoid retired Lime tone names', () => {
  const tabButton = read('../design/components/tab-button.tsx');
  const fab = read('../design/components/floating-action-button.tsx');

  assert.doesNotMatch(tabButton, /theme\.color\.primary/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*borderBottomColor: theme\.color\.brandAccent/);
  assert.doesNotMatch(fab, /tone = 'lime'/);
  assert.doesNotMatch(fab, /FloatingActionButtonTone = 'lime' \| 'graphite'/);
});

test('navigation shell uses paper/cream surfaces with Coral selected signal', () => {
  const bottomMenu = read('../navigation/BottomMenu.tsx');
  const tripTabBar = read('../navigation/TripTabBar.tsx');
  const selection = read('../navigation/tab-selection.ts');
  const appBar = read('../trip-ui/AppBar.tsx');
  const bottomSheet = read('../trip-ui/BottomSheet.tsx');
  const dayChips = read('../trip-ui/DayChips.tsx');
  const tripRootFab = read('../trip-ui/TripRootFab.tsx');

  assert.doesNotMatch(selection, /backgroundColor: theme\.color\.primary/);
  assert.match(selection, /backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(selection, /borderBottomColor: theme\.color\.brandAccent/);
  assert.match(bottomMenu, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(bottomMenu, /borderTopColor: theme\.color\.borderDefault/);
  assert.match(tripTabBar, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(tripTabBar, /borderTopColor: theme\.color\.borderDefault/);
  assert.match(appBar, /backgroundColor: theme\.color\.shell/);
  assert.match(appBar, /borderBottomColor: theme\.color\.borderDefault/);
  assert.match(bottomSheet, /sheet:[\s\S]*backgroundColor: theme\.color\.shellElevated/);
  assert.match(bottomSheet, /sheet:[\s\S]*borderColor: theme\.color\.borderDefault/);
  assert.match(dayChips, /FilterChip/);
  assert.doesNotMatch(tripRootFab, /tone="lime"/);
});

test('root screens use shared Ledger Memory surfaces without raw primary fills', () => {
  for (const relativePath of [
    '../../app/login.tsx',
    '../../app/index.tsx',
    '../../app/mypage.tsx',
    '../../app/notifications.tsx',
    '../../app/account.tsx',
    '../home-ui/TripCards.tsx',
    '../account-ui/AccountRows.tsx',
    '../trip-ui/MyPageParts.tsx',
    '../trip-ui/MyPageStyles.ts',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
    assert.doesNotMatch(source, /tone="lime"|tone: 'lime'/);
  }
});

test('trip tabs avoid retired Lime CTA fill while using shared components', () => {
  for (const relativePath of [
    '../../app/trips/[tripId]/(tabs)/today.tsx',
    '../../app/trips/[tripId]/(tabs)/itinerary.tsx',
    '../../app/trips/[tripId]/(tabs)/expenses.tsx',
    '../../app/trips/[tripId]/(tabs)/settle.tsx',
    '../trip-ui/NextPlaceHeroCard.tsx',
    '../trip-ui/TodaySpendCard.tsx',
    '../trip-ui/DayItineraryEditorStyles.ts',
    '../trip-ui/DayItineraryContent.tsx',
    '../trip-ui/ItineraryTimeline.tsx',
    '../trip-ui/ExpenseRow.tsx',
    '../trip-ui/TransferRow.tsx',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
    assert.doesNotMatch(source, /tone="lime"|tone: 'lime'/);
  }
});

test('map search overlays use tokenized surfaces and polished place thumbnails', () => {
  const mapParts = read('../trip-ui/TripMapScreenParts.tsx');
  const mapStyles = read('../trip-ui/TripMapScreenStyles.ts');
  const googlePlaceMapSearch = read('../trip-ui/GooglePlaceMapSearch.tsx');

  assert.doesNotMatch(mapParts, /tone="lime"|tone: 'lime'/);
  assert.doesNotMatch(googlePlaceMapSearch, /tone="lime"|tone: 'lime'/);
  assert.doesNotMatch(mapStyles, /backgroundColor: theme\.color\.primary/);
  assert.doesNotMatch(googlePlaceMapSearch, /backgroundColor: theme\.color\.primary/);
  assert.match(mapStyles, /backgroundColor: theme\.color\.surface|backgroundColor: theme\.color\.shellElevated/);
  assert.match(googlePlaceMapSearch, /photo|thumbnail|category|Place/);
});

test('form and detail flows avoid retired Lime/primary-fill semantics', () => {
  for (const relativePath of [
    '../../app/trips/new.tsx',
    '../../app/trips/[tripId]/detail.tsx',
    '../../app/trips/[tripId]/edit.tsx',
    '../../app/trips/[tripId]/participants.tsx',
    '../../app/trips/[tripId]/flights/index.tsx',
    '../../app/trips/[tripId]/flights/new.tsx',
    '../../app/trips/[tripId]/flights/[flightId].tsx',
    '../trip-ui/ParticipantsScreenParts.tsx',
    '../trip-ui/ParticipantsScreenStyles.ts',
    '../trip-ui/TripDetailScreenParts.tsx',
    '../trip-ui/TripDetailScreenStyles.ts',
    '../trip-ui/TripDateRangeEditor.tsx',
    '../trips/date-picker.tsx',
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primarySoft/);
    assert.doesNotMatch(source, /borderColor: theme\.color\.primary/);
    assert.doesNotMatch(source, /tone="lime"|tone: 'lime'/);
  }
});
