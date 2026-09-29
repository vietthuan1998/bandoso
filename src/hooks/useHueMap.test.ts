jest.mock('../services/api/catalogApi', () => ({
  fetchWardBoundaries: jest.fn(),
}));

import { normalizeWard, toWardFeatureCollection } from './useHueMap';

const SQUARE = {
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [107.5, 16.4],
        [107.6, 16.4],
        [107.6, 16.5],
        [107.5, 16.4],
      ],
    ],
  ],
};

describe('toWardFeatureCollection (/catalog/wards/geojson)', () => {
  it('keys wards by administrative code and maps BFF fields onto the ward panel fields', () => {
    const collection = toWardFeatureCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '20179',
          geometry: SQUARE,
          properties: {
            code: '20179',
            name: 'Xã Nam Đông',
            type: 'xa',
            areaKm2: 175.95,
            color: null,
            population: 12345,
            geographicPosition: null,
            officeAddress: 'Thôn 1',
          },
        },
      ],
    });

    const feature = collection.features[0];
    expect(feature.id).toBe('20179');
    expect(feature.properties.publicWardId).toBe('20179');
    // Chưa có color từ server -> vẫn có màu nền.
    expect(feature.properties.publicFillColor).toMatch(/^#/);

    const ward = normalizeWard(feature.properties);
    expect(ward).toMatchObject({
      code: '20179',
      name: 'Xã Nam Đông',
      type: 'Xã',
      area: 175.95,
      population: '12345',
      committeeAddress: 'Thôn 1',
      geographicDescription: '',
    });
  });

  it('uses the server colour when the catalog provides one', () => {
    const collection = toWardFeatureCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '19900',
          geometry: SQUARE,
          properties: {
            code: '19900',
            name: 'Phường Thuận An',
            type: 'phuong',
            areaKm2: 20,
            color: '#123456',
          },
        },
      ],
    });
    expect(collection.features[0].properties.publicFillColor).toBe('#123456');
  });
});
