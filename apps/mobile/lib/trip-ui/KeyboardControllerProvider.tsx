import type { ComponentType, ReactNode } from 'react';
import { Fragment } from 'react';

export type KeyboardControllerProviderProps = {
  children: ReactNode;
};

type NativeKeyboardProviderProps = KeyboardControllerProviderProps & {
  navigationBarTranslucent?: boolean;
  statusBarTranslucent?: boolean;
};

type KeyboardControllerModule = {
  KeyboardProvider?: ComponentType<NativeKeyboardProviderProps>;
};

function FallbackKeyboardProvider({ children }: KeyboardControllerProviderProps) {
  return <Fragment>{children}</Fragment>;
}

function resolveKeyboardProvider(): ComponentType<NativeKeyboardProviderProps> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module is absent in Expo Go; keep app boot safe there.
    const keyboardController = require('react-native-keyboard-controller') as KeyboardControllerModule;
    return keyboardController.KeyboardProvider ?? FallbackKeyboardProvider;
  } catch {
    return FallbackKeyboardProvider;
  }
}

const ResolvedKeyboardProvider = resolveKeyboardProvider();

export function KeyboardControllerProvider({ children }: KeyboardControllerProviderProps) {
  return <ResolvedKeyboardProvider>{children}</ResolvedKeyboardProvider>;
}
