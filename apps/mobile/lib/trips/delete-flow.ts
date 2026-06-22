export type TripDeleteState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'deleting' }
  | { status: 'auth'; message: string }
  | { status: 'safeFailure'; message: string }
  | { status: 'error'; message: string };

const authMessage = '다시 로그인해주세요.';
const safeFailureMessage = '여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.';
const genericErrorMessage = '여행을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.';

export function openTripDeleteConfirmation(state: TripDeleteState): TripDeleteState {
  if (state.status === 'deleting') {
    return state;
  }
  return { status: 'confirming' };
}

export function cancelTripDelete(state: TripDeleteState): TripDeleteState {
  if (state.status === 'confirming') {
    return { status: 'idle' };
  }
  return state;
}

export function beginTripDelete(state: TripDeleteState): TripDeleteState {
  if (state.status !== 'confirming') {
    return state;
  }
  return { status: 'deleting' };
}

export function deleteTripFailureState(status?: number): TripDeleteState {
  if (status === 401) {
    return { status: 'auth', message: authMessage };
  }
  if (status === 400 || status === 403 || status === 404) {
    return { status: 'safeFailure', message: safeFailureMessage };
  }
  return { status: 'error', message: genericErrorMessage };
}
