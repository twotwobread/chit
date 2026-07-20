import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SurfaceFrame, type SurfaceFrameVariant } from '../foundation/surface-frame';
import { theme } from '../theme';

export type CardVariant = Extract<SurfaceFrameVariant, 'content' | 'hero' | 'dark' | 'shelf'>;

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

const BRAND_STAMP_SIZE: Record<BrandStampSize, { box: number; font: number; radius: number; offset: number }> = {
  sm: { box: 38, font: 18, radius: theme.radius.md, offset: 3 },
  md: { box: 52, font: 25, radius: theme.radius.lg, offset: 4 },
  lg: { box: 70, font: 34, radius: theme.radius.xl, offset: 5 },
};

export function BrandStamp({
  accessibilityLabel = '칫 브랜드 로고',
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
      style={[
        styles.brandStampWrap,
        { height: metrics.box + metrics.offset, width: metrics.box + metrics.offset },
        style,
      ]}
    >
      <View
        style={[styles.brandStampOffset, { borderRadius: metrics.radius, height: metrics.box, width: metrics.box }]}
      />
      <View style={[styles.brandStamp, { borderRadius: metrics.radius, height: metrics.box, width: metrics.box }]}>
        <Text style={[styles.brandStampText, { fontSize: metrics.font }]}>칫</Text>
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
  brandStamp: {
    alignItems: 'center',
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.shellRaised,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    transform: [{ rotate: '-3deg' }],
    ...theme.shadow.md,
  },
  brandStampOffset: {
    backgroundColor: theme.color.brandAccent,
    bottom: 0,
    position: 'absolute',
    right: 0,
    transform: [{ rotate: '-3deg' }],
  },
  brandStampText: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -1,
  },
  brandStampWrap: {
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
