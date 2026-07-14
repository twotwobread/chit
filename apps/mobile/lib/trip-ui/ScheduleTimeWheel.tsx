import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '../design';
import {
  DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT,
  DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS,
  buildScheduleTimeWheelContentPadding,
  buildScheduleTimeWheelOffset,
  buildScheduleTimeWheelSelectedIndex,
} from '../trips/schedule-time-wheel-layout';
import {
  buildScheduleTimeText,
  parseScheduleTimePickerValue,
  scheduleTimeHourOptions,
  scheduleTimeMinuteOptions,
  scheduleTimePeriodOptions,
  type PlaceScheduleTimePeriod,
  type PlaceScheduleTimePickerValue,
} from '../places/place-schedule-detail';

const wheelItemHeight = DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT;
const wheelVisibleItems = DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS;
const wheelContentPadding = buildScheduleTimeWheelContentPadding({
  itemHeight: wheelItemHeight,
  visibleItems: wheelVisibleItems,
});

export function ScheduleTimeWheel({
  disabled,
  label,
  onChangeTime,
  value,
}: {
  disabled: boolean;
  label: string;
  onChangeTime: (time: string) => void;
  value: string;
}) {
  const pickerValue = parseScheduleTimePickerValue(value);
  const update = (patch: Partial<PlaceScheduleTimePickerValue>) => {
    onChangeTime(buildScheduleTimeText({ ...pickerValue, ...patch }));
  };

  return (
    <View style={styles.timeWheelCard}>
      <View style={styles.timeWheelHeader}>
        <Text style={styles.timeWheelLabel}>{label}</Text>
        <Text style={styles.timeWheelValue}>{formatScheduleTimeDisplay(pickerValue)}</Text>
      </View>
      <View style={styles.timeWheelRow}>
        <TimeWheelColumn<PlaceScheduleTimePeriod>
          disabled={disabled}
          labelForOption={formatPeriodOption}
          onChange={(period) => update({ period })}
          options={scheduleTimePeriodOptions}
          value={pickerValue.period}
        />
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(hour) => `${Number(hour)}시`}
          onChange={(hour) => update({ hour })}
          options={scheduleTimeHourOptions}
          value={pickerValue.hour}
        />
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(minute) => `${minute}분`}
          onChange={(minute) => update({ minute })}
          options={scheduleTimeMinuteOptions}
          value={pickerValue.minute}
        />
      </View>
    </View>
  );
}

function TimeWheelColumn<T extends string>({
  disabled,
  labelForOption,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  labelForOption: (option: T) => string;
  onChange: (option: T) => void;
  options: T[];
  value: T;
}) {
  const selectedIndex = Math.max(0, options.indexOf(value));
  const contentOffsetY = buildScheduleTimeWheelOffset({
    itemHeight: wheelItemHeight,
    optionCount: options.length,
    selectedIndex,
    visibleItems: wheelVisibleItems,
  });
  const selectByOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (disabled) {
      return;
    }
    const index = buildScheduleTimeWheelSelectedIndex({
      contentOffsetY: event.nativeEvent.contentOffset.y,
      itemHeight: wheelItemHeight,
      optionCount: options.length,
    });
    onChange(options[index]);
  };

  return (
    <View style={styles.timeWheelColumn}>
      <View pointerEvents="none" style={styles.timeWheelSelectionFrame} />
      <ScrollView
        contentContainerStyle={styles.timeWheelContent}
        contentOffset={{ x: 0, y: contentOffsetY }}
        decelerationRate="fast"
        key={value}
        nestedScrollEnabled
        onMomentumScrollEnd={selectByOffset}
        showsVerticalScrollIndicator={false}
        snapToInterval={wheelItemHeight}
        style={styles.timeWheelList}
      >
        {options.map((item) => {
          const selected = item === value;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              key={item}
              onPress={() => onChange(item)}
              accessibilityState={{ selected }}
              style={styles.timeWheelOption}
            >
              <Text style={[styles.timeWheelOptionText, selected ? styles.timeWheelOptionTextSelected : null]}>
                {labelForOption(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function formatPeriodOption(period: PlaceScheduleTimePeriod): string {
  return period === 'AM' ? '오전' : '오후';
}

function formatScheduleTimeDisplay(value: PlaceScheduleTimePickerValue): string {
  return `${formatPeriodOption(value.period)} ${Number(value.hour)}:${value.minute}`;
}

const styles = StyleSheet.create({
  timeWheelCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  timeWheelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  timeWheelLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  timeWheelValue: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  timeWheelRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  timeWheelColumn: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    height: wheelItemHeight * wheelVisibleItems,
    overflow: 'hidden',
  },
  timeWheelContent: {
    paddingVertical: wheelContentPadding,
  },
  timeWheelList: {
    borderRadius: theme.radius.md,
  },
  timeWheelSelectionFrame: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    height: wheelItemHeight,
    left: theme.space[1],
    position: 'absolute',
    right: theme.space[1],
    top: wheelItemHeight * Math.floor(wheelVisibleItems / 2),
  },
  timeWheelOption: {
    alignItems: 'center',
    height: wheelItemHeight,
    justifyContent: 'center',
  },
  timeWheelOptionText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  timeWheelOptionTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
