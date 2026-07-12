import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { router } from 'expo-router';

import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import {
  buildDayLodgingPlaceOptions,
  buildSetDayLodgingPlaceRequest,
  dayLodgingMutationFailureState,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { buildDayItineraryLodgingPlaceSearchRoute } from '../trips/day-itinerary-add-place-navigation';
import { clearDayLodgingPlace, setDayLodgingPlace } from '../trips/itinerary-api';
import { listTripPlaces } from '../trips/trip-api';
import {
  type DayItineraryLoad,
  type DayItineraryMutationFailureHandler,
  type DayItineraryState,
  type DeleteState,
  type EditState,
  type LodgingPlacePickerState,
  type LodgingState,
} from './DayItineraryEditorControllerTypes';
import { isDayItineraryAuthError } from './day-itinerary-editor-errors';

type DayItineraryLodgingActionContext = {
  clearMapActionFeedback: () => void;
  date?: string;
  deleteOriginFocusTargetRef: MutableRefObject<number | null>;
  discardReorder: () => void;
  enterAuthState: () => void;
  handleRecoverableMutationError: DayItineraryMutationFailureHandler;
  load: DayItineraryLoad;
  lodgingState: LodgingState;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingPickerState: Dispatch<SetStateAction<LodgingPlacePickerState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  state: DayItineraryState;
  tripId?: string;
};

export function createDayItineraryLodgingActions({
  clearMapActionFeedback,
  date,
  deleteOriginFocusTargetRef,
  discardReorder,
  enterAuthState,
  handleRecoverableMutationError,
  load,
  lodgingState,
  setDeleteState,
  setEditState,
  setLodgingPickerState,
  setLodgingState,
  state,
  tripId,
}: DayItineraryLodgingActionContext) {
  const submitSetLodging = async (item: DayItineraryRowViewModel) => {
    if (!tripId || !date || !item.placeId || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    clearMapActionFeedback();
    setLodgingState({ status: 'setting', itemId: item.id });
    try {
      await setDayLodgingPlace(tripId, date, buildSetDayLodgingPlaceRequest(item.placeId));
      setLodgingState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setLodgingState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const submitClearLodging = async (item: DayItineraryRowViewModel) => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    clearMapActionFeedback();
    setLodgingState({ status: 'clearing', itemId: item.id });
    try {
      await clearDayLodgingPlace(tripId, date);
      setLodgingState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setLodgingState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const submitClearCurrentLodging = async () => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    discardReorder();
    setLodgingState({
      status: 'clearing',
      itemId: state.status === 'success' ? (state.viewModel.lodgingPlace?.id ?? 'current') : 'current',
    });
    try {
      await clearDayLodgingPlace(tripId, date);
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setLodgingState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const openLodgingPlaceSelection = async () => {
    if (!tripId) {
      return;
    }

    discardReorder();
    setLodgingPickerState({ status: 'loading' });
    try {
      const places = await listTripPlaces(tripId);
      const currentPlaceId = state.status === 'success' ? state.viewModel.lodgingPlace?.id : null;
      setLodgingPickerState({ status: 'selecting', options: buildDayLodgingPlaceOptions(places, currentPlaceId) });
    } catch (error) {
      if (isDayItineraryAuthError(error)) {
        enterAuthState();
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
      setLodgingPickerState({ status: 'idle' });
    }
  };

  const submitSelectLodgingPlace = async (option: DayLodgingPlaceOptionViewModel) => {
    if (!tripId || !date || lodgingState.status === 'setting' || lodgingState.status === 'clearing') {
      return;
    }

    setLodgingState({ status: 'setting', itemId: option.id });
    try {
      await setDayLodgingPlace(tripId, date, buildSetDayLodgingPlaceRequest(option.id));
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setLodgingState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      setLodgingState({ status: 'error', error: dayLodgingMutationFailureState() });
    }
  };

  const openLodgingSearchRegister = () => {
    if (!tripId || !date) {
      return;
    }

    discardReorder();
    setLodgingPickerState({ status: 'idle' });
    router.push(buildDayItineraryLodgingPlaceSearchRoute(tripId, date));
  };

  const cancelLodgingPicker = () => {
    setLodgingPickerState({ status: 'idle' });
  };

  return {
    cancelLodgingPicker,
    openLodgingPlaceSelection,
    openLodgingSearchRegister,
    submitClearCurrentLodging,
    submitClearLodging,
    submitSelectLodgingPlace,
    submitSetLodging,
  };
}
