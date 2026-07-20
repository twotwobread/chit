import type { PressableProps } from 'react-native';

export function buildAccessibilityState({
  busy,
  disabled,
  expanded,
  selected,
}: {
  busy?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
}): PressableProps['accessibilityState'] {
  const state: NonNullable<PressableProps['accessibilityState']> = {};

  if (busy !== undefined) {
    state.busy = busy;
  }
  if (disabled !== undefined) {
    state.disabled = disabled;
  }
  if (expanded !== undefined) {
    state.expanded = expanded;
  }
  if (selected !== undefined) {
    state.selected = selected;
  }

  return state;
}
