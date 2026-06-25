import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { todayNavigationFailureMessage } from './today-navigation';
import {
  buildTodayNavigationFallbackCopyPayload,
  buildTodayNavigationFallbackPanel,
  copyTodayNavigationFallbackDestination,
  resetTodayNavigationFallbackState,
  todayNavigationFallbackCopyFeedback,
  todayNavigationFallbackStateForResult,
} from './today-navigation-fallback';

describe('today navigation fallback helpers', () => {
  const destination = { placeName: ' 도톤보리 ', address: ' 1 Chome Dotonbori, Chuo Ward, Osaka ' };

  it('builds fallback panel state only for terminal navigation failure', () => {
    assert.equal(
      todayNavigationFallbackStateForResult({ status: 'openedDirections', url: 'comgooglemaps://?daddr=dotonbori' }, destination),
      null,
    );
    assert.equal(
      todayNavigationFallbackStateForResult({ status: 'openedInstall', url: 'market://details?id=com.google.android.apps.maps' }, destination),
      null,
    );

    assert.deepEqual(
      todayNavigationFallbackStateForResult({ status: 'failed', message: todayNavigationFailureMessage }, destination),
      { destination, feedback: null },
    );
  });

  it('composes one-line destination copy payload from trimmed non-empty fields', () => {
    assert.equal(
      buildTodayNavigationFallbackCopyPayload(destination),
      '도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka',
    );
    assert.equal(buildTodayNavigationFallbackCopyPayload({ placeName: ' 도톤보리 ', address: '   ' }), '도톤보리');
    assert.equal(buildTodayNavigationFallbackCopyPayload({ placeName: '   ', address: ' Dotonbori ' }), 'Dotonbori');
    assert.equal(buildTodayNavigationFallbackCopyPayload({ placeName: '   ', address: '   ' }), null);
  });

  it('maps panel copy availability, copy feedback, and retry pending state', () => {
    assert.deepEqual(buildTodayNavigationFallbackPanel({ destination }), {
      message: todayNavigationFailureMessage,
      feedback: null,
      copyAction: {
        label: '장소 정보 복사',
        payload: '도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka',
        disabled: false,
        disabledHelper: undefined,
        successFeedback: '장소 정보를 복사했어요.',
        failureFeedback: '장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.',
      },
      retryAction: { label: '다시 시도', disabled: false },
      itineraryAction: { label: '오늘 일정 보기' },
    });

    assert.deepEqual(
      buildTodayNavigationFallbackPanel({
        destination: { placeName: '   ', address: '   ' },
        feedback: todayNavigationFallbackCopyFeedback('failure'),
        retrying: true,
      }),
      {
        message: todayNavigationFailureMessage,
        feedback: { kind: 'error', message: '장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.' },
        copyAction: {
          label: '장소 정보 복사',
          payload: undefined,
          disabled: true,
          disabledHelper: '복사할 장소 정보가 없어요.',
          successFeedback: '장소 정보를 복사했어요.',
          failureFeedback: '장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.',
        },
        retryAction: { label: '다시 시도 중...', disabled: true },
        itineraryAction: { label: '오늘 일정 보기' },
      },
    );
  });

  it('copies available destination text and skips clipboard side effects when disabled', async () => {
    const copied: string[] = [];

    assert.deepEqual(
      await copyTodayNavigationFallbackDestination(destination, {
        setStringAsync: async (text) => {
          copied.push(text);
        },
      }),
      {
        status: 'copied',
        payload: '도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka',
        feedback: { kind: 'success', message: '장소 정보를 복사했어요.' },
      },
    );
    assert.deepEqual(copied, ['도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka']);

    assert.deepEqual(
      await copyTodayNavigationFallbackDestination(
        { placeName: ' ', address: ' ' },
        {
          setStringAsync: async (text) => {
            copied.push(text);
          },
        },
      ),
      { status: 'unavailable', feedback: null },
    );
    assert.deepEqual(copied, ['도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka']);
  });

  it('maps clipboard failures and exposes an explicit reset state', async () => {
    assert.deepEqual(
      await copyTodayNavigationFallbackDestination(destination, {
        setStringAsync: async () => {
          throw new Error('clipboard unavailable');
        },
      }),
      {
        status: 'failed',
        payload: '도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka',
        feedback: { kind: 'error', message: '장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.' },
      },
    );

    assert.equal(resetTodayNavigationFallbackState(), null);
  });
});
