import { buildResponsiveLineHeight } from '../design/responsive-text';
import { theme } from '../design/theme';

export const DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT = 36;
export const DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS = 5;

export type ScheduleTimeWheelLayout = {
  contentPadding: number;
  itemHeight: number;
  optionLineHeight: number;
  viewportHeight: number;
  visibleItems: number;
};

export function buildScheduleTimeWheelLayout({ fontScale = 1 }: { fontScale?: number } = {}): ScheduleTimeWheelLayout {
  const optionLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.body,
    fontScale,
  });
  const itemHeight = Math.max(DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT, optionLineHeight + theme.space[3]);
  const visibleItems = DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS;
  const contentPadding = buildScheduleTimeWheelContentPadding({ itemHeight, visibleItems });

  return {
    contentPadding,
    itemHeight,
    optionLineHeight,
    viewportHeight: itemHeight * visibleItems,
    visibleItems,
  };
}

export function buildScheduleTimeWheelOffset({
  itemHeight = DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT,
  optionCount,
  selectedIndex,
  visibleItems = DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS,
}: {
  itemHeight?: number;
  optionCount: number;
  selectedIndex: number;
  visibleItems?: number;
}): number {
  const normalizedItemHeight = normalizeWheelMetric(itemHeight);
  const normalizedOptionCount = normalizeOptionCount(optionCount);

  if (normalizedOptionCount === 0) {
    return 0;
  }

  const safeSelectedIndex = clamp(Math.round(selectedIndex), 0, normalizedOptionCount - 1);
  const maxOffset = buildScheduleTimeWheelMaxOffset({
    itemHeight: normalizedItemHeight,
    optionCount: normalizedOptionCount,
    visibleItems,
  });

  return clamp(safeSelectedIndex * normalizedItemHeight, 0, maxOffset);
}

export function buildScheduleTimeWheelSelectedIndex({
  contentOffsetY,
  itemHeight = DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT,
  optionCount,
}: {
  contentOffsetY: number;
  itemHeight?: number;
  optionCount: number;
}): number {
  const normalizedOptionCount = normalizeOptionCount(optionCount);

  if (normalizedOptionCount === 0) {
    return 0;
  }

  const normalizedItemHeight = normalizeWheelMetric(itemHeight);
  const rawIndex = Math.round(contentOffsetY / normalizedItemHeight);

  return clamp(rawIndex, 0, normalizedOptionCount - 1);
}

export function buildScheduleTimeWheelContentPadding({
  itemHeight = DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT,
  visibleItems = DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS,
}: {
  itemHeight?: number;
  visibleItems?: number;
} = {}): number {
  const normalizedItemHeight = normalizeWheelMetric(itemHeight);
  const normalizedVisibleItems = normalizeVisibleItems(visibleItems);
  const centerRowOffset = Math.floor(normalizedVisibleItems / 2);

  return centerRowOffset * normalizedItemHeight;
}

function buildScheduleTimeWheelMaxOffset({
  itemHeight,
  optionCount,
  visibleItems,
}: {
  itemHeight: number;
  optionCount: number;
  visibleItems: number;
}): number {
  const normalizedVisibleItems = normalizeVisibleItems(visibleItems);
  const contentPadding = buildScheduleTimeWheelContentPadding({ itemHeight, visibleItems: normalizedVisibleItems });
  const contentHeight = contentPadding * 2 + optionCount * itemHeight;
  const viewportHeight = normalizedVisibleItems * itemHeight;

  return Math.max(0, contentHeight - viewportHeight);
}

function normalizeWheelMetric(value: number): number {
  return Math.max(1, Math.round(value));
}

function normalizeOptionCount(value: number): number {
  return Math.max(0, Math.round(value));
}

function normalizeVisibleItems(value: number): number {
  return Math.max(1, Math.round(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
