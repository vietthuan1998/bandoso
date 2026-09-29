import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../services/api/catalogApi', () => ({
  fetchCatalogWards: jest.fn(async () => [
    { code: '19900', name: 'Phường Thuận An', type: 'phuong' },
    { code: '19858', name: 'Phường Phong Thái', type: 'phuong' },
  ]),
  shortWardName: (name: string) => name.replace(/^(Phường|Xã)\s+/, ''),
}));

import { AccountScreen } from './AccountScreen';
import type { AuthGateState } from '../../hooks/useAuthGate';
import type { UserProfile } from '../../services/auth/authClient';

const FRAME = { x: 0, y: 0, width: 375, height: 812 };
const INSETS = { top: 0, left: 0, right: 0, bottom: 0 };

const PROFILE: UserProfile = {
  id: 'u1',
  username: 'canbo01',
  fullName: 'Nguyễn Văn A',
  unit: 'UBND phường Thuận An',
  roles: ['ward_officer'],
  permissions: ['data.read'],
  wardScope: { type: 'ward', wardIds: ['19900', '19858'] },
  allowedCollections: ['thua_dat', 'bts', 'water_level_station'],
};

let renderer!: TestRenderer.ReactTestRenderer;

async function render(overrides: Partial<AuthGateState>) {
  const auth: AuthGateState = {
    status: 'authenticated',
    sessionExpired: false,
    profile: null,
    login: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
    ...overrides,
  };
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
        <AccountScreen auth={auth} />
      </SafeAreaProvider>,
    );
  });
  return renderer.root
    .findAllByType(Text)
    .map(n => [].concat(n.props.children as never).join(''));
}

describe('AccountScreen', () => {
  it('does not flash the login form while the stored session is being restored', async () => {
    const text = await render({ status: 'checking' });

    expect(text).not.toContain('Tên đăng nhập');
    expect(text).toContain('Đang kiểm tra phiên đăng nhập...');
  });

  it('offers a retry instead of the login form when the session could not be restored offline', async () => {
    const retry = jest.fn();
    const text = await render({ status: 'offline', retry });

    expect(text).not.toContain('Tên đăng nhập');
    expect(text).toContain(
      'Không kết nối được máy chủ để khôi phục phiên đăng nhập.',
    );
    const button = renderer.root.findByProps({
      testID: 'account-retry-session',
    });
    button.props.onPress();
    expect(retry).toHaveBeenCalled();
  });

  it('shows the login form when not authenticated', async () => {
    const text = await render({ status: 'unauthenticated' });
    expect(text).toContain('Tên đăng nhập');
  });

  it('shows the logged-in status and a logout control when the profile is not loaded yet', async () => {
    const logout = jest.fn();
    const text = await render({ logout });

    expect(text).toContain('Bạn đã đăng nhập');
    const button = renderer.root.findByProps({ testID: 'account-logout' });
    button.props.onPress();
    expect(logout).toHaveBeenCalled();
  });

  it('shows the /auth/me profile, assigned wards and the number of visible layers', async () => {
    const text = await render({ profile: PROFILE });

    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain('canbo01');
    expect(text).toContain('UBND phường Thuận An');
    expect(text).toContain('Cán bộ phường xã');
    expect(text).toContain('2 phường/xã');
    expect(text).toContain('Thuận An');
    expect(text).toContain('Phong Thái');
    // allowedCollections.length
    expect(text).toContain('Lớp xem được');
    expect(text).toContain('3 lớp');
  });

  it('shows "—" instead of "0 lớp" while only the provisional login profile is known', async () => {
    const text = await render({
      profile: { ...PROFILE, id: null, allowedCollections: [] },
    });

    expect(text).toContain('Lớp xem được');
    expect(text).toContain('—');
    expect(text).not.toContain('0 lớp');
  });
});
