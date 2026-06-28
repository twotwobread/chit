import { Tabs } from 'expo-router';

import { theme } from '../../../../lib/design';
import { TripTabBar } from '../../../../lib/navigation/TripTabBar';

export default function TripTabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.color.bg },
      }}
      tabBar={(props) => <TripTabBar {...props} />}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="itinerary" />
      <Tabs.Screen name="settle" />
    </Tabs>
  );
}
