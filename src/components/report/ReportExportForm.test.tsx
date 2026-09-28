import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockExportReport = jest.fn();
const mockSave = jest.fn();
const mockOpen = jest.fn();

jest.mock('../../services/report/reportApi', () => {
  const actual = jest.requireActual('../../services/report/reportApi');
  return {
    ...actual,
    exportReport: (...args: unknown[]) => mockExportReport(...args),
  };
});
jest.mock('../../services/report/reportFile', () => {
  const actual = jest.requireActual('../../services/report/reportFile');
  return {
    ...actual,
    saveReportToDevice: (...args: unknown[]) => mockSave(...args),
    openSavedReport: (...args: unknown[]) => mockOpen(...args),
  };
});
jest.mock('../../services/api/catalogApi', () => ({
  fetchCatalogWards: jest.fn(async () => [
    { code: '19858', name: 'Phường Phong Thái', type: 'phuong' },
  ]),
}));

import { AxiosError, AxiosHeaders } from 'axios';
import { ReportExportForm } from './ReportExportForm';

let renderer!: TestRenderer.ReactTestRenderer;
const texts = () =>
  renderer.root
    .findAllByType(Text)
    .map(node => [].concat(node.props.children as never).join(''));

async function press(label: string) {
  const target = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node.findAllByType(Text).some(text => text.props.children === label),
  )[0];
  if (!target) throw new Error(`Không tìm thấy nút "${label}"`);
  await act(async () => {
    await target.props.onPress();
  });
}

const LAYERS = [
  { id: 'thua_dat', label: 'Thửa đất' },
  { id: 'bts', label: 'Trạm BTS' },
];

async function render(
  initial: Partial<
    React.ComponentProps<typeof ReportExportForm>['initial']
  > = {},
) {
  await act(async () => {
    renderer = TestRenderer.create(
      <ReportExportForm
        layers={LAYERS}
        initial={{
          collectionKey: 'thua_dat',
          wardCode: null,
          dateFrom: null,
          dateTo: null,
          ...initial,
        }}
        onClose={jest.fn()}
      />,
    );
  });
}

describe('ReportExportForm', () => {
  beforeEach(() => {
    mockExportReport.mockReset();
    mockSave.mockReset();
    mockOpen.mockReset();
  });

  it('exports with all 6 parameters and hands the file to the device', async () => {
    const file = {
      filename: 'bao-cao.csv',
      mimeType: 'text/csv',
      base64: 'YQ==',
    };
    const saved = {
      filename: 'bao-cao.csv',
      uri: 'content://x',
      mimeType: 'text/csv',
    };
    mockExportReport.mockResolvedValue(file);
    mockSave.mockResolvedValue(saved);
    mockOpen.mockResolvedValue(true);
    await render();

    await press('CSV');
    await press('Theo trạng thái');
    await press('Tất cả phường, xã');
    await press('Phường Phong Thái');
    // Nút gửi nằm cuối form (tiêu đề form cũng là "Xuất báo cáo").
    await press('Xuất báo cáo');

    expect(mockExportReport).toHaveBeenCalledWith({
      format: 'csv',
      report: 'byStatus',
      collections: ['thua_dat'],
      wards: ['19858'],
      dateFrom: null,
      dateTo: null,
    });
    expect(mockSave).toHaveBeenCalledWith(file);
    expect(mockOpen).toHaveBeenCalledWith(saved);
    // Jest chạy như iOS -> vị trí trong app Tệp.
    expect(texts()).toContain(
      'Đã lưu báo cáo vào Tệp › Trên iPhone › HueMaps › bao-cao.csv',
    );
  });

  it('tells apart "not saved" from "saved but no app can open it"', async () => {
    const file = { filename: 'bao-cao.xlsx', mimeType: 'x', base64: 'YQ==' };
    mockExportReport.mockResolvedValue(file);
    const { ReportSaveError } = jest.requireActual(
      '../../services/report/reportFile',
    );
    mockSave.mockRejectedValueOnce(
      new ReportSaveError('saveFailed', new Error('disk')),
    );
    await render();

    await press('Xuất báo cáo');
    expect(texts()).toContain('Không lưu được tệp báo cáo vào máy.');
    expect(mockOpen).not.toHaveBeenCalled();

    mockSave.mockResolvedValueOnce({
      filename: 'bao-cao.xlsx',
      uri: 'u',
      mimeType: 'x',
    });
    mockOpen.mockResolvedValueOnce(false);
    await press('Xuất báo cáo');
    expect(texts()).toContain(
      'Đã lưu vào Tệp › Trên iPhone › HueMaps › bao-cao.xlsx nhưng máy chưa có ứng dụng mở được loại tệp này.',
    );
  });

  it('starts from the statistics filters and lets the user widen the scope to all layers', async () => {
    mockExportReport.mockRejectedValue(new Error('stop'));
    await render({
      collectionKey: 'bts',
      wardCode: '19858',
      dateTo: '2026-09-01',
    });

    const shown = texts();
    expect(shown).toContain('Trạm BTS');
    expect(shown).toContain('Phường Phong Thái');
    expect(shown).toContain('01/09/2026');

    await press('Trạm BTS');
    await press('Tất cả lớp');
    await press('Xuất báo cáo');

    expect(mockExportReport).toHaveBeenCalledWith({
      format: 'xlsx',
      report: 'byWard',
      collections: [],
      wards: ['19858'],
      dateFrom: null,
      dateTo: '2026-09-01',
    });
  });

  it('never offers PDF and explains a missing report.export permission', async () => {
    const config = { headers: new AxiosHeaders() };
    mockExportReport.mockRejectedValue(
      new AxiosError('403', '403', config, null, {
        status: 403,
        statusText: '',
        headers: {},
        config,
        data: {},
      }),
    );
    await render();

    expect(texts()).not.toContain('PDF');
    await press('Xuất báo cáo');

    expect(texts()).toContain('Tài khoản chưa được cấp quyền xuất báo cáo.');
  });
});
