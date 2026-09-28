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
});
