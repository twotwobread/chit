#!/usr/bin/env node
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, isMap } from 'yaml';
import { validateExpression } from './policy-expression.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const requiredDirs = [
  '.harness/workflows',
  '.harness/contracts',
  '.harness/providers',
  '.harness/policies',
  '.harness/policies/rulepacks',
  '.harness/checks',
  '.harness/artifacts',
  '.harness/artifacts/schemas',
  '.harness/artifacts/templates',
  '.harness/history',
  '.harness/evals',
  '.harness/evals/cases',
  '.harness/rules',
  '.harness/skills',
  '.harness/scripts',
];

const expectedGeneratedAdapters = [
  ['.harness/skills/feature-start/SKILL.md', '.pi/skills/i-um-feature-start/SKILL.md'],
  ['.harness/skills/feature-start/SKILL.md', '.claude/skills/i-um-feature-start/SKILL.md'],
  ['.harness/skills/feature-start/SKILL.md', '.agents/skills/i-um-feature-start/SKILL.md'],
  ['.harness/skills/feature-spec-plan/SKILL.md', '.pi/skills/i-um-feature-spec-plan/SKILL.md'],
  ['.harness/skills/feature-spec-plan/SKILL.md', '.claude/skills/i-um-feature-spec-plan/SKILL.md'],
  ['.harness/skills/feature-spec-plan/SKILL.md', '.agents/skills/i-um-feature-spec-plan/SKILL.md'],
  ['.harness/skills/docs-cleanup/SKILL.md', '.pi/skills/i-um-docs-cleanup/SKILL.md'],
  ['.harness/skills/docs-cleanup/SKILL.md', '.claude/skills/i-um-docs-cleanup/SKILL.md'],
  ['.harness/skills/docs-cleanup/SKILL.md', '.agents/skills/i-um-docs-cleanup/SKILL.md'],
  ['.harness/skills/pr-lifecycle/SKILL.md', '.pi/skills/i-um-pr-lifecycle/SKILL.md'],
  ['.harness/skills/pr-lifecycle/SKILL.md', '.claude/skills/i-um-pr-lifecycle/SKILL.md'],
  ['.harness/skills/pr-lifecycle/SKILL.md', '.agents/skills/i-um-pr-lifecycle/SKILL.md'],
  ['.harness/skills/staging-deploy/SKILL.md', '.pi/skills/i-um-staging-deploy/SKILL.md'],
  ['.harness/skills/staging-deploy/SKILL.md', '.claude/skills/i-um-staging-deploy/SKILL.md'],
  ['.harness/skills/staging-deploy/SKILL.md', '.agents/skills/i-um-staging-deploy/SKILL.md'],
  ['.harness/skills/ui-ux-pro-max/SKILL.md', '.pi/skills/ui-ux-pro-max/SKILL.md'],
  ['.harness/skills/ui-ux-pro-max/SKILL.md', '.claude/skills/ui-ux-pro-max/SKILL.md'],
  ['.harness/skills/ui-ux-pro-max/SKILL.md', '.agents/skills/ui-ux-pro-max/SKILL.md'],
  ['.harness/rules/code/api-db.md', '.pi/rules/api-db.md'],
  ['.harness/rules/code/code-quality.md', '.pi/rules/code-quality.md'],
  ['.harness/rules/core/commit.md', '.pi/rules/commit.md'],
  ['.harness/rules/core/completion-report.md', '.pi/rules/completion-report.md'],
  ['.harness/rules/phase/deploy.rules.md', '.pi/rules/deploy.md'],
  ['.harness/rules/phase/docs-cleanup.rules.md', '.pi/rules/docs-cleanup.md'],
  ['.harness/rules/phase/feature-implement.rules.md', '.pi/rules/feature-implement.md'],
  ['.harness/rules/code/mobile-ui.md', '.pi/rules/mobile-ui.md'],
  ['.harness/rules/phase/pr-lifecycle.rules.md', '.pi/rules/pr-lifecycle.md'],
  ['.harness/rules/phase/task-triage.rules.md', '.pi/rules/task-triage.md'],
  ['.harness/rules/code/testing.md', '.pi/rules/testing.md'],
  ['.harness/rules/core/worktree.md', '.pi/rules/worktree.md'],
];

