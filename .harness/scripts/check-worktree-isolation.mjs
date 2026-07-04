#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(__filename), '..', '..');

async function git(repoRoot, args) {
  const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
  return stdout.trim();
}

function resolveGitPath(repoRoot, value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function isInsideDirectory(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function safeRealpath(value) {
  return realpath(value);
}

async function gitOptional(repoRoot, args) {
  try {
    return await git(repoRoot, args);
  } catch {
    return '';
  }
}

export async function checkWorktreeIsolation({ repoRoot = defaultRepoRoot } = {}) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  let toplevel;
  let gitDir;
  let gitCommonDir;

  try {
    [toplevel, gitDir, gitCommonDir] = await Promise.all([
      git(absoluteRepoRoot, ['rev-parse', '--show-toplevel']),
      git(absoluteRepoRoot, ['rev-parse', '--git-dir']),
      git(absoluteRepoRoot, ['rev-parse', '--git-common-dir']),
    ]);
  } catch (error) {
    return {
      ok: false,
      errors: [`Not a git checkout or cannot inspect repository: ${absoluteRepoRoot}`],
      mode: 'unknown',
    };
  }

  const [toplevelReal, gitDirReal, gitCommonDirReal] = await Promise.all([
    safeRealpath(toplevel),
    safeRealpath(resolveGitPath(absoluteRepoRoot, gitDir)),
    safeRealpath(resolveGitPath(absoluteRepoRoot, gitCommonDir)),
  ]);
  const superproject = await gitOptional(absoluteRepoRoot, ['rev-parse', '--show-superproject-working-tree']);
  const isLinkedWorktree = gitDirReal !== gitCommonDirReal && superproject === '';

  if (isLinkedWorktree) {
    const mainRepoRoot = path.basename(gitCommonDirReal) === '.git' ? path.dirname(gitCommonDirReal) : null;
    const expectedWorktreesRoot = mainRepoRoot ? path.join(mainRepoRoot, '.worktrees') : null;
    if (!expectedWorktreesRoot || !isInsideDirectory(toplevelReal, expectedWorktreesRoot)) {
      return {
        ok: false,
        errors: [
          `Linked worktrees for this repository must live under ${expectedWorktreesRoot ?? '<repo>/.worktrees'}.`,
          `Current worktree path: ${toplevelReal}`,
        ],
        mode: 'linked-worktree-outside-policy',
        worktreePath: toplevelReal,
      };
    }

    return {
      ok: true,
      errors: [],
      mode: 'linked-worktree',
      worktreePath: toplevelReal,
    };
  }

  const branch = await gitOptional(absoluteRepoRoot, ['branch', '--show-current']);
  const status = await gitOptional(absoluteRepoRoot, ['status', '--porcelain']);
  const errors = [
    `Feature-start work must run in an isolated .worktrees workspace; current checkout is not an isolated .worktrees workspace: ${toplevelReal}`,
    'Create or select one with `.pi/bin/worktree-create` before writing run artifacts, specs, plans, or implementation files.',
  ];
  if (branch) {
    errors.push(`Current branch: ${branch}`);
  }
  if (status) {
    errors.push(`Repository root checkout has working tree changes:\n${status}`);
  }

  return {
    ok: false,
    errors,
    mode: 'root-checkout',
    worktreePath: toplevelReal,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const result = await checkWorktreeIsolation(parseArgs(process.argv.slice(2)));
  if (result.ok) {
    console.log(`Worktree isolation check passed (${result.mode}: ${result.worktreePath}).`);
    return;
  }

  console.error('Worktree isolation check failed:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
