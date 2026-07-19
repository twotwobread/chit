#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const skillMappings = [
  {
    source: '.harness/skills/feature-start/SKILL.md',
    targets: [
      '.pi/skills/i-um-feature-start/SKILL.md',
      '.claude/skills/i-um-feature-start/SKILL.md',
      '.agents/skills/i-um-feature-start/SKILL.md',
    ],
  },
  {
    source: '.harness/skills/feature-spec-plan/SKILL.md',
    targets: [
      '.pi/skills/i-um-feature-spec-plan/SKILL.md',
      '.claude/skills/i-um-feature-spec-plan/SKILL.md',
      '.agents/skills/i-um-feature-spec-plan/SKILL.md',
    ],
  },
  {
    source: '.harness/skills/docs-cleanup/SKILL.md',
    targets: [
      '.pi/skills/i-um-docs-cleanup/SKILL.md',
      '.claude/skills/i-um-docs-cleanup/SKILL.md',
      '.agents/skills/i-um-docs-cleanup/SKILL.md',
    ],
  },
  {
    source: '.harness/skills/pr-lifecycle/SKILL.md',
    targets: [
      '.pi/skills/i-um-pr-lifecycle/SKILL.md',
      '.claude/skills/i-um-pr-lifecycle/SKILL.md',
      '.agents/skills/i-um-pr-lifecycle/SKILL.md',
    ],
  },
  {
    source: '.harness/skills/staging-deploy/SKILL.md',
    targets: [
      '.pi/skills/i-um-staging-deploy/SKILL.md',
      '.claude/skills/i-um-staging-deploy/SKILL.md',
      '.agents/skills/i-um-staging-deploy/SKILL.md',
    ],
  },
];

const skillDirectoryMappings = [
  {
    source: '.harness/skills/ui-ux-pro-max',
    targets: [
      '.pi/skills/ui-ux-pro-max',
      '.claude/skills/ui-ux-pro-max',
      '.agents/skills/ui-ux-pro-max',
    ],
  },
];

const ruleMappings = [
  { source: '.harness/rules/code/api-db.md', target: '.pi/rules/api-db.md' },
  { source: '.harness/rules/code/code-quality.md', target: '.pi/rules/code-quality.md' },
  { source: '.harness/rules/core/commit.md', target: '.pi/rules/commit.md' },
  { source: '.harness/rules/core/completion-report.md', target: '.pi/rules/completion-report.md' },
  { source: '.harness/rules/phase/deploy.rules.md', target: '.pi/rules/deploy.md' },
  { source: '.harness/rules/phase/docs-cleanup.rules.md', target: '.pi/rules/docs-cleanup.md' },
  { source: '.harness/rules/phase/feature-implement.rules.md', target: '.pi/rules/feature-implement.md' },
  { source: '.harness/rules/code/mobile-ui.md', target: '.pi/rules/mobile-ui.md' },
  { source: '.harness/rules/phase/pr-lifecycle.rules.md', target: '.pi/rules/pr-lifecycle.md' },
  { source: '.harness/rules/phase/task-triage.rules.md', target: '.pi/rules/task-triage.md' },
  { source: '.harness/rules/code/testing.md', target: '.pi/rules/testing.md' },
  { source: '.harness/rules/core/worktree.md', target: '.pi/rules/worktree.md' },
];

function notice(source) {
  return `\n<!--\nGENERATED FILE. DO NOT EDIT.\n\nSource:\n${source}\n\nTo modify this adapter:\nedit the source file, then run:\npnpm harness:sync\n-->\n`;
}

function renderGenerated(content, source) {
  if (!content.startsWith('---\n')) {
    return `${notice(source)}\n${content}`;
  }

  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    return `${notice(source)}\n${content}`;
  }

  const frontmatter = content.slice(0, end + '\n---'.length);
  const body = content.slice(end + '\n---'.length);
  return `${frontmatter}\n${notice(source)}${body}`;
}

function shouldCopySkillPath(sourcePath) {
  const name = path.basename(sourcePath);
  return name !== '__pycache__' && name !== '.DS_Store' && !name.endsWith('.pyc') && !name.endsWith('.pyo');
}

async function syncMapping(source, targets) {
  const sourcePath = path.join(repoRoot, source);
  const sourceContent = await readFile(sourcePath, 'utf8');
  const rendered = renderGenerated(sourceContent, source);

  for (const target of targets) {
    const targetPath = path.join(repoRoot, target);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, rendered, 'utf8');
    console.log(`synced ${source} -> ${target}`);
  }
}

async function syncSkillDirectory(source, targets) {
  const sourceDir = path.join(repoRoot, source);
  const sourceSkill = path.join(sourceDir, 'SKILL.md');
  const sourceSkillContent = await readFile(sourceSkill, 'utf8');
  const renderedSkill = renderGenerated(sourceSkillContent, `${source}/SKILL.md`);

  for (const target of targets) {
    const targetDir = path.join(repoRoot, target);
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await cp(sourceDir, targetDir, { recursive: true, force: true, filter: shouldCopySkillPath });
    await writeFile(path.join(targetDir, 'SKILL.md'), renderedSkill, 'utf8');
    console.log(`synced ${source} -> ${target}`);
  }
}

for (const mapping of skillMappings) {
  await syncMapping(mapping.source, mapping.targets);
}

for (const mapping of skillDirectoryMappings) {
  await syncSkillDirectory(mapping.source, mapping.targets);
}

for (const mapping of ruleMappings) {
  await syncMapping(mapping.source, [mapping.target]);
}
