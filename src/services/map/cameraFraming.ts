/**
 * Căn camera khi chọn đối tượng sao cho panel chi tiết (InfoCard, neo đáy
 * màn hình) không che đối tượng: phần đáy bị panel chiếm được coi là padding,
 * nên đối tượng nằm giữa phần bản đồ còn nhìn thấy — tức là lệch lên trên.
 */

/** Chiều cao tối đa của InfoCard so với vùng bản đồ (khớp style maxHeight). */
export const INFO_CARD_MAX_HEIGHT_RATIO = 0.58;

/** Zoom khi bay tới một điểm hoặc vùng quá nhỏ để khung vừa. */
export const POINT_FOCUS_ZOOM = 17;

/** Khoảng chừa phía trên cho header + nút nổi. */
const TOP_CHROME = 90;
/** Khoảng hở giữa đối tượng và mép panel. */
const PANEL_GAP = 24;
/** Chiều cao tối thiểu của phần bản đồ còn lại để đặt đối tượng. */
const MIN_VISIBLE = 120;
const SIDE = 48;

export type ViewPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export const NO_PADDING: ViewPadding = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Padding cho camera khi panel chi tiết có thể mở: đáy = chiều cao tối đa
 * của panel (chưa biết panel cao bao nhiêu trước khi dữ liệu về).
 */
export function panelAwarePadding(
  mapHeight: number,
  topInset: number,
): ViewPadding {
  const top = topInset + TOP_CHROME;
  const wanted = Math.round(mapHeight * INFO_CARD_MAX_HEIGHT_RATIO) + PANEL_GAP;
  // Màn hình thấp: vẫn chừa tối thiểu MIN_VISIBLE để đặt đối tượng.
  const bottom = Math.max(0, Math.min(wanted, mapHeight - top - MIN_VISIBLE));
  return { top, bottom, left: SIDE, right: SIDE };
}

/** ~50 m: nhỏ hơn thì coi như một điểm (fitBounds sẽ phóng tới zoom tối đa). */
const TINY_DEGREES = 0.0005;

export function isTinyBounds(
  bounds: [number, number, number, number],
): boolean {
  const [minX, minY, maxX, maxY] = bounds;
  return maxX - minX < TINY_DEGREES && maxY - minY < TINY_DEGREES;
}

export function boundsCenter(
  bounds: [number, number, number, number],
): [number, number] {
  const [minX, minY, maxX, maxY] = bounds;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}
