export type DayItinerarySheetMode = { kind: 'closed' } | { kind: 'detail'; itemId: string } | { kind: 'editPlace' };

export type DayItinerarySheetStatus = 'idle' | 'editing' | 'saving' | 'error';

export type DayItinerarySheetCloseAction = { kind: 'blocked' } | { kind: 'close' } | { kind: 'promptSave' };

export type DayItineraryTimelineItemPressAction = { kind: 'none' } | { kind: 'openEdit'; itemId: string };

export type DayItineraryDirtyClosePrompt = {
  title: string;
  buttons: (
    | { label: string; role: 'cancel'; style: 'cancel' }
    | { label: string; role: 'discard'; style: 'destructive' }
    | { label: string; role: 'save' }
  )[];
};

export function buildDayItineraryDirtyClosePrompt(): DayItineraryDirtyClosePrompt {
  return {
    title: '변경 사항을 저장할까요?',
    buttons: [
      { label: '취소', role: 'cancel', style: 'cancel' },
      { label: '저장 안 함', role: 'discard', style: 'destructive' },
      { label: '저장', role: 'save' },
    ],
  };
}

export function resolveDayItinerarySheetMode(input: {
  selectedDetailItemId: string | null;
  editStatus: DayItinerarySheetStatus;
}): DayItinerarySheetMode {
  if (isActiveSheetFormStatus(input.editStatus)) {
    return { kind: 'editPlace' };
  }
  if (input.selectedDetailItemId) {
    return { kind: 'detail', itemId: input.selectedDetailItemId };
  }

  return { kind: 'closed' };
}

export function shouldDismissDayItinerarySheet(input: { editStatus: DayItinerarySheetStatus }): boolean {
  return input.editStatus !== 'saving';
}

export function resolveDayItineraryTimelineItemPress(input: {
  editStatus: DayItinerarySheetStatus;
  itemId: string | null;
}): DayItineraryTimelineItemPressAction {
  if (!input.itemId || isActiveSheetFormStatus(input.editStatus)) {
    return { kind: 'none' };
  }

  return { kind: 'openEdit', itemId: input.itemId };
}

export function resolveDayItinerarySheetCloseAction(input: {
  editStatus: DayItinerarySheetStatus;
  hasEditChanges: boolean;
}): DayItinerarySheetCloseAction {
  if (!shouldDismissDayItinerarySheet(input)) {
    return { kind: 'blocked' };
  }
  if (isActiveSheetFormStatus(input.editStatus) && input.hasEditChanges) {
    return { kind: 'promptSave' };
  }
  return { kind: 'close' };
}

function isActiveSheetFormStatus(status: DayItinerarySheetStatus): boolean {
  return status === 'editing' || status === 'saving' || status === 'error';
}
