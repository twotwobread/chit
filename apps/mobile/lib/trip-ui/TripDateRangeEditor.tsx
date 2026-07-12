import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../design';
import { TripDatePicker } from '../trips/date-picker';
import {
  buildTripDateRangeEditorSegments,
  buildTripDateRangePickerState,
  type TripDateRangeEditorValues,
  type TripDateRangeField,
} from '../trips/trip-date-range-editor';
import { buildScheduleTimeEditorLayout } from '../trips/schedule-time-editor-layout';

const dateEditorLayout = buildScheduleTimeEditorLayout();

export function TripDateRangeEditor({
  activeField,
  calendarMonth,
  disabled,
  onClosePicker,
  onMonthChange,
  onOpenField,
  onSelectDate,
  today,
  values,
  yearOptionCount,
}: {
  activeField: TripDateRangeField | null;
  calendarMonth: string;
  disabled: boolean;
  onClosePicker: () => void;
  onMonthChange: (month: string) => void;
  onOpenField: (field: TripDateRangeField) => void;
  onSelectDate: (date: string) => void;
  today: string;
  values: TripDateRangeEditorValues;
  yearOptionCount?: number;
}) {
  const [startSegment, endSegment] = buildTripDateRangeEditorSegments(values, activeField);
  const pickerState = buildTripDateRangePickerState(values, activeField, today);

  const renderSegment = (segment: typeof startSegment) => (
    <Pressable
      accessibilityLabel={segment.accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onOpenField(segment.field)}
      style={[styles.dateSegment, segment.active ? styles.dateSegmentActive : null]}
    >
      <Text style={[styles.dateSegmentLabel, segment.active ? styles.dateSegmentLabelActive : null]}>
        {segment.label}
      </Text>
      <Text
        style={[
          values[segment.field] ? styles.dateSegmentText : styles.dateSegmentPlaceholder,
          segment.active ? styles.dateSegmentTextActive : null,
        ]}
      >
        {segment.valueLabel}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>여행 기간</Text>

      <View style={styles.dateCompactBox}>
        <View style={styles.dateSegmentedControl}>
          {renderSegment(startSegment)}
          <View style={styles.dateBridge}>
            <Text style={styles.dateArrow}>→</Text>
          </View>
          {renderSegment(endSegment)}
        </View>

        {pickerState ? (
          <TripDatePicker
            anchorDate={pickerState.anchorDate}
            helperText={pickerState.helperText}
            label={pickerState.label}
            minDate={pickerState.minDate}
            month={calendarMonth}
            onClose={onClosePicker}
            onMonthChange={onMonthChange}
            onSelect={onSelectDate}
            selectedDate={pickerState.selectedDate}
            yearOptionCount={yearOptionCount}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateArrow: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  dateBridge: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    justifyContent: 'center',
    width: theme.space[8],
  },
  dateCompactBox: {
    gap: dateEditorLayout.containerGap,
    padding: dateEditorLayout.containerPadding,
  },
  dateSegment: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    flex: 1,
    flexDirection: dateEditorLayout.segmentContentDirection,
    gap: dateEditorLayout.segmentGap,
    justifyContent: 'center',
    minHeight: dateEditorLayout.segmentMinHeight,
    paddingHorizontal: dateEditorLayout.segmentHorizontalPadding,
    paddingVertical: dateEditorLayout.segmentVerticalPadding,
  },
  dateSegmentActive: {
    backgroundColor: theme.color.primarySoft,
  },
  dateSegmentedControl: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: dateEditorLayout.segmentMinHeight,
    overflow: 'hidden',
    width: '100%',
  },
  dateSegmentLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  dateSegmentLabelActive: {
    color: theme.color.primary,
  },
  dateSegmentPlaceholder: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  dateSegmentText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  dateSegmentTextActive: {
    color: theme.color.primary,
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
});
