import { dateFromString, formatLocalDate, isValidDate } from './date';

export type TripDateRangeCalendarValues = {
  startDate: string;
  endDate: string;
};

export type TripDateRangeCalendarNextSelection = 'startDate' | 'endDate';

export type TripDateRangeCalendarState = {
  endLabel: string;
  helperText: string;
  nextSelection: TripDateRangeCalendarNextSelection;
  startLabel: string;
};

export type TripDateRangeMarkedDate = {
  color: string;
  endingDay?: boolean;
  startingDay?: boolean;
  textColor: string;
};

export type TripDateRangeMarkedDateColors = {
  rangeColor?: string;
  rangeTextColor?: string;
};

const defaultRangeColor = 'range';
const defaultRangeTextColor = 'rangeText';

export function selectTripDateRangeCalendarDate<T extends TripDateRangeCalendarValues>(values: T, date: string): T {
  if (!values.startDate || values.endDate) {
    return { ...values, startDate: date, endDate: '' };
  }

  if (date < values.startDate) {
    return { ...values, startDate: date, endDate: '' };
  }

  return { ...values, endDate: date };
}

export function buildTripDateRangeCalendarState(values: TripDateRangeCalendarValues): TripDateRangeCalendarState {
  const hasStart = Boolean(values.startDate);
  const hasEnd = Boolean(values.endDate);

  return {
    startLabel: hasStart ? values.startDate : '시작일 선택 전',
    endLabel: hasEnd ? values.endDate : '종료일 선택 전',
    nextSelection: hasStart && !hasEnd ? 'endDate' : 'startDate',
    helperText: hasStart && !hasEnd ? '종료일을 찍으면 기간 선택 끝.' : '시작일을 먼저 찍어요. 당일치기도 가능해요.',
  };
}

export function formatTripDateRangeSummary(values: TripDateRangeCalendarValues): string {
  if (!values.startDate && !values.endDate) {
    return '기간 선택 전';
  }
  if (values.startDate && !values.endDate) {
    return `${values.startDate} ~ 종료일 선택 전`;
  }
  if (values.startDate === values.endDate) {
    return `${values.startDate} 당일`;
  }
  return `${values.startDate} ~ ${values.endDate}`;
}

export function buildTripDateRangeMarkedDates(
  values: TripDateRangeCalendarValues,
  colors: TripDateRangeMarkedDateColors = {},
): Record<string, TripDateRangeMarkedDate> {
  const startDate = values.startDate;
  if (!isValidDate(startDate)) {
    return {};
  }

  const endDate = isValidDate(values.endDate) && values.endDate >= startDate ? values.endDate : startDate;
  const rangeColor = colors.rangeColor ?? defaultRangeColor;
  const rangeTextColor = colors.rangeTextColor ?? defaultRangeTextColor;
  const markedDates: Record<string, TripDateRangeMarkedDate> = {};

  for (const date of datesBetween(startDate, endDate)) {
    markedDates[date] = {
      color: rangeColor,
      textColor: rangeTextColor,
      ...(date === startDate ? { startingDay: true } : {}),
      ...(date === endDate ? { endingDay: true } : {}),
    };
  }

  return markedDates;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = dateFromString(startDate);
  const end = dateFromString(endDate);

  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}
