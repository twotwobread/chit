import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('root screen copy surfaces the Ledger Memory brand sentence without changing root tabs', () => {
  const homeSource = read('../../app/index.tsx');
  const bottomMenuSource = read('../navigation/bottom-menu-tabs.ts');

  assert.match(homeSource, /기록은 정확하게, 기억은 다정하게/);
  assert.match(bottomMenuSource, /label: '홈'/);
  assert.match(bottomMenuSource, /label: '마이'/);
});

test('root trip cards avoid retired dark graphite aliases and use Ledger Memory tokens', () => {
  const source = read('../home-ui/TripCards.tsx');

  assert.doesNotMatch(source, /chit\.(charcoal|charcoalElevated|acidLimeSofter|acidLime|graphite)/);
  assert.match(source, /hero:[\s\S]*backgroundColor: theme\.color\.shellHighest/);
  assert.match(source, /heroDayBadge:[\s\S]*backgroundColor: theme\.color\.chit\.inkRaised/);
  assert.match(source, /heroDate:[\s\S]*color: theme\.color\.chit\.inkSoft/);
  assert.match(source, /upcomingHomeHero:[\s\S]*backgroundColor: theme\.color\.memorySurface/);
});

test('my root settlement summary uses semantic credit/debit colors instead of Coral for money state', () => {
  const source = read('../trip-ui/MyPageStyles.ts');

  assert.match(source, /settlementChipReceive:[\s\S]*backgroundColor: theme\.color\.green\[50\]/);
  assert.match(source, /settlementChipTextReceive:[\s\S]*color: theme\.color\.credit/);
  assert.match(source, /settlementChipSend:[\s\S]*backgroundColor: theme\.color\.red\[100\]/);
  assert.match(source, /settlementChipTextSend:[\s\S]*color: theme\.color\.debit/);
  assert.doesNotMatch(source, /settlementChipReceive:[\s\S]*backgroundColor: theme\.color\.uiAccentSoft/);
});

test('root action affordances use action, link, and semantic tokens with sufficient contrast', () => {
  assert.equal(theme.color.actionPrimary, theme.color.chit.actionCoral);
  assert.equal(theme.color.textLink, theme.color.chit.infoBlue);
  assert.notEqual(theme.color.credit, theme.color.brandAccent);
  assert.notEqual(theme.color.debit, theme.color.brandAccent);

  const notificationsSource = read('../../app/notifications.tsx');
  assert.match(notificationsSource, /notificationAction:[\s\S]*color: theme\.color\.textLink/);
});
