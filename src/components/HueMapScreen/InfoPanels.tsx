import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { appLanguage, getLocalizedDataValue } from '../../i18n/localizedData';
import { PROJECT_CATEGORIES } from '../../map/projectLayers';
import type { ProjectCategoryId, SelectedProject, Ward } from '../../map/types';
import { InfoCard } from './InfoCard';
import { infoPanelStyles as styles } from './infoPanelStyles';

export function CityInfoPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <InfoCard title={t('city.title')} onClose={onClose}>
      <Row icon="\u{1F3DB}️" label={t('city.administrativeUnits')}>
        <Text style={styles.value}>{t('city.administrativeValue')}</Text>
        <Text style={styles.hint}>{t('city.resolution')}</Text>
      </Row>
      <Row icon="\u{1F4D0}" label={t('city.area')}>
        <Text style={styles.strong}>4.947,11 km²</Text>
      </Row>
      <Row icon="\u{1F465}" label={t('city.population')}>
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

export function ProjectLegendPanel({
  categoryVisibility,
  onToggleCategory,
  onClose,
}: {
  categoryVisibility: Record<ProjectCategoryId, boolean>;
  onToggleCategory: (id: ProjectCategoryId, visible: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <InfoCard
      title={t('project.legendTitle')}
      subtitle={t('project.legendHint')}
      onClose={onClose}
      closeLabel={t('project.closeLayer')}
    >
      {PROJECT_CATEGORIES.map(category => (
        <View key={category.id} style={styles.legendRow}>
          <View
            style={[styles.legendSwatch, { backgroundColor: category.color }]}
          />
          <Text style={styles.legendLabel}>
            {t(`projectCategories.${category.id}`)}
          </Text>
          <Switch
            value={categoryVisibility[category.id]}
            onValueChange={value => onToggleCategory(category.id, value)}
            trackColor={{ false: '#d7e1ea', true: category.color }}
            thumbColor="#ffffff"
          />
        </View>
      ))}
    </InfoCard>
  );
}

export function ProjectInfoPanel({
  project,
  onClose,
}: {
  project: SelectedProject;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const properties = project.properties;
  const projectName = getLocalizedDataValue(
    properties,
    ['tenDuAn', 'name'],
    language,
  );
  const detailDefinitions: Array<[string, string[], string?]> = [
    ['project.location', ['diaDiem']],
    ['project.area', ['dienTich'], 'ha'],
    ['project.totalInvestment', ['tongMucDauTu']],
    ['project.investor', ['nhaDauTu', 'chuDauTu']],
    ['project.description', ['moTa']],
    ['project.information', ['thongTin']],
    ['project.implementation', ['tinhHinhThucHien']],
    ['project.progress', ['tienDoThucHien']],
    ['project.issues', ['vuongMac']],
    ['project.proposal', ['deXuat']],
    ['project.note', ['ghiChu']],
  ];
  const details = detailDefinitions.map(([labelKey, fields, unit]) => {
    const localized = getLocalizedDataValue(properties, fields, language);
    return {
      label: t(labelKey),
      value:
        unit && localized.value
          ? `${localized.value} ${unit}`
          : localized.value,
      isFallback: localized.isFallback,
    };
  });
  const usesFallback =
    (projectName.value && projectName.isFallback) ||
    details.some(detail => detail.value && detail.isFallback);

  return (
    <InfoCard
      title={projectName.value || t('project.defaultTitle')}
      subtitle={t(`projectCategories.${project.categoryId}`)}
      accentColor={project.color}
      onClose={onClose}
    >
      {usesFallback && <SourceLanguageNotice />}
      {details.map(({ label, value }) =>
        value ? <Detail key={label} label={label} value={value} /> : null,
      )}
    </InfoCard>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.iconRow}>
      <Text style={styles.iconGlyph}>{icon}</Text>
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
      <Text style={styles.noticeIcon}>{'\u{1F310}'}</Text>
      <Text style={styles.noticeText}>{t('common.originalVietnamese')}</Text>
    </View>
  );
}
