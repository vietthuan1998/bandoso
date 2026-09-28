import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthError } from '../../services/auth/authClient';
import { LoginScreen } from './LoginScreen';

const TEST_SAFE_AREA_FRAME = { x: 0, y: 0, width: 375, height: 812 };
const TEST_SAFE_AREA_INSETS = { top: 0, left: 0, right: 0, bottom: 0 };

function renderLogin(props: Partial<React.ComponentProps<typeof LoginScreen>> = {}) {
  const onSubmit = props.onSubmit ?? jest.fn().mockResolvedValue(undefined);
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: TEST_SAFE_AREA_FRAME,
          insets: TEST_SAFE_AREA_INSETS,
        }}
      >
        <LoginScreen onSubmit={onSubmit} sessionExpired={props.sessionExpired} />
      </SafeAreaProvider>,
    );
  });
  return { renderer: renderer!, onSubmit };
}

function allText(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(Boolean)
    .join(' | ');
}

describe('LoginScreen', () => {
  it('renders fixed username/password labels (not placeholder-only)', () => {
    const { renderer } = renderLogin();

    const text = allText(renderer);
    expect(text).toContain('Tên đăng nhập');
    expect(text).toContain('Mật khẩu');
  });

  it('does not show the session-expired banner by default', () => {
    const { renderer } = renderLogin();

    expect(allText(renderer)).not.toContain('Phiên làm việc đã hết hạn');
  });

  it('shows the session-expired banner when sessionExpired is true', () => {
    const { renderer } = renderLogin({ sessionExpired: true });

    expect(allText(renderer)).toContain(
      'Phiên làm việc đã hết hạn, vui lòng đăng nhập lại',
    );
  });

  it('calls onSubmit with the entered username and password', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { renderer } = renderLogin({ onSubmit });

    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
      inputs[0].props.onChangeText('canbo01');
      inputs[1].props.onChangeText('matkhau123');
    });
    const button = renderer.root.findByProps({ testID: 'login-submit' });
    await act(async () => {
      await button.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith('canbo01', 'matkhau123');
  });

  it('shows "sai tên đăng nhập hoặc mật khẩu" on invalid_credentials error', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValue(new AuthError('invalid_credentials'));
    const { renderer } = renderLogin({ onSubmit });

    const button = renderer.root.findByProps({ testID: 'login-submit' });
    await act(async () => {
      await button.props.onPress();
    });

    expect(allText(renderer)).toContain('Sai tên đăng nhập hoặc mật khẩu');
  });

  it('shows a distinct network-error message and a retry affordance on network error', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new AuthError('network'));
    const { renderer } = renderLogin({ onSubmit });

    const button = renderer.root.findByProps({ testID: 'login-submit' });
    await act(async () => {
      await button.props.onPress();
    });

    expect(allText(renderer)).toContain(
      'Không kết nối được máy chủ, thử lại',
    );
  });

  it('disables the submit button while a login request is in flight', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = jest.fn().mockReturnValue(
      new Promise<void>(resolve => {
        resolveSubmit = resolve;
      }),
    );
    const { renderer } = renderLogin({ onSubmit });

    const button = renderer.root.findByProps({ testID: 'login-submit' });
    act(() => {
      button.props.onPress();
    });

    const buttonAfterPress = renderer.root.findByProps({
      testID: 'login-submit',
    });
    expect(buttonAfterPress.props.disabled).toBe(true);

    await act(async () => {
      resolveSubmit();
    });
  });
});
