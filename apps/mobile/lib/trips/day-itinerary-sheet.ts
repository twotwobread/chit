export type DayItinerarySheetMode =
  | { kind: 'closed' }
  | { kind: 'detail'; itemId: string }
  | { kind: 'editPlace' }
  | { kind: 'editNonPlace' };

export type DayItinerarySheetStatus = 'idle' | 'editing' | 'saving' | 'error';

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

function isActiveSheetFormStatus(status: DayItinerarySheetStatus): boolean {
  return status === 'editing' || status === 'saving' || status === 'error';
}
