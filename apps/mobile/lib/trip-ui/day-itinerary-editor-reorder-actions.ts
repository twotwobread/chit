import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DayItineraryViewModel } from '../trips/day-itinerary';
import {
  buildDayItineraryReorderConflictViewModel,
  buildDayItineraryReorderDraft,
  buildDayItineraryReorderSuccessViewModel,
  buildReorderScheduleItemsRequest,
  dayItineraryReorderFailureState,
  moveDayItineraryReorderItem,
  submitDayItineraryReorder,
} from '../trips/reorder-itinerary';
import { reorderScheduleItems } from '../trips/itinerary-api';
import { isApiStatus } from './day-itinerary-editor-errors';
import {
  type DayItineraryApplyResponse,
  type DayItineraryLoad,
  type DayItineraryMutationFailureHandler,
  type DeleteState,
  type EditState,
  type LodgingState,
  type ReorderState,
} from './DayItineraryEditorControllerTypes';

type DayItineraryReorderActionContext = {
  applyItineraryResponse: DayItineraryApplyResponse;
  clearMapActionFeedback: () => void;
  date?: string;
  deleteOriginFocusTargetRef: MutableRefObject<number | null>;
  handleRecoverableMutationError: DayItineraryMutationFailureHandler;
  load: DayItineraryLoad;
  reorderState: ReorderState;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  setReorderFeedback: Dispatch<SetStateAction<string | null>>;
  setReorderState: Dispatch<SetStateAction<ReorderState>>;
  tripId?: string;
};

export function createDayItineraryReorderActions({
  applyItineraryResponse,
  clearMapActionFeedback,
  date,
  deleteOriginFocusTargetRef,
  handleRecoverableMutationError,
  load,
  reorderState,
  setDeleteState,
  setEditState,
  setLodgingState,
  setReorderFeedback,
  setReorderState,
  tripId,
}: DayItineraryReorderActionContext) {
  const beginReorder = (viewModel: DayItineraryViewModel) => {
    const draft = buildDayItineraryReorderDraft(viewModel);
    if (!draft) {
      return;
    }

    setReorderFeedback(null);
    setEditState({ status: 'idle' });
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    clearMapActionFeedback();
    setReorderState({ status: 'editing', draft });
  };

  const moveReorderItem = (fromIndex: number, toIndex: number) => {
    setReorderState((current) => {
      if (current.status !== 'editing') {
        return current;
      }

      return {
        ...current,
        draft: moveDayItineraryReorderItem(current.draft, fromIndex, toIndex),
        error: undefined,
      };
    });
  };

  const submitReorder = async () => {
    if (
      !tripId ||
      !date ||
      (reorderState.status !== 'editing' && reorderState.status !== 'saving') ||
      reorderState.status === 'saving'
    ) {
      return;
    }

    const draft = reorderState.draft;
    if (!buildReorderScheduleItemsRequest(draft)) {
      return;
    }

    const submittingState: ReorderState = { ...reorderState, status: 'saving', error: undefined };
    setReorderState(submittingState);
    try {
      const response = await submitDayItineraryReorder(draft, (request) => reorderScheduleItems(tripId, date, request));
      if (!response) {
        setReorderState({ status: 'editing', draft });
        return;
      }
      const success = buildDayItineraryReorderSuccessViewModel(response);
      setReorderFeedback(success.reorderFeedback);
      setReorderState(success.reorderState);
      applyItineraryResponse(response);
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setReorderState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      if (isApiStatus(error, 409)) {
        const conflictViewModel = buildDayItineraryReorderConflictViewModel();
        setReorderState(conflictViewModel.reorderState);
        setReorderFeedback(conflictViewModel.reorderFeedback);
        await load();
        return;
      }

      const failure = dayItineraryReorderFailureState();
      setReorderState({
        ...submittingState,
        status: 'editing',
        error: { title: failure.title, helper: failure.helper },
      });
    }
  };

  return {
    beginReorder,
    moveReorderItem,
    submitReorder,
  };
}
