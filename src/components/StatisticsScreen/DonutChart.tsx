import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../HueMapScreen/theme';

const SIZE = 132;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Biểu đồ donut vẽ bằng react-native-svg (nhiều <Circle> xếp chồng, mỗi lát
 * cắt dùng strokeDasharray/strokeDashoffset để chỉ vẽ đúng một cung) — kỹ
 * thuật chuẩn để dựng donut chart không cần thư viện chart riêng (dự án
 * chưa có SVG trước khi thêm tính năng này). Khớp bố cục "Theo trạng thái"
 * trong mota/2.jpg; xem StatisticsScreen/index.tsx để biết 3 lát cắt ở đây
 * là gì (không phải Hoàn thành/Đang cập nhật/Lỗi như mockup nguyên bản — xem
 * ghi chú trong map/statisticsOverview.ts vì mockup không có field trạng
 * thái thật tương ứng).
 */
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
        // Xoay -90° để lát cắt đầu tiên bắt đầu từ đỉnh (12 giờ) — mặc định
        // SVG vẽ góc 0° từ hướng 3 giờ.
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
