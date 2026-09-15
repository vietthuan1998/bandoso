import { Text, View } from 'react-native';
import type { NormalizedFeatureField } from '../../map/normalizeFeatureFields';
import { infoPanelStyles as styles } from './infoPanelStyles';

/**
 * Render danh sách field đã chuẩn hoá (normalizeFeatureFields) — tách ra
 * dùng chung cho MvtFeaturePanel (popup nhỏ trên bản đồ) và
 * FeatureDetailScreen (trang chi tiết toàn màn hình), tránh lặp lại cùng 1
 * khối JSX xử lý field dạng text/danh sách ở 2 nơi.
 */
export function FeatureFieldList({
  fields,
  emptyText,
}: {
  fields: NormalizedFeatureField[];
  emptyText: string;
}) {
  if (fields.length === 0) {
    return <Text style={styles.value}>{emptyText}</Text>;
  }
  return (
    <>
      {fields.map(field =>
        field.kind === 'list' ? (
          <View key={field.key}>
            <Text style={styles.detailLabel}>{field.label}</Text>
            {field.items.map((item, index) => (
              <View key={index} style={styles.listItemCard}>
                {item.map(leaf => (
                  <View key={leaf.key} style={styles.listItemRow}>
                    <Text style={styles.listItemLabel}>{leaf.label}: </Text>
                    <Text style={styles.listItemValue}>{leaf.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View key={field.key}>
            <Text style={styles.detailLabel}>{field.label}</Text>
            <Text style={styles.detailValue}>{field.value}</Text>
          </View>
        ),
      )}
    </>
  );
}
