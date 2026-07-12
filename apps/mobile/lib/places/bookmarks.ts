import type { TripPlaceBookmark, TripPlaceType } from '@i-um/api-contract';

import type {
  GooglePlaceSearchMarkerIconName,
  GooglePlaceSearchMarkerViewModel,
  GooglePlaceSearchRowViewModel,
} from './google-search';
import type { PlaceScheduleSelectedPlace } from './place-schedule-detail';
import { getPlaceTypeLabel } from '../trips/day-itinerary';
import { manualPlaceTypeValues } from '../trips/manual-place';

export type BookmarkCategoryOption = {
  value: TripPlaceType;
  label: string;
};

export function buildBookmarkCategoryOptions(): BookmarkCategoryOption[] {
  return manualPlaceTypeValues.map((value) => ({ value, label: getPlaceTypeLabel(value) }));
}

export function buildTripPlaceBookmarkMarkerViewModels(
  bookmarks: TripPlaceBookmark[],
  selectedBookmarkId?: string | null,
): GooglePlaceSearchMarkerViewModel[] {
  return bookmarks.flatMap((bookmark) => {
    const routablePlace = bookmark.place.routablePlace;
    if (!routablePlace || !Number.isFinite(routablePlace.latitude) || !Number.isFinite(routablePlace.longitude)) {
      return [];
    }
    const selected = bookmark.id === selectedBookmarkId;
    return [
      {
        id: bookmark.id,
        coordinate: { latitude: routablePlace.latitude, longitude: routablePlace.longitude },
        title: bookmark.place.name,
        category: bookmark.category,
        categoryLabel: getPlaceTypeLabel(bookmark.category),
        selected,
        iconName: bookmarkMarkerIconName(bookmark.category),
        variant: 'bookmark',
        emphasis: selected ? 'focused' : 'normal',
      } satisfies GooglePlaceSearchMarkerViewModel,
    ];
  });
}

export function filterTripPlaceBookmarkMarkers(
  markers: GooglePlaceSearchMarkerViewModel[],
  layerVisible: boolean,
): GooglePlaceSearchMarkerViewModel[] {
  return layerVisible ? markers : [];
}

export function selectedPlaceFromTripPlaceBookmark(bookmark: TripPlaceBookmark): PlaceScheduleSelectedPlace | null {
  const googlePlaceId = bookmark.place.routablePlace?.googlePlaceId?.trim();
  if (!googlePlaceId) {
    return null;
  }
  return {
    googlePlaceId,
    placeName: bookmark.place.name,
    address: bookmark.place.address,
    typeHint: getPlaceTypeLabel(bookmark.category),
  };
}

export function tripPlaceBookmarkToGoogleSearchRow(bookmark: TripPlaceBookmark): GooglePlaceSearchRowViewModel | null {
  const selectedPlace = selectedPlaceFromTripPlaceBookmark(bookmark);
  const routablePlace = bookmark.place.routablePlace;
  if (!selectedPlace || !routablePlace) {
    return null;
  }
  return {
    id: selectedPlace.googlePlaceId,
    bookmarkId: bookmark.id,
    placeName: selectedPlace.placeName,
    address: selectedPlace.address,
    typeHint: selectedPlace.typeHint,
    latitude: routablePlace.latitude,
    longitude: routablePlace.longitude,
    metadataLabels: [selectedPlace.typeHint, '찜한 장소'],
  };
}

function bookmarkMarkerIconName(category: TripPlaceType): GooglePlaceSearchMarkerIconName {
  switch (category) {
    case 'sights':
      return 'landmark';
    case 'food':
      return 'utensils';
    case 'lodging':
      return 'bed';
    case 'cafe':
      return 'coffee';
    case 'shopping':
      return 'shopping-bag';
    case 'transport':
      return 'train-front';
    case 'etc':
      return 'map-pin';
  }
}
