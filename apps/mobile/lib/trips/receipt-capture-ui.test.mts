import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(currentDir, '../..');

function source(relativePath: string): string {
  return readFileSync(resolve(mobileRoot, relativePath), 'utf8');
}

test('receipt capture camera preview avoids a fixed receipt boxing overlay', () => {
  const scannerSource = source('lib/trip-ui/ReceiptCaptureScanner.tsx');

  assert.doesNotMatch(
    scannerSource,
    /scannerStyles\.guideBox/,
    'expected receipt capture preview not to render a fixed guide box overlay',
  );
  assert.doesNotMatch(scannerSource, /\bguideBox:\s*\{/, 'expected fixed guide box styles to be removed');
});

test('receipt capture instructions ask for clear information instead of box alignment', () => {
  const scannerSource = source('lib/trip-ui/ReceiptCaptureScanner.tsx');

  assert.match(scannerSource, /영수증 전체가 보이고 글자가 선명하도록 촬영해주세요\./);
  assert.match(scannerSource, /상호와 날짜가 크게 보이도록 촬영해주세요\./);
  assert.match(scannerSource, /총액\/결제금액이 크게 보이도록 촬영해주세요\./);
  assert.doesNotMatch(scannerSource, /맞춘 뒤 직접 촬영/);
});
