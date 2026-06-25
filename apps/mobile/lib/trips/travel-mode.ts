export const travelModes = ['transit', 'walking', 'driving'] as const;

export type TravelMode = (typeof travelModes)[number];

export const defaultTravelMode = 'transit' as const;

export const travelModeLabels: Record<TravelMode, string> = {
  transit: '대중교통',
  walking: '도보',
  driving: '자동차',
};

export const travelModeStorageKey = 'i-um.trips.travel-mode.v1';

export type TravelModeStore = {
  getItem: () => Promise<string | null>;
  setItem: (value: string) => Promise<void>;
  deleteItem: () => Promise<void>;
};

export type StoredTravelModeReadResult =
  | { status: 'ready'; mode: TravelMode }
  | { status: 'default'; mode: typeof defaultTravelMode; reason: 'missing' | 'invalid' | 'unreadable' };

export type StoredTravelModeWriteResult =
  | { status: 'saved'; mode: TravelMode; userMessage: null }
  | { status: 'failed'; mode: TravelMode; userMessage: null };

export type TravelModeOptionViewModel = {
  mode: TravelMode;
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
};

export type TravelModeSelectorViewModel = {
  label: '이동 모드';
  accessibilityLabel: '이동 모드 선택';
  options: TravelModeOptionViewModel[];
};

const secureTravelModeStore: TravelModeStore = {
  getItem: async () => {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(travelModeStorageKey);
  },
  setItem: async (value) => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(travelModeStorageKey, value);
  },
  deleteItem: async () => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(travelModeStorageKey);
  },
};

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === 'string' && travelModes.includes(value as TravelMode);
}

export function buildTravelModeSelectorViewModel(selectedMode: TravelMode): TravelModeSelectorViewModel {
  return {
    label: '이동 모드',
    accessibilityLabel: '이동 모드 선택',
    options: travelModes.map((mode) => ({
      mode,
      label: travelModeLabels[mode],
      selected: mode === selectedMode,
      accessibilityLabel: travelModeLabels[mode],
      accessibilityState: { selected: mode === selectedMode },
    })),
  };
}

export async function readStoredTravelMode(
  store: TravelModeStore = secureTravelModeStore,
): Promise<StoredTravelModeReadResult> {
  let raw: string | null;
  try {
    raw = await store.getItem();
  } catch {
    return { status: 'default', mode: defaultTravelMode, reason: 'unreadable' };
  }

  if (!raw) {
    return { status: 'default', mode: defaultTravelMode, reason: 'missing' };
  }

  if (isTravelMode(raw)) {
    return { status: 'ready', mode: raw };
  }

  try {
    await store.deleteItem();
  } catch {
    // Invalid values should not block the default fallback.
  }

  return { status: 'default', mode: defaultTravelMode, reason: 'invalid' };
}

export async function saveSelectedTravelMode(
  mode: TravelMode,
  store: TravelModeStore = secureTravelModeStore,
): Promise<StoredTravelModeWriteResult> {
  try {
    await store.setItem(mode);
    return { status: 'saved', mode, userMessage: null };
  } catch {
    return { status: 'failed', mode, userMessage: null };
  }
}
