import assert from 'node:assert/strict';
import test from 'node:test';

import appConfig from '../../app.json' with { type: 'json' };

test('uses the approved Chit display name for installed app builds', () => {
  assert.equal(appConfig.expo.name, '칫 Chit');
});
