import type { TripDefaultTravelMode } from '@i-um/api-contract';

export const travelModes = ['transit', 'walking', 'driving'] as const;

export type TravelMode = (typeof travelModes)[number];

export const defaultTripTravelMode: TripDefaultTravelMode = 'transit';
export const tripDefaultTravelModes = ['transit', 'driving'] as const satisfies readonly TripDefaultTravelMode[];

export const travelModeLabels: Record<TravelMode, string> = {
  transit: '대중교통',
  walking: '도보',
  driving: '자동차',
};

export const travelModeDisplayOptions = travelModes.map((mode) => travelModeLabels[mode]);
export const tripDefaultTravelModeDisplayOptions = tripDefaultTravelModes.map((mode) => travelModeLabels[mode]);

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

export type TripDefaultTravelModeOptionViewModel = {
  mode: TripDefaultTravelMode;
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
};

export type TripDefaultTravelModeSelectorViewModel = {
  label: '기본 이동 방식';
  accessibilityLabel: '기본 이동 방식 선택';
  options: TripDefaultTravelModeOptionViewModel[];
};

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === 'string' && travelModes.includes(value as TravelMode);
}

export function isTripDefaultTravelMode(value: unknown): value is TripDefaultTravelMode {
  return typeof value === 'string' && tripDefaultTravelModes.includes(value as TripDefaultTravelMode);
}

export function travelModeDisplayLabel(mode: TravelMode): string {
  return travelModeLabels[mode];
}

export function travelModeFromDisplayLabel(label: string): TravelMode | null {
  return travelModes.find((mode) => travelModeLabels[mode] === label) ?? null;
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

export function buildTripDefaultTravelModeSelectorViewModel(
  selectedMode: TripDefaultTravelMode,
): TripDefaultTravelModeSelectorViewModel {
  return {
    label: '기본 이동 방식',
    accessibilityLabel: '기본 이동 방식 선택',
    options: tripDefaultTravelModes.map((mode) => ({
      mode,
      label: travelModeLabels[mode],
      selected: mode === selectedMode,
      accessibilityLabel: travelModeLabels[mode],
      accessibilityState: { selected: mode === selectedMode },
    })),
  };
}
