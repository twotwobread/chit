export type ScheduleDisplayOrderItem = {
  id?: string;
  itemOrder: number;
  startTime?: string | null;
  endTime?: string | null;
};

const scheduleTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function orderScheduleItemsByDisplayTime<T extends ScheduleDisplayOrderItem>(items: T[]): T[] {
  const baseOrdered = items
    .map((item, index) => ({ item, index, startMinutes: parseScheduleTimeToMinutes(item.startTime) }))
    .sort((left, right) => {
      const orderDiff = left.item.itemOrder - right.item.itemOrder;
      return orderDiff !== 0 ? orderDiff : left.index - right.index;
    });
  const timedOrdered = baseOrdered
    .filter((candidate) => candidate.startMinutes !== null)
    .sort((left, right) => {
      const timeDiff = (left.startMinutes ?? 0) - (right.startMinutes ?? 0);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      const orderDiff = left.item.itemOrder - right.item.itemOrder;
      return orderDiff !== 0 ? orderDiff : left.index - right.index;
    });

  let timedIndex = 0;
  return baseOrdered.map((candidate) => {
    if (candidate.startMinutes === null) {
      return candidate.item;
    }
    const timedCandidate = timedOrdered[timedIndex];
    timedIndex += 1;
    return timedCandidate?.item ?? candidate.item;
  });
}

export function resolvePreviousTimedEndTimeDefault<T extends ScheduleDisplayOrderItem>(
  items: T[],
  targetItemId?: string,
): string | null {
  const orderedItems = orderScheduleItemsByDisplayTime(items);
  const targetIndex = targetItemId ? orderedItems.findIndex((item) => item.id === targetItemId) : orderedItems.length;
  if (targetIndex === -1) {
    return null;
  }

  const targetItem = targetItemId ? orderedItems[targetIndex] : null;
  if (targetItem && parseScheduleTimeToMinutes(targetItem.startTime) !== null) {
    return null;
  }

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const candidate = orderedItems[index];
    if (parseScheduleTimeToMinutes(candidate?.startTime) === null) {
      continue;
    }
    if (parseScheduleTimeToMinutes(candidate?.endTime) !== null) {
      return candidate.endTime ?? null;
    }
  }

  return null;
}

export function parseScheduleTimeToMinutes(value?: string | null): number | null {
  if (!value || !scheduleTimePattern.test(value)) {
    return null;
  }
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
}

export function formatScheduleMinutes(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 23 * 60 + 59) {
    return null;
  }
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
