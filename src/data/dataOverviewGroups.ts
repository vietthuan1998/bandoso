import type { OverviewGroupConfig } from '../map/dataOverview';

/**
 * Dữ liệu cứng cách nhóm 15 collection MVT thành 9 dòng cho panel "Tổng quan
 * dữ liệu" — tách khỏi src/map/dataOverview.ts (nơi vẫn giữ type và logic
 * gọi API đếm số bản ghi).
 *
 * Gộp hiện trạng + định hướng theo đúng chủ đề khi cả hai tồn tại (thửa đất,
 * khu công nghiệp, khu xử lý chất thải, nghĩa trang, cơ sở KHCN); các
 * collection lẻ (không có cặp hiện trạng/định hướng) đứng riêng một dòng.
 * Khớp với ảnh mẫu "Tổng quan dữ liệu" thực tế bên vận hành cung cấp (đã đối
 * chiếu số liệu API thật trùng khớp: Khu công nghiệp 6+8=14, Khu xử lý chất
 * thải 7+8=15, Nghĩa trang 44+48=92, Trạm quan trắc 55+17+4=76 — KHÔNG gồm
 * trạm BTS, vì trambts là hạ tầng viễn thông, không phải trạm quan trắc môi
 * trường, nên tách dòng riêng).
 */
export const DATA_OVERVIEW_GROUPS: OverviewGroupConfig[] = [
  {
    id: 'land-parcel',
    labelKey: 'dataOverview.groups.landParcel',
    icon: 'landParcel',
    layerIds: ['thua-dat'],
  },
  {
    id: 'industrial-zone',
    labelKey: 'dataOverview.groups.industrialZone',
    icon: 'factory',
    layerIds: ['khu-cong-nghiep-hien-trang', 'khu-cong-nghiep-dinh-huong'],
  },
  {
    id: 'waste-treatment',
    labelKey: 'dataOverview.groups.wasteTreatment',
    icon: 'recycle',
    layerIds: ['xu-ly-chat-thai-hien-trang', 'xu-ly-chat-thai-dinh-huong'],
  },
  {
    id: 'cemetery',
    labelKey: 'dataOverview.groups.cemetery',
    icon: 'cemetery',
    layerIds: ['nghia-trang-hien-trang', 'nghia-trang-dinh-huong'],
  },
  {
    id: 'high-tech-zone',
    labelKey: 'dataOverview.groups.highTechZone',
    icon: 'microscope',
    layerIds: ['cong-nghe-cao-dinh-huong'],
  },
  {
    id: 'science-tech-facility',
    labelKey: 'dataOverview.groups.scienceTechFacility',
    icon: 'testTube',
    layerIds: ['co-so-khcn-dinh-huong', 'co-so-khcn-hien-trang'],
  },
  {
    id: 'underground-planning',
    labelKey: 'dataOverview.groups.undergroundPlanning',
    icon: 'crane',
    layerIds: ['cong-trinh-ngam-a'],
  },
  {
    id: 'bts-station',
    labelKey: 'dataOverview.groups.btsStation',
    icon: 'antenna',
    layerIds: ['tram-bts'],
  },
  {
    id: 'monitoring-station',
    labelKey: 'dataOverview.groups.monitoringStation',
    icon: 'satellite',
    layerIds: [
      'rain-water-stations',
      'water-level-station',
      'iot-wind-station',
    ],
  },
];
