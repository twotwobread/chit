#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(__filename), '..', '..');

const defaultContextBoundComponents = new Set([
  'BottomSheetTextInput',
  'BottomSheetScrollView',
  'BottomSheetFlatList',
  'BottomSheetSectionList',
  'BottomSheetVirtualizedList',
  'BottomSheetView',
  'GooglePlaceBottomSheetTextInput',
  'GooglePlaceBottomSheetScrollView',
]);

const defaultProviderComponents = new Set(['BottomSheet', 'BottomSheetModal', 'GooglePlaceBottomSheet']);

const sourceExtensions = new Set(['.jsx', '.tsx']);
const ignoredDirectoryNames = new Set(['.expo', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules']);

function lineAndColumnAt(source, index) {
  let line = 1;
  let column = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function splitImportSpecifiers(specifiers) {
  return specifiers
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean);
}

function localNameForSpecifier(specifier) {
  const [imported, local] = specifier.split(/\s+as\s+/);
  return {
    imported: imported?.trim() ?? '',
    local: (local ?? imported)?.trim() ?? '',
  };
}

function addBottomSheetImportAliases(source, contextBoundComponents, providerComponents) {
  const importPattern = /import\s+([^;]+?)\s+from\s+['"]@gorhom\/bottom-sheet['"]/gs;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    const clause = match[1].trim();
    const namedStart = clause.indexOf('{');
    const namedEnd = clause.lastIndexOf('}');

    if (namedStart > 0) {
      const defaultImport = clause.slice(0, namedStart).replace(/,$/, '').trim();
      if (defaultImport) providerComponents.add(defaultImport);
    } else if (namedStart === -1 && clause && !clause.startsWith('*')) {
      providerComponents.add(clause.trim());
    }

    if (namedStart !== -1 && namedEnd > namedStart) {
      const namedSpecifiers = clause.slice(namedStart + 1, namedEnd);
      for (const specifier of splitImportSpecifiers(namedSpecifiers)) {
        const { imported, local } = localNameForSpecifier(specifier);
        if (defaultContextBoundComponents.has(imported)) contextBoundComponents.add(local);
        if (defaultProviderComponents.has(imported)) providerComponents.add(local);
      }
    }
  }
}

function isTagNameStart(char) {
  return /[A-Za-z]/.test(char ?? '');
}

function isTagNameChar(char) {
  return /[A-Za-z0-9_.$:-]/.test(char ?? '');
}

function scanJsxTagEnd(source, startIndex) {
  let braceDepth = 0;
  let quote = null;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '>' && braceDepth === 0) {
      return index;
    }
  }

  return -1;
}

function parseNextJsxTag(source, searchStart) {
  let openIndex = source.indexOf('<', searchStart);
  while (openIndex !== -1) {
    const next = source[openIndex + 1];
    const closing = next === '/';
    const nameStart = openIndex + (closing ? 2 : 1);

    if (source.startsWith('<!--', openIndex)) {
      const commentEnd = source.indexOf('-->', openIndex + 4);
      return parseNextJsxTag(source, commentEnd === -1 ? source.length : commentEnd + 3);
    }

    if (!isTagNameStart(source[nameStart])) {
      openIndex = source.indexOf('<', openIndex + 1);
      continue;
    }

    let nameEnd = nameStart;
    while (isTagNameChar(source[nameEnd])) nameEnd += 1;
    const name = source.slice(nameStart, nameEnd);
    const endIndex = scanJsxTagEnd(source, nameEnd);
    if (endIndex === -1) return null;

    let beforeClose = endIndex - 1;
    while (beforeClose > nameEnd && /\s/.test(source[beforeClose])) beforeClose -= 1;

    return {
      closing,
      endIndex,
      name,
      selfClosing: !closing && source[beforeClose] === '/',
      startIndex: openIndex,
    };
  }

  return null;
}

function hasProviderAncestor(stack, providerComponents) {
  return stack.some((tagName) => providerComponents.has(tagName));
}

export function findContextBoundUiViolationsInSource(source, { sourcePath = '<source>' } = {}) {
  const contextBoundComponents = new Set(defaultContextBoundComponents);
  const providerComponents = new Set(defaultProviderComponents);
  addBottomSheetImportAliases(source, contextBoundComponents, providerComponents);

  const violations = [];
  const stack = [];
  let cursor = 0;

  while (cursor < source.length) {
    const tag = parseNextJsxTag(source, cursor);
    if (!tag) break;
    cursor = tag.endIndex + 1;

    if (tag.closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const tagName = stack.pop();
        if (tagName === tag.name) break;
      }
      continue;
    }

    if (contextBoundComponents.has(tag.name) && !hasProviderAncestor(stack, providerComponents)) {
      const { line, column } = lineAndColumnAt(source, tag.startIndex);
      violations.push({
        column,
        component: tag.name,
        line,
        message: `${tag.name} is context-bound and must render inside a bottom-sheet provider tree. Use a plain React Native primitive for external overlays, or move it under BottomSheet.`,
        sourcePath,
      });
    }

    if (!tag.selfClosing) stack.push(tag.name);
  }

  return violations;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) continue;
      files.push(...(await listSourceFiles(path.join(directory, entry.name))));
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

export async function checkMobileContextBoundUi({ repoRoot = defaultRepoRoot, sourceDir = 'apps/mobile' } = {}) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const absoluteSourceDir = path.resolve(absoluteRepoRoot, sourceDir);

  if (!(await pathExists(absoluteSourceDir))) {
    return {
      ok: true,
      scannedFiles: 0,
      violations: [],
    };
  }

  const files = await listSourceFiles(absoluteSourceDir);
  const violations = [];

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    const sourcePath = path.relative(absoluteRepoRoot, filePath);
    violations.push(...findContextBoundUiViolationsInSource(source, { sourcePath }));
  }

  return {
    ok: violations.length === 0,
    scannedFiles: files.length,
    violations,
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
    } else if (arg === '--source-dir') {
      options.sourceDir = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const result = await checkMobileContextBoundUi(parseArgs(process.argv.slice(2)));
  if (result.ok) {
    console.log(`Mobile context-bound UI check passed (${result.scannedFiles} TSX/JSX file(s) scanned).`);
    return;
  }

  console.error('Mobile context-bound UI check failed:');
  for (const violation of result.violations) {
    console.error(`- ${violation.sourcePath}:${violation.line}:${violation.column} ${violation.message}`);
  }
  process.exit(1);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
