export type DayItinerarySheetMode =
  | { kind: 'closed' }
  | { kind: 'detail'; itemId: string }
  | { kind: 'editPlace' }
  | { kind: 'editNonPlace' };

export type DayItinerarySheetStatus = 'idle' | 'editing' | 'saving' | 'error';

export type DayItinerarySheetCloseAction =
  | { kind: 'blocked' }
  | { kind: 'close' }
  | { kind: 'promptSave'; target: 'place' | 'nonPlace' };

export function resolveDayItinerarySheetMode(input: {
  selectedDetailItemId: string | null;
  editStatus: DayItinerarySheetStatus;
  nonPlaceEditorStatus: DayItinerarySheetStatus;
}): DayItinerarySheetMode {
  if (isActiveSheetFormStatus(input.editStatus)) {
    return { kind: 'editPlace' };
  }
  if (isActiveSheetFormStatus(input.nonPlaceEditorStatus)) {
    return { kind: 'editNonPlace' };
  }
  if (input.selectedDetailItemId) {
    return { kind: 'detail', itemId: input.selectedDetailItemId };
  }

  return { kind: 'closed' };
}

export function shouldDismissDayItinerarySheet(input: {
  editStatus: DayItinerarySheetStatus;
  nonPlaceEditorStatus: DayItinerarySheetStatus;
}): boolean {
  return input.editStatus !== 'saving' && input.nonPlaceEditorStatus !== 'saving';
}

export function resolveDayItinerarySheetCloseAction(input: {
  editStatus: DayItinerarySheetStatus;
  hasEditChanges: boolean;
  hasNonPlaceEditorChanges: boolean;
  nonPlaceEditorStatus: DayItinerarySheetStatus;
}): DayItinerarySheetCloseAction {
  if (!shouldDismissDayItinerarySheet(input)) {
    return { kind: 'blocked' };
  }
  if (isActiveSheetFormStatus(input.editStatus) && input.hasEditChanges) {
    return { kind: 'promptSave', target: 'place' };
  }
  if (isActiveSheetFormStatus(input.nonPlaceEditorStatus) && input.hasNonPlaceEditorChanges) {
    return { kind: 'promptSave', target: 'nonPlace' };
  }
  return { kind: 'close' };
}

function isActiveSheetFormStatus(status: DayItinerarySheetStatus): boolean {
  return status === 'editing' || status === 'saving' || status === 'error';
}
