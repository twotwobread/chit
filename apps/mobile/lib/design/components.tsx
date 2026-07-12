import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && !loading ? styles.primaryButtonPressed : null,
        disabled || loading ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.color.onPrimary} />
          <Text style={styles.primaryButtonText}>{loadingLabel ?? label}</Text>
        </View>
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
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
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  primaryButtonPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  primaryButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonPressed: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primaryPressed,
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  disabled: {
    opacity: 0.5,
  },
});
