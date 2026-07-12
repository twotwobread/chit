import { theme } from '../design/theme';

export type TripRootFabLayoutInput = {
  bottomInset?: number;
  rightInset?: number;
};

export type TripRootFabLayout = {
  fab: {
    bottom: number;
    right: number;
  };
  scrollContent: {
    paddingBottom: number;
  };
};

export type TripRootFabVisibilityInput = {
  hasAction: boolean;
  isBlocked: boolean;
  status: 'loading' | 'ready' | 'unavailable' | 'auth' | 'notFound' | 'error';
};

export function shouldShowTripRootFab({ hasAction, isBlocked, status }: TripRootFabVisibilityInput): boolean {
  return hasAction && !isBlocked && status === 'ready';
}

export function buildTripRootFabLayout({
  bottomInset = 0,
  rightInset = 0,
}: TripRootFabLayoutInput = {}): TripRootFabLayout {
  const safeBottomInset = Math.max(0, bottomInset);
  const safeRightInset = Math.max(0, rightInset);
  const edgeGap = theme.space[5];

  return {
    fab: {
      bottom: safeBottomInset + edgeGap,
      right: safeRightInset + edgeGap,
    },
    scrollContent: {
      paddingBottom: safeBottomInset + theme.layout.controlHLg + theme.space[7] + edgeGap * 2,
    },
  };
}
