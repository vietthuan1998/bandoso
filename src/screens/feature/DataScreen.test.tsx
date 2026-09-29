import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchPage = jest.fn();
const mockFetchAll = jest.fn();

function mockLayer(id: string, label: string) {
  return {
    id,
    collection: id,
    label,
    color: '#000',
    capabilities: { list: true, detail: true, search: true, statistics: true },
  };
}

// Snapshot cố định như store thật (useSyncExternalStore) — mảng mới mỗi lần
// render sẽ làm effect tải dữ liệu chạy lặp.
let mockRegistry: unknown;
jest.mock('../../services/map/mapRegistry', () => ({
  useMapRegistry: () => {
    mockRegistry ??= {
      status: 'ready',
      layers: [mockLayer('bts', 'Trạm BTS'), mockLayer('thua_dat', 'Thửa đất')],
      groups: [],
      reload: jest.fn(),
    };
    return mockRegistry;
  },
}));
jest.mock('../../services/api/dataRecords', () => {
  const actual = jest.requireActual('../../services/api/dataRecords');
  return {
    ...actual,
    fetchDataRecordsPage: (...args: unknown[]) => mockFetchPage(...args),
    fetchAllLayersRecords: (...args: unknown[]) => mockFetchAll(...args),
  };
});
jest.mock('../../services/api/catalogApi', () => ({
  fetchCatalogWards: jest.fn(async () => []),
  shortWardName: (name: string) => name,
}));

import { DataScreen } from './DataScreen';
import { SharedFiltersProvider } from '../../hooks/useSharedFilters';

let renderer!: TestRenderer.ReactTestRenderer;

async function pressText(label: string) {
  const target = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node.findAllByType(Text).some(text => text.props.children === label),
  )[0];
  if (!target) throw new Error(`Không tìm thấy nút "${label}"`);
  await act(async () => {
    target.props.onPress();
  });
}

async function render() {
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <SharedFiltersProvider>
          <DataScreen />
        </SharedFiltersProvider>
      </SafeAreaProvider>,
    );
  });
  // Chờ debounce ô tìm kiếm + effect tải dữ liệu.
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  });
}

describe('DataScreen layer selection', () => {
  beforeEach(() => {
    mockFetchPage.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      unreadableReason: null,
      unsupported: null,
    });
    mockFetchAll.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      unreadableLayerIds: [],
      unsupportedLayerIds: [],
    });
  });

  it('shows the first registry layer by default', async () => {
    await render();

    expect(mockFetchPage).toHaveBeenCalledWith(
      expect.objectContaining({
        layer: expect.objectContaining({ id: 'bts' }),
      }),
    );
    expect(mockFetchAll).not.toHaveBeenCalled();
  });

  it('keeps "all layers" once the user picks it explicitly', async () => {
    await render();

    // Mở ô chọn lớp (đang hiện lớp mặc định) rồi chọn "Tất cả lớp".
    await pressText('Trạm BTS');
    await pressText('Tất cả lớp');

    expect(mockFetchAll).toHaveBeenCalled();
  });
});
