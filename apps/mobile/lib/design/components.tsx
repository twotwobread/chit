import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { buildCriticalTextLayout } from './responsive-text';
import { theme } from './theme';

export type CardVariant = 'content' | 'hero' | 'dark' | 'shelf';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export function Card({ children, style, variant = 'content' }: CardProps) {
  const variantStyle =
    variant === 'hero'
      ? styles.cardHero
      : variant === 'dark'
        ? styles.cardDark
        : variant === 'shelf'
          ? styles.cardShelf
          : null;

  return <View style={[styles.card, variantStyle, style]}>{children}</View>;
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
        {
          height: metrics.box + metrics.offset,
          width: metrics.box + metrics.offset,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.brandStampOffset,
          {
            borderRadius: metrics.radius,
            height: metrics.box,
            width: metrics.box,
          },
        ]}
      />
      <View
        style={[
          styles.brandStamp,
          {
            borderRadius: metrics.radius,
            height: metrics.box,
            width: metrics.box,
          },
        ]}
      >
        <Text style={[styles.brandStampText, { fontSize: metrics.font }]}>칫</Text>
      </View>
    </View>
  );
}

export function ScreenBackground({
  children,
  glow = true,
  style,
}: {
  children: ReactNode;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.screenBackground}>
      {glow ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.shellGlowLayer}
        >
          <View style={styles.shellGlow} />
          <View style={styles.shellGlowSoft} />
        </View>
      ) : null}
      <View style={[styles.screenContent, style]}>{children}</View>
    </View>
  );
}

export function PrimaryButton({
  accessibilityLabel,
  disabled,
  label,
  loading,
  loadingLabel,
  onPress,
  style,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlH,
    verticalPadding: theme.space[4],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { minHeight: textLayout.minHeight },
        pressed && !disabled && !loading ? styles.primaryButtonPressed : null,
        disabled || loading ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.color.onPrimary} />
          <Text style={[styles.primaryButtonText, { lineHeight: textLayout.lineHeight }]}>{loadingLabel ?? label}</Text>
        </View>
      ) : (
        <Text style={[styles.primaryButtonText, { lineHeight: textLayout.lineHeight }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  style,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlH,
    verticalPadding: theme.space[4],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { minHeight: textLayout.minHeight },
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.secondaryButtonText, { lineHeight: textLayout.lineHeight }]}>{label}</Text>
    </Pressable>
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
    backgroundColor: theme.color.primary,
    bottom: 0,
    position: 'absolute',
    right: 0,
    transform: [{ rotate: '-3deg' }],
  },
  brandStampText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -1,
  },
  brandStampWrap: {
    position: 'relative',
  },
  card: {
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
  cardDark: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.shellRaised,
    ...theme.shadow.md,
  },
  cardHero: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    gap: theme.space[5],
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  cardShelf: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderSubtle,
    shadowOpacity: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    justifyContent: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  primaryButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: theme.color.onPrimary,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.primaryPressed,
  },
  secondaryButtonText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  shellGlow: {
    backgroundColor: theme.color.shellGlow,
    borderRadius: 170,
    height: 340,
    position: 'absolute',
    right: -130,
    top: -145,
    width: 340,
  },
  shellGlowLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  shellGlowSoft: {
    backgroundColor: theme.color.shellGlowSoft,
    borderRadius: 135,
    height: 270,
    position: 'absolute',
    right: 18,
    top: 78,
    width: 270,
  },
});
