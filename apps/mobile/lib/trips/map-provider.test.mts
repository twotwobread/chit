import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildExternalMapUrl,
  buildGoogleMapsSearchUrl,
  buildNaverMapsSearchUrl,
  externalMapDetailLabel,
  externalMapViewLabel,
  resolveMapProvider,
} from './map-provider';

describe('map provider policy helpers', () => {
  it('uses Naver Maps only when every trip destination is known as Korea', () => {
    assert.equal(resolveMapProvider([{ countryCode: 'KR' }]), 'naverMaps');
    assert.equal(resolveMapProvider([{ countryCode: ' kr ' }, { countryCode: 'KR' }]), 'naverMaps');

    assert.equal(resolveMapProvider([{ countryCode: 'JP' }]), 'googleMaps');
    assert.equal(resolveMapProvider([{ countryCode: 'KR' }, { countryCode: 'JP' }]), 'googleMaps');
    assert.equal(resolveMapProvider([{ countryCode: '' }]), 'googleMaps');
    assert.equal(resolveMapProvider([{}]), 'googleMaps');
    assert.equal(resolveMapProvider([]), 'googleMaps');
  });

  it('builds provider-specific external map search URLs from place names and addresses', () => {
    assert.equal(
      buildGoogleMapsSearchUrl('우메다 공중정원', '1 Chome-1-88 Oyodonaka, Kita Ward, Osaka'),
      'https://www.google.com/maps/search/?api=1&query=%EC%9A%B0%EB%A9%94%EB%8B%A4%20%EA%B3%B5%EC%A4%91%EC%A0%95%EC%9B%90%201%20Chome-1-88%20Oyodonaka%2C%20Kita%20Ward%2C%20Osaka',
    );
    assert.equal(
      buildNaverMapsSearchUrl('제주공항', '제주시 공항로 2'),
      'https://map.naver.com/v5/search/%EC%A0%9C%EC%A3%BC%EA%B3%B5%ED%95%AD%20%EC%A0%9C%EC%A3%BC%EC%8B%9C%20%EA%B3%B5%ED%95%AD%EB%A1%9C%202',
    );
    assert.equal(
      buildNaverMapsSearchUrl('제주공항', '   '),
      'https://map.naver.com/v5/search/%EC%A0%9C%EC%A3%BC%EA%B3%B5%ED%95%AD',
    );
  });

  it('preserves provider-neutral labels and uses Google URIs only for Google external map handoff', () => {
    assert.equal(externalMapViewLabel, '지도에서 보기');
    assert.equal(externalMapDetailLabel, '지도에서 자세히');
    assert.equal(
      buildExternalMapUrl(
        {
          placeName: '제주공항',
          address: '제주시 공항로 2',
          googleMapsUri: 'https://maps.google.com/?cid=google-jeju-airport',
        },
        'googleMaps',
      ),
      'https://maps.google.com/?cid=google-jeju-airport',
    );
    assert.equal(
      buildExternalMapUrl(
        {
          placeName: '제주공항',
          address: '제주시 공항로 2',
          googleMapsUri: 'https://maps.google.com/?cid=google-jeju-airport',
        },
        'naverMaps',
      ),
      'https://map.naver.com/v5/search/%EC%A0%9C%EC%A3%BC%EA%B3%B5%ED%95%AD%20%EC%A0%9C%EC%A3%BC%EC%8B%9C%20%EA%B3%B5%ED%95%AD%EB%A1%9C%202',
    );
  });
});
