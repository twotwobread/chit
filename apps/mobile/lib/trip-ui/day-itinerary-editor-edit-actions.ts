import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import {
  buildDayItineraryEditForm,
  dayItineraryMutationFailureState,
  validateDayItineraryEditForm,
  type DayItineraryEditFormValues,
} from '../trips/day-itinerary-edit';
import { updateScheduleItem } from '../trips/itinerary-api';
import {
  type DayItineraryLoad,
  type DayItineraryMutationFailureHandler,
  type DeleteState,
  type EditState,
  type LodgingState,
} from './DayItineraryEditorControllerTypes';

type DayItineraryEditActionContext = {
  clearMapActionFeedback: () => void;
  date?: string;
  deleteOriginFocusTargetRef: MutableRefObject<number | null>;
  discardReorder: () => void;
  editState: EditState;
  handleRecoverableMutationError: DayItineraryMutationFailureHandler;
  load: DayItineraryLoad;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  tripId?: string;
};

export function createDayItineraryEditActions({
  clearMapActionFeedback,
  date,
  deleteOriginFocusTargetRef,
  discardReorder,
  editState,
  handleRecoverableMutationError,
  load,
  setDeleteState,
  setEditState,
  setLodgingState,
  tripId,
}: DayItineraryEditActionContext) {
  const beginEdit = (item: DayItineraryRowViewModel) => {
    discardReorder();
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    clearMapActionFeedback();

    const values = buildDayItineraryEditForm(item);
    setEditState({ status: 'editing', item, original: values, values, errors: {} });
  };

  const updateEditValues = (values: DayItineraryEditFormValues) => {
    setEditState((current) => {
      if (current.status !== 'editing' && current.status !== 'saving') {
        return current;
      }
      return { ...current, values, errors: {}, error: undefined };
    });
  };

  const submitEdit = async () => {
    if (
      !tripId ||
      !date ||
      (editState.status !== 'editing' && editState.status !== 'saving') ||
      editState.status === 'saving'
    ) {
      return;
    }

    const validation = validateDayItineraryEditForm(editState.original, editState.values);
    if (!validation.ok) {
      setEditState({ ...editState, errors: validation.errors, error: undefined });
      return;
    }

    const submittingState: EditState = { ...editState, status: 'saving', errors: {}, error: undefined };
    setEditState(submittingState);
    try {
      await updateScheduleItem(tripId, date, editState.item.id, validation.request);
      setEditState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setEditState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      const failure = dayItineraryMutationFailureState('update');
      setEditState({ ...submittingState, status: 'editing', error: { title: failure.title, helper: failure.helper } });
    }
  };

  const cancelEdit = () => {
    setEditState({ status: 'idle' });
  };

  return {
    beginEdit,
    cancelEdit,
    submitEdit,
    updateEditValues,
  };
}
