import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import {
  canDismissDayItineraryDeleteModal,
  canSubmitDayItineraryDelete,
  dayItineraryMutationFailureState,
  resolveDayItineraryDeleteSuccessFocusTarget,
  type DayItineraryDeleteFocusTarget,
} from '../trips/day-itinerary-edit';
import { deleteScheduleItem } from '../trips/itinerary-api';
import {
  type DayItineraryLoad,
  type DayItineraryMutationFailureHandler,
  type DayItineraryRequestContentFocus,
  type DayItineraryState,
  type DeleteState,
  type EditState,
  type LodgingState,
} from './DayItineraryEditorControllerTypes';

type DayItineraryDeleteActionContext = {
  clearMapActionFeedback: () => void;
  date?: string;
  deleteOriginFocusTargetRef: MutableRefObject<number | null>;
  deleteState: DeleteState;
  discardReorder: () => void;
  enterAuthState: () => void;
  focusDeleteOrigin: (itemId: string) => void;
  handleRecoverableMutationError: DayItineraryMutationFailureHandler;
  load: DayItineraryLoad;
  requestContentFocus: DayItineraryRequestContentFocus;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  state: DayItineraryState;
  tripId?: string;
};

export function createDayItineraryDeleteActions({
  clearMapActionFeedback,
  date,
  deleteOriginFocusTargetRef,
  deleteState,
  discardReorder,
  enterAuthState,
  focusDeleteOrigin,
  handleRecoverableMutationError,
  load,
  requestContentFocus,
  setDeleteState,
  setEditState,
  setLodgingState,
  state,
  tripId,
}: DayItineraryDeleteActionContext) {
  const beginDelete = (item: DayItineraryRowViewModel, originFocusTarget?: number | null) => {
    discardReorder();
    deleteOriginFocusTargetRef.current = typeof originFocusTarget === 'number' ? originFocusTarget : null;
    setEditState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    clearMapActionFeedback();
    setDeleteState({ status: 'confirming', item });
  };

  const cancelDelete = () => {
    if (deleteState.status !== 'confirming' || !canDismissDayItineraryDeleteModal(deleteState.status)) {
      return;
    }

    const itemId = deleteState.item.id;
    setDeleteState({ status: 'idle' });
    focusDeleteOrigin(itemId);
  };

  const submitDelete = async () => {
    if (!tripId || !date || deleteState.status !== 'confirming' || !canSubmitDayItineraryDelete(deleteState.status)) {
      return;
    }

    const successFocusTarget: DayItineraryDeleteFocusTarget =
      state.status === 'success' && state.viewModel.status === 'success'
        ? resolveDayItineraryDeleteSuccessFocusTarget(state.viewModel.items, deleteState.item.id)
        : { kind: 'dayHeading' };
    const deletingState: DeleteState = { ...deleteState, status: 'deleting', error: undefined };
    setDeleteState(deletingState);
    try {
      await deleteScheduleItem(tripId, date, deleteState.item.id);
      await load();
      setDeleteState({ status: 'idle' });
      deleteOriginFocusTargetRef.current = null;
      requestContentFocus(successFocusTarget);
    } catch (error) {
      if (
        await handleRecoverableMutationError(
          error,
          async () => {
            setDeleteState({ status: 'idle' });
            await load();
          },
          () => {
            setDeleteState({ status: 'idle' });
            enterAuthState();
          },
        )
      ) {
        return;
      }
      const failure = dayItineraryMutationFailureState('delete');
      setDeleteState({
        ...deletingState,
        status: 'confirming',
        error: { title: failure.title, helper: failure.helper },
      });
    }
  };

  return {
    beginDelete,
    cancelDelete,
    submitDelete,
  };
}
