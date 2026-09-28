import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockDetail = jest.fn();
const mockHistory = jest.fn();
jest.mock('../../services/api/iotReadings', () => {
  const actual = jest.requireActual('../../services/api/iotReadings');
  return {
    ...actual,
    fetchIotStationDetail: (...args: unknown[]) => mockDetail(...args),
    fetchIotHistoryPage: (...args: unknown[]) => mockHistory(...args),
  };
});

import { IotReadingsPanel } from './IotReadingsPanel';

async function render(layerId: string, properties: Record<string, unknown>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <IotReadingsPanel
        layerId={layerId}
        properties={properties}
        color="#1479c9"
      />,
    );
  });
  return renderer;
}

const textsOf = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(Text)
    .map(node =>
      node.findAllByType(Text).length > 1
        ? ''
        : [].concat(node.props.children as never).join(''),
    );

describe('IotReadingsPanel', () => {
  beforeEach(() => {
    mockDetail.mockReset();
    mockHistory.mockReset();
  });

  it('renders nothing for a non-IoT layer', async () => {
    const renderer = await render('thua_dat', { id: 1 });
    expect(renderer.toJSON()).toBeNull();
    expect(mockDetail).not.toHaveBeenCalled();
  });

  it('loads a rain station by its code and shows indicators, chart and recent readings', async () => {
    mockDetail.mockResolvedValue({
      unit: 'mm',
      aggregateKind: 'sum',
      currentValue: 2.5,
      currentAt: '2026-09-28T08:00:00Z',
      aggregateValue: 41.2,
      readingCount: 24,
      chartPoints: [
        { date: '2026-09-28T08:00:00Z', label: '08:00', count: 2.5 },
      ],
    });
    mockHistory.mockResolvedValue({
      items: [{ id: 7, time: '2026-09-28T08:00:00Z', value: 2.5 }],
      nextCursor: null,
    });

    const renderer = await render('rain_water_stations', { code: 'MUA-01' });

    expect(mockDetail).toHaveBeenCalledWith('rain', 'MUA-01');
    expect(mockHistory).toHaveBeenCalledWith('rain', 'MUA-01', { limit: 5 });
    const texts = textsOf(renderer);
    expect(texts).toContain('Số liệu quan trắc');
    expect(texts).toContain('Tổng 24 giờ');
    expect(texts).toContain('Lịch sử dữ liệu');
    // Trang đầu đã hết (nextCursor null) -> không có nút "Xem thêm".
    expect(texts).toContain('Đã hết dữ liệu');
    expect(texts).not.toContain('Xem thêm');
  });

  it('"Xem thêm" loads older pages before the oldest reading until the history runs out', async () => {
    mockDetail.mockResolvedValue({
      unit: 'm',
      aggregateKind: 'max',
      currentValue: 1.2,
      currentAt: '2026-09-28T08:00:00Z',
      aggregateValue: 1.8,
      readingCount: 5,
      chartPoints: [],
    });
    mockHistory
      .mockResolvedValueOnce({
        items: [
          { id: 5, time: '2026-09-28T08:00:00Z', value: 1.2 },
          { id: 4, time: '2026-09-28T07:00:00Z', value: 1.1 },
        ],
        nextCursor: '2026-09-28T07:00:00Z',
      })
      .mockResolvedValueOnce({
        // id 4 trùng mốc -> không được hiện hai lần.
        items: [
          { id: 4, time: '2026-09-28T07:00:00Z', value: 1.1 },
          { id: 3, time: '2026-09-28T06:00:00Z', value: 0.9 },
        ],
        nextCursor: null,
      });

    const renderer = await render('water_level_station', { code: 'MN-01' });
    const moreButton = renderer.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        typeof node.props.onPress === 'function' &&
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Xem thêm'),
    )[0];
    await act(async () => {
      moreButton.props.onPress();
    });

    expect(mockHistory).toHaveBeenLastCalledWith('waterLevel', 'MN-01', {
      before: '2026-09-28T07:00:00Z',
      limit: 20,
    });
    const rowTimes = renderer.root
      .findAllByType(Text)
      .filter(node =>
        /^\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/.test(String(node.props.children)),
      );
    expect(rowTimes).toHaveLength(3);
    const texts = textsOf(renderer);
    expect(texts).toContain('Đã hết dữ liệu');
    expect(texts).not.toContain('Xem thêm');
  });

  it('explains when the station readings cannot be read', async () => {
    mockDetail.mockResolvedValue(null);
    mockHistory.mockResolvedValue({ items: [], nextCursor: null });

    const renderer = await render('iot_wind_station', { id: 3 });

    expect(textsOf(renderer)).toContain('Không đọc được dữ liệu quan trắc');
  });
});
