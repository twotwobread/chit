import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APP_BUNDLED_FONT_FAMILIES,
  buildCriticalTextLayout,
  buildNonCriticalTextLayout,
  buildResponsiveControlMinHeight,
  buildResponsiveLineHeight,
  buildResponsiveTextProfile,
} from './responsive-text';
import { font, space } from './theme';

describe('responsive text design helpers', () => {
  it('classifies the required compact, narrow, stress, and regular validation profiles', () => {
    assert.equal(buildResponsiveTextProfile({ width: 320, fontScale: 1 }).name, 'compact');
    assert.equal(buildResponsiveTextProfile({ width: 320, fontScale: 1.3 }).name, 'compactLargerText');
    assert.equal(buildResponsiveTextProfile({ width: 320, fontScale: 1.5 }).name, 'compactStress');
    assert.equal(buildResponsiveTextProfile({ width: 360, fontScale: 1.3 }).name, 'narrowLargerText');
    assert.equal(buildResponsiveTextProfile({ width: 390, fontScale: 1 }).name, 'regular');
  });

  it('scales line height and control min height from fontScale instead of fixed OEM font metrics', () => {
    assert.equal(buildResponsiveLineHeight({ fontSize: font.size.label, fontScale: 1.5 }), 29);
    assert.equal(
      buildResponsiveControlMinHeight({
        fontSize: font.size.label,
        fontScale: 1.5,
        verticalPadding: space[3],
      }),
      45,
    );
  });

  it('keeps critical text non-truncating and touch-safe under compact stress constraints', () => {
    const layout = buildCriticalTextLayout({ fontSize: font.size.label, fontScale: 1.5, verticalPadding: space[3] });

    assert.equal(layout.allowsTruncation, false);
    assert.equal(layout.requiresAccessibilityLabel, false);
    assert.equal(layout.numberOfLines, undefined);
    assert.equal(layout.ellipsizeMode, undefined);
    assert.ok(layout.minHeight >= 44);
  });

  it('allows only non-critical text to ellipsize and requires a full accessibility label', () => {
    const layout = buildNonCriticalTextLayout({
      fontSize: font.size.caption,
      fontScale: 1.3,
      maxLines: 1,
    });

    assert.equal(layout.allowsTruncation, true);
    assert.equal(layout.requiresAccessibilityLabel, true);
    assert.equal(layout.numberOfLines, 1);
    assert.equal(layout.ellipsizeMode, 'tail');
  });

  it('documents bundled Pretendard as the production font baseline', () => {
    assert.deepEqual(APP_BUNDLED_FONT_FAMILIES, {
      regular: font.family.regular,
      semibold: font.family.semibold,
      bold: font.family.bold,
    });
  });
});
