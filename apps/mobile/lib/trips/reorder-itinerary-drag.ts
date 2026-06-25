export type DayItineraryDragTargetInput = {
  startIndex: number;
  dragOffsetY: number;
  rowHeights: readonly (number | undefined)[];
  fallbackRowHeight: number;
};

export type DayItineraryDragAutoScrollInput = {
  pointerY: number;
  viewportHeight: number;
  contentHeight: number;
  currentOffsetY: number;
  edgeSize?: number;
  maxStep?: number;
};

const DEFAULT_EDGE_SIZE = 72;
const DEFAULT_MAX_STEP = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveRowHeight(
  rowHeights: readonly (number | undefined)[],
  index: number,
  fallbackRowHeight: number,
): number {
  const height = rowHeights[index];
  if (height && Number.isFinite(height) && height > 0) {
    return height;
  }

  if (Number.isFinite(fallbackRowHeight) && fallbackRowHeight > 0) {
    return fallbackRowHeight;
  }

  return 1;
}

export function resolveDayItineraryDragTargetIndex({
  startIndex,
  dragOffsetY,
  rowHeights,
  fallbackRowHeight,
}: DayItineraryDragTargetInput): number {
  if (rowHeights.length === 0) {
    return 0;
  }

  const normalizedStartIndex = clamp(startIndex, 0, rowHeights.length - 1);
  let targetIndex = normalizedStartIndex;

  if (dragOffsetY > 0) {
    let consumedHeight = 0;
    for (let index = normalizedStartIndex + 1; index < rowHeights.length; index += 1) {
      const rowHeight = resolveRowHeight(rowHeights, index, fallbackRowHeight);
      consumedHeight += rowHeight;
      if (dragOffsetY >= consumedHeight - rowHeight / 2) {
        targetIndex = index;
      }
    }
  }

  if (dragOffsetY < 0) {
    let consumedHeight = 0;
    for (let index = normalizedStartIndex - 1; index >= 0; index -= 1) {
      const rowHeight = resolveRowHeight(rowHeights, index, fallbackRowHeight);
      consumedHeight += rowHeight;
      if (-dragOffsetY >= consumedHeight - rowHeight / 2) {
        targetIndex = index;
      }
    }
  }

  return targetIndex;
}

export function resolveDayItineraryDragAutoScrollOffset({
  pointerY,
  viewportHeight,
  contentHeight,
  currentOffsetY,
  edgeSize = DEFAULT_EDGE_SIZE,
  maxStep = DEFAULT_MAX_STEP,
}: DayItineraryDragAutoScrollInput): number | null {
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) {
    return null;
  }

  const maxOffsetY = Math.max(0, contentHeight - viewportHeight);
  const normalizedOffsetY = clamp(currentOffsetY, 0, maxOffsetY);
  const normalizedEdgeSize = Math.max(1, edgeSize);
  const normalizedMaxStep = Math.max(1, maxStep);
  const distanceToTop = pointerY;
  const distanceToBottom = viewportHeight - pointerY;

  let direction: -1 | 1 | null = null;
  let edgeDistance = 0;
  if (distanceToTop < normalizedEdgeSize) {
    direction = -1;
    edgeDistance = distanceToTop;
  } else if (distanceToBottom < normalizedEdgeSize) {
    direction = 1;
    edgeDistance = distanceToBottom;
  }

  if (!direction) {
    return null;
  }

  const intensity = clamp((normalizedEdgeSize - edgeDistance) / normalizedEdgeSize, 0, 1);
  if (intensity <= 0) {
    return null;
  }

  const step = Math.max(1, Math.ceil(normalizedMaxStep * intensity));
  const nextOffsetY = clamp(normalizedOffsetY + direction * step, 0, maxOffsetY);

  return nextOffsetY === normalizedOffsetY ? null : nextOffsetY;
}
