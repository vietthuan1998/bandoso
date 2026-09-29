import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockRegistry = {
  status: 'ready',
  groups: [],
  layers: [
    {
      id: 'water_level_station',
      collection: 'water_level_station',
      sourceLayer: 'water_level_station',
      tileUrl: 'https://bff.test/api/directus/mvt/{z}/{x}/{y}.mvt',
      label: 'Trạm đo mực nước',
      groupKey: 'iot',
      geometryTypes: ['point'],
      color: '#0f9b8e',
      icon: 'waterLevel',
      capabilities: {
        list: true,
        detail: true,
        search: true,
        statistics: true,
      },
    },
  ],
};
jest.mock('../../services/map/mapRegistry', () => ({
  useMapRegistry: () => mockRegistry,
  getRegistryVersion: async () => null,
}));

import { Layer } from '@maplibre/maplibre-react-native';
import { MapCanvas } from './MapCanvas';
import { mvtCircleLayerId } from '../../services/map/mvtLayers';

/**
 * Mô phỏng cách MapLibre xếp lớp khi các lớp được thêm theo thứ tự cây:
 * afterId -> ngay trên mốc, beforeId -> ngay dưới mốc, không có -> trên cùng.
 */
function styleStack(
  layers: Array<{ id: string; afterId?: string; beforeId?: string }>,
) {
  const stack: string[] = [];
  for (const layer of layers) {
    if (layer.afterId && stack.includes(layer.afterId)) {
      stack.splice(stack.indexOf(layer.afterId) + 1, 0, layer.id);
    } else if (layer.beforeId && stack.includes(layer.beforeId)) {
      stack.splice(stack.indexOf(layer.beforeId), 0, layer.id);
    } else {
      stack.push(layer.id);
    }
  }
  return stack;
}

it('draws the selected-feature highlight above the MVT point layer (no double circle)', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <MapCanvas
        cameraRef={{ current: null }}
        language="vi"
        wardData={null}
        hiddenWardIds={new Set()}
        selectedWardId={null}
        cityVisible
        onWardPress={() => {}}
        onCityPress={() => {}}
        mvtLayersVisible={{ water_level_station: true }}
        onMvtFeaturePress={() => {}}
        highlightFeature={{
          geometry: { type: 'Point', coordinates: [107.52, 16.56] },
          color: '#0f9b8e',
        }}
        onBearingChange={() => {}}
        topInset={0}
        showUserLocation={false}
      />,
    );
  });

  // Cả lớp MVT và lớp tô nổi bật được thêm trong cùng một lượt render.
  const stack = styleStack(
    renderer.root
      .findAllByType(Layer)
      .map(
        node =>
          node.props as { id: string; afterId?: string; beforeId?: string },
      ),
  );
  const pointLayer = stack.indexOf(mvtCircleLayerId('water_level_station'));
  const highlight = stack.indexOf('feature-highlight-circle');

  expect(pointLayer).toBeGreaterThan(-1);
  expect(highlight).toBeGreaterThan(pointLayer);
});
