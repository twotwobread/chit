import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { checkWorktreeIsolation } from './check-worktree-isolation.mjs';

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  await execFileAsync('git', args, { cwd });
}

async function createRepo() {
  const parent = await mkdtempParent();
  const repoRoot = path.join(parent, 'repo');
  await mkdir(repoRoot);
  await git(repoRoot, ['init', '-b', 'develop']);
  await writeFile(path.join(repoRoot, 'README.md'), '# demo\n');
  await git(repoRoot, ['add', 'README.md']);
  await git(repoRoot, ['-c', 'user.name=Test User', '-c', 'user.email=test@example.com', 'commit', '-m', 'init']);
  return { parent, repoRoot };
}

async function mkdtempParent() {
  return mkdtemp(path.join(os.tmpdir(), 'harness-worktree-isolation-'));
}

test('fails a normal root checkout even when develop is clean', async () => {
  const { repoRoot } = await createRepo();

  const result = await checkWorktreeIsolation({ repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /not an isolated \.worktrees workspace/);
  assert.match(result.errors.join('\n'), /\.pi\/bin\/worktree-create/);
});

test('fails a normal root checkout with working tree changes and reports the changed paths', async () => {
  const { repoRoot } = await createRepo();
  await writeFile(path.join(repoRoot, 'README.md'), '# changed\n');

  const result = await checkWorktreeIsolation({ repoRoot });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /root checkout has working tree changes/);
  assert.match(result.errors.join('\n'), /README\.md/);
});

test('passes a linked worktree under the repository .worktrees directory', async () => {
  const { repoRoot } = await createRepo();
  const worktreePath = path.join(repoRoot, '.worktrees', 'feature-demo');
  await git(repoRoot, ['worktree', 'add', worktreePath, '-b', 'feature/demo']);

  const result = await checkWorktreeIsolation({ repoRoot: worktreePath });

  assert.deepEqual(result, {
    ok: true,
    errors: [],
    mode: 'linked-worktree',
    worktreePath: await realpath(worktreePath),
  });
});

test('fails a linked worktree outside repository .worktrees', async () => {
  const { parent, repoRoot } = await createRepo();
  const worktreePath = path.join(parent, 'feature-external');
  await git(repoRoot, ['worktree', 'add', worktreePath, '-b', 'feature/external']);

  const result = await checkWorktreeIsolation({ repoRoot: worktreePath });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must live under/);
  assert.match(result.errors.join('\n'), /\.worktrees/);
});
