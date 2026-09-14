import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { MvtLayerConfig } from '../../map/mvtLayers';
import { normalizeFeatureFields } from '../../map/normalizeFeatureFields';
import { InfoCard } from './InfoCard';
import { infoPanelStyles as styles } from './infoPanelStyles';

// Các field hay dùng làm tiêu đề theo mục 11.3 của đặc tả ("titleFields, sau
// đó fallback name/ten/code/id"). Chưa có registry/titleFields thật nên đoán
// bằng danh sách khoá phổ biến này; sẽ thay bằng registry khi có backend.
const TITLE_FIELD_CANDIDATES = [
  'ten',
  'name',
  'tenTram',
  'ten_tram',
  'maTram',
  'ma_tram',
  'ma',
  'code',
  'id',
];

function pickTitle(properties: Record<string, unknown>): string | null {
  for (const key of TITLE_FIELD_CANDIDATES) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

/**
 * Panel chi tiết chung cho đối tượng MVT — vì chưa có registry thật
 * (titleFields/detailFields lấy từ backend theo mục 9), nên chỉ liệt kê toàn
 * bộ thuộc tính có sẵn trong tile dưới dạng key/value. Đây là bước kiểm
 * chứng đường ống MVT, không phải panel chi tiết hoàn chỉnh theo mục 11.3.
 */
export function MvtFeaturePanel({
  layer,
  properties,
  onClose,
}: {
  layer: MvtLayerConfig;
  properties: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title = pickTitle(properties) ?? t(layer.labelKey);
  const fields = normalizeFeatureFields(properties, {
    yes: t('common.yes'),
    no: t('common.no'),
    male: t('common.male'),
    female: t('common.female'),
  });

  return (
    <InfoCard
      title={title}
      subtitle={t(layer.labelKey)}
      accentColor={layer.color}
      onClose={onClose}
    >
      {fields.length === 0 ? (
        <Text style={styles.value}>{t('mvt.noAttributes')}</Text>
      ) : (
        fields.map(field =>
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
        )
      )}
    </InfoCard>
  );
}
