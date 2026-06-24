import assert from 'node:assert/strict';
import test from 'node:test';

import { ACCOUNT_DELETION_COPY, createAccountDeletionFlow } from './account-deletion-flow.ts';
import { MobileAuthError } from './client.ts';

test('account deletion confirmation opens and cancels without calling delete API', () => {
  let deleteCalls = 0;
  const flow = createAccountDeletionFlow({
    deleteAccount: async () => {
      deleteCalls += 1;
    },
    replace: () => undefined,
  });

  assert.equal(flow.getStatus(), 'idle');
  assert.equal(flow.requestConfirmation(), 'confirming');
  assert.equal(flow.cancelConfirmation(), 'idle');
  assert.equal(deleteCalls, 0);
  assert.match(ACCOUNT_DELETION_COPY.confirmationBody, /이 작업은 되돌릴 수 없어요/);
});

test('account deletion confirm coalesces duplicate submits and replaces to login once', async () => {
  const calls: string[] = [];
  let releaseDelete: (() => void) | null = null;
  const flow = createAccountDeletionFlow({
    deleteAccount: async () => {
      calls.push('delete');
      await new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
    },
    replace: (path) => calls.push(`replace:${path}`),
  });

  flow.requestConfirmation();
  const first = flow.confirmDeletion();
  const second = flow.confirmDeletion();
  assert.equal(flow.getStatus(), 'deleting');
  assert.equal(flow.isDeleting(), true);

  releaseDelete?.();
  const results = await Promise.all([first, second]);

  assert.deepEqual(results, [{ status: 'success' }, { status: 'success' }]);
  assert.equal(flow.getStatus(), 'idle');
  assert.equal(flow.isDeleting(), false);
  assert.deepEqual(calls, ['delete', 'replace:/login']);
});

test('account deletion maps retryable failure and stays confirming for retry', async () => {
  const flow = createAccountDeletionFlow({
    deleteAccount: async () => {
      throw new Error('network unavailable');
    },
    replace: () => {
      throw new Error('replace must not be called');
    },
  });

  flow.requestConfirmation();
  const result = await flow.confirmDeletion();

  assert.deepEqual(result, { status: 'retryableError', message: ACCOUNT_DELETION_COPY.retryableError });
  assert.equal(flow.getStatus(), 'confirming');
  assert.equal(flow.isDeleting(), false);
});

test('account deletion maps auth failure to login-required copy', async () => {
  const flow = createAccountDeletionFlow({
    deleteAccount: async () => {
      throw new MobileAuthError('UNAUTHORIZED', 'unauthorized');
    },
    replace: () => {
      throw new Error('replace must not be called');
    },
  });

  flow.requestConfirmation();
  const result = await flow.confirmDeletion();

  assert.deepEqual(result, { status: 'authError', message: ACCOUNT_DELETION_COPY.authError });
  assert.equal(flow.getStatus(), 'confirming');
});
