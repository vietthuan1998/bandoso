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
/** Số nhãn ngày tối đa hiển thị trên trục X — cố định ở 7 dù đang xem 7,
 * 14 hay 30 ngày, để không tràn/chồng chữ khi số điểm dữ liệu tăng lên. */
const MAX_LABELS = 7;
/** Bề rộng dành riêng bên trái cho nhãn giá trị trục Y (đủ chỗ cho số có
 * dấu phân cách hàng nghìn, vd. "1.234"). */
const Y_AXIS_WIDTH = 34;
/** Số khoảng chia trục Y -> Y_TICKS+1 mốc giá trị dàn đều từ minValue tới
 * maxValue (gồm cả 2 đầu), đủ để đọc thang đo mà không rối trên chiều cao
 * 140px. */
const Y_TICKS = 3;

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

/** "1234.5" -> "1.234,5" (bỏ ".0" nếu là số nguyên) — dùng cho nhãn trục Y. */
function formatTickValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

/**
 * Biểu đồ đường + vùng tô, có trục Y (vạch chia + giá trị) và trục X (nhãn
 * điểm) — dùng chung cho "Xu hướng cập nhật" (StatisticsScreen, mota/2.jpg)
 * và khối "Biểu đồ 24 giờ qua" của trạm IoT (FeatureDetailScreen, mota/5.jpg).
 * Vẽ tay bằng react-native-svg (nối các điểm bằng đoạn thẳng, không có thư
 * viện chart nào trong dự án để vẽ đường cong mượt — chấp nhận được cho biểu
 * đồ xu hướng đơn giản).
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

  // Thang trục Y ĐỘNG theo dữ liệu thật, KHÔNG cố định đáy ở 0 — vài nguồn
  // (vd. water_level_depth của trạm mực nước) có giá trị âm thật (đo tương
  // đối so với 1 mốc chuẩn, không phải lượng cộng dồn như mưa), cố định đáy
  // 0 sẽ đẩy toàn bộ điểm âm ra ngoài/kịch đáy biểu đồ, vẽ sai hình dạng dữ
  // liệu thật. Đáy trục vẫn giữ ở 0 khi mọi giá trị không âm (như "Xu hướng
  // cập nhật"/lượng mưa) — chỉ nới xuống dưới 0 khi dữ liệu thật sự có âm;
  // tương tự đỉnh trục giữ tối thiểu ở 0.
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

  // Đáy vùng tô là ĐÁY TRỤC (đúng minValue, không còn mặc định là 0) — khi
  // minValue < 0 đây là đường ngang y=0 thật sự nằm giữa biểu đồ, xem
  // zeroLineY bên dưới.
  const baselineY = PADDING_TOP + innerHeight;
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} ` +
    `L${coords[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`;

  const labelIndices = pickLabelIndices(points.length, MAX_LABELS);

  // Vạch chia trục Y: Y_TICKS+1 mốc dàn đều từ minValue tới maxValue (gồm cả
  // 2 đầu) — không còn giả định đáy là 0.
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const value = minValue + (valueRange * i) / Y_TICKS;
    return { value, y: valueToY(value) };
  });
  // Dữ liệu có cả âm lẫn dương -> vẽ thêm 1 đường mốc "0" nổi bật (không
  // trùng 2 vạch chia bất kỳ nào ở trên vì Y_TICKS chia đều theo min/max,
  // hiếm khi rơi đúng 0) để người xem biết đâu là ranh giới âm/dương.
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
