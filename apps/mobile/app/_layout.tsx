import type { ComponentType } from 'react';
import { Stack } from 'expo-router';
import { View, type ViewProps } from 'react-native';

import { theme, useDesignFonts } from '../lib/design';

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
      <Stack
        screenOptions={{
          title: 'i-um',
          contentStyle: { backgroundColor: theme.color.bg },
          headerStyle: { backgroundColor: theme.color.bg },
          headerTintColor: theme.color.textStrong,
          headerTitleStyle: { fontFamily: theme.font.family.bold, fontWeight: theme.font.weight.bold },
        }}
      />
    </AppRootView>
  );
}
