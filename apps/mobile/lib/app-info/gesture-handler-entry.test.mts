import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const layoutSource = readFileSync(new URL('../../app/_layout.tsx', import.meta.url), 'utf8');

describe('gesture handler app entry setup', () => {
  it('does not statically import react-native-gesture-handler from the app root', () => {
    assert.doesNotMatch(layoutSource, /^import .*react-native-gesture-handler/m);
  });
});
