import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
const selectableCardSource = readOptionalMobileSource('../design/components/selectable-card.tsx');
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
  selectableCardSource,
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
  'SkeletonCard',
  'FilterChip',
  'ChoiceChip',
  'SelectableCard',
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
  'SelectableCardMode',
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
  assert.match(
    foundationInteractiveSource,
    /children\(\{ busy, disabled: isDisabled, pressed, selected: isSelected \}\)/,
  );
  assert.doesNotMatch(foundationInteractiveSource, /pressed: false/);

  assert.match(buttonSource, /export type PrimaryButtonTone = 'graphite' \| 'lime'/);
  assert.match(buttonSource, /tone = 'graphite'/);
  assert.match(buttonSource, /primaryButtonLime/);
  assert.match(buttonSource, /backgroundColor: theme\.color\.uiAccent/);
  assert.match(buttonSource, /color: theme\.color\.onUiAccent/);

  assert.match(heroSource, /variant = 'panel'/);
  assert.match(heroSource, /HeroActions/);
  assert.match(heroSource, /tone: 'graphite'/);
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
  assert.match(tabButtonSource, /backgroundColor: theme\.color\.surfaceSoft/);
  assert.match(tabButtonSource, /borderBottomColor: theme\.color\.uiAccent/);
  assert.match(tabButtonSource, /color: theme\.color\.textStrong/);

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

test('Issue 403 design public export surface matches the tracked snapshot', () => {
  assert.deepEqual(extractDesignPublicSurface(), readDesignPublicSurfaceSnapshot());
});

test('Issue 403 shared design layer files stay token-only and avoid decorative glyph drift', () => {
  const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba\(/;
  const decorativeGlyphPattern = /[✅⚠️❌🎉✨🔥👉⭐★☆◆◇●○■□▲▼→←↑↓]/u;

  for (const relativePath of listDesignSourceFiles()) {
    const source = readMobileSource(relativePath);

    if (relativePath !== '../design/theme.ts') {
      assert.doesNotMatch(source, rawColorPattern, `${relativePath} should use theme tokens instead of raw colors`);
    }

    assert.doesNotMatch(
      source,
      decorativeGlyphPattern,
      `${relativePath} should not introduce emoji or decorative unicode glyphs`,
    );
  }
});

test('Issue 403 contributor guidance documents shared primitive guardrails', () => {
  const guidanceSource = readRepoSource('docs/features/0403-shared-design-system-guard-guidance.md');
  const mobileUiRuleSource = readRepoSource('.harness/rules/code/mobile-ui.md');

  for (const expected of [
    'foundation',
    'components',
    'patterns',
    'InteractiveSurface',
    'accessibilityRole',
    'accessibilityState',
    'theme.layout.tapMin',
    'hitSlop',
    'Graphite',
    'Acid Lime',
  ]) {
    assert.match(guidanceSource, new RegExp(escapeRegExp(expected)), `guidance should mention ${expected}`);
  }

  assert.match(guidanceSource, /Graphite[\s\S]*(default|기본)[\s\S]*(primary|CTA|주요 액션)/i);
  assert.match(guidanceSource, /Acid Lime[\s\S]*(sparse|one|single|한 개|드물게|제한)/i);
  assert.match(guidanceSource, /foundation[\s\S]*components[\s\S]*patterns/i);
  assert.match(guidanceSource, /InteractiveSurface[\s\S]*theme\.layout\.tapMin[\s\S]*hitSlop/);

  assert.match(mobileUiRuleSource, /docs\/features\/0403-shared-design-system-guard-guidance\.md/);
  assert.match(mobileUiRuleSource, /Graphite[\s\S]*(default|기본)[\s\S]*(primary|CTA|주요 액션)/i);
  assert.match(mobileUiRuleSource, /Acid Lime[\s\S]*(sparse|one|single|한 개|드물게|제한)/i);
  assert.match(mobileUiRuleSource, /InteractiveSurface[\s\S]*(accessibility|touch|tap|hitSlop|터치)/i);
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
    'SelectableCard',
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
    'selectableCard',
  ]) {
    assertStyleContains(styleName, /minHeight: theme\.layout\.(tapMin|controlHSm|controlH|controlHLg)/);
  }
});

