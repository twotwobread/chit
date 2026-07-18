import {
  defaultEndScheduleTimeFromStart,
  defaultScheduleTimeFromDate,
  parseScheduleTimePickerValue,
} from '../places/place-schedule-detail';

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

export function addScheduleStartTime<T extends ScheduleTimeEditorValues>(values: T, date = new Date()): T {
  return { ...values, startTime: defaultScheduleTimeFromDate(date) };
}

export function addScheduleEndTime<T extends ScheduleTimeEditorValues>(values: T): T {
  const endTime = defaultEndScheduleTimeFromStart(values.startTime);
  return endTime ? { ...values, endTime } : values;
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
