import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Keychain from 'react-native-keychain';

jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    __esModule: true,
    default: { ...actualAxios, post: jest.fn(), isAxiosError: actualAxios.isAxiosError },
  };
});
const mockedAxios = require('axios').default;

import { useAuthGate } from './useAuthGate';

function Probe({ onState }: { onState: (state: ReturnType<typeof useAuthGate>) => void }) {
  const state = useAuthGate();
  onState(state);
  return <Text>{state.status}</Text>;
}

async function renderProbe() {
  let latest: ReturnType<typeof useAuthGate>;
  await act(async () => {
    TestRenderer.create(<Probe onState={s => (latest = s)} />);
  });
  return () => latest;
}

describe('useAuthGate', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.resetGenericPassword({ service: 'huemaps-refresh-token' });
  });

  it('starts as "checking" then resolves to "unauthenticated" when no session is stored', async () => {
    const getLatest = await renderProbe();

    expect(getLatest().status).toBe('unauthenticated');
    expect(getLatest().sessionExpired).toBe(false);
  });

  it('resolves to "authenticated" when a valid refresh token is stored (bootstrapSession succeeds)', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-restored',
          refreshToken: 'refresh-restored',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });

    const getLatest = await renderProbe();

    expect(getLatest().status).toBe('authenticated');
  });

  it('moves to "authenticated" after a successful login() call', async () => {
    const getLatest = await renderProbe();
    expect(getLatest().status).toBe('unauthenticated');

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    await act(async () => {
      await getLatest().login('canbo01', 'matkhau123');
    });

    expect(getLatest().status).toBe('authenticated');
  });

  it('moves to "unauthenticated" with sessionExpired=true when the session expires', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-restored',
          refreshToken: 'refresh-restored',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    const getLatest = await renderProbe();
    expect(getLatest().status).toBe('authenticated');

    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });
    const { refreshAccessToken } = require('../services/auth/authClient');
    await act(async () => {
      await expect(refreshAccessToken()).rejects.toBeTruthy();
    });

    expect(getLatest().status).toBe('unauthenticated');
    expect(getLatest().sessionExpired).toBe(true);
  });

  it('moves to "unauthenticated" after logout()', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-restored',
          refreshToken: 'refresh-restored',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    const getLatest = await renderProbe();
    expect(getLatest().status).toBe('authenticated');

    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    await act(async () => {
      await getLatest().logout();
    });

    expect(getLatest().status).toBe('unauthenticated');
    expect(getLatest().sessionExpired).toBe(false);
  });
});
