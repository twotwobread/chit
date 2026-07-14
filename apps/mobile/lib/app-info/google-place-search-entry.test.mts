import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const placeSearchSource = readFileSync(
  new URL('../../app/trips/[tripId]/days/[date]/place-search.tsx', import.meta.url),
  'utf8',
);
const mapSearchSource = readFileSync(new URL('../trip-ui/GooglePlaceMapSearch.tsx', import.meta.url), 'utf8');

describe('google place search native module entry setup', () => {
  it('does not statically import native gesture bottom-sheet modules so Expo Go can fall back safely', () => {
    assert.doesNotMatch(placeSearchSource, /^import .*@gorhom\/bottom-sheet/m);
    assert.doesNotMatch(placeSearchSource, /^import .*react-native-gesture-handler/m);
  });

  it('disables native bottom-sheet dynamic sizing so the minimized map search handle can mount without content height', () => {
    assert.match(mapSearchSource, /enableDynamicSizing=\{false\}/);
  });
});
