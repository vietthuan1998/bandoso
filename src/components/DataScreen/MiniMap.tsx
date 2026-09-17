import { useEffect } from 'react';
import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { STYLE_URL } from '../../map/useHueMap';
import { ensureTileAuthHeader } from '../HueMapScreen/MapCanvas';
import { RADIUS } from '../HueMapScreen/theme';

export function DataRecordMiniMap({
  coordinates,
  color,
  height = 150,
}: {
  coordinates: [number, number];
  color: string;
  height?: number;
}) {
  useEffect(() => {
    ensureTileAuthHeader();
  }, []);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        logo={false}
        attribution={false}
        dragPan={false}
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={{ center: coordinates, zoom: 15.5 }} />
      </MapLibreMap>
      <View pointerEvents="none" style={styles.pinWrap}>
        <View style={[styles.pinHead, { backgroundColor: color }]} />
        <View style={[styles.pinTail, { borderTopColor: color }]} />
      </View>
    </View>
  );
}

export function DataRecordMiniMapPlaceholder({
  message,
  height = 150,
}: {
  message: string;
  height?: number;
}) {
  return (
    <View style={[styles.wrap, styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#e2e9ef',
  },
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: {
    fontSize: 11,
    color: '#8a99a8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
