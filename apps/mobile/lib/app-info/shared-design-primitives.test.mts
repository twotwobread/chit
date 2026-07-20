import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

const componentsSource = readMobileSource('../design/components.tsx');
const primitivesSource = readMobileSource('../design/primitives.tsx');
const indexSource = readMobileSource('../design/index.ts');
const foundationInteractiveSource = readMobileSource('../design/foundation/interactive-surface.tsx');
const foundationAccessibilitySource = readMobileSource('../design/foundation/accessibility.ts');
const cardSource = readMobileSource('../design/components/card.tsx');
const buttonSource = readMobileSource('../design/components/button.tsx');
const iconButtonSource = readMobileSource('../design/components/icon-button.tsx');
const tabButtonSource = readOptionalMobileSource('../design/components/tab-button.tsx');
const floatingActionButtonSource = readOptionalMobileSource('../design/components/floating-action-button.tsx');
const linkSource = readMobileSource('../design/components/link.tsx');
const rowSource = readMobileSource('../design/components/row.tsx');
const chipSource = readMobileSource('../design/components/chip.tsx');
const formFieldSource = readMobileSource('../design/patterns/form-field.tsx');
const stateCardSource = readMobileSource('../design/patterns/state-card.tsx');
const heroSource = readMobileSource('../design/patterns/hero.tsx');

const sharedImplementationSource = [
  componentsSource,
  primitivesSource,
  cardSource,
  buttonSource,
  iconButtonSource,
  tabButtonSource,
  floatingActionButtonSource,
  linkSource,
  rowSource,
  chipSource,
  formFieldSource,
  stateCardSource,
  heroSource,
].join('\n');

const primitiveExports = [
  'IconButton',
  'TabButton',
  'FloatingActionButton',
  'TextLink',
  'InlineAction',
  'ActionRow',
  'FormField',
  'EmptyState',
  'ErrorState',
  'LoadingState',
  'FilterChip',
  'ChoiceChip',
];

const primitiveTypeExports = [
  'IconButtonVariant',
  'TabButtonIconRenderer',
  'FloatingActionButtonTone',
  'TextLinkTone',
  'InlineActionTone',
  'ActionRowTone',
  'FormFieldTone',
  'StateAction',
  'FilterChipTone',
  'ChoiceChipTone',
];

const heroExports = ['HeroCard', 'HeroHeader', 'HeroMetricPanel', 'HeroActions'];
const heroTypeExports = ['HeroCardVariant', 'HeroAction', 'HeroMetricPanelTone'];

test('Issue 389 shared design primitives are exported from the foundation surface', () => {
  for (const exportName of primitiveExports) {
    assert.match(
      sharedImplementationSource,
      new RegExp(`export function ${exportName}\\b`),
      `${exportName} should be implemented`,
    );
    assert.match(
      indexSource,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} should be re-exported from design index`,
    );
  }

  for (const exportName of primitiveTypeExports) {
    assert.match(
      sharedImplementationSource,
      new RegExp(`export type ${exportName}\\b`),
      `${exportName} type should be public`,
    );
    assert.match(
      indexSource,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} type should be re-exported from design index`,
    );
  }
});

