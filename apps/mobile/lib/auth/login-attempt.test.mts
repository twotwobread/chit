import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoginAttemptGate } from './login-attempt.ts';

test('ignores duplicate login attempts while one attempt is already running', async () => {
  const gate = createLoginAttemptGate();
  let releaseFirst: (() => void) | null = null;
  let calls = 0;

  const first = gate.run(async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    return 'first';
  });

  const duplicate = gate.run(async () => {
    calls += 1;
    return 'duplicate';
  });

  assert.equal(duplicate, null);
  assert.equal(calls, 1);

  releaseFirst?.();
  assert.equal(await first, 'first');

  const afterCompletion = gate.run(async () => {
    calls += 1;
    return 'after';
  });

  assert.equal(await afterCompletion, 'after');
  assert.equal(calls, 2);
});

test('allows a retry after a failed login attempt settles', async () => {
  const gate = createLoginAttemptGate();
  let calls = 0;

  const failed = gate.run(async () => {
    calls += 1;
    throw new Error('provider failed');
  });

  await assert.rejects(failed, /provider failed/);

  const retry = gate.run(async () => {
    calls += 1;
    return 'retry';
  });

  assert.equal(await retry, 'retry');
  assert.equal(calls, 2);
});
