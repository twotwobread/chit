import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  buildDayItineraryMapRowActions,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../trips/day-itinerary-map-actions';
import { type DayItineraryRowViewModel } from '../trips/day-itinerary';

type UseDayItineraryMapActionsOptions = {
  discardReorder: () => void;
};

export function useDayItineraryMapActions({ discardReorder }: UseDayItineraryMapActionsOptions) {
  const [mapActionFeedback, setMapActionFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const clearMapActionFeedback = useCallback(() => {
    setMapActionFeedback(null);
  }, []);

  const openPlaceMap = useCallback(
    async (item: DayItineraryRowViewModel) => {
      discardReorder();
      const actions = buildDayItineraryMapRowActions(item);
      clearMapActionFeedback();

      try {
        await Linking.openURL(actions.map.url);
      } catch {
        setMapActionFeedback(dayItineraryMapActionFailureState('map'));
      }
    },
    [clearMapActionFeedback, discardReorder],
  );

  const copyPlaceAddress = useCallback(
    async (item: DayItineraryRowViewModel) => {
      discardReorder();
      const actions = buildDayItineraryMapRowActions(item);
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
    [clearMapActionFeedback, discardReorder],
  );

  return {
    clearMapActionFeedback,
    copyPlaceAddress,
    mapActionFeedback,
    openPlaceMap,
  };
}
