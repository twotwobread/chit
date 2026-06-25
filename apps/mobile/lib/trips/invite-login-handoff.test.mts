import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOGIN_GENERIC_SUBTITLE,
  LOGIN_INVITE_HANDOFF_SUBTITLE,
  buildInviteLoginReturnPath,
  clearPendingInviteLoginHandoff,
  consumeInviteLoginRedirectPath,
  consumePendingInviteLoginHandoff,
  getLoginSubtitleForInviteHandoff,
  parseInviteLoginReturnPath,
  peekPendingInviteLoginHandoff,
  setPendingInviteLoginHandoffForToken,
} from './invite-login-handoff.ts';

const validToken = 'valid-token-abcdefghijklmnopqrstuvwxyz123456';
const otherValidToken = 'other-token-abcdefghijklmnopqrstuvwxyz123456';
const validReturnPath = `/invite/${validToken}` as const;

test('invite login return path accepts only exact invite token paths', () => {
  assert.equal(buildInviteLoginReturnPath(validToken), validReturnPath);
  assert.equal(buildInviteLoginReturnPath(` ${validToken} `), validReturnPath);
  assert.deepEqual(parseInviteLoginReturnPath(validReturnPath), { token: validToken, returnPath: validReturnPath });

  for (const unsafePath of [
    null,
    undefined,
    '',
    '/invite',
    '/invite/',
    '/invite/short',
    `/invite/${validToken}?next=/account`,
    `/invite/${validToken}#fragment`,
    `/invite/${validToken}/extra`,
    `/invites/${validToken}`,
    `https://invite.i-um.app/invite/${validToken}`,
    '/login',
    '/invite/%2e%2e%2flogin',
    `/invite/ ${validToken}`,
  ]) {
    assert.equal(parseInviteLoginReturnPath(unsafePath), null, `expected unsafe path to be rejected: ${String(unsafePath)}`);
  }
});

test('pending invite login handoff is transient one-time state', () => {
  clearPendingInviteLoginHandoff();
  assert.equal(peekPendingInviteLoginHandoff(), null);
  assert.equal(consumeInviteLoginRedirectPath(), '/');

  const pending = setPendingInviteLoginHandoffForToken(validToken);
  assert.deepEqual(pending, { token: validToken, returnPath: validReturnPath });
  assert.deepEqual(peekPendingInviteLoginHandoff(), { token: validToken, returnPath: validReturnPath });

  assert.deepEqual(consumePendingInviteLoginHandoff(), { token: validToken, returnPath: validReturnPath });
  assert.equal(peekPendingInviteLoginHandoff(), null);
  assert.equal(consumePendingInviteLoginHandoff(), null);
});

test('latest valid invite handoff wins and invalid tokens do not overwrite', () => {
  clearPendingInviteLoginHandoff();

  setPendingInviteLoginHandoffForToken(validToken);
  assert.equal(peekPendingInviteLoginHandoff()?.returnPath, validReturnPath);

  assert.equal(setPendingInviteLoginHandoffForToken('short'), null);
  assert.equal(peekPendingInviteLoginHandoff()?.returnPath, validReturnPath);

  const otherReturnPath = `/invite/${otherValidToken}` as const;
  setPendingInviteLoginHandoffForToken(otherValidToken);
  assert.equal(peekPendingInviteLoginHandoff()?.returnPath, otherReturnPath);

  clearPendingInviteLoginHandoff();
  assert.equal(peekPendingInviteLoginHandoff(), null);
});

test('login subtitle and success redirect reflect pending invite handoff without consuming on failure states', () => {
  clearPendingInviteLoginHandoff();
  assert.equal(getLoginSubtitleForInviteHandoff(), LOGIN_GENERIC_SUBTITLE);

  setPendingInviteLoginHandoffForToken(validToken);
  assert.equal(getLoginSubtitleForInviteHandoff(), LOGIN_INVITE_HANDOFF_SUBTITLE);
  assert.equal(peekPendingInviteLoginHandoff()?.returnPath, validReturnPath);

  assert.equal(consumeInviteLoginRedirectPath(), validReturnPath);
  assert.equal(peekPendingInviteLoginHandoff(), null);
  assert.equal(getLoginSubtitleForInviteHandoff(), LOGIN_GENERIC_SUBTITLE);
  assert.equal(consumeInviteLoginRedirectPath(), '/');
});
