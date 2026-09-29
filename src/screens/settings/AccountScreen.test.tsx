import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountScreen } from './AccountScreen';
import type { AuthGateState } from '../../hooks/useAuthGate';

const FRAME = { x: 0, y: 0, width: 375, height: 812 };
const INSETS = { top: 0, left: 0, right: 0, bottom: 0 };

function render(auth: AuthGateState) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
        <AccountScreen auth={auth} />
      </SafeAreaProvider>,
    );
  });
  return renderer!;
}

describe('AccountScreen', () => {
  it('shows the login form when not authenticated', () => {
    const renderer = render({
      status: 'unauthenticated',
      sessionExpired: false,
      profile: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const text = renderer.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .flat();
    expect(text).toContain('Tên đăng nhập');
  });

  it('shows the logged-in status and a logout control when authenticated', () => {
    const logout = jest.fn();
    const renderer = render({
      status: 'authenticated',
      sessionExpired: false,
      profile: null,
      login: jest.fn(),
      logout,
    });

    const text = renderer.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .flat();
    expect(text).toContain('Bạn đã đăng nhập');

    const button = renderer.root.findByProps({ testID: 'account-logout' });
    button.props.onPress();
    expect(logout).toHaveBeenCalled();
  });

  it('shows the /auth/me profile and the data scope', () => {
    const renderer = render({
      status: 'authenticated',
      sessionExpired: false,
      profile: {
        id: 'u1',
        username: 'canbo01',
        fullName: 'Nguyễn Văn A',
        unit: 'UBND phường Thuận An',
        roles: ['ward_officer'],
        permissions: ['data.read'],
        wardScope: { type: 'ward', wardIds: ['19900', '19858'] },
        allowedCollections: [],
      },
      login: jest.fn(),
      logout: jest.fn(),
    });

    const text = renderer.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .flat();
    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain('UBND phường Thuận An');
    expect(text).toContain('Cán bộ phường xã');
    expect(text).toContain('2 phường/xã');
  });
});
