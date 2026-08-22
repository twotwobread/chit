import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../theme';

export type SurfaceFrameVariant = 'content' | 'hero' | 'dark' | 'shelf' | 'graphite' | 'memory' | 'ledger' | 'receipt';

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
  if (variant === 'memory') {
    return styles.memory;
  }
  if (variant === 'ledger') {
    return styles.ledger;
  }
  if (variant === 'receipt') {
    return styles.receipt;
  }
  return null;
}

const styles = StyleSheet.create({
  dark: {
    backgroundColor: theme.color.shellHighest,
    borderColor: theme.color.shellHighest,
    ...theme.shadow.md,
  },
  frame: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[5],
    width: '100%',
    ...theme.shadow.sm,
  },
  graphite: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderStrong,
    ...theme.shadow.md,
  },
  ledger: {
    backgroundColor: theme.color.ledgerSurface,
    borderColor: theme.color.borderSubtle,
  },
  memory: {
    backgroundColor: theme.color.memorySurface,
    borderColor: theme.color.borderDefault,
  },
  hero: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    gap: theme.space[5],
    padding: theme.space[6],
    ...theme.shadow.md,
  },
  receipt: {
    backgroundColor: theme.color.receiptSurface,
    borderColor: theme.color.borderDefault,
    borderStyle: 'dashed',
    shadowOpacity: 0,
  },
  shelf: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    shadowOpacity: 0,
  },
});
