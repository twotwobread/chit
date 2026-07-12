import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../design';

export type DayChip = {
  id: string;
  label: string;
  dateLabel?: string;
  legendColor?: string;
  statusLabel?: string;
};

export type DayChipsProps = {
  days: DayChip[];
  selectedDayId: string | null;
  onSelectDay: (dayId: string) => void;
  emptyLabel?: string;
  edgePadding?: number;
};

export function DayChips({
  days,
  edgePadding = theme.layout.gutter,
  emptyLabel = '선택할 Day가 없어요',
  onSelectDay,
  selectedDayId,
}: DayChipsProps) {
  if (days.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: edgePadding }]}
    >
      {days.map((day) => {
        const selected = day.id === selectedDayId;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={day.id}
            onPress={() => onSelectDay(day.id)}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : styles.chipIdle,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.labelRow}>
              {day.legendColor ? (
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: day.legendColor },
                    selected ? styles.legendDotSelected : null,
                  ]}
                />
              ) : null}
              <Text style={[styles.label, selected ? styles.labelSelected : null]}>{day.label}</Text>
            </View>
            {day.dateLabel ? (
              <Text style={[styles.date, selected ? styles.dateSelected : null]}>{day.dateLabel}</Text>
            ) : null}
            {day.statusLabel ? (
              <Text style={[styles.status, selected ? styles.statusSelected : null]}>{day.statusLabel}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    gap: theme.space[1],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm + theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  chipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  chipSelected: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  date: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  dateSelected: {
    color: theme.color.green[50],
  },
  emptyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  emptyWrap: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  legendDot: {
    borderColor: theme.color.surface,
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  legendDotSelected: {
    borderColor: theme.color.onPrimary,
    borderWidth: 2,
  },
  labelSelected: {
    color: theme.color.onPrimary,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    gap: theme.space[3],
    paddingVertical: theme.space[2],
  },
  status: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  statusSelected: {
    color: theme.color.green[100],
  },
});
