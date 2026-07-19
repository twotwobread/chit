import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTripDefaultTravelModeSelectorViewModel,
  buildTravelModeSelectorViewModel,
  defaultTripTravelMode,
  isTripDefaultTravelMode,
  isTravelMode,
  travelModeDisplayLabel,
  travelModeDisplayOptions,
  travelModeFromDisplayLabel,
  travelModeLabels,
  travelModes,
  tripDefaultTravelModeDisplayOptions,
  tripDefaultTravelModes,
} from './travel-mode';

describe('trip default travel mode helpers', () => {
  it('defines only transit and driving as trip defaults', () => {
    assert.deepEqual(tripDefaultTravelModes, ['transit', 'driving']);
    assert.equal(defaultTripTravelMode, 'transit');
    assert.deepEqual(tripDefaultTravelModeDisplayOptions, ['대중교통', '자동차']);
    assert.equal(isTripDefaultTravelMode('transit'), true);
    assert.equal(isTripDefaultTravelMode('driving'), true);
    assert.equal(isTripDefaultTravelMode('walking'), false);
  });

  it('builds trip default selector options without walking', () => {
    assert.deepEqual(buildTripDefaultTravelModeSelectorViewModel('driving'), {
      label: '기본 이동 방식',
      accessibilityLabel: '기본 이동 방식 선택',
      options: [
        {
          mode: 'transit',
          label: '대중교통',
          selected: false,
          accessibilityLabel: '대중교통',
          accessibilityState: { selected: false },
        },
        {
          mode: 'driving',
          label: '자동차',
          selected: true,
          accessibilityLabel: '자동차',
          accessibilityState: { selected: true },
        },
      ],
    });
  });
});

describe('route travel mode helpers', () => {
  it('defines canonical modes and Korean labels', () => {
    assert.deepEqual(travelModes, ['transit', 'walking', 'driving']);
    assert.deepEqual(travelModeLabels, {
      transit: '대중교통',
      walking: '도보',
      driving: '자동차',
    });
    assert.deepEqual(travelModeDisplayOptions, ['대중교통', '도보', '자동차']);
    assert.equal(travelModeDisplayLabel('driving'), '자동차');
    assert.equal(travelModeFromDisplayLabel('도보'), 'walking');
    assert.equal(travelModeFromDisplayLabel('자전거'), null);
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
});
