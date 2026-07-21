import { router } from 'expo-router';
import { House, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton, theme } from '../design';
import { markExplicitHomeIntent } from '../trips/home-intent';
import { BOTTOM_MENU_TABS, type BottomMenuIcon, type BottomMenuTab } from './bottom-menu-tabs';

type BottomMenuProps = {
  selected: BottomMenuTab;
};

const ICONS: Record<BottomMenuIcon, typeof House> = {
  house: House,
  'user-round': UserRound,
};

export function BottomMenu({ selected }: BottomMenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, theme.space[3]) }]}>
      {BOTTOM_MENU_TABS.map((tab) => {
        const focused = selected === tab.id;
        const Icon = ICONS[tab.icon];

        return (
          <TabButton
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            icon={({ color, size, strokeWidth }) => <Icon color={color} size={size} strokeWidth={strokeWidth} />}
            key={tab.id}
            label={tab.label}
            onPress={() => {
              if (focused) {
                return;
              }
              if (tab.id === 'home') {
                markExplicitHomeIntent();
                router.replace('/');
                return;
              }
              router.replace('/mypage');
            }}
            selected={focused}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.shellElevated,
    borderTopColor: theme.color.borderDefault,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: theme.layout.tabbarH,
    paddingHorizontal: theme.space[6],
    paddingTop: theme.space[3],
    width: '100%',
  },
});
