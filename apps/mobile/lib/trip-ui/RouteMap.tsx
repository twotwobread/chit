import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, type LatLng, type Region } from 'react-native-maps';

import { PlacePin, theme } from '../design';

export type RouteMapPlace = {
  id: string;
  order: number;
  type: keyof typeof theme.placeType;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: 'done' | 'next' | 'todo' | 'skipped';
};

export type RouteMapPolyline = {
  id: string;
  coordinates: LatLng[];
  tone?: 'done' | 'todo';
};

export type RouteMapProps = {
  places: RouteMapPlace[];
  polylines?: RouteMapPolyline[];
  initialRegion?: Region;
  emptyTitle?: string;
  emptyHelper?: string;
  style?: StyleProp<ViewStyle>;
};

type ValidMapPlace = RouteMapPlace & { latitude: number; longitude: number };

export function RouteMap({
  emptyHelper = '좌표를 불러오면 지도를 표시해요.',
  emptyTitle = '지도에 표시할 장소가 없어요',
  initialRegion,
  places,
  polylines,
  style,
}: RouteMapProps) {
  const validPlaces = places.filter(isValidPlace);
  if (validPlaces.length === 0) {
    return (
      <View style={[styles.empty, style]}>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyHelper}>{emptyHelper}</Text>
      </View>
    );
  }

  const region = initialRegion ?? fitRegion(validPlaces);
  const routeLines =
    polylines == null ? defaultPolylines(validPlaces) : polylines.map(sanitizePolyline).filter(isVisiblePolyline);

  return (
    <MapView initialRegion={region} showsMyLocationButton={false} style={[styles.map, style]}>
      {routeLines.map((polyline) => (
        <Polyline
          coordinates={polyline.coordinates}
          key={polyline.id}
          lineDashPattern={polyline.tone === 'todo' ? [3, 7] : undefined}
          strokeColor={polyline.tone === 'todo' ? theme.color.green[400] : theme.color.green[600]}
          strokeWidth={polyline.tone === 'todo' ? 3 : 4}
        />
      ))}
      {validPlaces.map((place) => (
        <Marker coordinate={toLatLng(place)} key={place.id} title={place.name} tracksViewChanges={false}>
          <PlacePin
            faded={place.status === 'done' || place.status === 'skipped'}
            order={place.order}
            size={place.status === 'next' ? 38 : 32}
            type={place.type}
          />
        </Marker>
      ))}
    </MapView>
  );
}

function isValidPlace(place: RouteMapPlace): place is ValidMapPlace {
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

function toLatLng(place: ValidMapPlace): LatLng {
  return { latitude: place.latitude, longitude: place.longitude };
}

function sanitizePolyline(polyline: RouteMapPolyline): RouteMapPolyline {
  return {
    ...polyline,
    coordinates: polyline.coordinates.filter(
      (coordinate) => Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
    ),
  };
}

function isVisiblePolyline(polyline: RouteMapPolyline): boolean {
  return polyline.coordinates.length > 1;
}

function defaultPolylines(places: ValidMapPlace[]): RouteMapPolyline[] {
  if (places.length < 2) {
    return [];
  }

  const nextIndex = Math.max(
    places.findIndex((place) => place.status === 'next'),
    places.filter((place) => place.status === 'done').length - 1,
    0,
  );
  const done = places.slice(0, nextIndex + 1).map(toLatLng);
  const todo = places.slice(nextIndex).map(toLatLng);
  const out: RouteMapPolyline[] = [];

  if (done.length > 1) {
    out.push({ coordinates: done, id: 'done', tone: 'done' });
  }
  if (todo.length > 1) {
    out.push({ coordinates: todo, id: 'todo', tone: 'todo' });
  }

  return out;
}

function fitRegion(places: ValidMapPlace[]): Region {
  const latitudes = places.map((place) => place.latitude);
  const longitudes = places.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.6, 0.01);
  const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.6, 0.01);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    latitudeDelta,
    longitude: (minLongitude + maxLongitude) / 2,
    longitudeDelta,
  };
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: 220,
    padding: theme.space[6],
  },
  emptyHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    textAlign: 'center',
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  map: {
    minHeight: 220,
  },
});
