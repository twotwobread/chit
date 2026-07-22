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

test('receipt capture flow uses branded verification recovery copy and accessible actions', () => {
  const scannerSource = source('lib/trip-ui/ReceiptCaptureScanner.tsx');

  assert.match(scannerSource, /칫 영수증 스캔/);
  assert.match(scannerSource, /영수증 초안을 만들게요\./);
  assert.match(scannerSource, /초안 만들기 전 확인/);
  assert.match(scannerSource, /칫, 글자를 읽는 중/);
  assert.match(scannerSource, /초안을 만들 수 없어요\./);
  assert.match(scannerSource, /accessibilityLabel="영수증 촬영하기"/);
  assert.match(scannerSource, /accessibilityLabel="영수증 이미지 인식하기"/);
  assert.match(scannerSource, /accessibilityLabel="영수증 다시 촬영하기"/);
  assert.match(scannerSource, /accessibilityLabel="영수증 직접 입력으로 전환"/);
});

test('receipt capture fixture OCR mode passes image roles and explains that OpenAI cleanup stays real', () => {
  const scannerSource = source('lib/trip-ui/ReceiptCaptureScanner.tsx');

  assert.match(scannerSource, /recognizeKoreanReceiptText\(image\.uri, \{ role: image\.role \}\)/);
  assert.match(scannerSource, /개발 OCR fixture 사용 중이에요\./);
  assert.match(scannerSource, /실제 OpenAI 정제를 확인해요\./);
});

test('receipt draft place candidate requires explicit trip-place-only confirmation', () => {
  const formSource = source('lib/trip-ui/QuickExpenseEntryParts.tsx');
  const controllerSource = source('lib/trip-ui/useQuickExpenseController.ts');

  assert.match(formSource, /영수증 장소 후보/);
  assert.match(formSource, /여행 장소로 등록/);
  assert.match(formSource, /일정에는 추가하지 않아요/);
  assert.match(controllerSource, /createManualTripPlace\(tripId, \{ name, address, placeType: 'food' \}\)/);
  assert.doesNotMatch(controllerSource, /CreateManualScheduleItem|createManualScheduleItem/);
});
