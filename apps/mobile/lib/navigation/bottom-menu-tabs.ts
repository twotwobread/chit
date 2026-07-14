export type BottomMenuTab = 'home' | 'my';

export type BottomMenuIcon = 'house' | 'user-round';

export type BottomMenuTabConfig = {
  icon: BottomMenuIcon;
  id: BottomMenuTab;
  label: string;
};

export const BOTTOM_MENU_TABS = [
  { icon: 'house', id: 'home', label: '홈' },
  { icon: 'user-round', id: 'my', label: '마이' },
] as const satisfies readonly BottomMenuTabConfig[];
