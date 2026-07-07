import { defaultEndScheduleTimeFromStart, defaultScheduleTimeFromDate } from '../places/place-schedule-detail';

export type ScheduleTimeEditorValues = {
  startTime: string;
  endTime: string;
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
