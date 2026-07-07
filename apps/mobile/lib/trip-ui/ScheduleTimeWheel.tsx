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
  buildScheduleTimeText,
  parseScheduleTimePickerValue,
  scheduleTimeHourOptions,
  scheduleTimeMinuteOptions,
  scheduleTimePeriodOptions,
  type PlaceScheduleTimePeriod,
  type PlaceScheduleTimePickerValue,
} from '../places/place-schedule-detail';

const wheelItemHeight = 36;
const wheelVisibleItems = 4;

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
  const selectByOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (disabled) {
      return;
    }
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / wheelItemHeight)),
    );
    onChange(options[index]);
  };

  return (
    <View style={styles.timeWheelColumn}>
      <ScrollView
        contentOffset={{ x: 0, y: selectedIndex * wheelItemHeight }}
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
              style={[styles.timeWheelOption, selected ? styles.timeWheelOptionSelected : null]}
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
    flex: 1,
    height: wheelItemHeight * wheelVisibleItems,
    overflow: 'hidden',
  },
  timeWheelList: {
    borderRadius: theme.radius.md,
  },
  timeWheelOption: {
    alignItems: 'center',
    height: wheelItemHeight,
    justifyContent: 'center',
  },
  timeWheelOptionSelected: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.sm,
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
