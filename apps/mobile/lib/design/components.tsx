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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[6],
    ...theme.shadow.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  primaryButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  primaryButtonText: {
    color: theme.color.onPrimary,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.color.primarySoft,
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
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
