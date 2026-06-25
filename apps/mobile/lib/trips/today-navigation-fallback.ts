import {
  todayNavigationFailureMessage,
  type TodayNavigationDestination,
  type TodayNavigationResult,
} from './today-navigation';
import type { TravelMode } from './travel-mode';

export type TodayNavigationFallbackFeedback = {
  kind: 'success' | 'error';
  message: string;
};

export type TodayNavigationFallbackState = {
  destination: TodayNavigationDestination;
  feedback: TodayNavigationFallbackFeedback | null;
  travelMode?: TravelMode;
};

export type TodayNavigationFallbackPanel = {
  message: string;
  feedback: TodayNavigationFallbackFeedback | null;
  copyAction: {
    label: '장소 정보 복사';
    payload?: string;
    disabled: boolean;
    disabledHelper?: string;
    successFeedback: string;
    failureFeedback: string;
  };
  retryAction: {
    label: '다시 시도' | '다시 시도 중...';
    disabled: boolean;
  };
  itineraryAction: {
    label: '오늘 일정 보기';
  };
};

export type TodayNavigationFallbackClipboard = {
  setStringAsync: (text: string) => Promise<unknown>;
};

export type TodayNavigationFallbackCopyResult =
  | { status: 'copied'; payload: string; feedback: TodayNavigationFallbackFeedback }
  | { status: 'failed'; payload: string; feedback: TodayNavigationFallbackFeedback }
  | { status: 'unavailable'; feedback: null };

const copySuccessMessage = '장소 정보를 복사했어요.';
const copyFailureMessage = '장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.';
const copyDisabledHelper = '복사할 장소 정보가 없어요.';

export function todayNavigationFallbackStateForResult(
  result: TodayNavigationResult,
  destination: TodayNavigationDestination,
  travelMode?: TravelMode,
): TodayNavigationFallbackState | null {
  if (result.status !== 'failed') {
    return null;
  }

  return { destination, feedback: null, ...(travelMode ? { travelMode } : {}) };
}

export function resetTodayNavigationFallbackState(): null {
  return null;
}

export function buildTodayNavigationFallbackCopyPayload(destination: TodayNavigationDestination): string | null {
  const parts = [destination.placeName, destination.address]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(' ') : null;
}

export function buildTodayNavigationFallbackPanel({
  destination,
  feedback = null,
  retrying = false,
}: {
  destination: TodayNavigationDestination;
  feedback?: TodayNavigationFallbackFeedback | null;
  retrying?: boolean;
}): TodayNavigationFallbackPanel {
  const payload = buildTodayNavigationFallbackCopyPayload(destination) ?? undefined;

  return {
    message: todayNavigationFailureMessage,
    feedback,
    copyAction: {
      label: '장소 정보 복사',
      payload,
      disabled: !payload,
      disabledHelper: payload ? undefined : copyDisabledHelper,
      successFeedback: copySuccessMessage,
      failureFeedback: copyFailureMessage,
    },
    retryAction: {
      label: retrying ? '다시 시도 중...' : '다시 시도',
      disabled: retrying,
    },
    itineraryAction: { label: '오늘 일정 보기' },
  };
}

export function todayNavigationFallbackCopyFeedback(result: 'success' | 'failure'): TodayNavigationFallbackFeedback {
  if (result === 'success') {
    return { kind: 'success', message: copySuccessMessage };
  }

  return { kind: 'error', message: copyFailureMessage };
}

export async function copyTodayNavigationFallbackDestination(
  destination: TodayNavigationDestination,
  clipboard: TodayNavigationFallbackClipboard,
): Promise<TodayNavigationFallbackCopyResult> {
  const payload = buildTodayNavigationFallbackCopyPayload(destination);
  if (!payload) {
    return { status: 'unavailable', feedback: null };
  }

  try {
    await clipboard.setStringAsync(payload);
    return { status: 'copied', payload, feedback: todayNavigationFallbackCopyFeedback('success') };
  } catch {
    return { status: 'failed', payload, feedback: todayNavigationFallbackCopyFeedback('failure') };
  }
}
