import assert from 'node:assert/strict';
import test from 'node:test';

import { createLogoutFlow } from './logout-flow.ts';

test('logout flow coalesces duplicate runs and replaces to login once', async () => {
  const calls: string[] = [];
  let releaseLogout: (() => void) | null = null;
  const flow = createLogoutFlow({
    logoutCurrentSession: async () => {
      calls.push('logout');
      await new Promise<void>((resolve) => {
        releaseLogout = resolve;
      });
    },
    replace: (path) => calls.push(`replace:${path}`),
  });

  assert.equal(flow.isLoggingOut(), false);
  const first = flow.run();
  const second = flow.run();
  assert.equal(flow.isLoggingOut(), true);

  releaseLogout?.();
  await Promise.all([first, second]);

  assert.equal(flow.isLoggingOut(), false);
  assert.deepEqual(calls, ['logout', 'replace:/login']);
});

test('logout flow resets in-progress state when logout throws', async () => {
  const calls: string[] = [];
  const flow = createLogoutFlow({
    logoutCurrentSession: async () => {
      calls.push('logout');
      throw new Error('logout failed');
    },
    replace: (path) => calls.push(`replace:${path}`),
  });

  await assert.rejects(() => flow.run(), /logout failed/);

  assert.equal(flow.isLoggingOut(), false);
  assert.deepEqual(calls, ['logout']);
});
