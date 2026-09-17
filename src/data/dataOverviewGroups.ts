import type { OverviewGroupConfig } from '../map/dataOverview';

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
