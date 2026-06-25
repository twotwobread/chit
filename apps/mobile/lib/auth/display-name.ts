export const DISPLAY_NAME_VALIDATION_MESSAGE = '이름은 1~20자로 입력해주세요.';

const MAX_DISPLAY_NAME_CODE_POINTS = 20;

export type DisplayNameValidationResult = { valid: true; value: string } | { valid: false; message: string };

export function normalizeDisplayNameInput(input: string): DisplayNameValidationResult {
  const value = input.trim();
  if (value.length === 0 || [...value].length > MAX_DISPLAY_NAME_CODE_POINTS) {
    return { valid: false, message: DISPLAY_NAME_VALIDATION_MESSAGE };
  }
  return { valid: true, value };
}
