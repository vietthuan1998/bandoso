import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import type { MvtLayerConfig } from '../../map/mvtLayers';
import {
  normalizeFeatureFields,
  pickFeatureTitle,
} from '../../map/normalizeFeatureFields';
import { FeatureFieldList } from './FeatureFieldList';
import { Icon } from './Icon';
import { InfoCard } from './InfoCard';
import { infoPanelStyles as styles } from './infoPanelStyles';
import { COLORS } from './theme';

export function MvtFeaturePanel({
  layer,
  properties,
  onClose,
  onViewDetail,
}: {
  layer: MvtLayerConfig;
  properties: Record<string, unknown>;
  onClose: () => void;
  onViewDetail: () => void;
}) {
  const { t } = useTranslation();
  const title = pickFeatureTitle(properties) ?? t(layer.labelKey);
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
      <FeatureFieldList fields={fields} emptyText={t('mvt.noAttributes')} />
      <Pressable
        onPress={onViewDetail}
        style={styles.detailLink}
        accessibilityRole="button"
      >
        <Text style={styles.detailLinkText}>{t('mvt.viewDetail')}</Text>
        <Icon name="chevronRight" size={13} color={COLORS.primary} />
      </Pressable>
    </InfoCard>
  );
}
