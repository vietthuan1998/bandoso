import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { classifyFreshness, type LayerFreshness } from '../../map/freshness';
import {
  fetchIotHistoryPage,
  fetchIotStationDetail,
  iotParameterForLayer,
  iotStationIdentifier,
  type IotHistoryRecord,
  type IotStationDetail,
} from '../../map/iotReadings';
import type { MvtLayerConfig } from '../../map/mvtLayers';
import {
  normalizeFeatureFields,
  pad2,
  pickFeatureTitle,
} from '../../map/normalizeFeatureFields';
import { TrendChart } from '../StatisticsScreen/TrendChart';
import { FeatureFieldList } from './FeatureFieldList';
import { FRESHNESS_COLOR, FRESHNESS_ICON } from './freshnessUi';
import { Icon } from './Icon';
import { CHART_WIDTH, COLORS, RADIUS, SPACING } from './theme';

function formatIotValue(value: number | null): string {
  return value === null
    ? '—'
    : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(
    d.getDate(),
  )}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function FeatureDetailScreen({
  layer,
  properties,
  coordinates,
  onBack,
  onLocate,
}: {
  layer: MvtLayerConfig;
  properties: Record<string, unknown>;
  coordinates: [number, number] | null;
  onBack: () => void;
  onLocate: (coordinates: [number, number]) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const layerLabel = t(layer.labelKey);
  const title = pickFeatureTitle(properties) ?? layerLabel;
  const fields = useMemo(
    () =>
      normalizeFeatureFields(properties, {
        yes: t('common.yes'),
        no: t('common.no'),
        male: t('common.male'),
        female: t('common.female'),
      }),
    [properties, t],
  );

  const rawUpdatedAt = properties.date_updated;
  const updatedAtIso =
    typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim()
      ? rawUpdatedAt
      : null;
  const freshness = updatedAtIso ? classifyFreshness(updatedAtIso) : null;

  const iotKind = iotParameterForLayer(layer.id);
  const iotStationId = iotKind
    ? iotStationIdentifier(iotKind, properties)
    : null;
  const [iotDetail, setIotDetail] = useState<IotStationDetail | 'error' | null>(
    null,
  );
  const [iotLoading, setIotLoading] = useState(false);

  useEffect(() => {
    if (!iotKind || !iotStationId) {
      setIotDetail(null);
      return;
    }
    let cancelled = false;
    setIotLoading(true);
    setIotDetail(null);
    fetchIotStationDetail(iotKind, iotStationId)
      .then(result => {
        if (!cancelled) setIotDetail(result ?? 'error');
      })
      .finally(() => {
        if (!cancelled) setIotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [iotKind, iotStationId]);

  const [historyItems, setHistoryItems] = useState<IotHistoryRecord[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const historyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!iotKind || !iotStationId) {
      historyKeyRef.current = null;
      setHistoryItems([]);
      setHistoryCursor(null);
      setHistoryExhausted(false);
      return;
    }
    const kind = iotKind;
    const stationId = iotStationId;
    const key = `${kind}:${stationId}`;
    historyKeyRef.current = key;
    setHistoryLoading(true);
    setHistoryItems([]);
    setHistoryCursor(null);
    setHistoryExhausted(false);
    fetchIotHistoryPage(kind, stationId)
      .then(page => {
        if (historyKeyRef.current !== key) return;
        setHistoryItems(page.items);
        setHistoryCursor(page.nextCursor);
        setHistoryExhausted(page.nextCursor === null);
      })
      .finally(() => {
        if (historyKeyRef.current === key) setHistoryLoading(false);
      });
  }, [iotKind, iotStationId]);

  const loadMoreHistory = () => {
    if (!iotKind || !iotStationId) return;
    if (
      historyLoading ||
      historyLoadingMore ||
      historyExhausted ||
      !historyCursor
    ) {
      return;
    }
    const key = `${iotKind}:${iotStationId}`;
    setHistoryLoadingMore(true);
    fetchIotHistoryPage(iotKind, iotStationId, { before: historyCursor })
      .then(page => {
        if (historyKeyRef.current !== key) return;
        setHistoryItems(prev => [...prev, ...page.items]);
        setHistoryCursor(page.nextCursor);
        setHistoryExhausted(page.nextCursor === null);
      })
      .finally(() => {
        if (historyKeyRef.current === key) setHistoryLoadingMore(false);
      });
  };

  const handleShare = async () => {
    const lines = [
      `${title} (${layerLabel})`,
      ...fields.flatMap(field =>
        field.kind === 'list'
          ? field.items.map(
              (item, index) =>
                `${field.label} ${index + 1}: ${item
                  .map(leaf => `${leaf.label} ${leaf.value}`)
                  .join(', ')}`,
            )
          : [`${field.label}: ${field.value}`],
      ),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable
          onPress={onBack}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={10}
        >
          <Icon name="chevronLeft" size={22} color={COLORS.primaryDark} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {layerLabel}
        </Text>
      </View>

      {iotKind ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          data={historyItems}
          keyExtractor={item => String(item.id)}
          renderItem={({ item, index }) => (
            <HistoryRow
              item={item}
              unit={
                typeof iotDetail === 'object' && iotDetail ? iotDetail.unit : ''
              }
              zebra={index % 2 === 1}
            />
          )}
          onEndReached={loadMoreHistory}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <>
              <HeroCard
                layer={layer}
                title={title}
                layerLabel={layerLabel}
                freshness={freshness}
                updatedAtIso={updatedAtIso}
              />

              <View style={styles.section}>
                {iotLoading ? (
                  <View style={styles.iotLoadingRow}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  </View>
                ) : !iotStationId || iotDetail === 'error' ? (
                  <Text style={styles.emptyText}>
                    {t('featureDetail.iot.unreadable')}
                  </Text>
                ) : iotDetail ? (
                  <>
                    <View style={styles.iotTileRow}>
                      <IotTile
                        label={t('featureDetail.iot.current')}
                        value={formatIotValue(iotDetail.currentValue)}
                        unit={iotDetail.unit}
                      />
                      <IotTile
                        label={t(
                          iotDetail.aggregateKind === 'sum'
                            ? 'featureDetail.iot.sum24h'
                            : 'featureDetail.iot.peak24h',
                        )}
                        value={formatIotValue(iotDetail.aggregateValue)}
                        unit={iotDetail.unit}
                      />
                      <IotTile
                        label={t('featureDetail.iot.readingCount')}
                        value={String(iotDetail.readingCount)}
                        unit=""
                      />
                    </View>

                    <Text style={styles.sectionTitle}>
                      {t('featureDetail.iot.chartTitle')}
                    </Text>
                    {iotDetail.chartPoints.length === 0 ? (
                      <Text style={styles.emptyText}>
                        {t('featureDetail.iot.chartEmpty')}
                      </Text>
                    ) : (
                      <TrendChart
                        points={iotDetail.chartPoints}
                        width={CHART_WIDTH}
                      />
                    )}
                  </>
                ) : null}
              </View>

              <View style={styles.historyBoxTop}>
                <Text style={styles.sectionTitle}>
                  {t('featureDetail.iot.historyTitle')}
                </Text>
                <View style={styles.historyHeaderRow}>
                  <Text
                    style={[styles.historyHeaderCell, styles.historyTimeCol]}
                  >
                    {t('featureDetail.iot.historyTime')}
                  </Text>
                  <Text
                    style={[
                      styles.historyHeaderCell,
                      styles.historyValueCol,
                      styles.historyValueAlign,
                    ]}
                  >
                    {t('featureDetail.iot.historyValue')}
                  </Text>
                </View>
              </View>
            </>
          }
          ListFooterComponent={
            <View style={styles.historyBoxBottom}>
              {historyLoading || historyLoadingMore ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : historyItems.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('featureDetail.iot.chartEmpty')}
                </Text>
              ) : historyExhausted ? (
                <Text style={styles.historyEndText}>
                  {t('featureDetail.iot.historyEnd')}
                </Text>
              ) : null}
            </View>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
        >
          <HeroCard
            layer={layer}
            title={title}
            layerLabel={layerLabel}
            freshness={freshness}
            updatedAtIso={updatedAtIso}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('featureDetail.sectionAttributes')}
            </Text>
            <FeatureFieldList
              fields={fields}
              emptyText={t('mvt.noAttributes')}
            />
          </View>
        </ScrollView>
      )}

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}
      >
        {coordinates ? (
          <Pressable
            onPress={() => onLocate(coordinates)}
            style={styles.footerButtonSecondary}
            accessibilityRole="button"
          >
            <Icon name="pin" size={14} color={COLORS.primaryDark} />
            <Text style={styles.footerButtonSecondaryText}>
              {t('featureDetail.locateButton')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleShare}
          style={styles.footerButtonPrimary}
          accessibilityRole="button"
        >
          <Icon name="share" size={14} color="#ffffff" />
          <Text style={styles.footerButtonPrimaryText}>
            {t('featureDetail.exportButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function IotTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.iotTile}>
      <Text style={styles.iotTileLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.iotTileValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.iotTileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function HeroCard({
  layer,
  title,
  layerLabel,
  freshness,
  updatedAtIso,
}: {
  layer: MvtLayerConfig;
  title: string;
  layerLabel: string;
  freshness: LayerFreshness | null;
  updatedAtIso: string | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={[styles.heroIconWrap, { backgroundColor: layer.color }]}>
          <Icon name="database" size={20} color="#ffffff" />
        </View>
        <View style={styles.heroTitleCol}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.heroSubtitle} numberOfLines={1}>
            {layerLabel}
          </Text>
        </View>
      </View>

      {freshness ? (
        <View style={styles.heroStatusRow}>
          <View
            style={[
              styles.freshnessBadge,
              { backgroundColor: `${FRESHNESS_COLOR[freshness]}1f` },
            ]}
          >
            <Icon
              name={FRESHNESS_ICON[freshness]}
              size={12}
              color={FRESHNESS_COLOR[freshness]}
            />
            <Text
              style={[
                styles.freshnessBadgeText,
                { color: FRESHNESS_COLOR[freshness] },
              ]}
            >
              {t(`statistics.status.${freshness}`)}
            </Text>
          </View>
          {updatedAtIso ? (
            <Text style={styles.heroUpdatedText} numberOfLines={1}>
              {t('statistics.detail.lastUpdated', {
                date: formatDateTime(updatedAtIso),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function HistoryRow({
  item,
  unit,
  zebra,
}: {
  item: IotHistoryRecord;
  unit: string;
  zebra: boolean;
}) {
  return (
    <View style={[styles.historyRow, zebra ? styles.historyRowZebra : null]}>
      <Text style={[styles.historyCell, styles.historyTimeCol]}>
        {formatDateTime(item.time)}
      </Text>
      <Text
        style={[
          styles.historyCell,
          styles.historyValueCol,
          styles.historyValueAlign,
        ]}
      >
        {formatIotValue(item.value)}
        {unit ? <Text style={styles.historyUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 50,
    elevation: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  list: { flex: 1 },
  body: { padding: SPACING.lg },

  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleCol: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  heroSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  freshnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  freshnessBadgeText: { fontSize: 11, fontWeight: '700' },
  heroUpdatedText: { fontSize: 11, color: COLORS.textFaint, flexShrink: 1 },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 11,
    color: COLORS.textFaint,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },

  iotLoadingRow: { paddingVertical: SPACING.lg, alignItems: 'center' },
  iotTileRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  iotTile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 4,
  },
  iotTileLabel: { fontSize: 10, color: COLORS.textMuted, minHeight: 26 },
  iotTileValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  iotTileUnit: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },

  // Bảng "Lịch sử dữ liệu" ghép từ 3 khối RIÊNG (ListHeaderComponent/từng
  // dòng renderItem/ListFooterComponent của FlatList — không thể gộp thành 1
  // View bo góc duy nhất) nhưng cùng màu nền/viền để LIỀN MẠCH thành 1 khối
  // thẻ trắng bo góc trên/dưới, đúng ngôn ngữ thị giác với các "card" khác
  // trên trang (heroCard, section).
  historyBoxTop: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.borderSoft,
    padding: SPACING.md,
    paddingBottom: 0,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  historyHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  // Vằn zebra xen kẽ thay cho đường kẻ dày — dễ dò dòng hơn trên danh sách
  // dài (bảng này cuộn ngược được nhiều trang, không chỉ 24 dòng cố định).
  historyRowZebra: { backgroundColor: COLORS.background },
  historyCell: { fontSize: 12, color: COLORS.text },
  historyTimeCol: { width: 112 },
  historyValueCol: { flex: 1 },
  historyValueAlign: { textAlign: 'right', fontWeight: '700' },
  historyUnit: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  historyBoxBottom: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.borderSoft,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  historyEndText: { fontSize: 11, color: COLORS.textFaint },

  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  footerButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  footerButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  footerButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
