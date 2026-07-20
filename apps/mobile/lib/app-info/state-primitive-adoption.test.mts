import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readMobileSource('../../app/index.tsx');
const notificationsSource = readMobileSource('../../app/notifications.tsx');
const tripDetailSource = readMobileSource('../../app/trips/[tripId]/detail.tsx');
const myPageSource = readMobileSource('../../app/mypage.tsx');
const myPagePartsSource = readMobileSource('../trip-ui/MyPageParts.tsx');
const stateCardSource = readMobileSource('../design/patterns/state-card.tsx');

test('Issue 397 representative screens use shared state primitives for loading empty and error states', () => {
  for (const [name, source] of Object.entries({
    homeSource,
    notificationsSource,
    tripDetailSource,
    myPageSource,
    myPagePartsSource,
  })) {
    assert.match(source, /SkeletonCard|LoadingState/, `${name} should use a shared loading primitive`);
    assert.match(source, /EmptyState/, `${name} should use a shared empty/recovery primitive`);
    assert.match(source, /ErrorState/, `${name} should use a shared error primitive`);
    assert.doesNotMatch(
      source,
      /<ActivityIndicator color=\{theme\.color\.primary\}/,
      `${name} should avoid raw primary spinners`,
    );
  }
});

test('Issue 397 shared state actions support primary retry and loading labels', () => {
  assert.match(stateCardSource, /variant\?: 'primary' \| 'secondary'/);
  assert.match(stateCardSource, /loadingLabel\?: string/);
  assert.match(stateCardSource, /<PrimaryButton[\s\S]*loading=\{action\.loading\}/);
  assert.match(stateCardSource, /<SecondaryButton[\s\S]*action\.loading \? \(action\.loadingLabel/);
});

function readMobileSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
