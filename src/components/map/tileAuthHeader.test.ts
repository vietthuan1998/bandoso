jest.mock('../../services/map/mapTileAuth', () => ({
  getTileAuthRules: jest.fn(),
  TILE_AUTH_RULE_IDS: ['map-huecity-tile-auth', 'dcu-huecity-auth'],
}));

import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import { getTileAuthRules } from '../../services/map/mapTileAuth';
import { ensureTileAuthHeader } from './MapCanvas';

describe('ensureTileAuthHeader', () => {
  it('removes the DCU header when no token is left (logout without a static token)', () => {
    const addHeader = jest.spyOn(TransformRequestManager, 'addHeader');
    const removeHeader = jest.spyOn(TransformRequestManager, 'removeHeader');
    (getTileAuthRules as jest.Mock).mockReturnValue([
      {
        id: 'map-huecity-tile-auth',
        hostPattern: 'map\\.huecity\\.vn:8280',
        headerName: 'Authorization',
        headerValue: 'Basic abc',
      },
    ]);

    ensureTileAuthHeader();

    expect(addHeader).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'map-huecity-tile-auth' }),
    );
    expect(removeHeader).toHaveBeenCalledWith('dcu-huecity-auth');
    expect(removeHeader).not.toHaveBeenCalledWith('map-huecity-tile-auth');
  });
});
