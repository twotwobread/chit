import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildRunSummary, recordRunSummary } from './record-run-summary.mjs';

async function writeFixtureRun() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'harness-record-run-'));
  const runRoot = path.join(repoRoot, '.harness/runs/demo-run');
  await mkdir(path.join(runRoot, 'artifacts'), { recursive: true });
  await mkdir(path.join(runRoot, 'private'), { recursive: true });
  await mkdir(path.join(repoRoot, '.harness/policies'), { recursive: true });

  await writeFile(
    path.join(repoRoot, '.harness/policies/default.yml'),
    'id: default\nversion: 7\n',
  );
  await writeFile(
    path.join(runRoot, 'run.yaml'),
    `run_id: demo-run
workflow: feature-start
policy: .harness/policies/default.yml
status: in_progress
current_phase: implementation.execute
route: ready_for_implementation
tier: normal
artifacts:
  classification: artifacts/classification.yaml
  provider_selection: provider-selection.yaml
tier_history:
  - tier: pending
    reason: envelope created
  - tier: normal
    reason: enough evidence
`,
  );
  await writeFile(
    path.join(runRoot, 'artifacts/classification.yaml'),
    `schema_version: classification.v1
type: feature
route: ready_for_implementation
size: normal
ambiguity: low
risk: medium
testability: high
architecture_impact: local
domain_sensitivity: none
product_direction_unclear: false
implementation_requires_exploration: false
ready_for_implementation: true
likely_tier: normal
next_phase: implementation.execute
knowns:
  - expected behavior is clear
unknowns: []
blocking_questions: []
risk_signals:
  - avoid raw private data
rationale: clear local harness change
`,
  );
  await writeFile(
    path.join(runRoot, 'provider-selection.yaml'),
    `schema_version: provider-selection.v1
selections:
  spec.author:
    selected_provider: micro-spec-author
    used_default: true
  implementation.execute:
    selected_provider: superpowers-tdd
    used_default: false
    matched_rule:
      index: 0
      reason: testable work
`,
  );
  await writeFile(path.join(runRoot, 'artifacts/user-request.md'), 'RAW USER TRANSCRIPT SECRET\n');
  await writeFile(path.join(runRoot, 'private/secret.txt'), 'PRIVATE SECRET\n');

  return repoRoot;
}

test('buildRunSummary returns a sanitized policy-aware record', async () => {
  const repoRoot = await writeFixtureRun();

  const summary = await buildRunSummary({
    repoRoot,
    runId: 'demo-run',
    recordedAt: '2026-07-04T00:00:00.000Z',
    outcome: 'merged',
  });

  assert.equal(summary.schema_version, 'run-summary.v1');
  assert.equal(summary.run_id, 'demo-run');
  assert.equal(summary.workflow.name, 'feature-start');
  assert.equal(summary.policy.path, '.harness/policies/default.yml');
  assert.equal(summary.policy.id, 'default');
  assert.equal(summary.policy.version, 7);
  assert.match(summary.policy.sha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.classification.route, 'ready_for_implementation');
  assert.equal(summary.classification.likely_tier, 'normal');
  assert.equal(summary.final_tier, 'normal');
  assert.equal(summary.provider_selection['implementation.execute'].selected_provider, 'superpowers-tdd');
  assert.equal(summary.outcome, 'merged');

  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes('RAW USER TRANSCRIPT SECRET'), false);
  assert.equal(serialized.includes('PRIVATE SECRET'), false);
});

test('recordRunSummary appends one valid NDJSON line', async () => {
  const repoRoot = await writeFixtureRun();
  const historyPath = '.harness/history/runs.ndjson';

  const summary = await recordRunSummary({
    repoRoot,
    runId: 'demo-run',
    recordedAt: '2026-07-04T00:00:00.000Z',
    outcome: 'blocked',
    historyPath,
    dryRun: false,
  });

  const text = await readFile(path.join(repoRoot, historyPath), 'utf8');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), summary);
  assert.equal(summary.outcome, 'blocked');
});
