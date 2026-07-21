import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { theme } from '../theme';

export type FloatingActionButtonTone = 'lime' | 'graphite';

const FAB_HIT_SLOP = theme.space[3];

export function FloatingActionButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  onPress,
  style,
  tone = 'graphite',
}: {
  accessibilityLabel: string;
  accessibilityHint: string;
  children: ReactNode;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  tone?: FloatingActionButtonTone;
}) {
  const lime = tone === 'lime';

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={FAB_HIT_SLOP}
      minHeight={theme.layout.controlHLg}
      minWidth={theme.layout.controlHLg}
      onPress={onPress}
      style={({ pressed }) => [
        styles.floatingActionButton,
        lime ? styles.floatingActionButtonLime : styles.floatingActionButtonGraphite,
        pressed ? (lime ? styles.floatingActionButtonLimePressed : styles.floatingActionButtonGraphitePressed) : null,
        style,
      ]}
    >
      {children}
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  floatingActionButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
    minHeight: theme.layout.controlHLg,
    minWidth: theme.layout.controlHLg,
    position: 'absolute',
    width: theme.layout.controlHLg,
    zIndex: 10,
    ...theme.shadow.lg,
  },
  floatingActionButtonGraphite: {
    backgroundColor: theme.color.actionPrimary,
  },
  floatingActionButtonGraphitePressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
  },
  floatingActionButtonLime: {
    backgroundColor: theme.color.uiAccent,
  },
  floatingActionButtonLimePressed: {
    backgroundColor: theme.color.primaryPressed,
  },
});
