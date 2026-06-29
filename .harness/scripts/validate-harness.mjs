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
  '.harness/rules',
  '.harness/rulepacks',
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

const errors = [];

async function exists(relPath) {
  try {
    await access(path.join(repoRoot, relPath));
    return true;
  } catch {
    return false;
  }
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

function validateGateExpressions(owner, value, axes) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) validateGateExpressions(`${owner}[${index}]`, item, axes);
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (key === 'except_when') {
      validatePolicyExpression(`${owner}.except_when`, child, axes);
    } else {
      validateGateExpressions(`${owner}.${key}`, child, axes);
    }
  }
}

function validateWorkflow(relPath, workflow) {
  const owner = relPath;
  requireString(owner, workflow, 'name');
  if (typeof workflow.version !== 'number') {
    errors.push(`${owner} must define numeric field: version`);
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
  const classificationAxes = isObject(workflow.classification_axes) ? workflow.classification_axes : {};
  const providerPolicies = isObject(workflow.provider_policies) ? workflow.provider_policies : {};

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
      if (when) validatePolicyExpression(`${ruleOwner}.when`, when, classificationAxes);
      validateProviderRef(ruleOwner, rule.provider);
    }
  }

  const workflowTierNames = isObject(workflow.workflow_tiers) ? Object.keys(workflow.workflow_tiers) : [];

  if (isObject(workflow.workflow_tiers)) {
    for (const [tierName, tier] of Object.entries(workflow.workflow_tiers)) {
      const tierOwner = `${owner}.workflow_tiers.${tierName}`;
      if (!isObject(tier)) {
        errors.push(`${tierOwner} must be a mapping`);
        continue;
      }
      const when = requireString(tierOwner, tier, 'when');
      if (when) validatePolicyExpression(`${tierOwner}.when`, when, classificationAxes);
    }
  }

  if (workflow.gates !== undefined) {
    validateGateExpressions(`${owner}.gates`, workflow.gates, {
      ...classificationAxes,
      workflow_tier: workflowTierNames,
      user_approved_skip_spec_review: [true, false],
    });
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

function requireStringArray(owner, obj, key) {
  if (obj?.[key] === undefined) return undefined;
  if (!Array.isArray(obj[key]) || obj[key].some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${owner}.${key} must be a sequence of non-empty strings when present`);
    return undefined;
  }
  return obj[key];
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

const pendingPathChecks = [];

for (const dir of requiredDirs) {
  if (!(await exists(dir))) {
    errors.push(`missing required directory: ${dir}`);
  }
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
  validateWorkflow(rel, await readYaml(rel));
}

const rulepackDir = path.join(repoRoot, '.harness/rulepacks');
let rulepackFiles = [];
try {
  rulepackFiles = (await readdir(rulepackDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  rulepackFiles = [];
}

for (const file of rulepackFiles) {
  const rel = `.harness/rulepacks/${file}`;
  validateRulepack(rel, await readYaml(rel));
}

const schemasDir = path.join(repoRoot, '.harness/schemas');
let schemaFiles = [];
try {
  schemaFiles = (await readdir(schemasDir)).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
} catch {
  schemaFiles = [];
}

for (const file of schemaFiles) {
  const rel = `.harness/schemas/${file}`;
  validateSchemaFile(rel, await readYaml(rel));
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
