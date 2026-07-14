import type { ComponentType } from 'react';
import { Stack } from 'expo-router';
import { View, type ViewProps } from 'react-native';

import { useDesignFonts } from '../lib/design';
import { rootStackScreenOptions } from '../lib/navigation/root-stack-options';

type GestureHandlerModule = {
  GestureHandlerRootView?: ComponentType<ViewProps>;
};

function resolveGestureHandlerRootView(): ComponentType<ViewProps> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- RNGH can throw during native initialization in Expo Go, so keep it optional.
    const gestureHandler = require('react-native-gesture-handler') as GestureHandlerModule;
    return gestureHandler.GestureHandlerRootView ?? View;
  } catch {
    return View;
  }
}

const AppRootView = resolveGestureHandlerRootView();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useDesignFonts();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppRootView style={{ flex: 1 }}>
      <Stack screenOptions={rootStackScreenOptions} />
    </AppRootView>
  );
}
