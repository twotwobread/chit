import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateKoreanReceiptTextParts } from './receipt-ocr';
import {
  getReceiptOCRFixtureText,
  isReceiptOCRFixtureModeEnabled,
  receiptOCRFixtureModeIMG8925,
  resolveReceiptOCRFixtureMode,
} from './receipt-ocr-fixture';

test('IMG_8925 fixture returns raw OCR text that can be sent to the real receipt API', () => {
  const text = getReceiptOCRFixtureText('single', receiptOCRFixtureModeIMG8925);

  assert.ok(text, 'expected fixture text for single receipt capture');
  assert.match(text, /주식회사비플랜트/);
  assert.match(text, /2026년 7월 4일 토요일 오후 12:46:47/);
  assert.match(text, /001 \*피자\s+17,800\s+1\s+17,800/);
  assert.match(text, /총결제금액\s*:?[\s\S]*17,800원/);
  assert.match(text, /카드사명\s*:\s*KB국민카드/);
  assert.deepEqual(validateKoreanReceiptTextParts([{ role: 'single', text }]), { ok: true });
});

test('IMG_8925 fixture provides role-specific raw OCR sections for split capture', () => {
  const headerText = getReceiptOCRFixtureText('header', receiptOCRFixtureModeIMG8925);
  const totalText = getReceiptOCRFixtureText('total', receiptOCRFixtureModeIMG8925);

  assert.ok(headerText, 'expected header fixture text');
  assert.ok(totalText, 'expected total fixture text');
  assert.match(headerText, /\[상호\]\s+주식회사비플랜트/);
  assert.match(headerText, /\[일시\]\s+2026년 7월 4일 토요일 오후 12:46:47/);
  assert.doesNotMatch(headerText, /총결제금액/);
  assert.match(totalText, /총결제금액\s*:?[\s\S]*17,800원/);
  assert.match(totalText, /승인금액\s*:?[\s\S]*17,800원/);
  assert.deepEqual(
    validateKoreanReceiptTextParts([
      { role: 'header', text: headerText },
      { role: 'total', text: totalText },
    ]),
    { ok: true },
  );
});

test('receipt OCR fixture mode only enables the explicit IMG_8925 dev mode', () => {
  assert.equal(resolveReceiptOCRFixtureMode(undefined), null);
  assert.equal(resolveReceiptOCRFixtureMode(''), null);
  assert.equal(resolveReceiptOCRFixtureMode('real'), null);
  assert.equal(resolveReceiptOCRFixtureMode('fixture-img-8925'), receiptOCRFixtureModeIMG8925);
  assert.equal(isReceiptOCRFixtureModeEnabled('fixture-img-8925'), true);
  assert.equal(isReceiptOCRFixtureModeEnabled('fixture-other'), false);
  assert.equal(getReceiptOCRFixtureText('single', null), null);
});
