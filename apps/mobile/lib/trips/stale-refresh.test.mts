import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from './stale-refresh';

type ExampleState =
  | { status: 'loading' }
  | { status: 'success'; payload: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

const keepGenericErrorsOnly = (state: ExampleState) => state.status === 'error';

describe('stale-while-revalidate refresh helpers', () => {
  it('uses blocking loading when there is no stale state to show', () => {
    const loading: ExampleState = { status: 'loading' };
    const current: ExampleState = { status: 'error', message: 'try again' };

    const result = beginStaleWhileRevalidate(current, loading, ['success']);

    assert.strictEqual(result, loading);
  });

  it('keeps stale success state when a refresh starts', () => {
    const loading: ExampleState = { status: 'loading' };
    const current: ExampleState = { status: 'success', payload: 'already visible' };

    const result = beginStaleWhileRevalidate(current, loading, ['success']);

    assert.strictEqual(result, current);
  });

  it('keeps any configured stale display state when a refresh starts', () => {
    const loading: ExampleState = { status: 'loading' };
    const current: ExampleState = { status: 'unavailable', reason: 'no current day' };

    const result = beginStaleWhileRevalidate(current, loading, ['success', 'unavailable']);

    assert.strictEqual(result, current);
  });

  it('keeps stale state on recoverable refresh failure', () => {
    const current: ExampleState = { status: 'success', payload: 'already visible' };
    const failure: ExampleState = { status: 'error', message: 'temporary network failure' };

    const result = resolveStaleWhileRevalidateFailure(current, failure, {
      shouldKeepStale: keepGenericErrorsOnly,
      staleStatuses: ['success'],
    });

    assert.strictEqual(result, current);
  });

  it('replaces stale state on terminal auth or notFound failures', () => {
    const current: ExampleState = { status: 'success', payload: 'sensitive trip' };
    const authFailure: ExampleState = { status: 'auth' };
    const notFoundFailure: ExampleState = { status: 'notFound' };

    assert.strictEqual(
      resolveStaleWhileRevalidateFailure(current, authFailure, {
        shouldKeepStale: keepGenericErrorsOnly,
        staleStatuses: ['success'],
      }),
      authFailure,
    );
    assert.strictEqual(
      resolveStaleWhileRevalidateFailure(current, notFoundFailure, {
        shouldKeepStale: keepGenericErrorsOnly,
        staleStatuses: ['success'],
      }),
      notFoundFailure,
    );
  });

  it('uses the failure state when there is no stale state to preserve', () => {
    const current: ExampleState = { status: 'loading' };
    const failure: ExampleState = { status: 'error', message: 'first load failed' };

    const result = resolveStaleWhileRevalidateFailure(current, failure, {
      shouldKeepStale: keepGenericErrorsOnly,
      staleStatuses: ['success'],
    });

    assert.strictEqual(result, failure);
  });
});
