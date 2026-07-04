import type { Dispatch, SetStateAction } from 'react';

import type { DayItineraryRowViewModel, DayItineraryViewModel } from '../trips/day-itinerary';
import type { DayItineraryDeleteFocusTarget, DayItineraryEditFormValues } from '../trips/day-itinerary-edit';
import type {
  DayItineraryContentFocusRequest,
  DayItineraryLodgingPickerState,
  DayItineraryLodgingState,
  DayItineraryReorderState,
  DeletePlaceConfirmationState,
  EditPlacePanelState,
  NonPlaceScheduleItemPanelState,
} from './DayItineraryEditorParts';

export type DayItineraryState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayItineraryViewModel }
  | { status: 'auth' }
  | { status: 'notFound'; title: string; helper: string }
  | { status: 'error'; title: string; helper: string };

export type EditState = { status: 'idle' } | EditPlacePanelState;

export type NonPlaceEditorState = { status: 'idle' } | NonPlaceScheduleItemPanelState;

export type DeleteState = { status: 'idle' } | DeletePlaceConfirmationState;

export type ReorderState = DayItineraryReorderState;

export type LodgingState = DayItineraryLodgingState;

export type LodgingPlacePickerState = DayItineraryLodgingPickerState;

export type DayItineraryControllerSetters = {
  setContentFocusRequest: Dispatch<SetStateAction<DayItineraryContentFocusRequest | null>>;
  setDeleteState: Dispatch<SetStateAction<DeleteState>>;
  setEditState: Dispatch<SetStateAction<EditState>>;
  setLodgingPickerState: Dispatch<SetStateAction<LodgingPlacePickerState>>;
  setLodgingState: Dispatch<SetStateAction<LodgingState>>;
  setNonPlaceEditorState: Dispatch<SetStateAction<NonPlaceEditorState>>;
  setReorderFeedback: Dispatch<SetStateAction<string | null>>;
  setReorderState: Dispatch<SetStateAction<ReorderState>>;
};

export type DayItineraryControllerState = {
  contentFocusRequest: DayItineraryContentFocusRequest | null;
  deleteState: DeleteState;
  editState: EditState;
  lodgingPickerState: LodgingPlacePickerState;
  lodgingState: LodgingState;
  nonPlaceEditorState: NonPlaceEditorState;
  reorderFeedback: string | null;
  reorderState: ReorderState;
  state: DayItineraryState;
};

export type DayItineraryMutationFailureHandler = (
  error: unknown,
  onReload: () => Promise<void>,
  onAuth?: () => void,
) => Promise<boolean>;

export type DayItineraryLoad = () => Promise<void>;
export type DayItineraryApplyResponse = (
  response: Awaited<ReturnType<typeof import('../trips/itinerary-api').getTripDayItinerary>>,
  requestSequence?: number,
) => boolean;
export type DayItineraryRequestContentFocus = (
  target: DayItineraryDeleteFocusTarget | { kind: 'deleteTrigger'; itemId: string },
) => void;
export type DayItineraryBeginEdit = (item: DayItineraryRowViewModel) => void;
export type DayItineraryBeginReorder = (viewModel: DayItineraryViewModel) => void;
export type DayItineraryUpdateEditValues = (values: DayItineraryEditFormValues) => void;
