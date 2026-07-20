import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};
const smokeDoc = readFileSync(
  new URL('../../../../docs/features/0391-mobile-visual-accessibility-smoke.md', import.meta.url),
  'utf8',
);

describe('mobile smoke and accessibility verification system', () => {
  it('exposes a reproducible mobile contrast audit command', () => {
    assert.equal(packageJson.scripts?.['contrast:audit'], 'node --import tsx lib/design/contrast-audit-cli.ts');
  });

  it('documents reusable core smoke flows and structured PR reporting fields', () => {
    for (const flow of [
      'Login',
      'Home active/empty/error',
      'Trip Today + tab navigation',
      'New trip wizard',
      'Expense add/edit + settlement summary',
      'Map search + bottom sheet',
    ]) {
      assert.match(smokeDoc, new RegExp(`\\| ${escapeRegExp(flow)} \\|`));
    }

    assert.match(smokeDoc, /## PR completion recording/);
    assert.match(smokeDoc, /Android smoke:/);
    assert.match(smokeDoc, /iOS smoke:/);
    assert.match(smokeDoc, /Visual\/device gap:/);
    assert.match(smokeDoc, /`pnpm --filter @i-um\/mobile contrast:audit`/);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
