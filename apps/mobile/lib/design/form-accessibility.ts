export type FieldErrorMap<TKey extends string> = Partial<Record<TKey, string | null | undefined>>;

export function firstInvalidFieldKey<TKey extends string>(
  fieldOrder: readonly TKey[],
  errors: FieldErrorMap<TKey>,
): TKey | null {
  for (const key of fieldOrder) {
    const error = errors[key];
    if (typeof error === 'string' && error.trim().length > 0) {
      return key;
    }
  }

  return null;
}

export function buildFieldAccessibilityHint({
  disabled = false,
  errorText,
  helperText,
  required = false,
}: {
  disabled?: boolean;
  errorText?: string | null;
  helperText?: string | null;
  required?: boolean;
}): string | undefined {
  const parts: string[] = [];
  if (required) {
    parts.push('필수 입력 항목입니다.');
  }
  if (disabled) {
    parts.push('현재 비활성화되어 있어요.');
  }

  const normalizedError = errorText?.trim();
  if (normalizedError) {
    parts.push(`오류: ${normalizedError}`);
    return parts.join(' ');
  }

  const normalizedHelper = helperText?.trim();
  if (normalizedHelper) {
    parts.push(normalizedHelper);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}
