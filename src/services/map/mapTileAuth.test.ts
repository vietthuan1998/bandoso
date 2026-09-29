jest.mock('../../config/apiAccessToken', () => ({
  getStaticApiToken: jest.fn(() => null),
}));
jest.mock('../auth/authClient', () => ({
  getAccessToken: jest.fn(() => null),
  subscribeToAccessTokenChange: jest.fn(),
}));

import { getStaticApiToken } from '../../config/apiAccessToken';
import { getAccessToken } from '../auth/authClient';
import { setSessionTokenAcceptance } from '../api/directusAuth';
import { getTileAuthRules } from './mapTileAuth';

const mockedGetStaticApiToken = getStaticApiToken as jest.Mock;
const mockedGetAccessToken = getAccessToken as jest.Mock;
const dcuRule = () =>
  getTileAuthRules().find(rule => rule.id === 'dcu-huecity-auth');

describe('getTileAuthRules', () => {
  beforeEach(() => {
    mockedGetStaticApiToken.mockReturnValue(null);
    mockedGetAccessToken.mockReturnValue(null);
    setSessionTokenAcceptance('unknown');
  });

  it('does not include a DCU rule without any token (tiles get 403)', () => {
    expect(dcuRule()).toBeUndefined();
  });

  it('falls back to the static token for guests', () => {
    mockedGetStaticApiToken.mockReturnValue('static-token');
    expect(dcuRule()?.headerValue).toBe('Bearer static-token');
  });

  it('uses the session access token once the host has accepted it', () => {
    mockedGetStaticApiToken.mockReturnValue('static-token');
    mockedGetAccessToken.mockReturnValue('access-session');

    // Chưa biết host có nhận không -> giữ token tĩnh (tile không thử lại được).
    expect(dcuRule()?.headerValue).toBe('Bearer static-token');

    setSessionTokenAcceptance('accepted');
    expect(dcuRule()?.headerValue).toBe('Bearer access-session');

    setSessionTokenAcceptance('rejected');
    expect(dcuRule()?.headerValue).toBe('Bearer static-token');
  });

  it('tries the session token when there is no static fallback at all', () => {
    mockedGetAccessToken.mockReturnValue('access-session');
    expect(dcuRule()?.headerValue).toBe('Bearer access-session');
  });
});
