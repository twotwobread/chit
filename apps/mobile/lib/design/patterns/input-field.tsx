import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { buildFieldAccessibilityHint } from '../form-accessibility';
import { theme } from '../theme';
import { FormField } from './form-field';

export type TextInputFieldProps = Omit<TextInputProps, 'placeholderTextColor' | 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  errorText?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label: string;
  required?: boolean;
};

export const TextInputField = forwardRef<TextInput, TextInputFieldProps>(function TextInputField(
  {
    accessibilityHint,
    accessibilityLabel,
    containerStyle,
    disabled = false,
    editable,
    errorText,
    helperText,
    inputStyle,
    label,
    multiline = false,
    required = false,
    ...inputProps
  },
  ref,
) {
  const resolvedAccessibilityHint = buildFieldAccessibilityHint({ disabled, errorText, helperText, required });
  const isEditable = !disabled && editable !== false;

  return (
    <FormField
      disabled={disabled}
      errorText={errorText}
      helperText={helperText}
      label={label}
      required={required}
      style={containerStyle}
    >
      <TextInput
        accessibilityHint={accessibilityHint ?? resolvedAccessibilityHint}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        accessibilityValue={errorText ? { text: `오류: ${errorText}` } : undefined}
        editable={isEditable}
        multiline={multiline}
        placeholderTextColor={theme.color.textFaint}
        ref={ref}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          errorText ? styles.inputError : null,
          inputStyle,
        ]}
        {...inputProps}
      />
    </FormField>
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  inputError: {
    borderColor: theme.color.danger,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
