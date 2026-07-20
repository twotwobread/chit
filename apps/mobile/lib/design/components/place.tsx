import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { buildResponsiveLineHeight } from '../responsive-text';
import { theme } from '../theme';

type PlaceTypeKey = keyof typeof theme.placeType;

export function PlacePin({
  faded = false,
  order,
  size = 32,
  type,
}: {
  type: PlaceTypeKey;
  order?: number | string;
  size?: number;
  faded?: boolean;
}) {
  return (
    <View
      style={[
        styles.pin,
        {
          backgroundColor: theme.placeType[type].color,
          borderRadius: size / 2,
          height: size,
          opacity: faded ? 0.5 : 1,
          width: size,
        },
      ]}
    >
      {order == null ? null : <Text style={[styles.pinText, { fontSize: size * 0.46 }]}>{order}</Text>}
    </View>
  );
}

export function PlaceTag({ type }: { type: PlaceTypeKey }) {
  const place = theme.placeType[type];
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.caption, fontScale });

  return (
    <View style={[styles.placeTag, { backgroundColor: tintColor(place.color) }]}>
      <View style={[styles.placeTagDot, { backgroundColor: place.color }]} />
      <Text style={[styles.placeTagText, { color: place.color, lineHeight }]}>{place.label}</Text>
    </View>
  );
}

function tintColor(hex: string): string {
  const color = hex.replace('#', '');
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  const tintRatio = 0.12;
  const blend = (channel: number) => Math.round(channel * tintRatio + 255 * (1 - tintRatio));

  return `rgb(${blend(red)}, ${blend(green)}, ${blend(blue)})`;
}

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  placeTag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    maxWidth: '100%',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  placeTagDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  placeTagText: {
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
});
