import { router } from 'expo-router';
import { House, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';
import { markExplicitHomeIntent } from '../trips/home-intent';
import { BOTTOM_MENU_TABS, type BottomMenuIcon, type BottomMenuTab } from './bottom-menu-tabs';
import { SELECTED_NAV_TAB_SURFACE_STYLE } from './tab-selection';

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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            key={tab.id}
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
            style={({ pressed }) => [
              styles.item,
              focused ? styles.selectedItem : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon
              color={focused ? theme.color.onPrimary : theme.color.textFaint}
              size={24}
              strokeWidth={focused ? 2.2 : 2}
            />
            <Text style={[styles.label, focused ? styles.selectedLabel : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: theme.layout.tabbarH,
    flexDirection: 'row',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    paddingHorizontal: theme.space[6],
    paddingTop: theme.space[3],
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    gap: theme.space[1] + 2,
    marginHorizontal: theme.space[2],
    minHeight: theme.layout.tapMin,
  },
  label: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  selectedItem: SELECTED_NAV_TAB_SURFACE_STYLE,
  selectedLabel: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
});
