import { Image } from 'react-native';

const LAYERS_ICON = require('../../assets/icons/layers.png');

export function LayersGlyph({
  size = 20,
  color = '#ffffff',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Image
      source={LAYERS_ICON}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}
