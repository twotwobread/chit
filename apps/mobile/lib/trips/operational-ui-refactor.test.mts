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

const issue374SurfaceFiles = [
  'app/login.tsx',
  'app/account.tsx',
  'app/notifications.tsx',
  'app/invite/[token].tsx',
  'app/kakaolink.tsx',
  'lib/account-ui/AccountRows.tsx',
  'app/trips/new.tsx',
  'app/trips/[tripId]/detail.tsx',
  'app/trips/[tripId]/edit.tsx',
  'app/trips/[tripId]/participants.tsx',
  'lib/trip-ui/TripDetailScreenParts.tsx',
  'lib/trip-ui/TripDetailScreenStyles.ts',
  'lib/trip-ui/ParticipantsScreenParts.tsx',
  'lib/trip-ui/ParticipantsScreenStyles.ts',
  'lib/trip-ui/CompanionsSheet.tsx',
  'lib/trip-ui/TripSwitcherSheet.tsx',
  'app/trips/[tripId]/days/[date].tsx',
  'app/trips/[tripId]/days/[date]/place-search.tsx',
  'app/trips/[tripId]/days/[date]/places/new.tsx',
  'app/trips/[tripId]/flights/index.tsx',
  'app/trips/[tripId]/flights/new.tsx',
  'app/trips/[tripId]/flights/[flightId].tsx',
];

test('issue 374 scoped surfaces keep colors tokenized outside theme and assets', () => {
  const rawHexPattern = /#[0-9a-fA-F]{3,8}\b/;

  for (const relativePath of issue374SurfaceFiles) {
    assert.doesNotMatch(source(relativePath), rawHexPattern, `${relativePath} should use Chit theme tokens`);
  }
});

test('login and account screens use Chit Foundation hierarchy', () => {
  const loginSource = source('app/login.tsx');
  const accountSource = source('app/account.tsx');

  assert.match(
    loginSource,
    /import \{[^}]*Card[^}]*PrimaryButton[^}]*SecondaryButton[^}]*theme[^}]*\} from '\.\.\/lib\/design'/s,
  );
  assert.match(loginSource, />칫<|>칫 Chit</, 'expected login title to use the Chit brand mark');
  assert.match(loginSource, /<Card\b/, 'expected login content to render inside Foundation Card');

  assert.match(
    accountSource,
    /\.\.\/lib\/account-ui\/AccountRows/,
    'expected account screen to use account row primitives',
  );
  assert.match(accountSource, /<ProfileCard\b/, 'expected account screen to render the shared profile card');
  assert.match(accountSource, /<SettingsList\b/, 'expected account screen to group dense settings rows');
  assert.match(accountSource, /<SettingRow\b/, 'expected account screen actions to use shared settings rows');
});

test('trip edit form uses sticky footer keyboard clearance instead of inline save actions', () => {
  const editSource = source('app/trips/[tripId]/edit.tsx');

  assert.match(editSource, /StickyActionFooter/, 'expected trip edit to render save and cancel in a sticky footer');
  assert.match(editSource, /useStickyActionFooterLayout/, 'expected trip edit to calculate sticky footer clearance');
  assert.match(
    editSource,
    /keyboardFixedBottomOffset=\{footerLayout\.keyboardFixedBottomOffset\}/,
    'expected trip edit scroll view to reserve the sticky footer keyboard offset',
  );
  assert.match(
    editSource,
    /keyboardMinClearance=\{footerLayout\.keyboardMinClearance\}/,
    'expected trip edit scroll view to reserve sticky footer keyboard clearance',
  );
  assert.match(editSource, /<StickyActionFooter[\s\S]*<PrimaryButton[\s\S]*<SecondaryButton/s);
});

test('trip detail recovery and management actions use Foundation primitives', () => {
  const detailScreenSource = source('app/trips/[tripId]/detail.tsx');
  const detailPartsSource = source('lib/trip-ui/TripDetailScreenParts.tsx');

  assert.match(
    detailScreenSource,
    /import \{[^}]*EmptyState[^}]*ErrorState[^}]*ScreenBackground[^}]*SkeletonCard[^}]*\} from '..\/..\/..\/lib\/design'/s,
  );
  assert.match(detailScreenSource, /<SkeletonCard[\s\S]*<ErrorState[\s\S]*<EmptyState/s);
  assert.match(detailScreenSource, /action=\{\{ label: '다시 시도'[\s\S]*variant: 'primary' \}\}/);
  assert.match(
    detailPartsSource,
    /import \{[^}]*Badge[^}]*PrimaryButton[^}]*SecondaryButton[^}]*theme[^}]*\} from '\.\.\/design'/s,
  );
  assert.match(detailPartsSource, /<PrimaryButton[\s\S]*label=\{primaryAction\.label\}/);
  assert.match(detailPartsSource, /<SecondaryButton[\s\S]*label="여행 정보 수정"/);
});

test('dense operational rows expose 44pt touch target evidence', () => {
  assert.match(source('lib/account-ui/AccountRows.tsx'), /editButton:[\s\S]*height: theme\.layout\.tapMin/);
  assert.match(
    source('lib/trip-ui/ParticipantsScreenStyles.ts'),
    /removeButton:[\s\S]*minHeight: theme\.layout\.tapMin/,
  );
  assert.match(source('lib/trip-ui/TripSwitcherSheet.tsx'), /row:[\s\S]*minHeight: theme\.layout\.tapMin/);
  assert.match(source('lib/trip-ui/TripSwitcherSheet.tsx'), /newRow:[\s\S]*minHeight: theme\.layout\.tapMin/);
  assert.match(
    source('app/trips/[tripId]/days/[date]/place-search.tsx'),
    /batchChip:[\s\S]*minHeight: theme\.layout\.tapMin/,
  );
  assert.match(source('app/trips/[tripId]/flights/new.tsx'), /passengerRow:[\s\S]*minHeight: theme\.layout\.tapMin/);
});

test('flight passenger selection rows use SelectableCard checkbox semantics with disabled state', () => {
  const newFlightSource = source('app/trips/[tripId]/flights/new.tsx');
  const flightDetailSource = source('app/trips/[tripId]/flights/[flightId].tsx');

  assert.match(newFlightSource, /import \{[^}]*SelectableCard[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/design'/s);
  assert.match(newFlightSource, /<SelectableCard\b[\s\S]*mode="checkbox"/);
  assert.match(newFlightSource, /checked=\{selected\}/);
  assert.match(newFlightSource, /disabled=\{saving\}/);
  assert.match(newFlightSource, /trailing=\{[\s\S]*selected \? '선택됨' : '선택'/);
  assert.match(
    flightDetailSource,
    /accessibilityState=\{\{ disabled: addingPassengers, selected: option\.selected \}\}/,
  );
});
