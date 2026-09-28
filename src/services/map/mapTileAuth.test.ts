jest.mock('../auth/authClient', () => ({
  getAccessToken: jest.fn(),
}));
jest.mock('../../config/apiAccessToken', () => ({
  getStaticApiToken: jest.fn(() => null),
}));

import { getStaticApiToken } from '../../config/apiAccessToken';
import { getAccessToken } from '../auth/authClient';
import { getTileAuthRules } from './mapTileAuth';

const mockedGetAccessToken = getAccessToken as jest.Mock;
const mockedGetStaticApiToken = getStaticApiToken as jest.Mock;

describe('getTileAuthRules', () => {
  beforeEach(() => {
    mockedGetStaticApiToken.mockReturnValue(null);
  });

  it('does not include a DCU rule when there is neither a session nor a static token (tiles get 403)', () => {
    mockedGetAccessToken.mockReturnValue(null);

    const rules = getTileAuthRules();

    expect(rules.find(rule => rule.id === 'dcu-huecity-auth')).toBeUndefined();
  });

  it('uses the static API_ACCESS_TOKEN for tiles when not logged in (guest map, no more 403)', () => {
    mockedGetAccessToken.mockReturnValue(null);
    mockedGetStaticApiToken.mockReturnValue('static-token');

    const dcuRule = getTileAuthRules().find(rule => rule.id === 'dcu-huecity-auth');

    expect(dcuRule?.headerValue).toBe('Bearer static-token');
  });

  it('prefers the session token over the static token once logged in', () => {
    mockedGetAccessToken.mockReturnValue('access-session');
    mockedGetStaticApiToken.mockReturnValue('static-token');

    const dcuRule = getTileAuthRules().find(rule => rule.id === 'dcu-huecity-auth');

    expect(dcuRule?.headerValue).toBe('Bearer access-session');
  });

  it('includes a DCU rule with the current access token as a Bearer header', () => {
    mockedGetAccessToken.mockReturnValue('access-123');

    const rules = getTileAuthRules();

    const dcuRule = rules.find(rule => rule.id === 'dcu-huecity-auth');
    expect(dcuRule?.headerValue).toBe('Bearer access-123');
  });

  it('reflects a refreshed access token on the next call (no stale static value)', () => {
    mockedGetAccessToken.mockReturnValue('access-old');
    const first = getTileAuthRules().find(r => r.id === 'dcu-huecity-auth');
    expect(first?.headerValue).toBe('Bearer access-old');

    mockedGetAccessToken.mockReturnValue('access-refreshed');
    const second = getTileAuthRules().find(r => r.id === 'dcu-huecity-auth');
    expect(second?.headerValue).toBe('Bearer access-refreshed');
  });
});
