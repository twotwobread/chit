import { theme } from './theme';

export const COMPACT_WIDTH = 320;
export const NARROW_WIDTH = 360;
export const REGULAR_WIDTH = 390;
export const LARGER_FONT_SCALE = 1.3;
export const STRESS_FONT_SCALE = 1.5;
export const MIN_TOUCH_TARGET = theme.layout.tapMin;

export const APP_BUNDLED_FONT_FAMILIES = {
  regular: theme.font.family.regular,
  semibold: theme.font.family.semibold,
  bold: theme.font.family.bold,
} as const;

export type ResponsiveTextProfileName =
  | 'compact'
  | 'compactLargerText'
  | 'compactStress'
  | 'narrowLargerText'
  | 'regular';

export type ResponsiveTextProfile = {
  name: ResponsiveTextProfileName;
  width: number;
  fontScale: number;
  isCompactWidth: boolean;
  isNarrowWidth: boolean;
  isRegularWidth: boolean;
  isLargerFontScale: boolean;
  isStressFontScale: boolean;
  prefersCompactDensity: boolean;
  prefersStackedContent: boolean;
};

export type ResponsiveTextProfileInput = {
  width?: number;
  fontScale?: number;
};

export type ResponsiveTextMetricInput = {
  fontSize: number;
  fontScale?: number;
  leading?: number;
};

export type ResponsiveControlMetricInput = ResponsiveTextMetricInput & {
  minHeight?: number;
  verticalPadding?: number;
};

export type ResponsiveTextLayout = {
  allowsTruncation: boolean;
  ellipsizeMode?: 'tail';
  lineHeight: number;
  minHeight: number;
  numberOfLines?: number;
  requiresAccessibilityLabel: boolean;
};

export type CriticalTextLayoutInput = ResponsiveControlMetricInput;
export type NonCriticalTextLayoutInput = ResponsiveTextMetricInput & {
  maxLines?: number;
  verticalPadding?: number;
};

export function buildResponsiveTextProfile({
  fontScale = 1,
  width = REGULAR_WIDTH,
}: ResponsiveTextProfileInput = {}): ResponsiveTextProfile {
  const normalizedWidth = normalizeWidth(width);
  const normalizedFontScale = normalizeFontScale(fontScale);
  const isCompactWidth = normalizedWidth <= COMPACT_WIDTH;
  const isNarrowWidth = normalizedWidth <= NARROW_WIDTH;
  const isRegularWidth = normalizedWidth >= REGULAR_WIDTH;
  const isLargerFontScale = normalizedFontScale >= LARGER_FONT_SCALE;
  const isStressFontScale = normalizedFontScale >= STRESS_FONT_SCALE;

  let name: ResponsiveTextProfileName = 'regular';
  if (isCompactWidth && isStressFontScale) {
    name = 'compactStress';
  } else if (isCompactWidth && isLargerFontScale) {
    name = 'compactLargerText';
  } else if (isCompactWidth) {
    name = 'compact';
  } else if (isNarrowWidth && isLargerFontScale) {
    name = 'narrowLargerText';
  }

  return {
    name,
    width: normalizedWidth,
    fontScale: normalizedFontScale,
    isCompactWidth,
    isNarrowWidth,
    isRegularWidth,
    isLargerFontScale,
    isStressFontScale,
    prefersCompactDensity: isNarrowWidth || isLargerFontScale,
    prefersStackedContent: isNarrowWidth || isLargerFontScale,
  };
}

export function buildResponsiveLineHeight({
  fontScale = 1,
  fontSize,
  leading = theme.font.leading.snug,
}: ResponsiveTextMetricInput): number {
  return Math.ceil(normalizeMetric(fontSize) * leading * normalizeFontScale(fontScale));
}

export function buildResponsiveControlMinHeight({
  fontScale = 1,
  fontSize,
  leading = theme.font.leading.snug,
  minHeight = MIN_TOUCH_TARGET,
  verticalPadding = theme.space[3],
}: ResponsiveControlMetricInput): number {
  return Math.max(
    normalizeMetric(minHeight),
    buildResponsiveLineHeight({ fontSize, fontScale, leading }) + normalizeMetric(verticalPadding) * 2,
  );
}

export function buildCriticalTextLayout({
  fontScale = 1,
  fontSize,
  leading = theme.font.leading.snug,
  minHeight = MIN_TOUCH_TARGET,
  verticalPadding = theme.space[3],
}: CriticalTextLayoutInput): ResponsiveTextLayout {
  const lineHeight = buildResponsiveLineHeight({ fontSize, fontScale, leading });
  return {
    allowsTruncation: false,
    lineHeight,
    minHeight: Math.max(normalizeMetric(minHeight), lineHeight + normalizeMetric(verticalPadding) * 2),
    requiresAccessibilityLabel: false,
  };
}

export function buildNonCriticalTextLayout({
  fontScale = 1,
  fontSize,
  leading = theme.font.leading.snug,
  maxLines = 1,
  verticalPadding = 0,
}: NonCriticalTextLayoutInput): ResponsiveTextLayout {
  const lineHeight = buildResponsiveLineHeight({ fontSize, fontScale, leading });
  const safeMaxLines = Math.max(1, Math.round(maxLines));
  return {
    allowsTruncation: true,
    ellipsizeMode: 'tail',
    lineHeight,
    minHeight: lineHeight * safeMaxLines + normalizeMetric(verticalPadding) * 2,
    numberOfLines: safeMaxLines,
    requiresAccessibilityLabel: true,
  };
}

function normalizeWidth(value: number): number {
  return Math.max(1, Math.round(value));
}

function normalizeFontScale(value: number): number {
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

function normalizeMetric(value: number): number {
  return Math.max(0, Math.round(value));
}
