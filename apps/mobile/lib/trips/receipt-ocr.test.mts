import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReceiptOCRTextParts, validateKoreanReceiptTextParts, type ReceiptOCRCapture } from './receipt-ocr';

test('accepts Korean receipt OCR when merchant text is English but total section has Korean KRW signals', () => {
  const capture: ReceiptOCRCapture = {
    mode: 'split',
    parts: [
      { role: 'header', text: 'STARBUCKS 강남대로점\n2026-07-10 19:30' },
      { role: 'total', text: '아메리카노\n합계 5,000원\n카드 승인' },
    ],
  };

  const result = validateKoreanReceiptTextParts(capture.parts);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(buildReceiptOCRTextParts(capture), [
    { role: 'header', text: 'STARBUCKS 강남대로점\n2026-07-10 19:30' },
    { role: 'total', text: '아메리카노\n합계 5,000원\n카드 승인' },
  ]);
});

test('rejects non-Korean receipt OCR before server upload', () => {
  const result = validateKoreanReceiptTextParts([{ role: 'single', text: 'TOTAL JPY 1850\nTAX 168\nCREDIT CARD' }]);

  assert.deepEqual(result, {
    ok: false,
    reason: 'unsupported-language',
    message: '한국어 영수증만 등록할 수 있어요.',
  });
});

test('rejects OCR text without a total amount signal', () => {
  const result = validateKoreanReceiptTextParts([{ role: 'single', text: '카페 노티드 성수\n아메리카노' }]);

  assert.deepEqual(result, {
    ok: false,
    reason: 'unreadable',
    message: '이미지를 인식하지 못했어요.',
  });
});
