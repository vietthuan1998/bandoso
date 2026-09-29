import {
  INFO_CARD_MAX_HEIGHT_RATIO,
  boundsCenter,
  isTinyBounds,
  panelAwarePadding,
} from './cameraFraming';

describe('panelAwarePadding', () => {
  it('reserves the whole panel height at the bottom so the target sits above it', () => {
    const padding = panelAwarePadding(800, 44);

    expect(padding.top).toBe(44 + 90);
    // Panel cao tối đa 58% vùng bản đồ (464px) + khoảng hở.
    expect(padding.bottom).toBeGreaterThanOrEqual(
      800 * INFO_CARD_MAX_HEIGHT_RATIO,
    );
    // Đối tượng luôn nằm trong phần còn nhìn thấy.
    expect(padding.top + padding.bottom).toBeLessThan(800);
  });

  it('keeps some visible map on short screens', () => {
    const padding = panelAwarePadding(400, 44);
    expect(400 - padding.top - padding.bottom).toBeGreaterThanOrEqual(120);
  });

  it('never returns a negative padding before the map is laid out', () => {
    expect(panelAwarePadding(0, 44).bottom).toBe(0);
  });
});

describe('isTinyBounds', () => {
  it('treats a point (zero-size box) and a very small area as a point', () => {
    expect(isTinyBounds([107.57, 16.46, 107.57, 16.46])).toBe(true);
    expect(isTinyBounds([107.57, 16.46, 107.5701, 16.4601])).toBe(true);
  });

  it('frames larger areas with fitBounds', () => {
    expect(isTinyBounds([107.55, 16.45, 107.59, 16.49])).toBe(false);
  });

  it('centres on the middle of the box', () => {
    expect(boundsCenter([107.5, 16.4, 107.7, 16.6])).toEqual([107.6, 16.5]);
  });
});
