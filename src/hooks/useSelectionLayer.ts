import { useCallback, useRef } from 'react';

type Visibility = Record<string, boolean>;
type SetVisibility = (update: (current: Visibility) => Visibility) => void;

/**
 * Lớp MVT tạm bật để xem một đối tượng được chọn từ tìm kiếm hoặc "Định vị
 * trên bản đồ": đóng panel chi tiết thì trả lớp về trạng thái trước đó.
 * - Lớp đang tắt -> bật và ghi nhớ; đóng panel -> tắt lại.
 * - Lớp đã bật sẵn -> không ghi nhớ; đóng panel vẫn giữ.
 * - Người dùng tự bật/tắt lớp đó trong menu -> bỏ ghi nhớ (họ đã chủ động).
 * - Chọn tiếp đối tượng ở lớp khác -> lớp tạm bật trước đó được tắt lại.
 */
export function useSelectionLayer(
  visible: Visibility,
  setVisible: SetVisibility,
) {
  const tempLayerRef = useRef<string | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const hide = useCallback(
    (id: string) => setVisible(current => ({ ...current, [id]: false })),
    [setVisible],
  );

  /** Bật lớp để hiển thị đối tượng vừa chọn. */
  const showForSelection = useCallback(
    (id: string) => {
      const previous = tempLayerRef.current;
      if (previous && previous !== id) {
        tempLayerRef.current = null;
        hide(previous);
      }
      if (!visibleRef.current[id]) tempLayerRef.current = id;
      setVisible(current => ({ ...current, [id]: true }));
    },
    [hide, setVisible],
  );

  /** Panel chi tiết đóng -> tắt lại lớp đã tạm bật (nếu có). */
  const releaseSelection = useCallback(() => {
    const temp = tempLayerRef.current;
    if (!temp) return;
    tempLayerRef.current = null;
    hide(temp);
  }, [hide]);

  /** Người dùng tự bật/tắt lớp trong menu. */
  const noteUserToggle = useCallback((id: string) => {
    if (tempLayerRef.current === id) tempLayerRef.current = null;
  }, []);

  return { showForSelection, releaseSelection, noteUserToggle };
}
