jest.mock('../../config/apiAccessToken', () => ({
  getStaticApiToken: jest.fn(() => null),
}));

import { getStaticApiToken } from '../../config/apiAccessToken';
import { getTileAuthRules } from './mapTileAuth';

const mockedGetStaticApiToken = getStaticApiToken as jest.Mock;

describe('getTileAuthRules', () => {
  beforeEach(() => {
    mockedGetStaticApiToken.mockReturnValue(null);
  });

  it('does not include a DCU rule without a static token (tiles get 403)', () => {
    const rules = getTileAuthRules();

    expect(rules.find(rule => rule.id === 'dcu-huecity-auth')).toBeUndefined();
  });

  it('uses the static API_ACCESS_TOKEN for DCU tiles', () => {
    mockedGetStaticApiToken.mockReturnValue('static-token');

    const dcuRule = getTileAuthRules().find(rule => rule.id === 'dcu-huecity-auth');

    expect(dcuRule?.headerValue).toBe('Bearer static-token');
  });
});
