import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterChip, theme } from '../design';

export type DayChip = {
  id: string;
  label: string;
  dateLabel?: string;
  legendColor?: string;
  statusLabel?: string;
};

export type DayChipsProps = {
  days: DayChip[];
  selectedDayId?: string | null;
  selectedDayIds?: string[];
  onSelectDay: (dayId: string) => void;
  emptyLabel?: string;
  edgePadding?: number;
};

export function DayChips({
  days,
  edgePadding = theme.layout.gutter,
  emptyLabel = '선택할 Day가 없어요',
  onSelectDay,
  selectedDayId = null,
  selectedDayIds,
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
        const selected = selectedDayIds ? selectedDayIds.includes(day.id) : day.id === selectedDayId;
        return (
          <FilterChip
            accessibilityLabel={buildDayChipAccessibilityLabel(day)}
            accessibilityRole="tab"
            key={day.id}
            label={day.label}
            leading={
              day.legendColor ? (
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: day.legendColor },
                    selected ? styles.legendDotSelected : null,
                  ]}
                />
              ) : undefined
            }
            onPress={() => onSelectDay(day.id)}
            selected={selected}
            statusLabel={buildDayChipStatusLabel(day)}
            style={styles.chip}
            tone="accent"
          />
        );
      })}
    </ScrollView>
  );
}

function buildDayChipAccessibilityLabel(day: DayChip): string {
  return [day.label, day.dateLabel, day.statusLabel].filter(Boolean).join(' ');
}

function buildDayChipStatusLabel(day: DayChip): string | undefined {
  return [day.dateLabel, day.statusLabel].filter(Boolean).join(' · ') || undefined;
}

const styles = StyleSheet.create({
  chip: {
    minHeight: theme.layout.controlHSm + theme.space[2],
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
  legendDot: {
    borderColor: theme.color.surface,
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  legendDotSelected: {
    borderColor: theme.color.textStrong,
    borderWidth: 2,
  },
  row: {
    gap: theme.space[3],
    paddingVertical: theme.space[2],
  },
});
