import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';

type BottomMenuTab = 'home' | 'my';

type BottomMenuProps = {
  selected: BottomMenuTab;
};

export function BottomMenu({ selected }: BottomMenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, theme.space[3]) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selected === 'home' }}
        onPress={() => {
          if (selected !== 'home') {
            router.replace('/');
          }
        }}
        style={[styles.item, selected === 'home' ? styles.selectedItem : null]}
      >
        <Text style={[styles.label, selected === 'home' ? styles.selectedLabel : null]}>오늘</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selected === 'my' }}
        onPress={() => {
          if (selected !== 'my') {
            router.replace('/mypage');
          }
        }}
        style={[styles.item, selected === 'my' ? styles.selectedItem : null]}
      >
        <Text style={[styles.label, selected === 'my' ? styles.selectedLabel : null]}>마이</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: theme.layout.tabbarH,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.space[4],
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    paddingHorizontal: theme.space[6],
    paddingVertical: theme.space[3],
  },
  item: {
    flex: 1,
    maxWidth: theme.layout.cardMaxW,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    minHeight: theme.layout.tapMin,
  },
  selectedItem: {
    backgroundColor: theme.color.primarySoft,
  },
  label: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  selectedLabel: {
    color: theme.color.primary,
  },
});
