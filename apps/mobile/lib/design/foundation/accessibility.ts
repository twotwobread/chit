import type { PressableProps } from 'react-native';

type AccessibilityCheckedState = NonNullable<PressableProps['accessibilityState']>['checked'];

export function buildAccessibilityState({
  busy,
  checked,
  disabled,
  expanded,
  selected,
}: {
  busy?: boolean;
  checked?: AccessibilityCheckedState;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
}): PressableProps['accessibilityState'] {
  const state: NonNullable<PressableProps['accessibilityState']> = {};

  if (busy !== undefined) {
    state.busy = busy;
  }
  if (checked !== undefined) {
    state.checked = checked;
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
