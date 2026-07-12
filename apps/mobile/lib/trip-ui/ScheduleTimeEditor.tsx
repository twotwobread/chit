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
import { buildScheduleTimeEditorLayout } from '../trips/schedule-time-editor-layout';
import { ScheduleTimeWheel } from './ScheduleTimeWheel';

const timeEditorLayout = buildScheduleTimeEditorLayout();

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
        <View style={styles.timeSegmentedControl}>
          <Pressable
            accessibilityLabel="시작 시간 수정"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openStartWheel}
            style={[styles.timeSegment, activeWheel === 'start' ? styles.timeSegmentActive : null]}
          >
            <Text style={[styles.timeSegmentLabel, activeWheel === 'start' ? styles.timeSegmentLabelActive : null]}>
              시작
            </Text>
            <Text style={[styles.timeSegmentText, activeWheel === 'start' ? styles.timeSegmentTextActive : null]}>
              {summary.startLabel}
            </Text>
          </Pressable>
          <View style={styles.timeBridge}>
            <Text style={styles.timeArrow}>→</Text>
          </View>
          <Pressable
            accessibilityLabel="종료 시간 수정"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openEndWheel}
            style={[styles.timeSegment, activeWheel === 'end' ? styles.timeSegmentActive : null]}
          >
            <Text style={[styles.timeSegmentLabel, activeWheel === 'end' ? styles.timeSegmentLabelActive : null]}>
              종료
            </Text>
            <Text style={[styles.timeSegmentText, activeWheel === 'end' ? styles.timeSegmentTextActive : null]}>
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
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  timeBridge: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    justifyContent: 'center',
    width: theme.space[8],
  },
  timeCompactBox: {
    gap: timeEditorLayout.containerGap,
    padding: timeEditorLayout.containerPadding,
  },
  timeSegment: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    flex: 1,
    flexDirection: timeEditorLayout.segmentContentDirection,
    gap: timeEditorLayout.segmentGap,
    justifyContent: 'center',
    minHeight: timeEditorLayout.segmentMinHeight,
    paddingHorizontal: timeEditorLayout.segmentHorizontalPadding,
    paddingVertical: timeEditorLayout.segmentVerticalPadding,
  },
  timeSegmentActive: {
    backgroundColor: theme.color.primarySoft,
  },
  timeSegmentedControl: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: timeEditorLayout.segmentMinHeight,
    overflow: 'hidden',
    width: '100%',
  },
  timeSegmentLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  timeSegmentLabelActive: {
    color: theme.color.primary,
  },
  timeSegmentText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  timeSegmentTextActive: {
    color: theme.color.primary,
  },
});
