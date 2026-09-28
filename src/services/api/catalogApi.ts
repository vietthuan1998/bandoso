import axios from 'axios';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';

export type CatalogWard = {
  /** Mã ĐVHC — khoá bất biến, dùng cho ?wards=; không dùng tên làm khoá. */
  code: string;
  name: string;
  type: 'phuong' | 'xa';
};

let wardsRequest: Promise<CatalogWard[]> | null = null;

/** GET /catalog/wards — public, gần như tĩnh: tải một lần mỗi phiên. */
export function fetchCatalogWards(): Promise<CatalogWard[]> {
  if (!wardsRequest) {
    wardsRequest = axios
      .get<{ data: CatalogWard[] }>(`${DCU_API_BASE_URL}/catalog/wards`, {
        timeout: TIMEOUT,
      })
      .then(response =>
        (response.data.data ?? []).map(ward => ({
          code: String(ward.code),
          name: ward.name,
          type: ward.type,
        })),
      )
      .catch(error => {
        wardsRequest = null;
        throw error;
      });
  }
  return wardsRequest;
}
