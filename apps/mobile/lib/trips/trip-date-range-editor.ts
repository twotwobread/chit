import { isValidDate } from './date';

export type TripDateRangeField = 'startDate' | 'endDate';

export type TripDateRangeEditorValues = {
  startDate: string;
  endDate: string;
};

export type TripDateRangeSegment = {
  accessibilityLabel: string;
  active: boolean;
  field: TripDateRangeField;
  label: string;
  valueLabel: string;
};

export type TripDateRangePickerState = {
  anchorDate?: string;
  helperText: string;
  label: string;
  minDate: string;
  placement: 'below-range-segments';
  selectedDate: string;
};

const segmentLabels: Record<TripDateRangeField, string> = {
  startDate: '시작',
  endDate: '종료',
};

const pickerLabels: Record<TripDateRangeField, string> = {
  startDate: '시작 일자',
  endDate: '종료 일자',
};

const datePlaceholder = '날짜 선택';

export function buildTripDateRangeEditorSegments(
  values: TripDateRangeEditorValues,
  activeField: TripDateRangeField | null,
): TripDateRangeSegment[] {
  return (['startDate', 'endDate'] as const).map((field) => ({
    accessibilityLabel: `${pickerLabels[field]} 선택`,
    active: activeField === field,
    field,
    label: segmentLabels[field],
    valueLabel: values[field] || datePlaceholder,
  }));
}

export function buildTripDateRangePickerState(
  values: TripDateRangeEditorValues,
  activeField: TripDateRangeField | null,
  today: string,
): TripDateRangePickerState | null {
  if (!activeField) {
    return null;
  }

  return {
    anchorDate: activeField === 'endDate' && values.startDate ? values.startDate : undefined,
    helperText:
      activeField === 'startDate' ? '오늘 이전 날짜는 선택할 수 없어요.' : '시작 일자 이전 날짜는 선택할 수 없어요.',
    label: `${pickerLabels[activeField]} 선택`,
    minDate: minDateForTripDateRangeField(activeField, values.startDate, today),
    placement: 'below-range-segments',
    selectedDate: values[activeField],
  };
}

export function selectTripDateRangeDate<T extends TripDateRangeEditorValues>(
  values: T,
  field: TripDateRangeField,
  date: string,
): T {
  if (field === 'startDate') {
    if (values.startDate === date) {
      return { ...values, startDate: '', endDate: '' };
    }

    return {
      ...values,
      startDate: date,
      endDate: values.endDate && values.endDate < date ? '' : values.endDate,
    };
  }

  if (values.endDate === date) {
    return { ...values, endDate: '' };
  }

  return { ...values, endDate: date };
}

export function keepTripDateRangePickerFieldAfterSelect(field: TripDateRangeField): TripDateRangeField {
  return field;
}

export function minDateForTripDateRangeField(field: TripDateRangeField, startDate: string, today: string): string {
  if (field === 'endDate' && isValidDate(startDate) && startDate > today) {
    return startDate;
  }

  return today;
}
