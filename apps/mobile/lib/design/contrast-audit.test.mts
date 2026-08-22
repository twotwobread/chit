import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { auditedContrastPairs, contrastRatio, runContrastAudit, type ContrastAuditPair } from './contrast-audit';

describe('mobile contrast audit', () => {
  it('computes WCAG contrast ratios for hex and alpha-over-background colors', () => {
    assert.equal(Number(contrastRatio('#22242A', '#FFFFFF').toFixed(2)), 15.51);
    assert.equal(Number(contrastRatio('rgba(34,36,42,0.72)', '#FFF8ED').toFixed(2)), 6.02);
  });

  it('keeps audited mobile text/action token pairs above their required thresholds', () => {
    const result = runContrastAudit(auditedContrastPairs);

    assert.deepEqual(result.failures, []);
    assert.ok(result.passes.length >= 6);
    assert.ok(result.passes.every((entry) => entry.ratio >= entry.minimumRatio));
  });

  it('reports failing pairs with the pair name and measured ratio', () => {
    const failingPairs: ContrastAuditPair[] = [
      { foreground: '#A7A8AD', background: '#FFFFFF', minimumRatio: 4.5, name: 'faint text on surface' },
    ];

    const result = runContrastAudit(failingPairs);

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.name, 'faint text on surface');
    assert.ok(result.failures[0]?.ratio && result.failures[0].ratio < 4.5);
  });
});
