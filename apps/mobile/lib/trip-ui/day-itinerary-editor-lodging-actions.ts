import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import {
  buildDayLodgingPlaceOptions,
  buildSetDayLodgingPlaceRequest,
  dayLodgingMutationFailureState,
  validateManualDayLodgingPlaceForm,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { clearDayLodgingPlace, createManualDayLodgingPlace, setDayLodgingPlace } from '../trips/itinerary-api';
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
  lodgingPickerState: LodgingPlacePickerState;
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
  lodgingPickerState,
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

  const openManualLodgingForm = () => {
    discardReorder();
    setLodgingPickerState({ status: 'manual', values: { name: '', address: '' }, errors: {} });
  };

  const submitManualLodging = async () => {
    if (!tripId || !date || lodgingPickerState.status !== 'manual') {
      return;
    }
    const validation = validateManualDayLodgingPlaceForm(lodgingPickerState.values);
    if (!validation.ok) {
      setLodgingPickerState({ ...lodgingPickerState, errors: validation.errors });
      return;
    }

    const submittingState = { status: 'creating' as const, values: lodgingPickerState.values, errors: {} };
    setLodgingPickerState(submittingState);
    try {
      await createManualDayLodgingPlace(tripId, date, validation.request);
      setLodgingState({ status: 'idle' });
      setLodgingPickerState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setLodgingPickerState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      const failure = dayLodgingMutationFailureState();
      setLodgingPickerState({ ...submittingState, status: 'manual', errors: { form: failure.title } });
    }
  };

  const cancelLodgingPicker = () => {
    setLodgingPickerState({ status: 'idle' });
  };

  const updateManualLodgingValues = (
    values: Extract<LodgingPlacePickerState, { status: 'manual' | 'creating' }>['values'],
  ) => {
    setLodgingPickerState((current) =>
      current.status === 'manual' || current.status === 'creating' ? { ...current, values, errors: {} } : current,
    );
  };

  return {
    cancelLodgingPicker,
    openLodgingPlaceSelection,
    openManualLodgingForm,
    submitClearCurrentLodging,
    submitClearLodging,
    submitManualLodging,
    submitSelectLodgingPlace,
    submitSetLodging,
    updateManualLodgingValues,
  };
}
