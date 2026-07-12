import type { DayItineraryRowViewModel } from './day-itinerary';

export type DayItineraryDetailPanelViewModel = {
  title: string;
  categoryLabel: string;
  address?: string;
  detailLabel?: string;
  memo?: string;
  actions: {
    copyAddress?: {
      label: '주소 복사';
      accessibilityLabel: string;
      disabled: boolean;
      disabledHelper?: string;
    };
    edit: {
      label: '수정';
      accessibilityLabel: string;
    };
    openMap?: {
      label: '지도에서 보기';
      accessibilityLabel: string;
    };
  };
  excludedActions: ['delete', 'lodging'];
};

const excludedActions: DayItineraryDetailPanelViewModel['excludedActions'] = ['delete', 'lodging'];

export function buildDayItineraryDetailPanel(item: DayItineraryRowViewModel): DayItineraryDetailPanelViewModel {
  const address = normalizeOptionalText(item.address);
  const detailLabel = normalizeOptionalText(item.timeLabel);
  const memo = normalizeOptionalText(item.placeMemo);

  return {
    title: item.placeName,
    categoryLabel: item.placeTypeLabel,
    address,
    detailLabel,
    ...(memo ? { memo } : {}),
    actions: {
      copyAddress: address
        ? {
            label: '주소 복사',
            accessibilityLabel: `${item.placeName} 주소 복사`,
            disabled: false,
            disabledHelper: undefined,
          }
        : undefined,
      edit: {
        label: '수정',
        accessibilityLabel: `${item.placeName} 수정`,
      },
      openMap: {
        label: '지도에서 보기',
        accessibilityLabel: `${item.placeName} 지도에서 보기`,
      },
    },
    excludedActions,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim() ?? '';
  return normalized || undefined;
}
