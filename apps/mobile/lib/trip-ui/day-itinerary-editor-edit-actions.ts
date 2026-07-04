import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { type CreateNonPlaceScheduleItemRequest } from '@i-um/api-contract';

import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import {
  buildDayItineraryEditForm,
  dayItineraryMutationFailureState,
  validateDayItineraryEditForm,
  type DayItineraryEditFormValues,
} from '../trips/day-itinerary-edit';
import {
  buildNonPlaceScheduleItemEditForm,
  emptyNonPlaceScheduleItemForm,
  validateCreateNonPlaceScheduleItemForm,
  validateUpdateNonPlaceScheduleItemForm,
  type NonPlaceScheduleItemFormValues,
} from '../trips/non-place-schedule-item';
import { createNonPlaceScheduleItem, updateScheduleItem } from '../trips/itinerary-api';
import {
  type DayItineraryLoad,
  type DayItineraryMutationFailureHandler,
  type DeleteState,
  type EditState,
  type LodgingState,
  type NonPlaceEditorState,
} from './DayItineraryEditorControllerTypes';

type DayItineraryEditActionContext = {
  clearMapActionFeedback: () => void;
  date?: string;
  deleteOriginFocusTargetRef: MutableRefObject<number | null>;
  discardReorder: () => void;
  editState: EditState;
  handleRecoverableMutationError: DayItineraryMutationFailureHandler;
  load: DayItineraryLoad;
  nonPlaceEditorState: NonPlaceEditorState;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  setNonPlaceEditorState: Dispatch<SetStateAction<NonPlaceEditorState>>;
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
  nonPlaceEditorState,
  setDeleteState,
  setEditState,
  setLodgingState,
  setNonPlaceEditorState,
  tripId,
}: DayItineraryEditActionContext) {
  const beginCreateNonPlace = () => {
    discardReorder();
    deleteOriginFocusTargetRef.current = null;
    setEditState({ status: 'idle' });
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    clearMapActionFeedback();
    setNonPlaceEditorState({ status: 'editing', mode: 'create', values: emptyNonPlaceScheduleItemForm(), errors: {} });
  };

  const beginEdit = (item: DayItineraryRowViewModel) => {
    discardReorder();
    deleteOriginFocusTargetRef.current = null;
    setDeleteState({ status: 'idle' });
    setLodgingState({ status: 'idle' });
    clearMapActionFeedback();

    if (item.itemType === 'non_place') {
      const values = buildNonPlaceScheduleItemEditForm(item);
      setEditState({ status: 'idle' });
      setNonPlaceEditorState({ status: 'editing', mode: 'edit', item, original: values, values, errors: {} });
      return;
    }

    const values = buildDayItineraryEditForm(item);
    setNonPlaceEditorState({ status: 'idle' });
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

  const updateNonPlaceEditorValues = (values: NonPlaceScheduleItemFormValues) => {
    setNonPlaceEditorState((current) => {
      if (current.status !== 'editing' && current.status !== 'saving') {
        return current;
      }
      return { ...current, values, errors: {}, error: undefined };
    });
  };

  const submitNonPlaceEditor = async () => {
    if (
      !tripId ||
      !date ||
      (nonPlaceEditorState.status !== 'editing' && nonPlaceEditorState.status !== 'saving') ||
      nonPlaceEditorState.status === 'saving'
    ) {
      return;
    }

    const validation =
      nonPlaceEditorState.mode === 'create'
        ? validateCreateNonPlaceScheduleItemForm(nonPlaceEditorState.values)
        : validateUpdateNonPlaceScheduleItemForm(nonPlaceEditorState.original, nonPlaceEditorState.values);
    if (!validation.ok) {
      setNonPlaceEditorState({ ...nonPlaceEditorState, errors: validation.errors, error: undefined });
      return;
    }

    const submittingState: NonPlaceEditorState = {
      ...nonPlaceEditorState,
      status: 'saving',
      errors: {},
      error: undefined,
    };
    setNonPlaceEditorState(submittingState);
    try {
      if (nonPlaceEditorState.mode === 'create') {
        await createNonPlaceScheduleItem(tripId, date, validation.request as CreateNonPlaceScheduleItemRequest);
      } else {
        await updateScheduleItem(tripId, date, nonPlaceEditorState.item.id, validation.request);
      }
      setNonPlaceEditorState({ status: 'idle' });
      await load();
    } catch (error) {
      if (
        await handleRecoverableMutationError(error, async () => {
          setNonPlaceEditorState({ status: 'idle' });
          await load();
        })
      ) {
        return;
      }
      setNonPlaceEditorState({
        ...submittingState,
        status: 'editing',
        error: {
          title: nonPlaceEditorState.mode === 'create' ? '일정을 추가할 수 없어요.' : '일정 정보를 저장할 수 없어요.',
          helper: '잠시 후 다시 시도해주세요.',
        },
      });
    }
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

  const cancelNonPlaceEditor = () => {
    setNonPlaceEditorState({ status: 'idle' });
  };

  const cancelEdit = () => {
    setEditState({ status: 'idle' });
  };

  return {
    beginCreateNonPlace,
    beginEdit,
    cancelEdit,
    cancelNonPlaceEditor,
    submitEdit,
    submitNonPlaceEditor,
    updateEditValues,
    updateNonPlaceEditorValues,
  };
}
