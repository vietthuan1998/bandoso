import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { appLanguage, getLocalizedDataValue } from '../../i18n/localizedData';
import type { Ward } from '../../types/map';
import { COLORS } from '../../constants/theme';
import { Icon, type IconName } from '../common/Icon';
import { InfoCard } from '../common/InfoCard';
import { infoPanelStyles as styles } from '../common/infoPanelStyles';

export function CityInfoPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <InfoCard title={t('city.title')} onClose={onClose}>
      <Row icon="cityHall" label={t('city.administrativeUnits')}>
        <Text style={styles.value}>{t('city.administrativeValue')}</Text>
        <Text style={styles.hint}>{t('city.resolution')}</Text>
      </Row>
      <Row icon="area" label={t('city.area')}>
        <Text style={styles.strong}>4.947,11 km²</Text>
      </Row>
      <Row icon="population" label={t('city.population')}>
        <Text style={styles.strong}>1.236.393 {t('city.people')}</Text>
      </Row>
    </InfoCard>
  );
}

export function WardInfoPanel({
  ward,
  onClose,
}: {
  ward: Ward;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const name = getLocalizedDataValue(
    ward.properties,
    ['nhanBanDo', 'nhan', 'Nhan', 'diaDanh'],
    language,
  );
  const geographicPosition = getLocalizedDataValue(
    ward.properties,
    ['viTriDiaLy'],
    language,
  );
  const committeeAddress = getLocalizedDataValue(
    ward.properties,
    ['diaChiUB'],
    language,
  );
  const note = getLocalizedDataValue(ward.properties, ['GhiChu'], language);
  const usesFallback = [name, geographicPosition, committeeAddress, note].some(
    item => item.value && item.isFallback,
  );

  return (
    <InfoCard title={name.value || ward.label || ward.name} onClose={onClose}>
      {usesFallback && <SourceLanguageNotice />}
      {ward.code ? (
        <KeyValueRow label={t('ward.code')} value={ward.code} />
      ) : null}
      {ward.area !== null ? (
        <KeyValueRow
          label={t('ward.area')}
          value={`${ward.area.toFixed(2)} km²`}
        />
      ) : null}
      {ward.population ? (
        <KeyValueRow
          label={t('ward.population')}
          value={`${ward.population} ${t('ward.people')}`}
        />
      ) : null}
      {geographicPosition.value ? (
        <Detail
          label={t('ward.geographicPosition')}
          value={geographicPosition.value}
        />
      ) : null}
      {committeeAddress.value ? (
        <Detail
          label={t('ward.committeeAddress')}
          value={committeeAddress.value}
        />
      ) : null}
      {note.value ? <Detail label={t('ward.note')} value={note.value} /> : null}
    </InfoCard>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.iconRow}>
      <View style={styles.iconGlyph}>
        <Icon name={icon} size={17} color={COLORS.primaryDark} />
      </View>
      <View style={styles.iconRowBody}>
        <Text style={styles.iconRowLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}:</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SourceLanguageNotice() {
  const { t } = useTranslation();
  return (
    <View style={styles.notice}>
      <Icon name="language" size={13} color={COLORS.warningText} />
      <Text style={styles.noticeText}>{t('common.originalVietnamese')}</Text>
    </View>
  );
}
