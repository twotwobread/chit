import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

const readRepo = (relativePath: string) =>
  readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8');
const readMobile = (relativePath: string) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('Ledger Memory theme exposes the approved Chit v2 brand palette', () => {
  const { color } = theme;

  assert.equal(color.chit.coral, '#FF6258');
  assert.equal(color.chit.actionCoral, '#C9433B');
  assert.equal(color.chit.receiptCream, '#FFF8ED');
  assert.equal(color.chit.paperWhite, '#FFFFFF');
  assert.equal(color.chit.ledgerInk, '#22242A');
  assert.equal(color.chit.softGray, '#F2F3F5');
  assert.equal(color.chit.clearGreen, '#168A5B');
  assert.equal(color.chit.alertRed, '#D83A45');
  assert.equal(color.chit.infoBlue, '#3478D4');
  assert.equal(color.chit.ticketYellow, '#FFC845');

  assert.equal(color.bg, color.chit.receiptCream);
  assert.equal(color.surface, color.chit.paperWhite);
  assert.equal(color.textStrong, color.chit.ledgerInk);
  assert.equal(color.actionPrimary, color.chit.actionCoral);
  assert.equal(color.brandAccent, color.chit.coral);
  assert.equal(color.success, color.chit.clearGreen);
  assert.equal(color.danger, color.chit.alertRed);
  assert.equal(color.info, color.chit.infoBlue);
  assert.notEqual(color.brandAccent, color.success, 'coral should not represent financial completion');
});

test('Ledger Memory design source documents the approved brand sentence and mode split', () => {
  const brandDoc = readRepo('docs/features/0341-chit-brand-design-system.md');
  const mobileRule = readRepo('.harness/rules/code/mobile-ui.md');
  const guardDoc = readRepo('docs/features/0403-shared-design-system-guard-guidance.md');

  for (const source of [brandDoc, mobileRule, guardDoc]) {
    assert.match(source, /Ledger × Memory/);
    assert.match(source, /기록은 정확하게, 기억은 다정하게/);
    assert.match(source, /Chit Coral/);
    assert.match(source, /Receipt Cream/);
    assert.match(source, /Ledger Ink/);
  }

  assert.match(brandDoc, /돈|지출|정산/);
  assert.match(brandDoc, /기억|추억|기록/);
  assert.match(brandDoc, /코랄로 금융 상태를 표현하지 않는다|financial state/i);
  assert.match(brandDoc, /receipt|영수증|티켓/i);
});

test('Ledger Memory shared components default to paper, ink, and action coral surfaces', () => {
  const surfaceFrame = readMobile('lib/design/foundation/surface-frame.tsx');
  const button = readMobile('lib/design/components/button.tsx');
  const card = readMobile('lib/design/components/card.tsx');
  const tabButton = readMobile('lib/design/components/tab-button.tsx');

  assert.match(surfaceFrame, /frame:[\s\S]*backgroundColor: theme\.color\.surface/);
  assert.match(surfaceFrame, /memory:[\s\S]*backgroundColor: theme\.color\.memorySurface/);
  assert.match(button, /primaryButtonCoral:[\s\S]*backgroundColor: theme\.color\.actionPrimary/);
  assert.match(button, /export type PrimaryButtonTone = 'coral' \| 'ink'/);
  assert.match(card, /screenBackground:[\s\S]*backgroundColor: theme\.color\.bg/);
  assert.match(tabButton, /selected \? theme\.color\.brandAccent : theme\.color\.textFaint/);
});
