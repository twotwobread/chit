import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { theme } from '../design';
import {
  buildScheduleTimeWheelLayout,
  buildScheduleTimeWheelOffset,
  buildScheduleTimeWheelSelectedIndex,
  type ScheduleTimeWheelLayout,
} from '../trips/schedule-time-wheel-layout';
import {
  buildScheduleTimeText,
  parseScheduleTimePickerValue,
  scheduleTimeHourOptions,
  scheduleTimeMinuteOptions,
  type PlaceScheduleTimePickerValue,
} from '../places/place-schedule-detail';

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
  const { fontScale } = useWindowDimensions();
  const wheelLayout = buildScheduleTimeWheelLayout({ fontScale });
  const pickerValue = parseScheduleTimePickerValue(value);
  const update = (patch: Partial<PlaceScheduleTimePickerValue>) => {
    onChangeTime(buildScheduleTimeText({ ...pickerValue, ...patch }));
  };

  return (
    <View style={styles.timeWheelCard}>
      <View style={styles.timeWheelHeader}>
        <Text style={[styles.timeWheelLabel, { lineHeight: wheelLayout.optionLineHeight }]}>{label}</Text>
        <Text style={[styles.timeWheelValue, { lineHeight: wheelLayout.optionLineHeight }]}>
          {formatScheduleTimeDisplay(pickerValue)}
        </Text>
      </View>
      <View style={styles.timeWheelRow}>
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(hour) => `${hour}시`}
          layout={wheelLayout}
          onChange={(hour) => update({ hour })}
          options={scheduleTimeHourOptions}
          value={pickerValue.hour}
        />
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(minute) => `${minute}분`}
          layout={wheelLayout}
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
  layout,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  labelForOption: (option: T) => string;
  layout: ScheduleTimeWheelLayout;
  onChange: (option: T) => void;
  options: T[];
  value: T;
}) {
  const selectedIndex = Math.max(0, options.indexOf(value));
  const contentOffsetY = buildScheduleTimeWheelOffset({
    itemHeight: layout.itemHeight,
    optionCount: options.length,
    selectedIndex,
    visibleItems: layout.visibleItems,
  });
  const selectByOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (disabled) {
      return;
    }
    const index = buildScheduleTimeWheelSelectedIndex({
      contentOffsetY: event.nativeEvent.contentOffset.y,
      itemHeight: layout.itemHeight,
      optionCount: options.length,
    });
    onChange(options[index]);
  };

  return (
    <View style={[styles.timeWheelColumn, { height: layout.viewportHeight }]}>
      <View
        pointerEvents="none"
        style={[
          styles.timeWheelSelectionFrame,
          { height: layout.itemHeight, top: layout.itemHeight * Math.floor(layout.visibleItems / 2) },
        ]}
      />
      <ScrollView
        contentContainerStyle={[styles.timeWheelContent, { paddingVertical: layout.contentPadding }]}
        contentOffset={{ x: 0, y: contentOffsetY }}
        decelerationRate="fast"
        key={value}
        nestedScrollEnabled
        onMomentumScrollEnd={selectByOffset}
        showsVerticalScrollIndicator={false}
        snapToInterval={layout.itemHeight}
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
              style={[styles.timeWheelOption, { height: layout.itemHeight }]}
            >
              <Text
                style={[
                  styles.timeWheelOptionText,
                  { lineHeight: layout.optionLineHeight },
                  selected ? styles.timeWheelOptionTextSelected : null,
                ]}
              >
                {labelForOption(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function formatScheduleTimeDisplay(value: PlaceScheduleTimePickerValue): string {
  return `${value.hour}:${value.minute}`;
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
    flexWrap: 'wrap',
    gap: theme.space[3],
    justifyContent: 'space-between',
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
    overflow: 'hidden',
  },
  timeWheelContent: {},
  timeWheelList: {
    borderRadius: theme.radius.md,
  },
  timeWheelSelectionFrame: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    left: theme.space[1],
    position: 'absolute',
    right: theme.space[1],
  },
  timeWheelOption: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWheelOptionText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  timeWheelOptionTextSelected: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
