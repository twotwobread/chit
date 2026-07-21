import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { theme } from '../design/theme';

test('Pure Dark Graphite tokens make dark graphite the default app surface', () => {
  assert.equal(theme.color.bg, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shell, theme.color.chit.graphiteShell);
  assert.equal(theme.color.shellElevated, theme.color.chit.graphiteRaised);
  assert.equal(theme.color.surface, theme.color.chit.graphiteCard);
  assert.equal(theme.color.surfaceSoft, theme.color.chit.graphiteElevated);
  assert.equal(theme.color.surfaceSunken, theme.color.chit.graphiteSunken);
  assert.equal(theme.color.actionPrimary, theme.color.chit.graphiteHighest);
  assert.equal(theme.color.onActionPrimary, theme.color.chit.offWhiteText);
  assert.notEqual(theme.color.surface, theme.color.chit.offWhiteElevated);
  assert.notEqual(theme.color.surfaceSunken, theme.color.chit.offWhiteSubtle);
  assert.notEqual(theme.color.primary, theme.color.actionPrimary);
});

test('Pure Dark Graphite keeps off-white as text or escape only', () => {
  assert.equal(theme.color.textStrong, theme.color.chit.offWhiteText);
  assert.equal(theme.color.textBody, theme.color.chit.mutedText);
  assert.equal(theme.color.textMuted, theme.color.chit.faintText);
  assert.equal(theme.color.lightEscape, theme.color.chit.offWhiteElevated);
});

test('mobile UI rule documents Pure Dark Graphite and Compact Premium Dark', () => {
  const rule = readFileSync(new URL('../../../../.harness/rules/code/mobile-ui.md', import.meta.url), 'utf8');
  assert.match(rule, /Pure Dark Graphite/);
  assert.match(rule, /Compact Premium Dark/);
  assert.match(rule, /large floating off-white blocks/);
  assert.match(rule, /placeholder-quality place cards/);
});
