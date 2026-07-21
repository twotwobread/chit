import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Compass, ListOrdered, Map as MapIcon, ReceiptText, Wallet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton, theme } from '../design';
import { isTripRootTab, tripTabPathWithState } from '../trips/routes';

type TripTabRoute = {
  key: string;
  name: string;
  params?: Readonly<object>;
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
  expenses: ReceiptText,
  itinerary: ListOrdered,
  map: MapIcon,
  settle: Wallet,
  today: Compass,
};

const LABELS: Record<string, string> = {
  expenses: '지출',
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
          <TabButton
            accessibilityLabel={label}
            accessibilityRole="tab"
            icon={({ color, size, strokeWidth }) => <Icon color={color} size={size} strokeWidth={strokeWidth} />}
            key={route.key}
            label={label}
            onPress={() => {
              const event = navigation.emit({ canPreventDefault: true, target: route.key, type: 'tabPress' });
              if (!focused && !event.defaultPrevented) {
                if (tripId && isTripRootTab(route.name)) {
                  router.replace(
                    tripTabPathWithState(tripId, route.name, route.params as Record<string, unknown> | undefined),
                  );
                  return;
                }
                navigation.navigate(route.name);
              }
            }}
            selected={focused}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: theme.color.shellElevated,
    borderTopColor: theme.color.borderDefault,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: theme.space[3],
  },
});
