import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface, type InteractiveSurfaceRole } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type TabButtonIconRenderer = ({
  color,
  size,
  strokeWidth,
}: {
  color: string;
  size: number;
  strokeWidth: number;
}) => ReactNode;

const TAB_BUTTON_HIT_SLOP = theme.space[2];

export function TabButton({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'tab',
  icon,
  label,
  onPress,
  selected = false,
  style,
}: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: InteractiveSurfaceRole;
  icon: TabButtonIconRenderer;
  label: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const iconColor = selected ? theme.color.onPrimary : theme.color.textFaint;
  const strokeWidth = selected ? 2.2 : 2;

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      hitSlop={TAB_BUTTON_HIT_SLOP}
      minHeight={theme.layout.tapMin}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.tabButton,
        selected ? styles.tabButtonSelected : null,
        pressed ? styles.tabButtonPressed : null,
        style,
      ]}
    >
      {icon({ color: iconColor, size: 24, strokeWidth })}
      <ResponsiveLabel fontSize={theme.font.size.micro} style={[styles.label, selected ? styles.labelSelected : null]}>
        {label}
      </ResponsiveLabel>
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  labelSelected: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    flex: 1,
    gap: theme.space[1] + 2,
    justifyContent: 'center',
    marginHorizontal: theme.space[2],
    minHeight: theme.layout.tapMin,
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
  tabButtonSelected: {
    backgroundColor: theme.color.primary,
    ...theme.shadow.xs,
  },
});
