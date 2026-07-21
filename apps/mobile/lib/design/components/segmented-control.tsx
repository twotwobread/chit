import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { buildCriticalTextLayout } from '../responsive-text';
import { theme } from '../theme';

export function SegmentedControl({
  dark = false,
  disabledOptions = [],
  onChange,
  options,
  value,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  dark?: boolean;
  disabledOptions?: string[];
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.tapMin,
    verticalPadding: theme.space[3],
  });

  return (
    <View style={[styles.segment, dark ? styles.segmentDark : null]}>
      {options.map((option) => {
        const active = option === value;
        const disabled = disabledOptions.includes(option);

        return (
          <InteractiveSurface
            accessibilityLabel={option}
            accessibilityRole="tab"
            disabled={disabled}
            key={option}
            minHeight={textLayout.minHeight}
            onPress={() => onChange(option)}
            selected={active}
            style={[
              styles.segmentItem,
              { minHeight: textLayout.minHeight },
              active ? (dark ? styles.segmentItemActiveDark : styles.segmentItemActive) : null,
              disabled ? styles.segmentItemDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { lineHeight: textLayout.lineHeight },
                dark ? styles.segmentTextDark : null,
                active ? (dark ? styles.segmentTextActiveDark : styles.segmentTextActive) : null,
                disabled ? styles.segmentTextDisabled : null,
              ]}
            >
              {option}
            </Text>
          </InteractiveSurface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[1],
    padding: theme.space[1] + 2,
  },
  segmentDark: {
    backgroundColor: theme.color.surfaceSunken,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[3],
  },
  segmentItemActive: {
    backgroundColor: theme.color.surfaceSoft,
    ...theme.shadow.xs,
  },
  segmentItemActiveDark: {
    backgroundColor: theme.color.surface,
  },
  segmentItemDisabled: {
    opacity: 0.45,
  },
  segmentText: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: theme.color.textStrong,
  },
  segmentTextActiveDark: {
    color: theme.color.textStrong,
  },
  segmentTextDark: {
    color: theme.color.textBody,
  },
  segmentTextDisabled: {
    color: theme.color.textFaint,
  },
});
