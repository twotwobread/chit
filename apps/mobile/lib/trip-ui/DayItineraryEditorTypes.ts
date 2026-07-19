import type { DayItineraryRowViewModel } from '../trips/day-itinerary';
import type {
  DayItineraryDeleteFocusTarget,
  DayItineraryEditFormErrors,
  DayItineraryEditFormValues,
} from '../trips/day-itinerary-edit';
import type { DayLodgingMutationFailureViewModel, DayLodgingPlaceOptionViewModel } from '../trips/lodging-place';
import type { DayItineraryReorderDraftViewModel } from '../trips/reorder-itinerary';

export type DayItineraryLodgingState =
  | { status: 'idle' }
  | { status: 'setting' | 'clearing'; itemId: string }
  | { status: 'error'; error: DayLodgingMutationFailureViewModel };

export type DayItineraryLodgingPickerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'selecting'; options: DayLodgingPlaceOptionViewModel[] };

export type EditPlacePanelState = {
  status: 'editing' | 'saving';
  item: DayItineraryRowViewModel;
  original: DayItineraryEditFormValues;
  values: DayItineraryEditFormValues;
  errors: DayItineraryEditFormErrors;
  defaultStartTime?: string | null;
  error?: { title: string; helper: string };
};

export type DeletePlaceConfirmationState = {
  status: 'confirming' | 'deleting';
  item: DayItineraryRowViewModel;
  error?: { title: string; helper: string };
};

export type DayItineraryReorderState =
  | { status: 'idle' }
  | {
      status: 'editing' | 'saving';
      draft: DayItineraryReorderDraftViewModel;
      error?: { title: string; helper: string };
    };

export type DayItineraryContentFocusTarget = DayItineraryDeleteFocusTarget | { kind: 'deleteTrigger'; itemId: string };

export type DayItineraryContentFocusRequest = {
  id: number;
  target: DayItineraryContentFocusTarget;
};
