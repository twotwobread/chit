import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripPlaceBookmark } from '@i-um/api-contract';

import {
  buildBookmarkCategoryOptions,
  buildTripPlaceBookmarkMarkerViewModels,
  filterTripPlaceBookmarkMarkers,
  selectedPlaceFromTripPlaceBookmark,
  tripPlaceBookmarkToGoogleSearchRow,
} from './bookmarks';

const bookmark: TripPlaceBookmark = {
  id: 'bookmark-1',
  tripId: 'trip-1',
  category: 'transport',
  createdAt: '2026-07-12T00:00:00Z',
  updatedAt: '2026-07-12T00:00:00Z',
  place: {
    id: 'place-1',
    name: '간사이공항',
    placeType: 'transport',
    address: 'Kansai International Airport',
    routablePlace: {
      provider: 'google',
      googlePlaceId: 'google-airport-1',
      latitude: 34.4347,
      longitude: 135.244,
    },
  },
};

describe('trip place bookmark helpers', () => {
  it('uses TripPlaceType categories including 교통', () => {
    assert.deepEqual(buildBookmarkCategoryOptions(), [
      { value: 'sights', label: '관광지' },
      { value: 'food', label: '식당' },
      { value: 'lodging', label: '숙소' },
      { value: 'cafe', label: '카페' },
      { value: 'shopping', label: '쇼핑' },
      { value: 'transport', label: '교통' },
      { value: 'etc', label: '기타' },
    ]);
  });

  it('maps bookmarks to category-aware map markers and respects layer visibility', () => {
    const markers = buildTripPlaceBookmarkMarkerViewModels([bookmark], 'bookmark-1');
    assert.deepEqual(markers, [
      {
        id: 'bookmark-1',
        coordinate: { latitude: 34.4347, longitude: 135.244 },
        title: '간사이공항',
        category: 'transport',
        categoryLabel: '교통',
        selected: true,
        iconName: 'train-front',
        variant: 'bookmark',
        emphasis: 'focused',
      },
    ]);
    assert.equal(filterTripPlaceBookmarkMarkers(markers, false).length, 0);
    assert.equal(filterTripPlaceBookmarkMarkers(markers, true).length, 1);
  });

  it('maps a bookmark to the same selected place/search row shape used by schedule search', () => {
    assert.deepEqual(selectedPlaceFromTripPlaceBookmark(bookmark), {
      googlePlaceId: 'google-airport-1',
      placeName: '간사이공항',
      address: 'Kansai International Airport',
      typeHint: '교통',
    });
    assert.deepEqual(tripPlaceBookmarkToGoogleSearchRow(bookmark), {
      id: 'google-airport-1',
      bookmarkId: 'bookmark-1',
      placeName: '간사이공항',
      address: 'Kansai International Airport',
      typeHint: '교통',
      latitude: 34.4347,
      longitude: 135.244,
      metadataLabels: ['교통', '찜한 장소'],
    });
  });
});
