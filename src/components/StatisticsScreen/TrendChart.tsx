import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS } from '../HueMapScreen/theme';
import type { TrendPoint } from '../../map/statisticsOverview';

const HEIGHT = 140;
const PADDING_X = 8;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 22;
const LABEL_WIDTH = 30;
const MAX_LABELS = 7;
const Y_AXIS_WIDTH = 34;
const Y_TICKS = 3;

function pickLabelIndices(count: number, maxLabels: number): Set<number> {
  if (count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, i) => i));
  }
  const step = (count - 1) / (maxLabels - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i++) {
    indices.add(Math.round(i * step));
  }
  return indices;
}

function formatTickValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

export function TrendChart({
  points,
  width,
}: {
  points: TrendPoint[];
  width: number;
}) {
  if (points.length === 0) {
    return null;
  }

  const rawMin = Math.min(...points.map(p => p.count));
  const rawMax = Math.max(...points.map(p => p.count));
  const minValue = Math.min(0, rawMin);
  const maxValue = Math.max(0, rawMax, minValue + 1);
  const valueRange = maxValue - minValue;

  const innerWidth = width - Y_AXIS_WIDTH - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const valueToY = (value: number) =>
    PADDING_TOP + innerHeight - ((value - minValue) / valueRange) * innerHeight;

  const coords = points.map((point, index) => {
    const x = Y_AXIS_WIDTH + PADDING_X + stepX * index;
    const y = valueToY(point.count);
    return { x, y, point };
  });

  const baselineY = PADDING_TOP + innerHeight;
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baselineY.toFixed(
      1,
    )} ` + `L${coords[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`;

  const labelIndices = pickLabelIndices(points.length, MAX_LABELS);

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const value = minValue + (valueRange * i) / Y_TICKS;
    return { value, y: valueToY(value) };
  });
  const zeroLineY = minValue < 0 && maxValue > 0 ? valueToY(0) : null;

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {yTicks.map((tick, i) => (
          <Line
            key={i}
            x1={Y_AXIS_WIDTH}
            x2={width}
            y1={tick.y}
            y2={tick.y}
            stroke={COLORS.borderSoft}
            strokeWidth={1}
          />
        ))}
        {zeroLineY !== null ? (
          <Line
            x1={Y_AXIS_WIDTH}
            x2={width}
            y1={zeroLineY}
            y2={zeroLineY}
            stroke={COLORS.textFaint}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        ) : null}
        <Path d={areaPath} fill="url(#trendFill)" />
        <Path
          d={linePath}
          stroke={COLORS.primary}
          strokeWidth={2.5}
          fill="none"
        />
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={3.5}
            fill={COLORS.surface}
            stroke={COLORS.primary}
            strokeWidth={2}
          />
        ))}
        {yTicks.map((tick, i) => (
          <SvgText
            key={i}
            x={Y_AXIS_WIDTH - 6}
            y={tick.y + 3}
            fontSize={9}
            fill={COLORS.textFaint}
            textAnchor="end"
          >
            {formatTickValue(tick.value)}
          </SvgText>
        ))}
        {zeroLineY !== null ? (
          <SvgText
            x={Y_AXIS_WIDTH - 6}
            y={zeroLineY + 3}
            fontSize={9}
            fontWeight="bold"
            fill={COLORS.textMuted}
            textAnchor="end"
          >
            0
          </SvgText>
        ) : null}
      </Svg>
      <View style={styles.labelRow}>
        {coords.map((c, i) =>
          labelIndices.has(i) ? (
            <Text
              key={i}
              style={[
                styles.labelText,
                { left: c.x - LABEL_WIDTH / 2, width: LABEL_WIDTH },
              ]}
              numberOfLines={1}
            >
              {points[i].label}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    height: 14,
    marginTop: 2,
  },
  labelText: {
    position: 'absolute',
    top: 0,
    fontSize: 9,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});
