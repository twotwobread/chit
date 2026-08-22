import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SurfaceFrame, type SurfaceFrameVariant } from '../foundation/surface-frame';
import { theme } from '../theme';

export type CardVariant = Extract<
  SurfaceFrameVariant,
  'content' | 'hero' | 'dark' | 'shelf' | 'memory' | 'ledger' | 'receipt'
>;

export function Card({
  children,
  style,
  variant = 'content',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
}) {
  return (
    <SurfaceFrame style={style} variant={variant}>
      {children}
    </SurfaceFrame>
  );
}

export type BrandStampSize = 'sm' | 'md' | 'lg';

const BRAND_STAMP_SIZE: Record<BrandStampSize, { box: number; dot: number; font: number }> = {
  sm: { box: 54, dot: 5, font: 24 },
  md: { box: 70, dot: 7, font: 31 },
  lg: { box: 92, dot: 9, font: 42 },
};

export function BrandStamp({
  accessibilityLabel = 'chit 브랜드 로고',
  decorative = false,
  size = 'md',
  style,
}: {
  accessibilityLabel?: string;
  decorative?: boolean;
  size?: BrandStampSize;
  style?: StyleProp<ViewStyle>;
}) {
  const metrics = BRAND_STAMP_SIZE[size];

  return (
    <View
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[styles.brandStampWrap, { minHeight: metrics.box, minWidth: metrics.box }, style]}
    >
      <View style={styles.brandStampRow}>
        <Text style={[styles.brandStampText, { fontSize: metrics.font }]}>chit</Text>
        <View style={[styles.brandStampDot, { borderRadius: metrics.dot, height: metrics.dot, width: metrics.dot }]} />
      </View>
    </View>
  );
}

export function ScreenBackground({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.screenBackground}>
      <View style={[styles.screenContent, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandStampDot: {
    alignSelf: 'flex-end',
    backgroundColor: theme.color.brandAccent,
    marginBottom: theme.space[3],
    marginLeft: theme.space[1],
  },
  brandStampRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  brandStampText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -1.8,
  },
  brandStampWrap: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    position: 'relative',
  },
  screenBackground: {
    backgroundColor: theme.color.bg,
    flex: 1,
    overflow: 'hidden',
  },
  screenContent: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
});
