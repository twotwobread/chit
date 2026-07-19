import { defaultScheduleTimeFromDate, parseScheduleTimePickerValue } from '../places/place-schedule-detail';
import { formatScheduleMinutes, parseScheduleTimeToMinutes } from './schedule-item-ordering';

export type ScheduleTimeEditorValues = {
  startTime: string;
  endTime: string;
};

export type ScheduleTimeEditorSummary = {
  startLabel: string;
  endLabel: string;
  summaryLabel: string;
  hasStartTime: boolean;
  hasEndTime: boolean;
};

export function addScheduleStartTime<T extends ScheduleTimeEditorValues>(
  values: T,
  defaultSource: Date | string = new Date(),
): T {
  const defaultStartTime =
    typeof defaultSource === 'string' && parseScheduleTimeToMinutes(defaultSource) !== null
      ? defaultSource
      : defaultScheduleTimeFromDate(defaultSource instanceof Date ? defaultSource : new Date());
  return { ...values, startTime: defaultStartTime };
}

export function addScheduleEndTime<T extends ScheduleTimeEditorValues>(values: T): T {
  return parseScheduleTimeToMinutes(values.startTime) === null ? values : { ...values, endTime: values.startTime };
}

export function addScheduleEndTimeDuration<T extends ScheduleTimeEditorValues>(values: T, durationMinutes: number): T {
  const startMinutes = parseScheduleTimeToMinutes(values.startTime);
  const endMinutes = parseScheduleTimeToMinutes(values.endTime);
  const baseMinutes =
    startMinutes === null || endMinutes === null || endMinutes <= startMinutes ? startMinutes : endMinutes;
  if (startMinutes === null || baseMinutes === null || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return values;
  }

  const nextEndTime = formatScheduleMinutes(baseMinutes + durationMinutes);
  const nextEndMinutes = parseScheduleTimeToMinutes(nextEndTime);
  return nextEndTime && nextEndMinutes !== null && nextEndMinutes > startMinutes
    ? { ...values, endTime: nextEndTime }
    : values;
}

export function clearScheduleTimes<T extends ScheduleTimeEditorValues>(values: T): T {
  return { ...values, startTime: '', endTime: '' };
}

export function buildScheduleTimeEditorSummary(values: ScheduleTimeEditorValues): ScheduleTimeEditorSummary {
  const startTime = values.startTime.trim();
  const endTime = values.endTime.trim();
  const startLabel = startTime ? formatScheduleTimeLabel(startTime) : '--:--';
  const endLabel = endTime ? formatScheduleTimeLabel(endTime) : '--:--';
  const hasStartTime = startTime.length > 0;
  const hasEndTime = endTime.length > 0;

  return {
    startLabel,
    endLabel,
    summaryLabel: `${startLabel} → ${endLabel}`,
    hasStartTime,
    hasEndTime,
  };
}

function formatScheduleTimeLabel(timeText: string): string {
  const value = parseScheduleTimePickerValue(timeText);
  return `${value.hour}:${value.minute}`;
}
