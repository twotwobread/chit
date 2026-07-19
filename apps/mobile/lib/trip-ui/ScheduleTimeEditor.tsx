import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { theme } from '../design';
import {
  addScheduleEndTime,
  addScheduleEndTimeDuration,
  addScheduleStartTime,
  buildScheduleTimeEditorSummary,
  clearScheduleTimes,
  type ScheduleTimeEditorValues,
} from '../trips/schedule-time-editor';
import { buildScheduleTimeEditorLayout } from '../trips/schedule-time-editor-layout';
import { ScheduleTimeWheel } from './ScheduleTimeWheel';

const endTimeDurationOptions = [
  { label: '+30분', minutes: 30 },
  { label: '+1시간', minutes: 60 },
  { label: '+2시간', minutes: 120 },
] as const;

export function ScheduleTimeEditor({
  defaultStartTime,
  disabled,
  endTimeError,
  onChange,
  startTimeError,
  values,
}: {
  defaultStartTime?: string;
  disabled: boolean;
  endTimeError?: string;
  onChange: (patch: Partial<ScheduleTimeEditorValues>) => void;
  startTimeError?: string;
  values: ScheduleTimeEditorValues;
}) {
  const [activeWheel, setActiveWheel] = useState<'start' | 'end' | null>(null);
  const { fontScale, width } = useWindowDimensions();
  const timeEditorLayout = buildScheduleTimeEditorLayout({ fontScale, width });
  const summary = buildScheduleTimeEditorSummary(values);
  const updateValues = (nextValues: ScheduleTimeEditorValues) => {
    onChange({ startTime: nextValues.startTime, endTime: nextValues.endTime });
  };

  const openStartWheel = () => {
    if (disabled) {
      return;
    }
    if (!values.startTime) {
      updateValues(addScheduleStartTime(values, defaultStartTime));
    }
    setActiveWheel('start');
  };

  const openEndWheel = () => {
    if (disabled) {
      return;
    }
    if (!values.startTime) {
      updateValues(addScheduleEndTime(addScheduleStartTime(values, defaultStartTime)));
    } else if (!values.endTime) {
      updateValues(addScheduleEndTime(values));
    }
    setActiveWheel('end');
  };

  const setQuickEndTime = (durationMinutes: number) => {
    if (disabled) {
      return;
    }
    updateValues(addScheduleEndTimeDuration(values, durationMinutes));
  };

  const clearTimes = () => {
    if (disabled) {
      return;
    }
    setActiveWheel(null);
    updateValues(clearScheduleTimes(values));
  };
  const segmentDynamicStyle = {
    flexDirection: timeEditorLayout.segmentContentDirection,
    gap: timeEditorLayout.segmentGap,
    minHeight: timeEditorLayout.segmentMinHeight,
    paddingHorizontal: timeEditorLayout.segmentHorizontalPadding,
    paddingVertical: timeEditorLayout.segmentVerticalPadding,
  } as const;

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

      <View
        style={[
          styles.timeCompactBox,
          { gap: timeEditorLayout.containerGap, padding: timeEditorLayout.containerPadding },
        ]}
      >
        <View style={[styles.timeSegmentedControl, { minHeight: timeEditorLayout.segmentMinHeight }]}>
          <Pressable
            accessibilityLabel={`시작 시간 수정, 현재 ${summary.startLabel}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={openStartWheel}
            style={[styles.timeSegment, segmentDynamicStyle, activeWheel === 'start' ? styles.timeSegmentActive : null]}
          >
            <Text
              style={[
                styles.timeSegmentLabel,
                { lineHeight: timeEditorLayout.segmentLabelLineHeight },
                activeWheel === 'start' ? styles.timeSegmentLabelActive : null,
              ]}
            >
              시작
            </Text>
            <Text
              style={[
                styles.timeSegmentText,
                { lineHeight: timeEditorLayout.segmentTextLineHeight },
                activeWheel === 'start' ? styles.timeSegmentTextActive : null,
              ]}
            >
              {summary.startLabel}
            </Text>
          </Pressable>
          <View style={[styles.timeBridge, { width: timeEditorLayout.timeBridgeWidth }]}>
            <Text style={styles.timeArrow}>→</Text>
          </View>
          <Pressable
            accessibilityLabel={`종료 시간 수정, 현재 ${summary.endLabel}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={openEndWheel}
            style={[styles.timeSegment, segmentDynamicStyle, activeWheel === 'end' ? styles.timeSegmentActive : null]}
          >
            <Text
              style={[
                styles.timeSegmentLabel,
                { lineHeight: timeEditorLayout.segmentLabelLineHeight },
                activeWheel === 'end' ? styles.timeSegmentLabelActive : null,
              ]}
            >
              종료
            </Text>
            <Text
              style={[
                styles.timeSegmentText,
                { lineHeight: timeEditorLayout.segmentTextLineHeight },
                activeWheel === 'end' ? styles.timeSegmentTextActive : null,
              ]}
            >
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

        {activeWheel === 'end' && values.startTime ? (
          <View style={styles.quickDurationRow}>
            {endTimeDurationOptions.map((option) => (
              <Pressable
                accessibilityLabel={`종료 시간 ${option.label}로 설정`}
                accessibilityRole="button"
                disabled={disabled}
                key={option.minutes}
                onPress={() => setQuickEndTime(option.minutes)}
                style={[styles.quickDurationButton, disabled ? styles.quickDurationButtonDisabled : null]}
              >
                <Text style={[styles.quickDurationButtonText, disabled ? styles.disabledText : null]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
  quickDurationButton: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  quickDurationButtonDisabled: {
    opacity: 0.5,
  },
  quickDurationButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  quickDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
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
  },
  timeCompactBox: {},
  timeSegment: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    flex: 1,
    justifyContent: 'center',
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
