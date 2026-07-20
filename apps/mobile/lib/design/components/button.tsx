import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ActionGroup } from '../foundation/action-group';
import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { buildCriticalTextLayout } from '../responsive-text';
import { theme } from '../theme';

export type PrimaryButtonTone = 'graphite' | 'lime';

export function PrimaryButton({
  accessibilityLabel,
  disabled,
  label,
  loading,
  loadingLabel,
  onPress,
  style,
  tone = 'graphite',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  tone?: PrimaryButtonTone;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlH,
    verticalPadding: theme.space[4],
  });
  const isDisabled = disabled || loading;
  const visibleLabel = loading ? (loadingLabel ?? label) : label;
  const isLime = tone === 'lime';
  const spinnerColor = isLime ? theme.color.onUiAccent : theme.color.onActionPrimary;

  return (
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel ?? visibleLabel}
      accessibilityRole="button"
      busy={loading}
      disabled={isDisabled}
      minHeight={textLayout.minHeight}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        isLime ? styles.primaryButtonLime : styles.primaryButtonGraphite,
        pressed && !isDisabled ? (isLime ? styles.primaryButtonLimePressed : styles.primaryButtonPressed) : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={spinnerColor} />
          <ResponsiveLabel
            fontSize={theme.font.size.label}
            style={[styles.primaryButtonText, isLime ? styles.primaryButtonTextLime : null]}
          >
            {visibleLabel}
          </ResponsiveLabel>
        </View>
      ) : (
        <ResponsiveLabel
          fontSize={theme.font.size.label}
          style={[styles.primaryButtonText, isLime ? styles.primaryButtonTextLime : null]}
        >
          {label}
        </ResponsiveLabel>
      )}
    </InteractiveSurface>
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
    <InteractiveSurface
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      minHeight={textLayout.minHeight}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <ResponsiveLabel fontSize={theme.font.size.label} style={styles.secondaryButtonText}>
        {label}
      </ResponsiveLabel>
    </InteractiveSurface>
  );
}

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <ActionGroup>{children}</ActionGroup>;
}

const styles = StyleSheet.create({
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
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  primaryButtonGraphite: {
    backgroundColor: theme.color.actionPrimary,
  },
  primaryButtonLime: {
    backgroundColor: theme.color.uiAccent,
  },
  primaryButtonLimePressed: {
    backgroundColor: theme.color.primaryPressed,
  },
  primaryButtonPressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
  },
  primaryButtonText: {
    color: theme.color.onActionPrimary,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  primaryButtonTextLime: {
    color: theme.color.onUiAccent,
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
    borderColor: theme.color.shellHighest,
  },
  secondaryButtonText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
