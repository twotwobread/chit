import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../design';
import {
  addScheduleEndTime,
  addScheduleStartTime,
  buildScheduleTimeEditorSummary,
  clearScheduleTimes,
  type ScheduleTimeEditorValues,
} from '../trips/schedule-time-editor';
import { ScheduleTimeWheel } from './ScheduleTimeWheel';

export function ScheduleTimeEditor({
  disabled,
  endTimeError,
  onChange,
  startTimeError,
  values,
}: {
  disabled: boolean;
  endTimeError?: string;
  onChange: (patch: Partial<ScheduleTimeEditorValues>) => void;
  startTimeError?: string;
  values: ScheduleTimeEditorValues;
}) {
  const [activeWheel, setActiveWheel] = useState<'start' | 'end' | null>(null);
  const summary = buildScheduleTimeEditorSummary(values);
  const updateValues = (nextValues: ScheduleTimeEditorValues) => {
    onChange({ startTime: nextValues.startTime, endTime: nextValues.endTime });
  };

  const openStartWheel = () => {
    if (disabled) {
      return;
    }
    if (!values.startTime) {
      updateValues(addScheduleStartTime(values));
    }
    setActiveWheel('start');
  };

  const openEndWheel = () => {
    if (disabled) {
      return;
    }
    if (!values.startTime) {
      updateValues(addScheduleEndTime(addScheduleStartTime(values)));
    } else if (!values.endTime) {
      updateValues(addScheduleEndTime(values));
    }
    setActiveWheel('end');
  };

  const clearTimes = () => {
    if (disabled) {
      return;
    }
    setActiveWheel(null);
    updateValues(clearScheduleTimes(values));
  };

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.label}>시간</Text>
        {summary.hasStartTime ? (
          <Pressable accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={clearTimes}>
            <Text style={[styles.inlineActionText, disabled ? styles.disabledText : null]}>시간 미정</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.timeCompactBox}>
        <View style={styles.timeRangeRow}>
          <Pressable
            accessibilityLabel="시작 시간 수정"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openStartWheel}
            style={[styles.timePill, activeWheel === 'start' ? styles.timePillActive : null]}
          >
            <Text style={[styles.timePillLabel, activeWheel === 'start' ? styles.timePillLabelActive : null]}>
              시작
            </Text>
            <Text style={[styles.timePillText, activeWheel === 'start' ? styles.timePillTextActive : null]}>
              {summary.startLabel}
            </Text>
          </Pressable>
          <Text style={styles.timeArrow}>→</Text>
          <Pressable
            accessibilityLabel="종료 시간 수정"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openEndWheel}
            style={[styles.timePill, activeWheel === 'end' ? styles.timePillActive : null]}
          >
            <Text style={[styles.timePillLabel, activeWheel === 'end' ? styles.timePillLabelActive : null]}>종료</Text>
            <Text style={[styles.timePillText, activeWheel === 'end' ? styles.timePillTextActive : null]}>
              {summary.endLabel}
            </Text>
          </Pressable>
        </View>

        {activeWheel === 'start' && values.startTime ? (
          <ScheduleTimeWheel
            disabled={disabled}
            label="시작 시간"
            onChangeTime={(startTime) => onChange({ startTime })}
            value={values.startTime}
          />
        ) : null}
        {startTimeError ? <Text style={styles.fieldError}>{startTimeError}</Text> : null}

        {activeWheel === 'end' && values.endTime ? (
          <ScheduleTimeWheel
            disabled={disabled}
            label="종료 시간"
            onChangeTime={(endTime) => onChange({ endTime })}
            value={values.endTime}
          />
        ) : null}
        {endTimeError ? <Text style={styles.fieldError}>{endTimeError}</Text> : null}
      </View>
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
    gap: theme.space[3],
    justifyContent: 'space-between',
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
  timeArrow: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  timeCompactBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[3],
  },
  timePill: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[1],
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  timePillActive: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  timePillLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  timePillLabelActive: {
    color: theme.color.primary,
  },
  timePillText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  timePillTextActive: {
    color: theme.color.primary,
  },
  timeRangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
});
