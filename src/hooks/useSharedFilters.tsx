import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Bộ lọc dùng chung cho màn Dữ liệu và Thống kê (tài liệu mục 11: danh sách
 * và thống kê dùng chung collections, wards, khoảng thời gian; chuyển tab
 * không được reset). Sống ở AppShell nên không mất khi màn hình unmount.
 */
export type SharedFilters = {
  /** collectionKey; rỗng = tất cả lớp. Hiện UI chọn tối đa một lớp. */
  collections: string[];
  /** Mã ĐVHC; rỗng = mọi phường xã. */
  wards: string[];
  /** yyyy-mm-dd; null = không giới hạn. */
  dateFrom: string | null;
  dateTo: string | null;
  /** Từ khoá ô tìm kiếm màn Dữ liệu. */
  search: string;
  /**
   * Màn Dữ liệu: người dùng đã chủ động chọn "Tất cả lớp". Khi false và chưa
   * chọn lớp nào, màn Dữ liệu mặc định hiển thị lớp đầu tiên của registry
   * (màn Thống kê vẫn hiểu collections rỗng là tất cả lớp).
   */
  dataAllLayers: boolean;
};

export const EMPTY_FILTERS: SharedFilters = {
  collections: [],
  wards: [],
  dateFrom: null,
  dateTo: null,
  search: '',
  dataAllLayers: false,
};

type SharedFiltersContextValue = {
  filters: SharedFilters;
  updateFilters: (patch: Partial<SharedFilters>) => void;
};

const SharedFiltersContext = createContext<SharedFiltersContextValue | null>(
  null,
);

export function SharedFiltersProvider({
  children,
  initial = EMPTY_FILTERS,
}: {
  children: ReactNode;
  initial?: SharedFilters;
}) {
  const [filters, setFilters] = useState<SharedFilters>(initial);
  const updateFilters = useCallback(
    (patch: Partial<SharedFilters>) =>
      setFilters(current => ({ ...current, ...patch })),
    [],
  );
  const value = useMemo(
    () => ({ filters, updateFilters }),
    [filters, updateFilters],
  );
  return (
    <SharedFiltersContext.Provider value={value}>
      {children}
    </SharedFiltersContext.Provider>
  );
}

/**
 * Không có Provider (vd. render riêng một màn trong test) -> dùng state cục
 * bộ, hành vi như trước.
 */
export function useSharedFilters(): SharedFiltersContextValue {
  const context = useContext(SharedFiltersContext);
  const [localFilters, setLocalFilters] =
    useState<SharedFilters>(EMPTY_FILTERS);
  const updateLocal = useCallback(
    (patch: Partial<SharedFilters>) =>
      setLocalFilters(current => ({ ...current, ...patch })),
    [],
  );
  const local = useMemo(
    () => ({ filters: localFilters, updateFilters: updateLocal }),
    [localFilters, updateLocal],
  );
  return context ?? local;
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value];
}
