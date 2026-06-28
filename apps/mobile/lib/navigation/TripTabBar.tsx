import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Compass, ListOrdered, Map as MapIcon, Wallet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';
import { isTripRootTab, tripTabPath } from '../trips/routes';

type TripTabRoute = {
  key: string;
  name: string;
};

type TabPressEvent = {
  type: 'tabPress';
  target: string;
  canPreventDefault: true;
};

export type TripTabBarProps = {
  state: {
    index: number;
    routes: TripTabRoute[];
  };
  navigation: {
    emit: (event: TabPressEvent) => { defaultPrevented?: boolean };
    navigate: (routeName: string) => void;
  };
};

const ICONS: Record<string, typeof Compass> = {
  itinerary: ListOrdered,
  map: MapIcon,
  settle: Wallet,
  today: Compass,
};

const LABELS: Record<string, string> = {
  itinerary: '일정',
  map: '지도',
  settle: '정산',
  today: '오늘',
};

export function TripTabBar({ navigation, state }: TripTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.space[3]) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name] ?? Compass;
        const label = LABELS[route.name] ?? route.name;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ canPreventDefault: true, target: route.key, type: 'tabPress' });
              if (!focused && !event.defaultPrevented) {
                if (tripId && isTripRootTab(route.name)) {
                  router.replace(tripTabPath(tripId, route.name));
                  return;
                }
                navigation.navigate(route.name);
              }
            }}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <Icon
              color={focused ? theme.color.primary : theme.color.textFaint}
              size={24}
              strokeWidth={focused ? 2.2 : 2}
            />
            <Text style={[styles.label, focused ? styles.labelActive : null]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: theme.space[3],
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: theme.space[1] + 2,
    minHeight: theme.layout.tapMin,
  },
  label: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  labelActive: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
});
