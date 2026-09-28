/**
 * Đơn vị của các trường đo lường (/statistics/{key}/measures). API không trả
 * đơn vị nên client ghi — khai báo tập trung tại đây, không rải trong UI.
 * Trường chưa rõ đơn vị thì không gán (hiển thị số trần).
 */
export const MEASURE_UNITS: Record<string, string> = {
  dien_tich: 'm²',
};
