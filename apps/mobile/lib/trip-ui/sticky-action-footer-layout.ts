import { theme } from '../design/theme';

export const STICKY_ACTION_FOOTER_ACTION_HEIGHT = theme.layout.controlH;
export const STICKY_ACTION_FOOTER_ACTION_GAP = theme.space[3];
export const STICKY_ACTION_FOOTER_MIN_BOTTOM_PADDING = theme.space[3];
export const STICKY_ACTION_FOOTER_MIN_CLEARANCE = theme.space[5];
export const STICKY_ACTION_FOOTER_TOP_PADDING = theme.space[4];

export type StickyActionFooterLayoutInput = {
  actionCount?: number;
  actionGap?: number;
  actionHeight?: number;
  bottomSafeArea?: number;
  minBottomPadding?: number;
  minClearance?: number;
  paddingTop?: number;
};

export type StickyActionFooterLayout = {
  footerActionCount: number;
  footerActionGap: number;
  footerActionHeight: number;
  footerPaddingBottom: number;
  footerPaddingTop: number;
  footerReservedHeight: number;
  keyboardFixedBottomOffset: number;
  keyboardMinClearance: number;
  scrollPaddingBottom: number;
};

export function buildStickyActionFooterLayout({
  actionCount = 1,
  actionGap = STICKY_ACTION_FOOTER_ACTION_GAP,
  actionHeight = STICKY_ACTION_FOOTER_ACTION_HEIGHT,
  bottomSafeArea = 0,
  minBottomPadding = STICKY_ACTION_FOOTER_MIN_BOTTOM_PADDING,
  minClearance = STICKY_ACTION_FOOTER_MIN_CLEARANCE,
  paddingTop = STICKY_ACTION_FOOTER_TOP_PADDING,
}: StickyActionFooterLayoutInput = {}): StickyActionFooterLayout {
  const safeBottom = clampNonNegative(bottomSafeArea);
  const normalizedActionCount = normalizeActionCount(actionCount);
  const normalizedActionHeight = positiveOrDefault(actionHeight, STICKY_ACTION_FOOTER_ACTION_HEIGHT);
  const normalizedActionGap = clampNonNegative(actionGap);
  const normalizedPaddingTop = clampNonNegative(paddingTop);
  const normalizedMinBottomPadding = clampNonNegative(minBottomPadding);
  const normalizedMinClearance = positiveOrDefault(minClearance, STICKY_ACTION_FOOTER_MIN_CLEARANCE);
  const footerPaddingBottom = Math.max(safeBottom, normalizedMinBottomPadding);
  const footerActionsHeight =
    normalizedActionCount * normalizedActionHeight + (normalizedActionCount - 1) * normalizedActionGap;
  const footerReservedHeight = normalizedPaddingTop + footerActionsHeight + footerPaddingBottom;
  const keyboardFixedBottomOffset = Math.max(0, footerReservedHeight - safeBottom);

  return {
    footerActionCount: normalizedActionCount,
    footerActionGap: normalizedActionGap,
    footerActionHeight: normalizedActionHeight,
    footerPaddingBottom,
    footerPaddingTop: normalizedPaddingTop,
    footerReservedHeight,
    keyboardFixedBottomOffset,
    keyboardMinClearance: normalizedMinClearance,
    scrollPaddingBottom: footerReservedHeight + normalizedMinClearance,
  };
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeActionCount(value: number): number {
  return Number.isFinite(value) && value > 1 ? Math.ceil(value) : 1;
}

function positiveOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
