import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const themeSource = readFileSync(new URL('../design/theme.ts', import.meta.url), 'utf8');
const tripCardsSource = readFileSync(new URL('../home-ui/TripCards.tsx', import.meta.url), 'utf8');
const transferRowSource = readFileSync(new URL('../trip-ui/TransferRow.tsx', import.meta.url), 'utf8');
const accountRowsSource = readFileSync(new URL('../account-ui/AccountRows.tsx', import.meta.url), 'utf8');
const dynamicTypeDoc = readFileSync(
  new URL('../../../../docs/features/0388-dynamic-type-long-text-patterns.md', import.meta.url),
  'utf8',
);

describe('dynamic type and long text policy', () => {
  it('keeps the mobile body text token at the readable 16pt floor', () => {
    assert.match(themeSource, /body: 16,/);
  });

  it('allows critical trip names, next-place text, transfer names, and profile names to wrap with full accessibility labels', () => {
    for (const styleName of ['heroName', 'heroNext', 'upcomingName', 'upcomingMeta', 'pastName']) {
      assertCriticalTextWraps(tripCardsSource, styleName);
    }

    assertCriticalTextWraps(transferRowSource, 'name');
    assertCriticalTextWraps(accountRowsSource, 'name');
  });

  it('documents the micro-text and truncation policy for future UI reviews', () => {
    assert.match(dynamicTypeDoc, /Body text floor: `theme\.font\.size\.body` is 16pt/);
    assert.match(dynamicTypeDoc, /Micro text is reserved for decorative badges, captions, and low-priority metadata/);
    assert.match(dynamicTypeDoc, /Critical values prefer wrapping before truncation/);
    assert.match(dynamicTypeDoc, /Manual smoke still required/);
  });
});

function assertCriticalTextWraps(source: string, styleName: string): void {
  const styleRegex = new RegExp(`<Text\\s+[^>]*numberOfLines=\\{2\\}[^>]*style=\\{[^}]*styles\\.${styleName}`);
  assert.match(source, styleRegex, `${styleName} should allow two-line wrapping`);

  const accessibilityRegex = new RegExp(
    `<Text\\s+[^>]*accessibilityLabel=\\{[^}]+\\}[^>]*numberOfLines=\\{2\\}[^>]*style=\\{[^}]*styles\\.${styleName}`,
  );
  assert.match(source, accessibilityRegex, `${styleName} should preserve full text for screen readers`);
}