test('Issue 395 shared design layer exposes foundation-backed Hero primitives', () => {
  for (const exportName of heroExports) {
    assert.match(heroSource, new RegExp(`export function ${exportName}\\b`), `${exportName} should be implemented`);
    assert.match(
      indexSource,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} should be re-exported from design index`,
    );
  }

  for (const exportName of heroTypeExports) {
    assert.match(heroSource, new RegExp(`export type ${exportName}\\b`), `${exportName} type should be public`);
    assert.match(
      indexSource,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} type should be re-exported from design index`,
    );
  }

  assert.match(foundationAccessibilitySource, /export function buildAccessibilityState/);
  assert.match(foundationInteractiveSource, /export function InteractiveSurface/);
  assert.match(foundationInteractiveSource, /accessibilityState=\{buildAccessibilityState/);
  assert.match(foundationInteractiveSource, /minHeight: minHeight \?\? theme\.layout\.tapMin/);
  assert.match(foundationInteractiveSource, /Pressable/);
  assert.match(foundationInteractiveSource, /children\(\{ busy, disabled: isDisabled, pressed, selected \}\)/);
  assert.doesNotMatch(foundationInteractiveSource, /pressed: false/);

  assert.match(buttonSource, /export type PrimaryButtonTone = 'graphite' \| 'lime'/);
  assert.match(buttonSource, /tone = 'graphite'/);
  assert.match(buttonSource, /primaryButtonLime/);
  assert.match(buttonSource, /backgroundColor: theme\.color\.uiAccent/);
  assert.match(buttonSource, /color: theme\.color\.onUiAccent/);

  assert.match(heroSource, /variant = 'panel'/);
  assert.match(heroSource, /HeroActions/);
  assert.match(heroSource, /tone: 'lime'/);
  assert.match(heroSource, /theme\.color\.actionPrimary/);
  assert.doesNotMatch(heroSource, /#[0-9a-fA-F]{3,8}\b/);
});

test('Issue 399 navigation chrome primitives are exported and foundation-backed', () => {
  assert.match(tabButtonSource, /export type TabButtonIconRenderer\b/);
  assert.match(tabButtonSource, /export function TabButton\b/);
  assert.match(tabButtonSource, /InteractiveSurface/);
  assert.match(tabButtonSource, /accessibilityRole=\{accessibilityRole\}/);
  assert.match(tabButtonSource, /selected=\{selected\}/);
  assert.match(tabButtonSource, /hitSlop=\{TAB_BUTTON_HIT_SLOP\}/);
  assert.match(tabButtonSource, /minHeight=\{theme\.layout\.tapMin\}/);
  assert.match(tabButtonSource, /backgroundColor: theme\.color\.primary/);
  assert.match(tabButtonSource, /color: theme\.color\.onPrimary/);

  assert.match(floatingActionButtonSource, /export type FloatingActionButtonTone = 'lime' \| 'graphite'/);
  assert.match(floatingActionButtonSource, /export function FloatingActionButton\b/);
  assert.match(floatingActionButtonSource, /InteractiveSurface/);
  assert.match(floatingActionButtonSource, /hitSlop=\{FAB_HIT_SLOP\}/);
  assert.match(floatingActionButtonSource, /minHeight=\{theme\.layout\.controlHLg\}/);
  assert.match(floatingActionButtonSource, /minWidth=\{theme\.layout\.controlHLg\}/);
  assert.match(floatingActionButtonSource, /backgroundColor: theme\.color\.uiAccent/);
  assert.match(floatingActionButtonSource, /backgroundColor: theme\.color\.actionPrimary/);
  assert.match(floatingActionButtonSource, /pressed/);
});

test('Issue 389 shared component code stays token-only and avoids emoji-style decorative glyphs', () => {
  assert.doesNotMatch(
    sharedImplementationSource,
    /#[0-9a-fA-F]{3,8}\b/,
    'components should use Chit theme tokens, not raw hex colors',
  );
  assert.doesNotMatch(
    sharedImplementationSource,
    /[✅⚠️❌🎉✨🔥👉]/u,
    'shared status/action primitives should not use emoji or decorative unicode as UI icons',
  );
});

test('Issue 389 interactive primitives encode accessibility roles, states, touch targets, and pressed feedback', () => {
  assert.ok(theme.layout.tapMin >= 44, `tap target floor must remain at least 44pt, got ${theme.layout.tapMin}`);

  assert.match(iconButtonSource, /const ICON_BUTTON_HIT_SLOP = theme\.space\[3\]/);
  assert.match(iconButtonSource, /accessibilityLabel: string;/, 'IconButton should require an accessibility label');
  assert.match(iconButtonSource, /accessibilityHint\?: string;/, 'IconButton should allow an accessibility hint');
  assert.match(iconButtonSource, /hitSlop=\{ICON_BUTTON_HIT_SLOP\}/, 'IconButton should expand icon-only hit area');

  for (const functionName of [
    'PrimaryButton',
    'SecondaryButton',
    'IconButton',
    'TabButton',
    'FloatingActionButton',
    'TextLink',
    'InlineAction',
    'ActionRow',
    'FilterChip',
    'ChoiceChip',
  ]) {
    const body = functionBody(functionName);
    assert.match(body, /accessibilityRole=/, `${functionName} should set an accessibility role`);
    assert.match(body, /InteractiveSurface/, `${functionName} should use the shared interactive primitive`);
    assert.match(body, /pressed/, `${functionName} should react to Pressable pressed state`);
  }

  for (const styleName of [
    'iconButton',
    'tabButton',
    'floatingActionButton',
    'textLinkHitArea',
    'inlineAction',
    'actionRow',
    'choiceChip',
    'filterChip',
  ]) {
    assertStyleContains(styleName, /minHeight: theme\.layout\.(tapMin|controlHSm|controlH|controlHLg)/);
  }
});

test('Issue 389 primitives keep Acid Lime vivid but sparse in shared UI', () => {
  assert.equal(theme.color.brandAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphite);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.surface);
  assert.equal(theme.color.uiAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.uiAccentSoft, theme.color.chit.acidLimeSofter);
  assert.equal(theme.color.onUiAccent, theme.color.chit.charcoal);
  assert.notEqual(theme.color.actionPrimary, theme.color.brandAccent);

  assert.match(cardSource, /brandStampOffset:[\s\S]*backgroundColor: theme\.color\.brandAccent/);
  assert.match(cardSource, /brandStampText:[\s\S]*color: theme\.color\.brandAccent/);
  assert.match(buttonSource, /ActivityIndicator color=\{spinnerColor\}/);
  assert.match(buttonSource, /primaryButtonGraphite:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(buttonSource, /primaryButtonPressed:[\s\S]*backgroundColor: theme\.color\.actionPrimaryPressed/);
  assert.match(buttonSource, /primaryButtonText:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.match(linkSource, /inlineActionPrimary:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(linkSource, /inlineActionTextPrimary:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.match(chipSource, /filterChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccent/);
  assert.match(chipSource, /choiceChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccent/);
  assert.match(chipSource, /filterChipTextSelected:[\s\S]*color: theme\.color\.onUiAccent/);
  assert.match(chipSource, /choiceChipTextSelected:[\s\S]*color: theme\.color\.onUiAccent/);

  const loadingState = functionBody('LoadingState');
  assert.doesNotMatch(
    loadingState,
    /ActivityIndicator color=\{theme\.color\.(primary|brandAccent|uiAccent)\}/,
    'neutral loading spinners on Off-white should not use Acid Lime foreground',
  );
  assert.match(loadingState, /ActivityIndicator color=\{theme\.color\.textStrong\}/);
});

test('Issue 389 form and status primitives provide visible recovery structure without owning screen state', () => {
  const formField = functionBody('FormField');
  assert.match(formField, /label: string;/);
  assert.match(formField, /helperText\?: string;/);
  assert.match(formField, /errorText\?: string;/);
  assert.match(formField, /required\?: boolean;/);
  assert.match(formField, /accessibilityLiveRegion="polite"/);

  for (const functionName of ['EmptyState', 'ErrorState', 'LoadingState']) {
    const body = functionBody(functionName);
    assert.match(body, /title:\s*string/, `${functionName} should require a title`);
    assert.match(body, /body\?:\s*string/, `${functionName} should support explanatory body copy`);
    assert.match(body, /action\?:\s*StateAction/, `${functionName} should support one recovery action slot`);
  }

  assert.match(stateCardSource, /function StatusStateCard\b/, 'status primitives should share one visual card pattern');
  assertStyleContains('statusCard', /backgroundColor: theme\.color\.surface/);
  assertStyleContains('statusCard', /borderColor: theme\.color\.borderDefault/);
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

function functionBody(functionName: string): string {
  const startMarker = `export function ${functionName}(`;
  const start = sharedImplementationSource.indexOf(startMarker);

  assert.notEqual(start, -1, `${functionName} function should exist`);

  const rest = sharedImplementationSource.slice(start + startMarker.length);
  const nextFunction = rest.search(/\nexport function |\nfunction StatusStateCard\b|\nconst styles =/);
  const end = nextFunction === -1 ? sharedImplementationSource.length : start + startMarker.length + nextFunction;

  return sharedImplementationSource.slice(start, end);
}

function assertStyleContains(styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = sharedImplementationSource.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
