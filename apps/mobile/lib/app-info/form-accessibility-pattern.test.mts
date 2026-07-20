import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const componentsSource = readFileSync(new URL('../design/components.tsx', import.meta.url), 'utf8');
const inputFieldSource = readFileSync(new URL('../design/patterns/input-field.tsx', import.meta.url), 'utf8');
const formFieldSource = readFileSync(new URL('../design/patterns/form-field.tsx', import.meta.url), 'utf8');
const formDoc = readFileSync(
  new URL('../../../../docs/features/0386-form-accessibility-patterns.md', import.meta.url),
  'utf8',
);

describe('shared form accessibility pattern surface', () => {
  it('exports TextInputField and form accessibility helpers from the design layer', () => {
    assert.match(componentsSource, /export \{ TextInputField \} from '\.\/patterns\/input-field';/);
    assert.match(componentsSource, /export type \{ TextInputFieldProps \} from '\.\/patterns\/input-field';/);
    assert.match(
      componentsSource,
      /export \{ buildFieldAccessibilityHint, firstInvalidFieldKey \} from '\.\/form-accessibility';/,
    );
  });

  it('combines visible FormField copy, live error text, TextInput semantics, and 44pt input height', () => {
    assert.match(
      inputFieldSource,
      /<FormField[\s\S]*errorText=\{errorText\}[\s\S]*helperText=\{helperText\}[\s\S]*required=\{required\}/,
    );
    assert.match(inputFieldSource, /accessibilityHint=\{accessibilityHint \?\? resolvedAccessibilityHint\}/);
    assert.match(inputFieldSource, /accessibilityState=\{\{ disabled \}\}/);
    assert.match(
      inputFieldSource,
      /accessibilityValue=\{errorText \? \{ text: `오류: \$\{errorText\}` \} : undefined\}/,
    );
    assert.match(inputFieldSource, /minHeight: theme\.layout\.tapMin/);
    assert.match(formFieldSource, /accessibilityLiveRegion="polite"/);
  });

  it('documents first-invalid focus, visible labels, keyboard type, and recovery-copy expectations', () => {
    assert.match(formDoc, /Visible labels are required/);
    assert.match(formDoc, /firstInvalidFieldKey/);
    assert.match(formDoc, /focusAccessibilityNode/);
    assert.match(formDoc, /keyboardType/);
    assert.match(formDoc, /Manual smoke still required/);
  });
});
