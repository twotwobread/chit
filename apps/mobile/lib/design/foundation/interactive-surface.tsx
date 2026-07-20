import type { ReactNode } from 'react';
import { Pressable, type Insets, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { buildAccessibilityState } from './accessibility';
import { theme } from '../theme';

export type InteractiveSurfaceCheckedState = NonNullable<PressableProps['accessibilityState']>['checked'];

export type InteractiveSurfaceState = {
  pressed: boolean;
  disabled: boolean;
  busy: boolean;
  selected: boolean;
};

export type InteractiveSurfaceRole = NonNullable<PressableProps['accessibilityRole']>;

export type InteractiveSurfaceProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: InteractiveSurfaceRole;
  busy?: boolean;
  checked?: InteractiveSurfaceCheckedState;
  children: ReactNode | ((state: InteractiveSurfaceState) => ReactNode);
  disabled?: boolean;
  expanded?: boolean;
  hitSlop?: Insets | number;
  minHeight?: number;
  minWidth?: number;
  onPress?: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle> | ((state: InteractiveSurfaceState) => StyleProp<ViewStyle>);
};

export function InteractiveSurface({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  busy = false,
  checked,
  children,
  disabled = false,
  expanded,
  hitSlop,
  minHeight,
  minWidth,
  onPress,
  selected,
  style,
}: InteractiveSurfaceProps) {
  const isDisabled = disabled || busy;
  const isSelected = selected ?? false;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={buildAccessibilityState({ busy, checked, disabled: isDisabled, expanded, selected })}
      disabled={isDisabled}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => {
        const state = { busy, disabled: isDisabled, pressed, selected: isSelected };
        return [
          { minHeight: minHeight ?? theme.layout.tapMin, minWidth: minWidth ?? undefined },
          typeof style === 'function' ? style(state) : style,
        ];
      }}
    >
      {({ pressed }) =>
        typeof children === 'function'
          ? children({ busy, disabled: isDisabled, pressed, selected: isSelected })
          : children
      }
    </Pressable>
  );
}
