import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { COLORS } from '../HueMapScreen/theme';
import type { TrendPoint } from '../../map/statisticsOverview';

const HEIGHT = 140;
const PADDING_X = 8;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 22;
const LABEL_WIDTH = 30;
/** Số nhãn ngày tối đa hiển thị trên trục X — cố định ở 7 dù đang xem 7,
 * 14 hay 30 ngày, để không tràn/chồng chữ khi số điểm dữ liệu tăng lên. */
const MAX_LABELS = 7;

/**
 * Chọn tối đa `maxLabels` chỉ số, DÀN ĐỀU trên `count` điểm, luôn gồm điểm
 * đầu và điểm cuối — dùng để chỉ hiện 1 phần nhãn trục X thay vì mọi điểm
 * (14/30 điểm nhãn sẽ tràn/chồng nhau trên màn hình điện thoại), trong khi
 * đường và các điểm trên biểu đồ vẫn vẽ đủ, không bớt dữ liệu nào.
 */
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

/**
 * Biểu đồ đường + vùng tô cho "Xu hướng cập nhật" (mota/2.jpg), vẽ tay bằng
 * react-native-svg (nối các điểm bằng đoạn thẳng, không có thư viện chart
 * nào trong dự án để vẽ đường cong mượt — chấp nhận được cho biểu đồ xu
 * hướng đơn giản).
 */
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

  const maxValue = Math.max(...points.map(p => p.count), 1);
  const innerWidth = width - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = PADDING_X + stepX * index;
    const y =
      PADDING_TOP + innerHeight - (point.count / maxValue) * innerHeight;
    return { x, y, point };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(PADDING_TOP + innerHeight).toFixed(1)} ` +
    `L${coords[0].x.toFixed(1)},${(PADDING_TOP + innerHeight).toFixed(1)} Z`;

  const labelIndices = pickLabelIndices(points.length, MAX_LABELS);

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
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
