import { Stack } from 'expo-router';

import { theme, useDesignFonts } from '../lib/design';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useDesignFonts();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        title: 'i-um',
        contentStyle: { backgroundColor: theme.color.bg },
        headerStyle: { backgroundColor: theme.color.bg },
        headerTintColor: theme.color.textStrong,
        headerTitleStyle: { fontFamily: theme.font.family.bold, fontWeight: theme.font.weight.bold },
      }}
    />
  );
}
