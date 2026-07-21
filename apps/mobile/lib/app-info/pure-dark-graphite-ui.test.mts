import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

test('Pure Dark Graphite tokens make dark graphite the default app surface', () => {
  assert.equal(theme.color.bg, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shell, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shellElevated, theme.color.chit.graphiteRaised);
  assert.equal(theme.color.surface, theme.color.chit.graphiteCard);
  assert.equal(theme.color.surfaceSoft, theme.color.chit.graphiteElevated);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.graphiteSunken);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.offWhiteText);
  assert.notEqual(theme.color.surface, theme.color.chit.offWhiteElevated);
  assert.notEqual(theme.color.surfaceSunken, theme.color.chit.offWhiteSubtle);
  assert.notEqual(theme.color.primary, theme.color.actionPrimary);
});

test('Pure Dark Graphite keeps off-white as text or escape only', () => {
  assert.equal(theme.color.textStrong, theme.color.chit.offWhiteText);
  assert.equal(theme.color.textBody, theme.color.chit.mutedText);
  assert.equal(theme.color.textMuted, theme.color.chit.faintText);
  assert.equal(theme.color.lightEscape, theme.color.chit.offWhiteElevated);
});

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('mobile UI rule documents Pure Dark Graphite and Compact Premium Dark', () => {
  const rule = read('../../../../.harness/rules/code/mobile-ui.md');
  assert.match(rule, /Pure Dark Graphite/);
  assert.match(rule, /Compact Premium Dark/);
  assert.match(rule, /large floating off-white blocks/);
  assert.match(rule, /placeholder-quality place cards/);
});

test('shared surfaces default to dark graphite instead of off-white', () => {
  const surfaceFrame = read('../design/foundation/surface-frame.tsx');
  const card = read('../design/components/card.tsx');
  const hero = read('../design/patterns/hero.tsx');

  assert.match(surfaceFrame, /frame:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.match(surfaceFrame, /graphite:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(card, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.match(hero, /heroCardPanel:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.doesNotMatch(hero, /tone: 'lime' as PrimaryButtonTone, \.\.\.primary/);
});

test('routine nav and floating actions avoid full Acid Lime fill', () => {
  const tabButton = read('../design/components/tab-button.tsx');
  const fab = read('../design/components/floating-action-button.tsx');

  assert.doesNotMatch(tabButton, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.primary/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabButton, /tabButtonSelected:[\s\S]*borderBottomColor: theme\.color\.uiAccent/);
  assert.doesNotMatch(fab, /tone = 'lime'/);
  assert.match(fab, /tone = 'graphite'/);
});

test('navigation shell uses dark selected surfaces and avoids Lime capsules', () => {
  const bottomMenu = read('../navigation/BottomMenu.tsx');
  const tripTabBar = read('../navigation/TripTabBar.tsx');
  const selection = read('../navigation/tab-selection.ts');
  const appBar = read('../trip-ui/AppBar.tsx');
  const bottomSheet = read('../trip-ui/BottomSheet.tsx');
  const dayChips = read('../trip-ui/DayChips.tsx');
  const tripRootFab = read('../trip-ui/TripRootFab.tsx');

  assert.doesNotMatch(selection, /backgroundColor: theme\.color\.primary/);
  assert.match(selection, /backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(bottomMenu, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(bottomMenu, /borderTopColor: theme\.color\.borderDefault/);
  assert.match(tripTabBar, /backgroundColor: theme\.color\.shellElevated/);
  assert.match(tripTabBar, /borderTopColor: theme\.color\.borderDefault/);
  assert.match(appBar, /backgroundColor: theme\.color\.shell/);
  assert.match(appBar, /borderBottomColor: theme\.color\.borderDefault/);
  assert.match(bottomSheet, /sheet:[\s\S]*backgroundColor: theme\.color\.shellElevated/);
  assert.match(bottomSheet, /sheet:[\s\S]*borderColor: theme\.color\.borderDefault/);
  assert.match(dayChips, /FilterChip/);
  assert.match(dayChips, /legendDotSelected:[\s\S]*borderColor: theme\.color\.textStrong/);
  assert.doesNotMatch(tripRootFab, /tone="lime"/);
  assert.match(tripRootFab, /<Plus color=\{theme\.color\.uiAccent\}/);
});

test('root screens use Pure Dark Graphite shared surfaces without local off-white blocks', () => {
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
    assert.doesNotMatch(source, /offWhiteElevated|offWhiteSubtle|warmPaper/);
    assert.doesNotMatch(source, /backgroundColor: theme\.color\.primary/);
  }
});
