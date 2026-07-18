import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
  type DayItineraryMapActionInput,
} from '../trips/day-itinerary-map-actions';
import type { MapProvider } from '../trips/map-provider';

type UseDayItineraryMapActionsOptions = {
  discardReorder: () => void;
  mapProvider?: MapProvider;
};

export function useDayItineraryMapActions({
  discardReorder,
  mapProvider = 'googleMaps',
}: UseDayItineraryMapActionsOptions) {
  const [mapActionFeedback, setMapActionFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const clearMapActionFeedback = useCallback(() => {
    setMapActionFeedback(null);
  }, []);

  const openPlaceMap = useCallback(
    async (item: DayItineraryMapActionInput) => {
      discardReorder();
      const actions = buildDayItineraryMapRowActions(item, mapProvider);
      clearMapActionFeedback();

      try {
        await Linking.openURL(actions.map.url);
      } catch {
        setMapActionFeedback(dayItineraryMapActionFailureState('map'));
      }
    },
    [clearMapActionFeedback, discardReorder, mapProvider],
  );

  const copyPlaceAddress = useCallback(
    async (item: DayItineraryMapActionInput) => {
      discardReorder();
      const actions = buildDayItineraryMapRowActions(item, mapProvider);
      if (actions.copy.disabled || !actions.copy.address) {
        return;
      }

      clearMapActionFeedback();
      try {
        await Clipboard.setStringAsync(actions.copy.address);
        setMapActionFeedback(dayItineraryMapActionSuccessState('copy'));
      } catch {
        setMapActionFeedback(dayItineraryMapActionFailureState('copy'));
      }
    },
    [clearMapActionFeedback, discardReorder, mapProvider],
  );

  return {
    clearMapActionFeedback,
    copyPlaceAddress,
    mapActionFeedback,
    openPlaceMap,
  };
}
