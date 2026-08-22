import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { theme } from '../theme';

export type FloatingActionButtonTone = 'coral' | 'ink';

const FAB_HIT_SLOP = theme.space[3];

export function FloatingActionButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  onPress,
  style,
  tone = 'ink',
}: {
  accessibilityLabel: string;
  accessibilityHint: string;
  children: ReactNode;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  tone?: FloatingActionButtonTone;
}) {
  const isCoral = tone === 'coral';

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
        isCoral ? styles.floatingActionButtonCoral : styles.floatingActionButtonInk,
        pressed ? (isCoral ? styles.floatingActionButtonCoralPressed : styles.floatingActionButtonInkPressed) : null,
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
  floatingActionButtonCoral: {
    backgroundColor: theme.color.actionPrimary,
  },
  floatingActionButtonCoralPressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
  },
  floatingActionButtonInk: {
    backgroundColor: theme.color.shellHighest,
  },
  floatingActionButtonInkPressed: {
    backgroundColor: theme.color.chit.inkRaised,
  },
});
