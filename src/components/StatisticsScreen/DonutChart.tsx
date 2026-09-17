import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../HueMapScreen/theme';

const SIZE = 132;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  segments,
}: {
  segments: Array<{ color: string; value: number }>;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter(s => s.value > 0);

  let offsetAccumulated = 0;

  return (
    <View style={styles.wrap}>
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={styles.rotated}
      >
        {total === 0 ? (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={COLORS.borderSoft}
            strokeWidth={STROKE}
            fill="none"
          />
        ) : (
          visible.map((segment, index) => {
            const fraction = segment.value / total;
            const dashLength = fraction * CIRCUMFERENCE;
            const dashOffset = -offsetAccumulated;
            offsetAccumulated += dashLength;
            return (
              <Circle
                key={index}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap={visible.length > 1 ? 'butt' : 'round'}
                fill="none"
              />
            );
          })
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotated: { transform: [{ rotate: '-90deg' }] },
});
