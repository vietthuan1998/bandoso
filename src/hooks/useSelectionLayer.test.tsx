import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useSelectionLayer } from './useSelectionLayer';

type Api = ReturnType<typeof useSelectionLayer> & {
  visible: Record<string, boolean>;
  userToggle: (id: string, value: boolean) => void;
};

function Probe({
  initial,
  onApi,
}: {
  initial: Record<string, boolean>;
  onApi: (api: Api) => void;
}) {
  const [visible, setVisible] = useState(initial);
  const api = useSelectionLayer(visible, setVisible);
  onApi({
    ...api,
    visible,
    // Như toggleMvtLayer của màn bản đồ (bật/tắt từ menu).
    userToggle: (id, value) => {
      api.noteUserToggle(id);
      setVisible(current => ({ ...current, [id]: value }));
    },
  });
  return null;
}

function setup(initial: Record<string, boolean> = {}) {
  let latest!: Api;
  act(() => {
    TestRenderer.create(
      <Probe initial={initial} onApi={api => (latest = api)} />,
    );
  });
  return () => latest;
}

describe('useSelectionLayer', () => {
  it('turns a layer that was off back off when the detail panel closes', () => {
    const api = setup({ bts: false });

    act(() => api().showForSelection('bts'));
    expect(api().visible.bts).toBe(true);

    act(() => api().releaseSelection());
    expect(api().visible.bts).toBe(false);
  });

  it('leaves a layer the user had already turned on', () => {
    const api = setup({ bts: true });

    act(() => api().showForSelection('bts'));
    act(() => api().releaseSelection());

    expect(api().visible.bts).toBe(true);
  });

  it('keeps the layer once the user toggles it in the menu', () => {
    const api = setup({ bts: false });

    act(() => api().showForSelection('bts'));
    act(() => api().userToggle('bts', true));
    act(() => api().releaseSelection());

    expect(api().visible.bts).toBe(true);
  });

  it('turns the previous temporary layer off when a feature of another layer is selected', () => {
    const api = setup({ bts: false, thua_dat: false });

    act(() => api().showForSelection('bts'));
    act(() => api().showForSelection('thua_dat'));
    expect(api().visible).toEqual({ bts: false, thua_dat: true });

    act(() => api().releaseSelection());
    expect(api().visible).toEqual({ bts: false, thua_dat: false });
  });
});
