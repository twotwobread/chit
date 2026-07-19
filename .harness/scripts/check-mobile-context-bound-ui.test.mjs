import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { checkMobileContextBoundUi, findContextBoundUiViolationsInSource } from './check-mobile-context-bound-ui.mjs';

async function withTempRepo(files, callback) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'i-um-context-ui-'));
  try {
    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const filePath = path.join(repoRoot, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
      }),
    );
    return await callback(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

describe('mobile context-bound UI guard', () => {
  it('flags bottom-sheet-bound aliases rendered outside their provider tree', () => {
    const source = `
export function Broken() {
  return (
    <View>
      <GooglePlaceBottomSheetTextInput accessibilityLabel="outside" />
      <GooglePlaceBottomSheet>
        <GooglePlaceBottomSheetTextInput accessibilityLabel="inside" />
      </GooglePlaceBottomSheet>
    </View>
  );
}
`;

    const violations = findContextBoundUiViolationsInSource(source, { sourcePath: 'Broken.tsx' });

    assert.deepEqual(
      violations.map(({ component, line }) => ({ component, line })),
      [{ component: 'GooglePlaceBottomSheetTextInput', line: 5 }],
    );
  });

  it('treats @gorhom/bottom-sheet import aliases as context-bound components and providers', () => {
    const source = `
import BottomSheet, { BottomSheetScrollView as SheetScroll, BottomSheetTextInput as SheetInput } from '@gorhom/bottom-sheet';

export function Aliased() {
  return (
    <>
      <SheetInput />
      <BottomSheet index={0} snapPoints={[100]}>
        <SheetScroll>
          <SheetInput />
        </SheetScroll>
      </BottomSheet>
    </>
  );
}
`;

    const violations = findContextBoundUiViolationsInSource(source, { sourcePath: 'Aliased.tsx' });

    assert.deepEqual(
      violations.map(({ component, line }) => ({ component, line })),
      [{ component: 'SheetInput', line: 7 }],
    );
  });

  it('scans mobile TSX files and ignores non-TSX files by default', async () => {
    await withTempRepo(
      {
        'apps/mobile/lib/Broken.tsx': `
export function Broken() {
  return <GooglePlaceBottomSheetScrollView />;
}
`,
        'apps/mobile/lib/Notes.md': '<GooglePlaceBottomSheetTextInput />',
      },
      async (repoRoot) => {
        const result = await checkMobileContextBoundUi({ repoRoot });

        assert.equal(result.ok, false);
        assert.equal(result.violations.length, 1);
        assert.equal(result.violations[0].sourcePath, 'apps/mobile/lib/Broken.tsx');
        assert.equal(result.violations[0].component, 'GooglePlaceBottomSheetScrollView');
      },
    );
  });

  it('passes when context-bound components stay inside known provider roots', async () => {
    await withTempRepo(
      {
        'apps/mobile/lib/Safe.tsx': `
export function Safe() {
  return (
    <GooglePlaceBottomSheet index={0} snapPoints={[100]}>
      <GooglePlaceBottomSheetScrollView>
        <GooglePlaceBottomSheetTextInput />
      </GooglePlaceBottomSheetScrollView>
    </GooglePlaceBottomSheet>
  );
}
`,
      },
      async (repoRoot) => {
        const result = await checkMobileContextBoundUi({ repoRoot });

        assert.equal(result.ok, true);
        assert.deepEqual(result.violations, []);
      },
    );
  });
});
