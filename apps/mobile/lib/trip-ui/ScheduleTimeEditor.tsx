import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton, theme } from '../design';
import { defaultEndScheduleTimeFromStart } from '../places/place-schedule-detail';
import {
  addScheduleEndTime,
  addScheduleStartTime,
  clearScheduleTimes,
  type ScheduleTimeEditorValues,
} from '../trips/schedule-time-editor';
import { ScheduleTimeWheel } from './ScheduleTimeWheel';

export function ScheduleTimeEditor({
  disabled,
  emptyHelper,
  endTimeError,
  helper,
  onChange,
  startTimeError,
  values,
}: {
  disabled: boolean;
  emptyHelper: string;
  endTimeError?: string;
  helper: string;
  onChange: (patch: Partial<ScheduleTimeEditorValues>) => void;
  startTimeError?: string;
  values: ScheduleTimeEditorValues;
}) {
  const updateValues = (nextValues: ScheduleTimeEditorValues) => {
    onChange({ startTime: nextValues.startTime, endTime: nextValues.endTime });
  };
  const addEndDisabled = disabled || defaultEndScheduleTimeFromStart(values.startTime).length === 0;

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.label}>시간</Text>
        {values.startTime ? (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => updateValues(clearScheduleTimes(values))}
          >
            <Text style={[styles.inlineActionText, disabled ? styles.disabledText : null]}>시간 미정</Text>
          </Pressable>
        ) : null}
      </View>

      {values.startTime ? (
        <View style={styles.timePickerStack}>
          <ScheduleTimeWheel
            disabled={disabled}
            label="시작 시간"
            onChangeTime={(startTime) => onChange({ startTime })}
            value={values.startTime}
          />
          {startTimeError ? <Text style={styles.fieldError}>{startTimeError}</Text> : null}

          {values.endTime ? (
            <ScheduleTimeWheel
              disabled={disabled}
              label="종료 시간"
              onChangeTime={(endTime) => onChange({ endTime })}
              value={values.endTime}
            />
          ) : (
            <SecondaryButton
              disabled={addEndDisabled}
              label="종료 시간 추가"
              onPress={() => updateValues(addScheduleEndTime(values))}
            />
          )}
          {endTimeError ? <Text style={styles.fieldError}>{endTimeError}</Text> : null}
          <Text style={styles.fieldHelper}>{helper}</Text>
        </View>
      ) : (
        <View style={styles.timeEmptyBox}>
          <Text style={styles.fieldHelper}>{emptyHelper}</Text>
          <SecondaryButton
            disabled={disabled}
            label="시간 추가"
            onPress={() => updateValues(addScheduleStartTime(values))}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disabledText: {
    opacity: 0.5,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  fieldHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  fieldHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  inlineActionText: {
    color: theme.color.textLink,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  timeEmptyBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  timePickerStack: {
    gap: theme.space[3],
  },
});
