import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkBugfixScenarioCoverage } from './check-bugfix-scenario-coverage.mjs';

async function writeRun({ classification = 'type: bugfix\n', verification = '' } = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'harness-bugfix-scenario-'));
  const runDir = path.join(repoRoot, '.harness/runs/demo-run');
  await mkdir(path.join(runDir, 'artifacts'), { recursive: true });
  await writeFile(path.join(runDir, 'artifacts/classification.yaml'), classification);
  if (verification !== null) {
    await writeFile(path.join(runDir, 'artifacts/verification.md'), verification);
  }
  return { repoRoot, runDir };
}

test('skips non-bugfix runs', async () => {
  const { runDir } = await writeRun({ classification: 'type: feature\n', verification: null });

  const result = await checkBugfixScenarioCoverage({ runDir });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('fails bugfix runs without user scenario coverage', async () => {
  const { runDir } = await writeRun({
    verification: '# Verification\n\n## Commands\n\n- test: pass\n',
  });

  const result = await checkBugfixScenarioCoverage({ runDir });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /User scenario coverage/);
});

test('fails scenario coverage rows with placeholders', async () => {
  const { runDir } = await writeRun({
    verification: `# Verification

## User scenario coverage

| Given | When | Then | Automated coverage | Manual smoke | Gap / risk |
|---|---|---|---|---|---|
| <reported input/state> | 검색 버튼 클릭 | 결과 표시 | test | not run | none |
`,
  });

  const result = await checkBugfixScenarioCoverage({ runDir });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /placeholder/i);
});

test('passes bugfix runs with automated scenario coverage', async () => {
  const { runDir } = await writeRun({
    verification: `# Verification

## User scenario coverage

| Given | When | Then | Automated coverage | Manual smoke | Gap / risk |
|---|---|---|---|---|---|
| 유효한 장소 검색어 | 지도 탭 검색 submit | 검색 호출이 차단되지 않음 | google-search.test.mts: valid query is not blocked | not run | none |
`,
  });

  const result = await checkBugfixScenarioCoverage({ runDir });

  assert.equal(result.ok, true);
  assert.equal(result.coveredRows, 1);
});

test('passes bugfix runs with an explicit scenario regression gap', async () => {
  const { runDir } = await writeRun({
    verification: `# Verification

## User scenario coverage

| Given | When | Then | Automated coverage | Manual smoke | Gap / risk |
|---|---|---|---|---|---|
| 위치 권한 거부 상태 | 시스템 권한 팝업 처리 | 거부 안내 표시 | not covered | not run | 자동화 불가: OS 권한 팝업 제어 필요. Follow-up: device smoke |
`,
  });

  const result = await checkBugfixScenarioCoverage({ runDir });

  assert.equal(result.ok, true);
  assert.equal(result.gapRows, 1);
});
