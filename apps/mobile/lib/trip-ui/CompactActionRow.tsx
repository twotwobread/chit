import type { ReactNode } from 'react';
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../design/foundation/interactive-surface';
import { theme } from '../design';

export function CompactActionRow({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  children,
  disabled = false,
  minHeight = theme.layout.tapMin,
  onPress,
  pressedStyle,
  selected = false,
  style,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: NonNullable<PressableProps['accessibilityRole']>;
  children: ReactNode;
  disabled?: boolean;
  minHeight?: number;
  onPress?: PressableProps['onPress'];
  pressedStyle?: StyleProp<ViewStyle>;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rowStyle: StyleProp<ViewStyle> = [styles.row, { minHeight }, style];

  if (onPress) {
    return (
      <InteractiveSurface
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        disabled={disabled}
        minHeight={minHeight}
        onPress={onPress}
        selected={selected}
        style={({ pressed }) => [rowStyle, pressed && !disabled ? (pressedStyle ?? styles.pressed) : null]}
      >
        {children}
      </InteractiveSurface>
    );
  }

  return (
    <View accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  row: {
    minHeight: theme.layout.tapMin,
  },
});
