import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { theme } from '../theme';

export type IconButtonVariant = 'plain' | 'soft' | 'onDark' | 'ghostOnDark';

const ICON_BUTTON_HIT_SLOP = theme.space[3];

export function IconButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled,
  onPress,
  selected,
  style,
  variant = 'plain',
}: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: IconButtonVariant;
}) {
  const variantStyle =
    variant === 'soft'
      ? styles.iconButtonSoft
      : variant === 'onDark'
        ? styles.iconButtonOnDark
        : variant === 'ghostOnDark'
          ? styles.iconButtonGhostOnDark
          : styles.iconButtonPlain;
  const pressedStyle =
    variant === 'onDark' || variant === 'ghostOnDark' ? styles.iconButtonOnDarkPressed : styles.iconButtonPressed;

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={ICON_BUTTON_HIT_SLOP}
      minHeight={theme.layout.tapMin}
      minWidth={theme.layout.tapMin}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.iconButton,
        variantStyle,
        selected ? styles.iconButtonSelected : null,
        pressed && !disabled ? pressedStyle : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {children}
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  iconButtonGhostOnDark: {
    backgroundColor: 'transparent',
  },
  iconButtonOnDark: {
    backgroundColor: theme.color.shellElevated,
    borderColor: theme.color.shellRaised,
    borderWidth: 1,
  },
  iconButtonOnDarkPressed: {
    backgroundColor: theme.color.shellRaised,
  },
  iconButtonPlain: {
    backgroundColor: 'transparent',
  },
  iconButtonPressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  iconButtonSelected: {
    backgroundColor: theme.color.uiAccent,
    borderColor: theme.color.uiAccent,
  },
  iconButtonSoft: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderWidth: 1,
    ...theme.shadow.xs,
  },
});
