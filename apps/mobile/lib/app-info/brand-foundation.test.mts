import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import appConfig from '../../app.json' with { type: 'json' };
import { theme } from '../design/theme';

test('maps semantic mobile tokens to the approved Ledger Memory Chit palette', () => {
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

  assert.equal(color.primary, color.chit.coral);
  assert.equal(color.onPrimary, color.chit.paperWhite);
  assert.equal(color.brandAccent, color.chit.coral);
  assert.equal(color.actionPrimary, color.chit.actionCoral);
  assert.equal(color.onActionPrimary, color.chit.paperWhite);
  assert.equal(color.uiAccent, color.chit.coral);
  assert.equal(color.uiAccentSoft, color.chit.coralSoft);
  assert.equal(color.bg, color.chit.receiptCream);
  assert.equal(color.surface, color.chit.paperWhite);
  assert.equal(color.surfaceSunken, color.chit.softGray);
  assert.equal(color.memorySurface, color.chit.receiptCream);
  assert.equal(color.ledgerSurface, color.chit.paperWhite);
  assert.equal(color.shellHighest, color.chit.ledgerInk);
  assert.equal(color.textStrong, color.chit.ledgerInk);
  assert.equal(color.textLink, color.chit.infoBlue);
  assert.equal(color.info, color.chit.infoBlue);
  assert.equal(color.success, color.chit.clearGreen);
  assert.equal(color.danger, color.chit.alertRed);
  assert.equal(color.credit, color.chit.clearGreen);
  assert.equal(color.debit, color.chit.alertRed);
  assert.notEqual(color.brandAccent, color.success, 'Coral should not double as completion state');
  assert.notEqual(color.brandAccent, color.danger, 'Coral should not double as alert/unpaid state');
});

test('uses Chit icon metadata while keeping existing infrastructure identifiers stable', () => {
  assert.equal(appConfig.expo.name, '칫 Chit');
  assert.equal(appConfig.expo.slug, 'i-um');
  assert.equal(appConfig.expo.scheme, 'ium');
  assert.equal(appConfig.expo.ios?.bundleIdentifier, 'com.twotwobread.ium.staging');
  assert.equal(appConfig.expo.android?.package, 'com.twotwobread.ium');
});

test('login entry screen uses the formal Chit brand name', () => {
  const source = readMobileSourceText('app/login.tsx');

  assert.match(source, />칫 Chit<\/Text>/);
  assert.doesNotMatch(source, />이음<\/Text>/);
});

test('brand SVG sources use the clean Ledger Memory wordmark direction', () => {
  const brandSvgs = ['logo-mark.svg', 'logo-wordmark.svg', 'logo-wordmark-dark.svg'];

  for (const assetName of brandSvgs) {
    const source = readMobileAssetText(`assets/brand/${assetName}`);
    assert.doesNotMatch(source, /이음|i-um|linked-ring/i, `${assetName} should not contain old brand copy`);
    assert.doesNotMatch(
      source,
      /#098563|#0e9c72|#7CE0BE|#C8FF00/i,
      `${assetName} should not contain retired green/lime colors`,
    );
    assert.match(source, /chit|칫/i, `${assetName} should include the Chit mark`);
    assert.match(source, /#FF6258/i, `${assetName} should use Chit Coral`);
    assert.match(
      source,
      /#22242A|#FFFFFF|#FFF8ED/i,
      `${assetName} should use Ledger Ink, Paper White, or Receipt Cream`,
    );
    assert.doesNotMatch(
      source,
      /rotate\(|stroke-dasharray|stamp/i,
      `${assetName} should not use a stamp-lockup treatment`,
    );
  }
});

test('keeps the existing generated app icon PNG dimensions until production asset replacement', () => {
  assert.deepEqual(readPngDimensions('assets/brand/chit-app-icon-imagegen-soft-3d.png'), {
    width: 1254,
    height: 1254,
  });
  assert.deepEqual(readPngDimensions('assets/icon.png'), { width: 1024, height: 1024 });
  assert.deepEqual(readPngDimensions('assets/adaptive-icon.png'), { width: 1024, height: 1024 });
});

function readMobileAssetText(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function readMobileSourceText(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function readPngDimensions(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(`../../${relativePath}`, import.meta.url));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${relativePath} should be a PNG file`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
