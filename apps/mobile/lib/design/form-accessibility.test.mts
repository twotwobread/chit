import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildFieldAccessibilityHint, firstInvalidFieldKey } from './form-accessibility';

describe('form accessibility helpers', () => {
  it('returns the first invalid field in visual order while ignoring blank errors', () => {
    const field = firstInvalidFieldKey(['name', 'amount', 'memo'] as const, {
      amount: '금액을 입력해 주세요.',
      memo: '   ',
    });

    assert.equal(field, 'amount');
  });

  it('returns null when no visible field error is present', () => {
    assert.equal(firstInvalidFieldKey(['name', 'amount'] as const, { amount: '' }), null);
  });

  it('builds recovery-first hints from error, helper, required, and disabled state', () => {
    assert.equal(
      buildFieldAccessibilityHint({
        disabled: true,
        errorText: '금액을 입력해 주세요.',
        helperText: '영수증 금액 기준으로 입력해요.',
        required: true,
      }),
      '필수 입력 항목입니다. 현재 비활성화되어 있어요. 오류: 금액을 입력해 주세요.',
    );

    assert.equal(
      buildFieldAccessibilityHint({ helperText: '여행 참여자와 정산 화면에 표시돼요.' }),
      '여행 참여자와 정산 화면에 표시돼요.',
    );
  });
});
