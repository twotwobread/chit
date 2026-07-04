#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(__filename), '..', '..');

const CLASSIFICATION_FIELDS = [
  'schema_version',
  'type',
  'route',
  'size',
  'ambiguity',
  'risk',
  'testability',
  'architecture_impact',
  'domain_sensitivity',
  'product_direction_unclear',
  'implementation_requires_exploration',
  'ready_for_implementation',
  'likely_tier',
  'next_phase',
  'knowns',
  'unknowns',
  'blocking_questions',
  'risk_signals',
  'rationale',
];

function usage() {
  console.error(`Usage:
  node .harness/scripts/record-run-summary.mjs \\
    --run-id <run-id> [--dry-run] [--outcome <outcome>]

Options:
  --run-id <id>       Run id under .harness/runs
  --runs-dir <path>   Runs directory (default: .harness/runs)
  --history <path>    History NDJSON path (default: .harness/history/runs.ndjson)
  --outcome <value>   Outcome label such as unknown, merged, blocked, abandoned, reverted
  --recorded-at <iso> Override recorded_at timestamp for deterministic tests
  --dry-run           Print the summary without appending it
`);
}

export function parseArgs(argv) {
  const args = {
    dryRun: false,
    runsDir: '.harness/runs',
    historyPath: '.harness/history/runs.ndjson',
    outcome: 'unknown',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (['--run-id', '--runs-dir', '--history', '--outcome', '--recorded-at'].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === '--run-id') args.runId = value;
      if (arg === '--runs-dir') args.runsDir = value;
      if (arg === '--history') args.historyPath = value;
      if (arg === '--outcome') args.outcome = value;
      if (arg === '--recorded-at') args.recordedAt = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function resolveRepoPath(repoRoot, relOrAbsPath) {
  return path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(repoRoot, relOrAbsPath);
}

async function readYaml(filePath, { optional = false } = {}) {
  try {
    return parse(await readFile(filePath, 'utf8')) ?? {};
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return null;
    throw error;
  }
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function truncateString(value, maxLength = 600) {
  if (typeof value !== 'string') return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function sanitizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .slice(0, 20)
    .map((item) => truncateString(item));
}

function sanitizeClassification(classification) {
  const output = {};
  for (const field of CLASSIFICATION_FIELDS) {
    if (classification[field] === undefined) continue;
    if (Array.isArray(classification[field])) {
      output[field] = sanitizeList(classification[field]);
    } else if (typeof classification[field] === 'string') {
      output[field] = truncateString(classification[field], field === 'rationale' ? 1000 : 600);
    } else {
      output[field] = classification[field];
    }
  }
  return output;
}

function sanitizeTierHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry) => ({
    tier: truncateString(entry?.tier ?? 'unknown', 120),
    reason: truncateString(entry?.reason ?? '', 600),
  }));
}

function sanitizeProviderSelection(providerSelection) {
  const selections = providerSelection?.selections ?? {};
  const output = {};
  for (const [phase, selection] of Object.entries(selections)) {
    output[phase] = {
      provider_policy: selection?.provider_policy ?? null,
      selected_provider: selection?.selected_provider ?? null,
      used_default: selection?.used_default ?? null,
      matched_rule: selection?.matched_rule
        ? {
            index: selection.matched_rule.index ?? null,
            when: truncateString(selection.matched_rule.when ?? '', 600),
            reason: truncateString(selection.matched_rule.reason ?? '', 600),
          }
        : null,
      reason: truncateString(selection?.reason ?? '', 600),
    };
  }
  return output;
}

function runPath(runRoot, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.join(runRoot, relPath);
}

export async function buildRunSummary({
  repoRoot = defaultRepoRoot,
  runId,
  runsDir = '.harness/runs',
  recordedAt = new Date().toISOString(),
  outcome = 'unknown',
} = {}) {
  if (!runId) throw new Error('--run-id is required');

  const runsRoot = resolveRepoPath(repoRoot, runsDir);
  const runRoot = path.join(runsRoot, runId);
  const runStatePath = path.join(runRoot, 'run.yaml');
  const runState = await readYaml(runStatePath);

  const classificationRel = runState.artifacts?.classification ?? 'artifacts/classification.yaml';
  const providerSelectionRel = runState.artifacts?.provider_selection ?? 'provider-selection.yaml';
  const classification = await readYaml(runPath(runRoot, classificationRel));
  const providerSelection = await readYaml(runPath(runRoot, providerSelectionRel), { optional: true });

  const policyPath = runState.policy ?? null;
  let policy = {};
  let policyHash = null;
  if (policyPath) {
    const policyText = await readFile(resolveRepoPath(repoRoot, policyPath), 'utf8');
    policy = parse(policyText) ?? {};
    policyHash = sha256(policyText);
  }

  return {
    schema_version: 'run-summary.v1',
    run_id: runState.run_id ?? runId,
    recorded_at: recordedAt,
    workflow: {
      name: runState.workflow ?? null,
    },
    policy: {
      path: policyPath,
      id: policy.id ?? null,
      version: policy.version ?? null,
      sha256: policyHash,
    },
    status: runState.status ?? null,
    current_phase: runState.current_phase ?? null,
    route: runState.route ?? classification.route ?? null,
    final_tier: runState.tier ?? classification.likely_tier ?? null,
    tier_history: sanitizeTierHistory(runState.tier_history),
    classification: sanitizeClassification(classification),
    provider_selection: sanitizeProviderSelection(providerSelection),
    outcome,
    review: {
      human_override: false,
      quality_notes: [],
      followups: [],
    },
    sources: {
      run_state: `${runsDir}/${runId}/run.yaml`,
      classification: `${runsDir}/${runId}/${classificationRel}`,
      provider_selection: providerSelection ? `${runsDir}/${runId}/${providerSelectionRel}` : null,
      excluded: [
        `${runsDir}/${runId}/private/`,
        `${runsDir}/${runId}/events.ndjson`,
        `${runsDir}/${runId}/artifacts/user-request.md`,
        `${runsDir}/${runId}/artifacts/checks/`,
      ],
    },
  };
}

export async function recordRunSummary({
  repoRoot = defaultRepoRoot,
  runId,
  runsDir = '.harness/runs',
  historyPath = '.harness/history/runs.ndjson',
  recordedAt,
  outcome = 'unknown',
  dryRun = false,
} = {}) {
  const summary = await buildRunSummary({ repoRoot, runId, runsDir, recordedAt, outcome });
  if (!dryRun) {
    const outputPath = resolveRepoPath(repoRoot, historyPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await appendFile(outputPath, `${JSON.stringify(summary)}\n`);
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.runId) {
    usage();
    process.exitCode = 2;
    return;
  }

  const summary = await recordRunSummary(args);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
