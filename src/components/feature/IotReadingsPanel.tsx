import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TrendChart } from '../statistics/TrendChart';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { pad2 } from '../../services/gis/normalizeFeatureFields';
import {
  fetchIotHistoryPage,
  fetchIotStationDetail,
  iotParameterForLayer,
  iotStationIdentifier,
  type IotHistoryRecord,
  type IotStationDetail,
} from '../../services/api/iotReadings';

const RECENT_READINGS = 5;
/** Số lần đo tải thêm mỗi lần bấm "Xem thêm". */
const HISTORY_PAGE_SIZE = 20;

function formatValue(value: number | null): string {
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

type PanelState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; detail: IotStationDetail };

type HistoryState = {
  items: IotHistoryRecord[];
  /** time_point của lần đo cũ nhất đã tải — trang sau lấy các lần đo trước mốc này. */
  cursor: string | null;
  loadingMore: boolean;
};

const EMPTY_HISTORY: HistoryState = {
  items: [],
  cursor: null,
  loadingMore: false,
};

/**
 * Số liệu quan trắc của một trạm IoT (mưa / mực nước / gió) đọc thẳng từ các
 * collection đo đạc trên Directus: chỉ số hiện tại, tổng/đỉnh 24 giờ, số lượt
 * đo, biểu đồ theo giờ và lịch sử đo (5 lần gần nhất, "Xem thêm" để tải tiếp
 * từng trang về quá khứ cho tới hết). Lớp không phải IoT -> không render.
 */
export function IotReadingsPanel({
  layerId,
  properties,
  color,
}: {
  layerId: string;
  properties: Record<string, unknown>;
  color: string;
}) {
  const { t } = useTranslation();
  const kind = iotParameterForLayer(layerId);
  const stationId = kind ? iotStationIdentifier(kind, properties) : null;
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [chartWidth, setChartWidth] = useState(0);
  // Bỏ kết quả "Xem thêm" về trễ nếu người dùng đã chuyển sang trạm khác.
  const stationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    stationKeyRef.current = stationId ? `${kind}:${stationId}` : null;
    setHistory(EMPTY_HISTORY);
    if (!stationId) {
      setState({ status: 'error' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    Promise.all([
      fetchIotStationDetail(kind, stationId),
      fetchIotHistoryPage(kind, stationId, { limit: RECENT_READINGS }),
    ]).then(([detail, page]) => {
      if (cancelled) return;
      setState(detail ? { status: 'ready', detail } : { status: 'error' });
      setHistory({
        items: page.items,
        cursor: page.nextCursor,
        loadingMore: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, stationId]);

  const loadMore = () => {
    if (!kind || !stationId || !history.cursor || history.loadingMore) return;
    const key = `${kind}:${stationId}`;
    setHistory(current => ({ ...current, loadingMore: true }));
    fetchIotHistoryPage(kind, stationId, {
      before: history.cursor,
      limit: HISTORY_PAGE_SIZE,
    }).then(page => {
      if (stationKeyRef.current !== key) return;
      setHistory(current => {
        const seen = new Set(current.items.map(item => item.id));
        return {
          items: [
            ...current.items,
            ...page.items.filter(item => !seen.has(item.id)),
          ],
          cursor: page.nextCursor,
          loadingMore: false,
        };
      });
    });
  };

  if (!kind) return null;

  return (
    <View
      style={styles.card}
      onLayout={event =>
        setChartWidth(event.nativeEvent.layout.width - SPACING.md * 2)
      }
    >
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.title}>{t('featureDetail.iot.sectionTitle')}</Text>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} size="small" />
        </View>
      ) : state.status === 'error' ? (
        <Text style={styles.empty}>{t('featureDetail.iot.unreadable')}</Text>
      ) : (
        <>
          <View style={styles.tileRow}>
            <Tile
              label={t('featureDetail.iot.current')}
              value={formatValue(state.detail.currentValue)}
              unit={state.detail.unit}
            />
            <Tile
              label={t(
                state.detail.aggregateKind === 'sum'
                  ? 'featureDetail.iot.sum24h'
                  : 'featureDetail.iot.peak24h',
              )}
              value={formatValue(state.detail.aggregateValue)}
              unit={state.detail.unit}
            />
            <Tile
              label={t('featureDetail.iot.readingCount')}
              value={String(state.detail.readingCount)}
            />
          </View>
          {state.detail.currentAt ? (
            <Text style={styles.meta}>
              {t('featureDetail.iot.latestAt', {
                time: formatDateTime(state.detail.currentAt),
              })}
            </Text>
          ) : null}

          <Text style={styles.subTitle}>
            {t('featureDetail.iot.chartTitle')}
          </Text>
          {state.detail.chartPoints.length === 0 ? (
            <Text style={styles.empty}>
              {t('featureDetail.iot.chartEmpty')}
            </Text>
          ) : chartWidth > 0 ? (
            <TrendChart points={state.detail.chartPoints} width={chartWidth} />
          ) : null}

          {history.items.length > 0 ? (
            <>
              <Text style={styles.subTitle}>
                {t('featureDetail.iot.historyTitle')}
              </Text>
              {history.items.map((reading, index) => (
                <View
                  key={reading.id}
                  style={[styles.row, index % 2 === 1 ? styles.rowZebra : null]}
                >
                  <Text style={styles.rowTime}>
                    {formatDateTime(reading.time)}
                  </Text>
                  <Text style={styles.rowValue}>
                    {formatValue(reading.value)}
                    <Text style={styles.unit}> {state.detail.unit}</Text>
                  </Text>
                </View>
              ))}
              {history.cursor ? (
                <Pressable
                  onPress={loadMore}
                  disabled={history.loadingMore}
                  style={styles.moreButton}
                  accessibilityRole="button"
                >
                  {history.loadingMore ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : (
                    <Text style={styles.moreText}>
                      {t('featureDetail.iot.loadMore')}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endText}>
                  {t('featureDetail.iot.historyEnd')}
                </Text>
              )}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function Tile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.tileValue}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  loading: { paddingVertical: SPACING.lg, alignItems: 'center' },
  empty: {
    fontSize: 11,
    color: COLORS.textFaint,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  tileRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  tile: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    gap: 2,
  },
  tileLabel: { fontSize: 10, color: COLORS.textMuted, minHeight: 26 },
  tileValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  unit: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  meta: { fontSize: 10, color: COLORS.textFaint, marginTop: SPACING.xs },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  rowZebra: { backgroundColor: COLORS.background },
  rowTime: { fontSize: 12, color: COLORS.text },
  rowValue: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  moreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moreText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  endText: {
    fontSize: 11,
    color: COLORS.textFaint,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
