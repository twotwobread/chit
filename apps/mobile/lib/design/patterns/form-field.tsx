import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type FormFieldTone = 'default' | 'danger';

export function FormField({
  children,
  disabled,
  errorText,
  helperText,
  label,
  required,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  disabled?: boolean;
  errorText?: string;
  helperText?: string;
  label: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: FormFieldTone;
}) {
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.formField, disabled ? styles.disabled : null, style]}>
      <View style={styles.formLabelRow}>
        <ResponsiveLabel
          fontSize={theme.font.size.label}
          style={[styles.formLabel, tone === 'danger' || hasError ? styles.formLabelDanger : null]}
        >
          {label}
        </ResponsiveLabel>
        {required ? <Text style={styles.formRequired}>필수</Text> : null}
      </View>
      {children}
      {errorText ? (
        <ResponsiveLabel
          accessibilityLabel={errorText}
          accessibilityLiveRegion="polite"
          fontSize={theme.font.size.caption}
          style={styles.formErrorText}
        >
          {errorText}
        </ResponsiveLabel>
      ) : helperText ? (
        <ResponsiveLabel fontSize={theme.font.size.caption} style={styles.formHelperText}>
          {helperText}
        </ResponsiveLabel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  formErrorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  formField: {
    gap: theme.space[3],
    width: '100%',
  },
  formHelperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  formLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  formLabelDanger: {
    color: theme.color.danger,
  },
  formLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  formRequired: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
    paddingHorizontal: theme.space[2],
  },
});
