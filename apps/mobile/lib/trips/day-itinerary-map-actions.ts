import { buildExternalMapUrl, buildGoogleMapsSearchUrl, type MapProvider } from './map-provider';

export { buildGoogleMapsSearchUrl };

export type DayItineraryMapActionInput = {
  placeName: string;
  address?: string | null;
};

export type DayItineraryMapActionFeedback = {
  kind: 'success' | 'error';
  message: string;
};

export type DayItineraryMapRowActions = {
  map: {
    label: '지도';
    accessibilityLabel: string;
    url: string;
    successFeedback: null;
    failureFeedback: string;
  };
  copy: {
    label: '주소 복사';
    accessibilityLabel: string;
    address?: string;
    disabled: boolean;
    disabledHelper?: string;
    successFeedback: string;
    failureFeedback: string;
  };
};

const copySuccessMessage = '주소를 복사했어요.';
const mapFailureMessage = '지도를 열 수 없어요. 잠시 후 다시 시도해주세요.';
const copyFailureMessage = '주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.';
const missingAddressHelper = '주소 정보가 없어요.';

export function buildDayItineraryMapRowActions(
  input: DayItineraryMapActionInput,
  mapProvider: MapProvider = 'googleMaps',
): DayItineraryMapRowActions {
  const address = normalizeAddress(input.address);

  return {
    map: {
      label: '지도',
      accessibilityLabel: `${input.placeName} 지도 열기`,
      url: buildExternalMapUrl({ placeName: input.placeName, address }, mapProvider),
      successFeedback: null,
      failureFeedback: mapFailureMessage,
    },
    copy: {
      label: '주소 복사',
      accessibilityLabel: `${input.placeName} 주소 복사`,
      address: address || undefined,
      disabled: !address,
      disabledHelper: address ? undefined : missingAddressHelper,
      successFeedback: copySuccessMessage,
      failureFeedback: copyFailureMessage,
    },
  };
}

export function dayItineraryMapActionSuccessState(action: 'map' | 'copy'): DayItineraryMapActionFeedback | null {
  if (action === 'map') {
    return null;
  }

  return { kind: 'success', message: copySuccessMessage };
}

export function dayItineraryMapActionFailureState(action: 'map' | 'copy'): DayItineraryMapActionFeedback {
  if (action === 'map') {
    return { kind: 'error', message: mapFailureMessage };
  }

  return { kind: 'error', message: copyFailureMessage };
}

function normalizeAddress(address: string | null | undefined): string {
  return address?.trim() ?? '';
}
