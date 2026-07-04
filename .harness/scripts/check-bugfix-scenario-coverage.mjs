#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, isMap } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(__filename), '..', '..');

function normalizeCell(value) {
  return value.trim().replace(/^`|`$/g, '').trim();
}

function normalizeHeader(value) {
  return normalizeCell(value).toLowerCase().replace(/\s+/g, ' ');
}

function hasPlaceholder(value) {
  return /<[^>]+>|\bTODO\b|\bTBD\b/i.test(value);
}

function isEmptyLike(value) {
  const normalized = normalizeCell(value).toLowerCase();
  return normalized === '' || normalized === '-' || normalized === 'n/a' || normalized === 'none';
}

function isNotCovered(value) {
  const normalized = normalizeCell(value).toLowerCase();
  return isEmptyLike(normalized) || normalized === 'not covered' || normalized === 'not run';
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readYamlFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  const doc = parseDocument(text, { prettyErrors: false });
  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    throw new Error(`Invalid YAML: ${filePath}`);
  }
  return doc.toJS({ mapAsMap: false }) ?? {};
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^##\\s+${escaped}\\s*$`, 'im');
  const match = markdown.match(pattern);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function parseMarkdownTable(sectionText) {
  const lines = sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
  if (lines.length < 3) return null;

  const header = lines[0]
    .slice(1, -1)
    .split('|')
    .map(normalizeHeader);
  const separator = lines[1]
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
  if (!separator.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;

  const rows = lines.slice(2).map((line) =>
    line
      .slice(1, -1)
      .split('|')
      .map(normalizeCell),
  );

  return { header, rows };
}

function columnIndex(header, acceptedNames) {
  return header.findIndex((name) => acceptedNames.includes(name));
}

export function validateBugfixScenarioCoverageMarkdown(markdown) {
  const errors = [];
  const section = extractSection(markdown, 'User scenario coverage');
  if (!section) {
    return {
      ok: false,
      errors: ['Missing required section: ## User scenario coverage'],
      coveredRows: 0,
      gapRows: 0,
    };
  }

  const table = parseMarkdownTable(section);
  if (!table) {
    return {
      ok: false,
      errors: ['## User scenario coverage must contain a markdown table with at least one scenario row'],
      coveredRows: 0,
      gapRows: 0,
    };
  }

  const givenIndex = columnIndex(table.header, ['given']);
  const whenIndex = columnIndex(table.header, ['when']);
  const thenIndex = columnIndex(table.header, ['then']);
  const automatedIndex = columnIndex(table.header, ['automated coverage', 'automated test', 'test coverage']);
  const gapIndex = columnIndex(table.header, ['gap / risk', 'gap/risk', 'gap', 'risk', 'result / gap']);

  for (const [name, index] of [
    ['Given', givenIndex],
    ['When', whenIndex],
    ['Then', thenIndex],
    ['Automated coverage', automatedIndex],
  ]) {
    if (index === -1) errors.push(`User scenario coverage table is missing required column: ${name}`);
  }
  if (errors.length > 0) return { ok: false, errors, coveredRows: 0, gapRows: 0 };

  let coveredRows = 0;
  let gapRows = 0;

  for (const [rowNumber, row] of table.rows.entries()) {
    const rowErrors = [];
    const given = row[givenIndex] ?? '';
    const when = row[whenIndex] ?? '';
    const then = row[thenIndex] ?? '';
    const automatedCoverage = row[automatedIndex] ?? '';
    const gap = gapIndex === -1 ? '' : (row[gapIndex] ?? '');

    for (const [name, value] of [
      ['Given', given],
      ['When', when],
      ['Then', then],
    ]) {
      if (isEmptyLike(value)) rowErrors.push(`row ${rowNumber + 1}: ${name} must be filled`);
      if (hasPlaceholder(value)) rowErrors.push(`row ${rowNumber + 1}: ${name} contains a placeholder`);
    }

    if (hasPlaceholder(automatedCoverage) || hasPlaceholder(gap)) {
      rowErrors.push(`row ${rowNumber + 1}: coverage/gap contains a placeholder`);
    }

    const hasAutomatedCoverage = !isNotCovered(automatedCoverage);
    const hasExplicitGap = !isEmptyLike(gap) && !hasPlaceholder(gap);

    if (hasAutomatedCoverage) coveredRows += 1;
    if (!hasAutomatedCoverage && hasExplicitGap) gapRows += 1;
    if (!hasAutomatedCoverage && !hasExplicitGap) {
      rowErrors.push(
        `row ${rowNumber + 1}: provide automated coverage or an explicit regression gap/risk`,
      );
    }

    errors.push(...rowErrors);
  }

  if (table.rows.length === 0) errors.push('User scenario coverage table must include at least one scenario row');

  return { ok: errors.length === 0, errors, coveredRows, gapRows };
}

export async function checkBugfixScenarioCoverage({ runDir, repoRoot = defaultRepoRoot } = {}) {
  if (!runDir) throw new Error('runDir is required');
  const absoluteRunDir = path.isAbsolute(runDir) ? runDir : path.join(repoRoot, runDir);
  const classificationPath = path.join(absoluteRunDir, 'artifacts/classification.yaml');
  const verificationPath = path.join(absoluteRunDir, 'artifacts/verification.md');

  if (!(await exists(classificationPath))) {
    return { ok: false, skipped: false, errors: [`Missing classification artifact: ${classificationPath}`] };
  }

  const classification = await readYamlFile(classificationPath);
  if (classification.type !== 'bugfix') {
    return { ok: true, skipped: true, errors: [], coveredRows: 0, gapRows: 0 };
  }

  if (!(await exists(verificationPath))) {
    return {
      ok: false,
      skipped: false,
      errors: [`Bugfix runs must include verification artifact: ${verificationPath}`],
      coveredRows: 0,
      gapRows: 0,
    };
  }

  const verification = await readFile(verificationPath, 'utf8');
  return { skipped: false, ...validateBugfixScenarioCoverageMarkdown(verification) };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--run-dir') {
      options.runDir = argv[index + 1];
      index += 1;
    } else if (arg === '--run-id') {
      options.runDir = path.join('.harness/runs', argv[index + 1]);
      index += 1;
    } else if (arg === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.runDir) {
    throw new Error('Usage: check-bugfix-scenario-coverage.mjs --run-id <run-id> | --run-dir <path>');
  }

  const result = await checkBugfixScenarioCoverage(options);
  if (result.ok) {
    const detail = result.skipped
      ? 'non-bugfix run skipped'
      : `${result.coveredRows} covered scenario row(s), ${result.gapRows} explicit gap row(s)`;
    console.log(`Bugfix scenario coverage check passed (${detail}).`);
    return;
  }

  console.error('Bugfix scenario coverage check failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
