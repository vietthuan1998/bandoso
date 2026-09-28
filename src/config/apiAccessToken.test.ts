jest.mock('../constants/url', () => ({ API_BASE_URL: 'https://dcu.huecity.vn/' }));

import { isApiBaseUrl } from './apiAccessToken';

describe('isApiBaseUrl', () => {
  it('matches the API host and its paths', () => {
    expect(isApiBaseUrl('https://dcu.huecity.vn')).toBe(true);
    expect(isApiBaseUrl('https://dcu.huecity.vn/mvt/12/1/2.mvt?collections=bts')).toBe(true);
    expect(isApiBaseUrl('https://dcu.huecity.vn/items/thua_dat')).toBe(true);
  });

  it('never matches other hosts, including look-alike prefixes', () => {
    expect(isApiBaseUrl('https://dcu.huecity.vn.example.com/items/x')).toBe(false);
    expect(isApiBaseUrl('https://dcudata.cgb.vn/api/v1/statistics/summary')).toBe(false);
    expect(isApiBaseUrl('https://ioc-canhbao.hue.gov.vn/uploadfiles/a.json')).toBe(false);
    expect(isApiBaseUrl(undefined)).toBe(false);
  });
});
