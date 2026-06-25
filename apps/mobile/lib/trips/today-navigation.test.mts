import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildGoogleMapsDestinationQuery,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsInstallUrl,
  openTodayNavigationDestination,
  todayNavigationFailureMessage,
} from './today-navigation';

describe('today navigation helpers', () => {
  it('builds a destination query from place name and address', () => {
    assert.equal(
      buildGoogleMapsDestinationQuery({ placeName: ' 도톤보리 ', address: ' 1 Chome Dotonbori, Chuo Ward, Osaka ' }),
      '도톤보리 1 Chome Dotonbori, Chuo Ward, Osaka',
    );
    assert.equal(buildGoogleMapsDestinationQuery({ placeName: '도톤보리', address: '   ' }), '도톤보리');
    assert.equal(buildGoogleMapsDestinationQuery({ placeName: '도톤보리' }), '도톤보리');
  });

  it('builds platform Google Maps directions URLs without an i-um origin', () => {
    const destination = { placeName: '도톤보리', address: '1 Chome Dotonbori, Chuo Ward, Osaka' };

    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'ios'),
      'comgooglemaps://?daddr=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'android'),
      'google.navigation:q=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'web'),
      'https://www.google.com/maps/dir/?api=1&destination=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka',
    );
  });

  it('adds exact supported travel-mode parameters and falls back to generic directions without mode substitution', () => {
    const destination = { placeName: '도톤보리', address: '1 Chome Dotonbori, Chuo Ward, Osaka' };

    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'ios', 'transit'),
      'comgooglemaps://?daddr=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka&directionsmode=transit',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'ios', 'walking'),
      'comgooglemaps://?daddr=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka&directionsmode=walking',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'android', 'walking'),
      'google.navigation:q=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka&mode=w',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'android', 'driving'),
      'google.navigation:q=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka&mode=d',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'android', 'transit'),
      'google.navigation:q=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka',
    );
    assert.equal(
      buildGoogleMapsDirectionsUrl(destination, 'web', 'transit'),
      'https://www.google.com/maps/dir/?api=1&destination=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%201%20Chome%20Dotonbori%2C%20Chuo%20Ward%2C%20Osaka&travelmode=transit',
    );
  });

  it('builds platform Google Maps install URLs', () => {
    assert.equal(buildGoogleMapsInstallUrl('ios'), 'itms-apps://apps.apple.com/app/google-maps/id585027354');
    assert.equal(buildGoogleMapsInstallUrl('android'), 'market://details?id=com.google.android.apps.maps');
  });

  it('opens directions first and does not open the store when Google Maps succeeds', async () => {
    const opened: string[] = [];
    const result = await openTodayNavigationDestination({
      destination: { placeName: '도톤보리', address: 'Dotonbori' },
      platform: 'ios',
      launcher: {
        openURL: async (url) => {
          opened.push(url);
        },
      },
      travelMode: 'driving',
    });

    assert.deepEqual(result, {
      status: 'openedDirections',
      url: 'comgooglemaps://?daddr=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%20Dotonbori&directionsmode=driving',
    });
    assert.deepEqual(opened, [
      'comgooglemaps://?daddr=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%20Dotonbori&directionsmode=driving',
    ]);
  });

  it('opens the platform install page when Google Maps cannot be opened', async () => {
    const opened: string[] = [];
    const result = await openTodayNavigationDestination({
      destination: { placeName: '도톤보리', address: 'Dotonbori' },
      platform: 'android',
      launcher: {
        openURL: async (url) => {
          opened.push(url);
          if (url.startsWith('google.navigation:')) {
            throw new Error('Google Maps unavailable');
          }
        },
      },
    });

    assert.deepEqual(result, { status: 'openedInstall', url: 'market://details?id=com.google.android.apps.maps' });
    assert.deepEqual(opened, [
      'google.navigation:q=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%20Dotonbori',
      'market://details?id=com.google.android.apps.maps',
    ]);
  });

  it('returns failure feedback when both directions and install page fail', async () => {
    const result = await openTodayNavigationDestination({
      destination: { placeName: '도톤보리', address: 'Dotonbori' },
      platform: 'ios',
      launcher: {
        openURL: async () => {
          throw new Error('unavailable');
        },
      },
    });

    assert.deepEqual(result, { status: 'failed', message: todayNavigationFailureMessage });
  });
});
