import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

const componentsSource = readMobileSource('../design/components.tsx');
const indexSource = readMobileSource('../design/index.ts');

const primitiveExports = [
  'IconButton',
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
  'TextLinkTone',
  'InlineActionTone',
  'ActionRowTone',
  'FormFieldTone',
  'StateAction',
  'FilterChipTone',
  'ChoiceChipTone',
];

test('Issue 389 shared design primitives are exported from the foundation surface', () => {
  for (const exportName of primitiveExports) {
    assert.match(
      componentsSource,
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
    assert.match(componentsSource, new RegExp(`export type ${exportName}\\b`), `${exportName} type should be public`);
    assert.match(
      indexSource,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} type should be re-exported from design index`,
    );
  }
});

test('Issue 389 shared component code stays token-only and avoids emoji-style decorative glyphs', () => {
  assert.doesNotMatch(
    componentsSource,
    /#[0-9a-fA-F]{3,8}\b/,
    'components should use Chit theme tokens, not raw hex colors',
  );
  assert.doesNotMatch(
    componentsSource,
    /[✅⚠️❌🎉✨🔥👉]/u,
    'shared status/action primitives should not use emoji or decorative unicode as UI icons',
  );
});

test('Issue 389 interactive primitives encode accessibility roles, states, touch targets, and pressed feedback', () => {
  assert.ok(theme.layout.tapMin >= 44, `tap target floor must remain at least 44pt, got ${theme.layout.tapMin}`);

  assert.match(componentsSource, /const ICON_BUTTON_HIT_SLOP = theme\.space\[3\]/);
  assert.match(componentsSource, /accessibilityLabel: string;/, 'IconButton should require an accessibility label');
  assert.match(componentsSource, /accessibilityHint\?: string;/, 'IconButton should allow an accessibility hint');
  assert.match(componentsSource, /hitSlop=\{ICON_BUTTON_HIT_SLOP\}/, 'IconButton should expand icon-only hit area');

  for (const functionName of [
    'PrimaryButton',
    'SecondaryButton',
    'IconButton',
    'TextLink',
    'InlineAction',
    'ActionRow',
    'FilterChip',
    'ChoiceChip',
  ]) {
    const body = functionBody(functionName);
    assert.match(body, /accessibilityRole=/, `${functionName} should set an accessibility role`);
    assert.match(body, /accessibilityState=/, `${functionName} should expose accessibility state`);
    assert.match(body, /pressed/, `${functionName} should react to Pressable pressed state`);
  }

  for (const styleName of ['iconButton', 'textLinkHitArea', 'inlineAction', 'actionRow', 'choiceChip', 'filterChip']) {
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

  assert.match(componentsSource, /brandStampOffset:[\s\S]*backgroundColor: theme\.color\.brandAccent/);
  assert.match(componentsSource, /brandStampText:[\s\S]*color: theme\.color\.brandAccent/);
  assert.match(functionBody('PrimaryButton'), /ActivityIndicator color=\{theme\.color\.onActionPrimary\}/);
  assert.match(componentsSource, /primaryButton:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(componentsSource, /primaryButtonPressed:[\s\S]*backgroundColor: theme\.color\.actionPrimaryPressed/);
  assert.match(componentsSource, /primaryButtonText:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.match(componentsSource, /inlineActionPrimary:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(componentsSource, /inlineActionTextPrimary:[\s\S]*color: theme\.color\.onActionPrimary/);
  assert.match(componentsSource, /filterChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccent/);
  assert.match(componentsSource, /choiceChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccent/);
  assert.match(componentsSource, /filterChipTextSelected:[\s\S]*color: theme\.color\.onUiAccent/);
  assert.match(componentsSource, /choiceChipTextSelected:[\s\S]*color: theme\.color\.onUiAccent/);

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

  assert.match(
    componentsSource,
    /function StatusStateCard\b/,
    'status primitives should share one visual card pattern',
  );
  assertStyleContains('statusCard', /backgroundColor: theme\.color\.surface/);
  assertStyleContains('statusCard', /borderColor: theme\.color\.borderDefault/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function functionBody(functionName: string): string {
  const startMarker = `export function ${functionName}(`;
  const start = componentsSource.indexOf(startMarker);

  assert.notEqual(start, -1, `${functionName} function should exist`);

  const rest = componentsSource.slice(start + startMarker.length);
  const nextFunction = rest.search(
    /\nexport function |\nfunction StatusStateCard\b|\nfunction buildAccessibilityState\b|\nconst styles =/,
  );
  const end = nextFunction === -1 ? componentsSource.length : start + startMarker.length + nextFunction;

  return componentsSource.slice(start, end);
}

function assertStyleContains(styleName: string, expected: RegExp): void {
  const stylePattern = new RegExp(`${styleName}: \\{[\\s\\S]*?\\n  \\},`);
  const match = componentsSource.match(stylePattern);

  assert.ok(match, `${styleName} style should exist`);
  assert.match(match[0], expected);
}
