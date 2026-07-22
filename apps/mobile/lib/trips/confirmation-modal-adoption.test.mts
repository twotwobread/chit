import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(currentDir, '../..');

function source(relativePath: string): string {
  try {
    return readFileSync(resolve(mobileRoot, relativePath), 'utf8');
  } catch {
    return '';
  }
}

test('decision confirmations use a shared accessible popup modal primitive', () => {
  const modalSource = source('lib/trip-ui/ConfirmationModal.tsx');

  assert.match(modalSource, /export function ConfirmationModal\b/, 'expected shared confirmation modal primitive');
  assert.match(modalSource, /Modal/, 'expected confirmation primitive to use React Native Modal');
  assert.match(modalSource, /accessibilityViewIsModal/, 'expected modal accessibility boundary');
  assert.match(modalSource, /accessibilityRole="header"/, 'expected modal title to be exposed as a header');
  assert.match(modalSource, /theme\.layout\.tapMin/, 'expected touch-safe modal actions');
  assert.doesNotMatch(modalSource, /#[0-9a-fA-F]{3,8}\b|rgba\(/, 'expected token-only modal colors');
});

test('trip city mismatch confirmation is a popup instead of scroll-bottom inline warning content', () => {
  const newTripSource = source('app/trips/new.tsx');

  assert.match(newTripSource, /ConfirmationModal/, 'expected trip creation to import/render ConfirmationModal');
  assert.match(
    newTripSource,
    /<ConfirmationModal[\s\S]*pendingCountryMismatchConfirmation/,
    'expected pending country mismatch warning to render in a popup modal',
  );
  assert.doesNotMatch(
    newTripSource,
    /pendingCountryMismatchConfirmation \? \(\s*<View style=\{styles\.destinationWarningBox\}>/,
    'expected country mismatch warning not to render as inline scroll content',
  );
});

test('duplicate place confirmation is a popup instead of inline result-card content', () => {
  const mapSearchSource = source('lib/trip-ui/GooglePlaceMapSearch.tsx');

  assert.match(mapSearchSource, /ConfirmationModal/, 'expected map search to import/render ConfirmationModal');
  assert.match(
    mapSearchSource,
    /<ConfirmationModal[\s\S]*duplicateConfirmation/,
    'expected duplicate place warning to render in a popup modal',
  );
  assert.doesNotMatch(
    mapSearchSource,
    /function DuplicateConfirmationCard\b/,
    'expected duplicate confirmation not to be an inline result-card component',
  );
});
