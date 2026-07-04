import { AccessibilityInfo, findNodeHandle } from 'react-native';

type AccessibilityFocusable = Parameters<typeof findNodeHandle>[0];

const accessibilityFocusDelayMs = 120;

export function focusAccessibilityHandle(handle?: number | null): boolean {
  if (typeof handle !== 'number') {
    return false;
  }

  setTimeout(() => {
    AccessibilityInfo.setAccessibilityFocus(handle);
  }, accessibilityFocusDelayMs);
  return true;
}

export function focusAccessibilityNode(node: AccessibilityFocusable): boolean {
  return focusAccessibilityHandle(findNodeHandle(node));
}
