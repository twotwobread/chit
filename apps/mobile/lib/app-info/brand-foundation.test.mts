import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import appConfig from '../../app.json' with { type: 'json' };
import { theme } from '../design/theme';

test('maps semantic mobile tokens to the approved Chit palette', () => {
  const { color } = theme;

  assert.equal(color.chit.acidLime, '#C8FF00');
  assert.equal(color.chit.charcoal, '#111315');
  assert.equal(color.chit.matteCharcoal, '#191B1F');
  assert.equal(color.chit.offWhite, '#F7F7F2');
  assert.equal(color.chit.offWhiteElevated, '#FCFCF8');
  assert.equal(color.chit.offWhiteSubtle, '#F0F0EA');
  assert.equal(color.chit.offWhiteBorder, '#E4E3DA');
  assert.equal(color.chit.warmPaper, '#F5F1E8');
  assert.equal(color.chit.fintechBlue, '#2F6BFF');
  assert.equal(color.chit.punchRed, '#FF4D5E');
  assert.equal(color.chit.stampCoral, '#FF4F2E');

  assert.equal(color.primary, color.chit.acidLime);
  assert.equal(color.onPrimary, color.chit.charcoal);
  assert.equal(color.bg, color.chit.matteCharcoal);
  assert.equal(color.surface, color.chit.offWhiteElevated);
  assert.equal(color.surfaceSunken, color.chit.offWhiteSubtle);
  assert.equal(color.borderDefault, color.chit.offWhiteBorder);
  assert.equal(color.textStrong, color.chit.charcoal);
  assert.equal(color.textOnShell, color.chit.surface);
  assert.equal(color.shellGlow, 'rgba(200,255,0,0.16)');
  assert.equal(color.textLink, color.chit.fintechBlue);
  assert.equal(color.info, color.chit.fintechBlue);
  assert.equal(color.danger, color.chit.punchRed);
  assert.equal(color.warning, color.chit.stampCoral);
  assert.equal(color.credit, color.chit.fintechBlue);
  assert.equal(color.debit, color.chit.punchRed);
});

test('uses Chit icon metadata while keeping existing infrastructure identifiers stable', () => {
  assert.equal(appConfig.expo.name, '칫 Chit');
  assert.equal(appConfig.expo.slug, 'i-um');
  assert.equal(appConfig.expo.scheme, 'ium');
  assert.equal(appConfig.expo.ios?.bundleIdentifier, 'com.twotwobread.ium.staging');
  assert.equal(appConfig.expo.android?.package, 'com.twotwobread.ium');
  assert.equal(appConfig.expo.android?.adaptiveIcon?.backgroundColor, '#111315');
});

test('login entry screen uses the formal Chit brand name', () => {
  const source = readMobileSourceText('app/login.tsx');

  assert.match(source, />칫 Chit<\/Text>/);
  assert.doesNotMatch(source, />이음<\/Text>/);
});

test('brand SVG assets use Chit stamp direction and remove the old i-um linked-ring mark', () => {
  const brandSvgs = ['logo-mark.svg', 'logo-wordmark.svg', 'logo-wordmark-dark.svg'];

  for (const assetName of brandSvgs) {
    const source = readMobileAssetText(`assets/brand/${assetName}`);
    assert.doesNotMatch(source, /이음|i-um|linked-ring/i, `${assetName} should not contain old brand copy`);
    assert.doesNotMatch(source, /#098563|#0e9c72|#7CE0BE/i, `${assetName} should not contain old i-um green colors`);
    assert.match(source, /칫/, `${assetName} should include the Korean Chit mark`);
    assert.match(source, /#111315|#191B1F/i, `${assetName} should use Chit dark surfaces`);
    assert.match(source, /#C8FF00/i, `${assetName} should use Acid Lime accent`);
  }

  assert.match(readMobileAssetText('assets/brand/logo-wordmark.svg'), /CHIT|Chit/);
  assert.match(readMobileAssetText('assets/brand/logo-wordmark-dark.svg'), /CHIT|Chit/);
});

test('keeps the selected soft-3D imagegen Chit app icon source in brand assets', () => {
  assert.deepEqual(readPngDimensions('assets/brand/chit-app-icon-imagegen-soft-3d.png'), {
    width: 1254,
    height: 1254,
  });
});

test('app icon PNG assets are 1024 square Chit raster outputs', () => {
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
