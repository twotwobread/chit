import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTravelModeSelectorViewModel,
  defaultTravelMode,
  isTravelMode,
  readStoredTravelMode,
  saveSelectedTravelMode,
  travelModeLabels,
  travelModes,
  type TravelModeStore,
} from './travel-mode';

function memoryStore(
  initial: string | null,
  options: { failGet?: boolean; failSet?: boolean; failDelete?: boolean } = {},
) {
  let value = initial;
  const setValues: string[] = [];
  let deleteCount = 0;

  const store: TravelModeStore = {
    getItem: async () => {
      if (options.failGet) {
        throw new Error('storage unreadable');
      }
      return value;
    },
    setItem: async (nextValue) => {
      if (options.failSet) {
        throw new Error('storage write failed');
      }
      value = nextValue;
      setValues.push(nextValue);
    },
    deleteItem: async () => {
      if (options.failDelete) {
        throw new Error('storage delete failed');
      }
      value = null;
      deleteCount += 1;
    },
  };

  return {
    store,
    get value() {
      return value;
    },
    setValues,
    get deleteCount() {
      return deleteCount;
    },
  };
}

describe('travel mode preference helpers', () => {
  it('defines canonical modes, Korean labels, and transit default', () => {
    assert.deepEqual(travelModes, ['transit', 'walking', 'driving']);
    assert.equal(defaultTravelMode, 'transit');
    assert.deepEqual(travelModeLabels, {
      transit: '대중교통',
      walking: '도보',
      driving: '자동차',
    });
    assert.equal(isTravelMode('transit'), true);
    assert.equal(isTravelMode('bike'), false);
  });

  it('builds selector options with selected-state accessibility semantics', () => {
    assert.deepEqual(buildTravelModeSelectorViewModel('walking'), {
      label: '이동 모드',
      accessibilityLabel: '이동 모드 선택',
      options: [
        {
          mode: 'transit',
          label: '대중교통',
          selected: false,
          accessibilityLabel: '대중교통',
          accessibilityState: { selected: false },
        },
        {
          mode: 'walking',
          label: '도보',
          selected: true,
          accessibilityLabel: '도보',
          accessibilityState: { selected: true },
        },
        {
          mode: 'driving',
          label: '자동차',
          selected: false,
          accessibilityLabel: '자동차',
          accessibilityState: { selected: false },
        },
      ],
    });
  });

  it('reads a valid device-local mode and falls back to transit for missing, invalid, or unreadable storage', async () => {
    assert.deepEqual(await readStoredTravelMode(memoryStore('driving').store), {
      status: 'ready',
      mode: 'driving',
    });
    assert.deepEqual(await readStoredTravelMode(memoryStore(null).store), {
      status: 'default',
      mode: 'transit',
      reason: 'missing',
    });

    const invalid = memoryStore('{"mode":"walking"}');
    assert.deepEqual(await readStoredTravelMode(invalid.store), {
      status: 'default',
      mode: 'transit',
      reason: 'invalid',
    });
    assert.equal(invalid.value, null);
    assert.equal(invalid.deleteCount, 1);

    assert.deepEqual(await readStoredTravelMode(memoryStore('walking', { failGet: true }).store), {
      status: 'default',
      mode: 'transit',
      reason: 'unreadable',
    });
  });

  it('persists selection but keeps the selected mode and no user message when writes fail', async () => {
    const writable = memoryStore(null);
    assert.deepEqual(await saveSelectedTravelMode('walking', writable.store), {
      status: 'saved',
      mode: 'walking',
      userMessage: null,
    });
    assert.deepEqual(writable.setValues, ['walking']);
    assert.equal(writable.value, 'walking');

    const failing = memoryStore('transit', { failSet: true });
    assert.deepEqual(await saveSelectedTravelMode('driving', failing.store), {
      status: 'failed',
      mode: 'driving',
      userMessage: null,
    });
    assert.equal(failing.value, 'transit');
  });
});
