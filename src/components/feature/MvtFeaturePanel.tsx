import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import type { MvtLayerConfig } from '../../services/map/mvtLayers';
import {
  buildFeatureDetailFields,
  resolveFeatureTitle,
} from '../../services/gis/registryFeatureFields';
import { FeatureFieldList } from './FeatureFieldList';
import { Icon } from '../common/Icon';
import { InfoCard } from '../common/InfoCard';
import { infoPanelStyles as styles } from '../common/infoPanelStyles';
import { COLORS } from '../../constants/theme';

/**
 * Panel chi tiết đối tượng MVT dựng hoàn toàn từ registry của lớp: tiêu đề
 * theo titleFields, các dòng theo detailFields + fieldLabels + valueLabels +
 * objectValueKeys, bỏ mọi trường trong hiddenFields.
 */
export function MvtFeaturePanel({
  layer,
  properties,
  onClose,
  onViewDetail,
}: {
  layer: MvtLayerConfig;
  properties: Record<string, unknown>;
  onClose: () => void;
  /** Không truyền -> ẩn link "Xem chi tiết". */
  onViewDetail?: () => void;
}) {
  const { t } = useTranslation();
  const title = resolveFeatureTitle(layer, properties);
  const fields = buildFeatureDetailFields(layer, properties, {
    yes: t('common.yes'),
    no: t('common.no'),
    male: t('common.male'),
    female: t('common.female'),
  });
  return (
    <InfoCard
      title={title}
      subtitle={layer.label}
      accentColor={layer.color}
      onClose={onClose}
    >
      <FeatureFieldList fields={fields} emptyText={t('mvt.noAttributes')} />
      {onViewDetail ? (
        <Pressable
          onPress={onViewDetail}
          style={styles.detailLink}
          accessibilityRole="button"
        >
          <Text style={styles.detailLinkText}>{t('mvt.viewDetail')}</Text>
          <Icon name="chevronRight" size={13} color={COLORS.primary} />
        </Pressable>
      ) : null}
    </InfoCard>
  );
}
