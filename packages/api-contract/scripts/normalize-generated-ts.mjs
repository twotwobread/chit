import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../gen/ts', import.meta.url));

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile() && path.endsWith('.ts')) {
      yield path;
    }
  }
}

for await (const path of walk(root)) {
  const original = await readFile(path, 'utf8');
  const normalized = `${original.replace(/[ \t]+$/gm, '').replace(/\n+$/u, '')}\n`;
  if (normalized !== original) {
    await writeFile(path, normalized);
  }
}