test('Issue 406 SelectableCard supports rich checked, expanded, and trailing selection semantics', () => {
  const body = functionBody('SelectableCard');

  assert.match(foundationAccessibilitySource, /checked/, 'shared accessibility state should support checked');
  assert.match(foundationInteractiveSource, /checked\?:/, 'InteractiveSurface should accept checked state');
  assert.match(body, /InteractiveSurface/, 'SelectableCard should use the shared interactive surface');
  assert.match(body, /accessibilityRole=\{selectableCardRole\(mode\)\}/);
  assert.match(body, /checked=\{isCheckedMode\(mode\) \? active : undefined\}/);
  assert.match(body, /expanded=\{expanded\}/);
  assert.match(body, /selected=\{!isCheckedMode\(mode\) \? selected : undefined\}/);
  assert.match(selectableCardSource, /title: ReactNode;/);
  assert.match(selectableCardSource, /description\?: ReactNode;/);
  assert.match(selectableCardSource, /meta\?: ReactNode;/);
  assert.match(selectableCardSource, /trailing\?: ReactNode;/);
  assert.match(selectableCardSource, /children\?: ReactNode;/);
  assert.match(selectableCardSource, /selectableCardSelected/);
  assert.doesNotMatch(selectableCardSource, /#[0-9a-fA-F]{3,8}\b/);
});

test('Issue 389 primitives keep Acid Lime vivid but sparse in shared UI', () => {
  assert.equal(theme.color.brandAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.offWhiteText);
  assert.equal(theme.color.uiAccent, theme.color.chit.acidLime);
  assert.equal(theme.color.uiAccentSoft, theme.color.chit.acidLimeSurface);
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
  assert.match(chipSource, /filterChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccentSoft/);
  assert.match(chipSource, /choiceChipSelectedAccent:[\s\S]*backgroundColor: theme\.color\.uiAccentSoft/);
  assert.match(chipSource, /filterChipTextSelected:[\s\S]*color: theme\.color\.textStrong/);
  assert.match(chipSource, /choiceChipTextSelected:[\s\S]*color: theme\.color\.textStrong/);

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
  assert.match(functionBody('SkeletonCard'), /accessibilityState=\{\{ busy: true \}\}/);
  assert.match(functionBody('SkeletonCard'), /skeletonRow/);
  assertStyleContains('statusCard', /backgroundColor: theme\.color\.surface/);
  assertStyleContains('statusCard', /borderColor: theme\.color\.borderDefault/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function readRepoSource(relativePath: string): string {
  return readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8');
}

function readDesignPublicSurfaceSnapshot(): DesignPublicSurfaceSnapshot {
  return JSON.parse(readFileSync(new URL('./design-public-surface.snapshot.json', import.meta.url), 'utf8'));
}

function extractDesignPublicSurface(): DesignPublicSurfaceSnapshot {
  const surface: DesignPublicSurfaceSnapshot = {
    typeExports: {},
    valueExports: {},
  };
  const exportBlockPattern = /export( type)? \{([\s\S]*?)\} from '(\.\/[\w/-]+)';/g;

  for (const match of indexSource.matchAll(exportBlockPattern)) {
    const [, typeMarker, namesBlock, sourcePath] = match;
    const target = typeMarker ? surface.typeExports : surface.valueExports;
    target[sourcePath] = namesBlock
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .sort();
  }

  return surface;
}

function listDesignSourceFiles(): string[] {
  return listSourceFiles(new URL('../design/', import.meta.url), '../design/').filter(
    (relativePath) => !relativePath.endsWith('.test.mts'),
  );
}

function listSourceFiles(directoryUrl: URL, relativeDirectory: string): string[] {
  return readdirSync(directoryUrl, { withFileTypes: true }).flatMap((entry) => {
    const childRelativePath = `${relativeDirectory}${entry.name}`;

    if (entry.isDirectory()) {
      return listSourceFiles(new URL(`${entry.name}/`, directoryUrl), `${childRelativePath}/`);
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      return [childRelativePath];
    }

    return [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type DesignPublicSurfaceSnapshot = {
  typeExports: Record<string, string[]>;
  valueExports: Record<string, string[]>;
};

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
