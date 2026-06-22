import assert from 'node:assert/strict';
import test from 'node:test';

import appConfig from '../../app.json' with { type: 'json' };

import {
  LEGAL_LINK_AFFORDANCE,
  LEGAL_LINK_OPEN_ERROR,
  PRIVACY_URL,
  TERMS_URL,
  appVersion,
  buildAppInfoLegalRows,
  initialLegalLinkOpenState,
  openLegalLink,
  type LegalLinkOpenState,
} from './legal.ts';

test('builds app info and legal rows in the settings order', () => {
  const rows = buildAppInfoLegalRows();

  assert.deepEqual(
    rows.map((row) => row.id),
    ['version', 'terms', 'privacy'],
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ['앱 버전', '서비스 이용약관', '개인정보처리방침'],
  );
  assert.equal(rows[0]?.tappable, false);
  assert.equal(rows[1]?.tappable, true);
  assert.equal(rows[2]?.tappable, true);
});

test('maps app version from the committed Expo app config source', () => {
  assert.equal(appVersion(), appConfig.expo.version);
  assert.equal(buildAppInfoLegalRows()[0]?.value, appConfig.expo.version);
});

test('centralizes legal link urls and uses text affordance', () => {
  const rows = buildAppInfoLegalRows();
  const terms = rows.find((row) => row.id === 'terms');
  const privacy = rows.find((row) => row.id === 'privacy');

  assert.deepEqual(terms, {
    id: 'terms',
    label: '서비스 이용약관',
    tappable: true,
    affordance: LEGAL_LINK_AFFORDANCE,
    url: TERMS_URL,
  });
  assert.deepEqual(privacy, {
    id: 'privacy',
    label: '개인정보처리방침',
    tappable: true,
    affordance: LEGAL_LINK_AFFORDANCE,
    url: PRIVACY_URL,
  });
  assert.equal(TERMS_URL, 'https://twotwobread.github.io/i-um/terms/');
  assert.equal(PRIVACY_URL, 'https://twotwobread.github.io/i-um/privacy/');
});

test('opens a legal link and clears a previous error on success', async () => {
  let state: LegalLinkOpenState = { openingId: null, errorMessage: LEGAL_LINK_OPEN_ERROR };
  const openedUrls: string[] = [];

  const result = await openLegalLink({
    id: 'terms',
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    opener: async (url) => {
      openedUrls.push(url);
    },
  });

  assert.deepEqual(openedUrls, [TERMS_URL]);
  assert.deepEqual(result, initialLegalLinkOpenState);
  assert.deepEqual(state, initialLegalLinkOpenState);
});

test('sets the group-level error message on open failure', async () => {
  let state: LegalLinkOpenState = initialLegalLinkOpenState;

  const result = await openLegalLink({
    id: 'privacy',
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    opener: async () => {
      throw new Error('browser failed');
    },
  });

  assert.deepEqual(result, { openingId: null, errorMessage: LEGAL_LINK_OPEN_ERROR });
  assert.deepEqual(state, { openingId: null, errorMessage: LEGAL_LINK_OPEN_ERROR });
});

test('ignores duplicate taps for the same in-flight legal row', async () => {
  let state: LegalLinkOpenState = initialLegalLinkOpenState;
  let resolveOpen: (() => void) | null = null;
  let calls = 0;

  const firstOpen = openLegalLink({
    id: 'terms',
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    opener: async () => {
      calls += 1;
      await new Promise<void>((resolve) => {
        resolveOpen = resolve;
      });
    },
  });

  assert.deepEqual(state, { openingId: 'terms', errorMessage: null });

  const duplicateResult = await openLegalLink({
    id: 'terms',
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    opener: async () => {
      calls += 1;
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(duplicateResult, { openingId: 'terms', errorMessage: null });

  resolveOpen?.();
  await firstOpen;
  assert.deepEqual(state, initialLegalLinkOpenState);
});