const expectedGeneratedSkillDirectories = [
  ['.harness/skills/ui-ux-pro-max', '.pi/skills/ui-ux-pro-max'],
  ['.harness/skills/ui-ux-pro-max', '.claude/skills/ui-ux-pro-max'],
  ['.harness/skills/ui-ux-pro-max', '.agents/skills/ui-ux-pro-max'],
];

const errors = [];
const pendingPathChecks = [];

async function exists(relPath) {
  try {
    await access(path.join(repoRoot, relPath));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(relDir, baseDir = relDir) {
  let entries;
  try {
    entries = await readdir(path.join(repoRoot, relDir), { withFileTypes: true });
  } catch {
    return undefined;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name === '.DS_Store' || entry.name.endsWith('.pyc') || entry.name.endsWith('.pyo')) {
      continue;
    }

    const childRel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      const childFiles = await listFiles(childRel, baseDir);
      if (childFiles) files.push(...childFiles);
    } else if (entry.isFile()) {
      files.push(path.relative(path.join(repoRoot, baseDir), path.join(repoRoot, childRel)).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

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

async function readYaml(relPath) {
  const text = await readFile(path.join(repoRoot, relPath), 'utf8');
  const doc = parseDocument(text, { prettyErrors: false });

  for (const error of doc.errors) {
    errors.push(`${relPath} YAML parse error: ${error.message}`);
  }

  if (!isMap(doc.contents)) {
    errors.push(`${relPath} must be a YAML mapping at the root`);
    return {};
  }

  return doc.toJS({ mapAsMap: false }) ?? {};
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(owner, obj, key) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    errors.push(`${owner} must define string field: ${key}`);
    return undefined;
  }
  return obj[key];
}

function requireObject(owner, obj, key) {
  if (!isObject(obj?.[key])) {
    errors.push(`${owner} must define mapping field: ${key}`);
    return {};
  }
  return obj[key];
}

function requireStringArray(owner, obj, key) {
  if (obj?.[key] === undefined) return undefined;
  if (!Array.isArray(obj[key]) || obj[key].some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${owner}.${key} must be a sequence of non-empty strings when present`);
    return undefined;
  }
  return obj[key];
}

function validateHarnessPath(owner, relPath, options = {}) {
  if (typeof relPath !== 'string' || !relPath.startsWith('.harness/')) {
    errors.push(`${owner} must reference a .harness path, got: ${String(relPath)}`);
    return;
  }
  if (options.allowRunTemplate && relPath.includes('{run_id}')) return;
  if (!options.skipExistsCheck) {
    pendingPathChecks.push([owner, relPath]);
  }
}

function collectHarnessPaths(value, output = []) {
  if (typeof value === 'string') {
    const matches = value.match(/\.harness\/[A-Za-z0-9_./{}-]+/g) ?? [];
    output.push(...matches);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHarnessPaths(item, output);
    return output;
  }
  if (isObject(value)) {
    for (const item of Object.values(value)) collectHarnessPaths(item, output);
  }
  return output;
}

function validateProviderRef(owner, provider) {
  if (typeof provider !== 'string' || provider.trim() === '') {
    errors.push(`${owner} provider must be a non-empty string`);
    return;
  }
  pendingPathChecks.push([`${owner} provider doc`, `.harness/providers/${provider}.md`]);
}

function validatePolicyExpression(owner, expression, axes) {
  const result = validateExpression(expression, axes);
  for (const error of result.errors) {
    errors.push(`${owner}: ${error}`);
  }
}

function validateWhenExpressions(owner, value, axes) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) validateWhenExpressions(`${owner}[${index}]`, item, axes);
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (['when', 'except_when', 'required_when'].includes(key)) {
      validatePolicyExpression(`${owner}.${key}`, child, axes);
    } else {
      validateWhenExpressions(`${owner}.${key}`, child, axes);
    }
  }
}

function validateProviderPolicies(owner, providerPolicies, axes) {
  for (const [policyName, policy] of Object.entries(providerPolicies)) {
    const policyOwner = `${owner}.provider_policies.${policyName}`;
    if (!isObject(policy)) {
      errors.push(`${policyOwner} must be a mapping`);
      continue;
    }

    validateProviderRef(`${policyOwner}.default`, policy.default);
    if (policy.rules !== undefined && !Array.isArray(policy.rules)) {
      errors.push(`${policyOwner}.rules must be a sequence when present`);
    }
    for (const [index, rule] of (policy.rules ?? []).entries()) {
      const ruleOwner = `${policyOwner}.rules[${index}]`;
      if (!isObject(rule)) {
        errors.push(`${ruleOwner} must be a mapping`);
        continue;
      }
      const when = requireString(ruleOwner, rule, 'when');
      if (when) validatePolicyExpression(`${ruleOwner}.when`, when, axes);
      validateProviderRef(ruleOwner, rule.provider);
    }
  }
}

function validatePolicyFile(relPath, policy) {
  const owner = relPath;
  requireString(owner, policy, 'id');
  if (typeof policy.version !== 'number') {
    errors.push(`${owner} must define numeric field: version`);
  }

  const axes = requireObject(owner, policy, 'classification_axes');
  const providerPolicies = isObject(policy.provider_policies) ? policy.provider_policies : {};
  validateProviderPolicies(owner, providerPolicies, axes);
  validateWhenExpressions(`${owner}.routing`, policy.routing, axes);
  validateWhenExpressions(`${owner}.tiers`, policy.tiers, axes);
  validateWhenExpressions(`${owner}.approvals`, policy.approvals, axes);

  if (isObject(policy.tiers)) {
    for (const [tierName, tier] of Object.entries(policy.tiers)) {
      if (!isObject(tier)) continue;
      for (const check of tier.checks ?? []) {
        if (typeof check !== 'string' || check.trim() === '') {
          errors.push(`${owner}.tiers.${tierName}.checks must contain non-empty check ids`);
          continue;
        }
        pendingPathChecks.push([`${owner}.tiers.${tierName}.checks.${check}`, `.harness/checks/${check}.yml`]);
      }
    }
  }

  if (isObject(policy.rulepack_selection)) {
    for (const [key, rulepackPath] of Object.entries(policy.rulepack_selection)) {
      validateHarnessPath(`${owner}.rulepack_selection.${key}`, rulepackPath);
    }
  }

  for (const [index, ref] of collectHarnessPaths(policy).entries()) {
    pendingPathChecks.push([`${owner} embedded .harness ref[${index}]`, ref]);
  }
}

function validateWorkflow(relPath, workflow, policiesByPath) {
  const owner = relPath;
  requireString(owner, workflow, 'name');
  if (typeof workflow.version !== 'number') {
    errors.push(`${owner} must define numeric field: version`);
  }

  const policyPath = typeof workflow.policy === 'string' ? workflow.policy : undefined;
  const externalPolicy = policyPath ? policiesByPath.get(policyPath) : undefined;
  if (policyPath) {
    validateHarnessPath(`${owner}.policy`, policyPath);
    if (!externalPolicy) errors.push(`${owner}.policy references missing policy: ${policyPath}`);
  }

  const rulepack = requireString(owner, workflow, 'rulepack');
  if (rulepack) validateHarnessPath(`${owner}.rulepack`, rulepack);

  if (workflow.artifacts !== undefined) {
    if (!isObject(workflow.artifacts)) {
      errors.push(`${owner}.artifacts must be a mapping when present`);
    } else {
      for (const [key, artifactPath] of Object.entries(workflow.artifacts)) {
        validateHarnessPath(`${owner}.artifacts.${key}`, artifactPath, { allowRunTemplate: true });
      }
    }
  }

  const phases = requireObject(owner, workflow, 'phases');
  const classificationAxes = isObject(workflow.classification_axes)
    ? workflow.classification_axes
    : isObject(externalPolicy?.classification_axes)
      ? externalPolicy.classification_axes
      : {};
  const providerPolicies = isObject(workflow.provider_policies)
    ? workflow.provider_policies
    : isObject(externalPolicy?.provider_policies)
      ? externalPolicy.provider_policies
      : {};

  for (const [phaseName, phase] of Object.entries(phases)) {
    const phaseOwner = `${owner}.phases.${phaseName}`;
    if (!isObject(phase)) {
      errors.push(`${phaseOwner} must be a mapping`);
      continue;
    }

    const contract = requireString(phaseOwner, phase, 'contract');
    if (contract) validateHarnessPath(`${phaseOwner}.contract`, contract);

    const hasProvider = typeof phase.provider === 'string';
    const hasProviderPolicy = typeof phase.provider_policy === 'string';
    if (hasProvider === hasProviderPolicy) {
      errors.push(`${phaseOwner} must define exactly one of provider or provider_policy`);
    }
    if (hasProvider) validateProviderRef(phaseOwner, phase.provider);
    if (hasProviderPolicy && !isObject(providerPolicies[phase.provider_policy])) {
      errors.push(`${phaseOwner} references missing provider policy: ${phase.provider_policy}`);
    }
  }

  if (workflow.provider_policies !== undefined) {
    validateProviderPolicies(owner, workflow.provider_policies, classificationAxes);
  }

  if (workflow.checks !== undefined) {
    if (!isObject(workflow.checks)) {
      errors.push(`${owner}.checks must be a mapping when present`);
    } else {
      for (const [stageName, checkIds] of Object.entries(workflow.checks)) {
        if (!Array.isArray(checkIds)) {
          errors.push(`${owner}.checks.${stageName} must be a sequence of check ids`);
          continue;
        }
        for (const checkId of checkIds) {
          if (typeof checkId !== 'string' || checkId.trim() === '') {
            errors.push(`${owner}.checks.${stageName} must contain non-empty check ids`);
            continue;
          }
          pendingPathChecks.push([`${owner}.checks.${stageName}.${checkId}`, `.harness/checks/${checkId}.yml`]);
        }
      }
    }
  }

  for (const [index, ref] of collectHarnessPaths(workflow).entries()) {
    if (ref.includes('{run_id}')) continue;
    pendingPathChecks.push([`${owner} embedded .harness ref[${index}]`, ref]);
  }
}

function validateRulepack(relPath, rulepack) {
  const owner = relPath;
  requireString(owner, rulepack, 'name');
  if (typeof rulepack.version !== 'number') {
    errors.push(`${owner} must define numeric field: version`);
  }

  for (const [index, ref] of collectHarnessPaths(rulepack).entries()) {
    validateHarnessPath(`${owner} rule ref[${index}]`, ref);
  }
}

function validateSchemaFile(relPath, schema) {
  const owner = relPath;
  requireString(owner, schema, 'schema_version');
  const required = requireStringArray(owner, schema, 'required');
  const requiredSections = requireStringArray(owner, schema, 'required_sections');

  if (!required && !requiredSections) {
    errors.push(`${owner} must define either required or required_sections`);
  }

  if (schema.fields !== undefined && !isObject(schema.fields)) {
    errors.push(`${owner}.fields must be a mapping when present`);
  }

  if (schema.verdict !== undefined) {
    if (!isObject(schema.verdict)) {
      errors.push(`${owner}.verdict must be a mapping when present`);
    } else {
      const verdictEnum = requireStringArray(`${owner}.verdict`, schema.verdict, 'enum');
      if (verdictEnum && verdictEnum.length === 0) {
        errors.push(`${owner}.verdict.enum must not be empty`);
      }
    }
  }
}

function validateCheckFile(relPath, check) {
  const owner = relPath;
  requireString(owner, check, 'id');
  const type = requireString(owner, check, 'type');
  const severity = requireString(owner, check, 'severity');
  if (type && !['command', 'schema_validation', 'human', 'model_judge', 'adapter_sync'].includes(type)) {
    errors.push(`${owner}.type must be one of command, schema_validation, human, model_judge, adapter_sync`);
  }
  if (severity && !['blocking', 'warning', 'advisory'].includes(severity)) {
    errors.push(`${owner}.severity must be one of blocking, warning, advisory`);
  }
  if (type === 'command') requireString(owner, check, 'command');

  if (isObject(check.applies_to)) {
    requireStringArray(`${owner}.applies_to`, check.applies_to, 'contracts');
  }
  if (isObject(check.evidence)) {
    requireString(owner, check.evidence, 'write_to');
  }
}

for (const dir of requiredDirs) {
  if (!(await exists(dir))) {
    errors.push(`missing required directory: ${dir}`);
  }
}

const policiesByPath = new Map();
const policyDir = path.join(repoRoot, '.harness/policies');
let policyFiles = [];
try {
  policyFiles = (await readdir(policyDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  policyFiles = [];
}
for (const file of policyFiles) {
  const rel = `.harness/policies/${file}`;
  const policy = await readYaml(rel);
  validatePolicyFile(rel, policy);
  policiesByPath.set(rel, policy);
}

const workflowsDir = path.join(repoRoot, '.harness/workflows');
let workflowFiles = [];
try {
  workflowFiles = (await readdir(workflowsDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  workflowFiles = [];
}
for (const file of workflowFiles) {
  const rel = `.harness/workflows/${file}`;
  validateWorkflow(rel, await readYaml(rel), policiesByPath);
}

const rulepackDir = path.join(repoRoot, '.harness/policies/rulepacks');
let rulepackFiles = [];
try {
  rulepackFiles = (await readdir(rulepackDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  rulepackFiles = [];
}
for (const file of rulepackFiles) {
  const rel = `.harness/policies/rulepacks/${file}`;
  validateRulepack(rel, await readYaml(rel));
}

const schemasDir = path.join(repoRoot, '.harness/artifacts/schemas');
let schemaFiles = [];
try {
  schemaFiles = (await readdir(schemasDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  schemaFiles = [];
}
for (const file of schemaFiles) {
  const rel = `.harness/artifacts/schemas/${file}`;
  validateSchemaFile(rel, await readYaml(rel));
}

const checksDir = path.join(repoRoot, '.harness/checks');
let checkFiles = [];
try {
  checkFiles = (await readdir(checksDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  checkFiles = [];
}
for (const file of checkFiles) {
  const rel = `.harness/checks/${file}`;
  validateCheckFile(rel, await readYaml(rel));
}

for (const [owner, relPath] of pendingPathChecks) {
  if (!(await exists(relPath))) {
    errors.push(`${owner} references missing path: ${relPath}`);
  }
}

for (const [source, target] of expectedGeneratedAdapters) {
  if (!(await exists(source))) {
    errors.push(`missing adapter source: ${source}`);
    continue;
  }
  if (!(await exists(target))) {
    errors.push(`missing generated adapter: ${target}`);
    continue;
  }

  const sourceText = await readFile(path.join(repoRoot, source), 'utf8');
  const text = await readFile(path.join(repoRoot, target), 'utf8');
  if (!text.includes('GENERATED FILE. DO NOT EDIT.')) {
    errors.push(`${target} is expected to be a generated adapter copy`);
  }
  if (!text.includes(`Source:\n${source}`)) {
    errors.push(`${target} does not point to source ${source}`);
  }
  if (text !== renderGenerated(sourceText, source)) {
    errors.push(`${target} is out of sync with ${source}; run pnpm harness:sync`);
  }
}

for (const [sourceDir, targetDir] of expectedGeneratedSkillDirectories) {
  const sourceFiles = await listFiles(sourceDir);
  if (!sourceFiles) {
    errors.push(`missing adapter source directory: ${sourceDir}`);
    continue;
  }

  const targetFiles = await listFiles(targetDir);
  if (!targetFiles) {
    errors.push(`missing generated adapter directory: ${targetDir}`);
    continue;
  }

  const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
  const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
  if (missing.length || extra.length) {
    errors.push(`${targetDir} file list is out of sync with ${sourceDir}; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
  }

  for (const file of sourceFiles) {
    if (!targetFiles.includes(file)) continue;
    const source = `${sourceDir}/${file}`;
    const target = `${targetDir}/${file}`;
    const sourceText = await readFile(path.join(repoRoot, source), 'utf8');
    const targetText = await readFile(path.join(repoRoot, target), 'utf8');
    const expectedText = file === 'SKILL.md' ? renderGenerated(sourceText, source) : sourceText;
    if (targetText !== expectedText) {
      errors.push(`${target} is out of sync with ${source}; run pnpm harness:sync`);
    }
  }
}

if (await exists('AGENTS.md')) {
  const agents = await readFile(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  if (!agents.includes('.harness')) {
    errors.push('AGENTS.md must bootstrap agents to .harness');
  }
}

if (errors.length > 0) {
  console.error('Harness validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Harness validation passed.');
