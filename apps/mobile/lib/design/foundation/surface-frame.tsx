import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../theme';

export type SurfaceFrameVariant = 'content' | 'hero' | 'dark' | 'shelf' | 'graphite';

export type SurfaceFrameProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: SurfaceFrameVariant;
};

export function SurfaceFrame({ children, style, variant = 'content' }: SurfaceFrameProps) {
  return <View style={[styles.frame, surfaceFrameVariantStyle(variant), style]}>{children}</View>;
}

function surfaceFrameVariantStyle(variant: SurfaceFrameVariant): StyleProp<ViewStyle> {
  if (variant === 'hero') {
    return styles.hero;
  }
  if (variant === 'dark') {
    return styles.dark;
  }
  if (variant === 'shelf') {
    return styles.shelf;
  }
  if (variant === 'graphite') {
    return styles.graphite;
  }
  return null;
}

const styles = StyleSheet.create({
  dark: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.shellRaised,
    ...theme.shadow.md,
  },
  frame: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.sm,
  },
  graphite: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.shellRaised,
    ...theme.shadow.md,
  },
  hero: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    gap: theme.space[5],
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  shelf: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderSubtle,
    shadowOpacity: 0,
  },
});
