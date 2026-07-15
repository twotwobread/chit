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

  it('passes the reserved top inset to the native bottom sheet so focused search stays below map overlays', () => {
    assert.match(
      mapSearchSource,
      /const resolvedSheetTopInset = resolveGooglePlaceSearchSheetTopInset\(sheetTopInset\);/,
    );
    assert.match(mapSearchSource, /topInset=\{resolvedSheetTopInset\}/);
  });

  it('guards bookmark-mode search result actions with current bookmarkResults before invoking create flow', () => {
    assert.match(mapSearchSource, /canBookmarkGooglePlaceSearchResult/);
    assert.match(
      mapSearchSource,
      /if \(actionMode === 'bookmark'\) \{\s*if \(canBookmarkGooglePlaceSearchResult\(result, bookmarkResults\)\) \{\s*onBookmarkSelectResult\?\.\(result\);\s*}\s*return;\s*}/,
    );
  });

  it('renders already-bookmarked search result primary actions as disabled controls', () => {
    assert.match(
      mapSearchSource,
      /actionView=\{buildGooglePlaceSearchResultActionView\(\{\s*addState: actionState,\s*bookmarkResults,\s*mode: actionMode,\s*result: item,\s*}\)\}/,
    );
    assert.match(
      mapSearchSource,
      /const isPrimaryActionDisabled = isBusy \|\| actionView\.primaryAction\?\.disabled === true;/,
    );
    assert.match(
      mapSearchSource,
      /accessibilityState=\{\{ disabled: isPrimaryActionDisabled }}\s*disabled=\{isPrimaryActionDisabled\}/,
    );
  });
});
