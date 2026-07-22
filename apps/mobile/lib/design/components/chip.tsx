import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type FilterChipTone = 'neutral' | 'accent';
export type ChoiceChipTone = 'neutral' | 'accent';

export function Chip({
  label,
  leading,
  onPress,
  selected = false,
}: {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  onPress?: PressableProps['onPress'];
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="button"
      minHeight={theme.layout.controlHSm}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed ? styles.chipPressed : null,
      ]}
    >
      {leading}
      <ResponsiveLabel
        fontSize={theme.font.size.label}
        style={[styles.chipText, selected ? styles.chipTextSelected : null]}
      >
        {label}
      </ResponsiveLabel>
    </InteractiveSurface>
  );
}

export function FilterChip({
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
  label,
  leading,
  onPress,
  selected,
  statusLabel,
  style,
  tone = 'neutral',
}: {
  accessibilityLabel?: string;
  accessibilityRole?: NonNullable<PressableProps['accessibilityRole']>;
  disabled?: boolean;
  label: string;
  leading?: ReactNode;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  statusLabel?: string;
  style?: StyleProp<ViewStyle>;
  tone?: FilterChipTone;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel ?? [label, statusLabel].filter(Boolean).join(', ')}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      minHeight={theme.layout.controlHSm}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.filterChip,
        selected ? filterChipSelectedStyle(tone) : styles.filterChipIdle,
        pressed && !disabled ? styles.filterChipPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leading}
      <ResponsiveLabel
        fontSize={theme.font.size.label}
        style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}
      >
        {label}
      </ResponsiveLabel>
      {statusLabel ? (
        <ResponsiveLabel
          fontSize={theme.font.size.micro}
          style={[styles.filterChipStatus, selected ? styles.filterChipStatusSelected : null]}
        >
          {statusLabel}
        </ResponsiveLabel>
      ) : null}
    </InteractiveSurface>
  );
}

export function ChoiceChip({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  selected,
  style,
  tone = 'neutral',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: ChoiceChipTone;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      disabled={disabled}
      minHeight={theme.layout.controlHSm}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.choiceChip,
        selected ? choiceChipSelectedStyle(tone) : styles.choiceChipIdle,
        pressed && !disabled ? styles.choiceChipPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <ResponsiveLabel
        fontSize={theme.font.size.label}
        style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}
      >
        {label}
      </ResponsiveLabel>
    </InteractiveSurface>
  );
}

function filterChipSelectedStyle(tone: FilterChipTone): StyleProp<ViewStyle> {
  return tone === 'accent' ? styles.filterChipSelectedAccent : styles.filterChipSelected;
}

function choiceChipSelectedStyle(tone: ChoiceChipTone): StyleProp<ViewStyle> {
  return tone === 'accent' ? styles.choiceChipSelectedAccent : styles.choiceChipSelected;
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  chipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  chipPressed: {
    opacity: 0.78,
  },
  chipSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  chipText: {
    color: theme.color.textBody,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
  },
  choiceChip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  choiceChipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  choiceChipPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.uiAccent,
  },
  choiceChipSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  choiceChipSelectedAccent: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  choiceChipText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  choiceChipTextSelected: {
    color: theme.color.textStrong,
  },
  disabled: {
    opacity: 0.5,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[1],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  filterChipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  filterChipPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.uiAccent,
  },
  filterChipSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  filterChipSelectedAccent: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  filterChipStatus: {
    color: theme.color.textMuted,
    flexBasis: '100%',
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
    textAlign: 'center',
  },
  filterChipStatusSelected: {
    color: theme.color.uiAccent,
  },
  filterChipText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  filterChipTextSelected: {
    color: theme.color.textStrong,
  },
});
