#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { selectProvider, validateExpression } from './policy-expression.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

function usage() {
  console.error(`Usage:
  node .harness/scripts/evaluate-provider-policy.mjs \\
    --workflow .harness/workflows/feature-start.yml \\
    --policy spec-authoring-policy \\
    --classification .harness/runs/<run-id>/classification.yaml

Options:
  --workflow <path>        Workflow YAML path
  --policy <name>          Provider policy name in workflow.provider_policies
  --classification <path>  Classification/context YAML path
  --json                   Emit JSON instead of YAML
`);
}

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--workflow' || arg === '--policy' || arg === '--classification') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      args[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readYaml(relOrAbsPath) {
  const filePath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(repoRoot, relOrAbsPath);
  return parse(await readFile(filePath, 'utf8')) ?? {};
}

function providerDocPath(provider) {
  return `.harness/providers/${provider}.md`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.workflow || !args.policy || !args.classification) {
    usage();
    process.exit(2);
  }

  const workflow = await readYaml(args.workflow);
  const context = await readYaml(args.classification);
  const policy = workflow?.provider_policies?.[args.policy];

  if (!policy) {
    throw new Error(`Provider policy not found: ${args.policy}`);
  }

  const axes = workflow.classification_axes ?? {};
  const expressionErrors = [];
  for (const [index, rule] of (policy.rules ?? []).entries()) {
    const result = validateExpression(rule.when, axes);
    for (const error of result.errors) {
      expressionErrors.push(`${args.policy}.rules[${index}].when: ${error}`);
    }
  }
  if (expressionErrors.length > 0) {
    throw new Error(`Policy expression validation failed:\n- ${expressionErrors.join('\n- ')}`);
  }

  const selection = selectProvider(policy, context);
  const output = {
    workflow: workflow.name ?? args.workflow,
    policy: args.policy,
    classification: args.classification,
    selected_provider: selection.selected_provider,
    provider_doc: providerDocPath(selection.selected_provider),
    used_default: selection.used_default,
    matched_rule: selection.matched_rule,
  };

  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : stringify(output));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
