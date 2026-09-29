import { resolveBaseUrl } from './url';

describe('resolveBaseUrl', () => {
  it('accepts an http(s) URL and drops trailing slashes', () => {
    expect(resolveBaseUrl(' https://dcudata.cgb.vn/api/ ')).toBe(
      'https://dcudata.cgb.vn/api',
    );
  });

  it('fails loudly when BASE_URL is missing instead of falling back to a hard-coded domain', () => {
    expect(() => resolveBaseUrl(undefined)).toThrow('Thiếu BASE_URL');
    expect(() => resolveBaseUrl('  ')).toThrow('Thiếu BASE_URL');
  });

  it('rejects values that are not an http(s) URL', () => {
    expect(() => resolveBaseUrl('dcudata.cgb.vn/api')).toThrow('không hợp lệ');
  });
});
